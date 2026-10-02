"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { Tenant } from "@/lib/db/models/tenant.model";
import {
  verifyRolePinSchema,
  changeRolePinsSchema,
  resetPinOtpSchema,
} from "@/lib/validations/auth";
import {
  checkRolePinRateLimit,
  recordFailedRolePin,
  resetRolePinRateLimit,
} from "@/lib/auth/rate-limiter";
import {
  setRoleSessionCookie,
  clearRoleSessionCookie,
  getRoleSession,
} from "@/lib/auth/role-session";
import { sendForgotPinOtpEmail } from "@/lib/email/email-service";
import { triggerTenantEvent } from "@/lib/realtime/pusher-server";

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.length > 2 ? `${user.slice(0, 2)}***` : `${user[0]}***`;
  return `${visible}@${domain}`;
}

/**
 * Verifies the 6-digit Role Code (Owner vs Staff PIN) for the counter.
 * Evicts any existing active session of the same role on other devices.
 */
export async function verifyRolePinAction(rawPin: unknown): Promise<{
  success: boolean;
  role?: "owner" | "staff";
  activeSessionId?: string;
  error?: string;
  retryAfterSeconds?: number;
}> {
  try {
    const parsed = verifyRolePinSchema.safeParse({ pin: rawPin });
    if (!parsed.success) {
      return {
        success: false,
        error: "Please enter a valid 6-digit numeric PIN.",
      };
    }

    const ip = await getClientIp();
    const rateCheck = checkRolePinRateLimit(ip);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many failed attempts. Keypad is locked for ${Math.ceil(
          rateCheck.retryAfterSeconds / 60
        )} minute(s).`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Your shop counter session has expired. Please sign in again.",
      };
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id)
      .select("ownerPinHash staffPinHash tenantId")
      .lean();
    if (!user) {
      return { success: false, error: "Salon account not found." };
    }

    const pin = parsed.data.pin;

    // Check Owner PIN and Staff PIN concurrently
    const [isOwner, isStaff] = await Promise.all([
      user.ownerPinHash ? bcrypt.compare(pin, user.ownerPinHash) : false,
      user.staffPinHash ? bcrypt.compare(pin, user.staffPinHash) : false,
    ]);

    const resolvedRole: "owner" | "staff" | null = isOwner
      ? "owner"
      : isStaff
      ? "staff"
      : null;

    if (!resolvedRole) {
      const fail = recordFailedRolePin(ip);
      const remainingMsg =
        fail.remainingAttempts > 0
          ? ` (${fail.remainingAttempts} attempt(s) remaining)`
          : "";
      return {
        success: false,
        error: `Incorrect Role PIN. Please check with your salon owner.${remainingMsg}`,
        retryAfterSeconds: fail.retryAfterSeconds,
      };
    }

    // Success -> reset rate limiter
    resetRolePinRateLimit(ip);

    // Concurrency control: Generate new activeSessionId for this role to displace old sessions
    const activeSessionId = crypto.randomUUID();
    const updateField =
      resolvedRole === "owner"
        ? { ownerActiveSessionId: activeSessionId, lastRoleLoginAt: new Date() }
        : { staffActiveSessionId: activeSessionId, lastRoleLoginAt: new Date() };

    // Parallelize DB update and cookie setting
    await Promise.all([
      User.updateOne({ _id: user._id }, { $set: updateField }),
      setRoleSessionCookie({
        tenantId: user.tenantId.toString(),
        userId: user._id.toString(),
        role: resolvedRole,
        activeSessionId,
      }),
    ]);

    // Broadcast instant displacement event to other devices asynchronously without blocking response
    triggerTenantEvent({
      tenantId: user.tenantId.toString(),
      event: "role_session_displaced",
      data: {
        role: resolvedRole,
        newSessionId: activeSessionId,
      },
    }).catch((err) =>
      console.error("[AuthAction] Pusher eviction broadcast error:", err)
    );

    return { success: true, role: resolvedRole, activeSessionId };
  } catch (error) {
    console.error("[AuthAction] verifyRolePinAction error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while verifying your PIN.",
    };
  }
}

/**
 * Locks the current role session back to the keypad modal without logging out the shop account.
 */
export async function lockRoleSessionAction(): Promise<{ success: boolean }> {
  try {
    await clearRoleSessionCookie();
    return { success: true };
  } catch (error) {
    console.error("[AuthAction] lockRoleSessionAction error:", error);
    return { success: false };
  }
}

/**
 * Changes the Owner PIN and/or Staff PIN.
 * Owner-only action requiring the shop email password for verification.
 */
export async function changeRolePinsAction(rawInput: unknown): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const roleSession = await getRoleSession();
    if (roleSession.role !== "owner") {
      return {
        success: false,
        error: "Permission denied. Only the salon owner can change role PINs.",
      };
    }

    const parsed = changeRolePinsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Invalid input";
      return { success: false, error: firstErr };
    }

    const { emailPassword, newOwnerPin, newStaffPin } = parsed.data;

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return { success: false, error: "Salon account not found." };
    }

    // Verify email password strictly from DB
    if (!user.passwordHash) {
      return {
        success: false,
        error: "No password configured for this account in the database.",
      };
    }

    const isPasswordCorrect = await bcrypt.compare(emailPassword, user.passwordHash);
    if (!isPasswordCorrect) {
      return {
        success: false,
        error: "Incorrect shop email password. PIN changes were not saved.",
      };
    }

    const updates: Record<string, unknown> = {};
    if (newOwnerPin) {
      updates.ownerPinHash = await bcrypt.hash(newOwnerPin, 10);
    }
    if (newStaffPin) {
      updates.staffPinHash = await bcrypt.hash(newStaffPin, 10);
    }

    await User.updateOne({ _id: user._id }, { $set: updates });

    // Also update Tenant if pins are mirrored there
    const tenantUpdates: Record<string, unknown> = {};
    if (newOwnerPin) tenantUpdates.ownerPinHash = updates.ownerPinHash;
    if (newStaffPin) tenantUpdates.staffPinHash = updates.staffPinHash;
    await Tenant.updateOne({ _id: user.tenantId }, { $set: tenantUpdates });

    return { success: true, message: "Role PINs updated successfully." };
  } catch (error) {
    console.error("[AuthAction] changeRolePinsAction error:", error);
    return {
      success: false,
      error: "Failed to update role PINs. Please try again.",
    };
  }
}

/**
 * Dispatches a 6-digit verification code to the registered owner email
 * to reset forgotten Role PINs.
 */
export async function requestForgotPinOtpAction(): Promise<{
  success: boolean;
  maskedEmail?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Shop account session expired. Please sign in with email and password first.",
      };
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    const tenant = user ? await Tenant.findById(user.tenantId) : null;

    if (!user || !tenant) {
      return { success: false, error: "Salon account details not found." };
    }

    // Generate 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const resetOtpHash = await bcrypt.hash(otp, 10);
    const resetOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await User.updateOne(
      { _id: user._id },
      { $set: { resetOtpHash, resetOtpExpiresAt } }
    );

    // Send professional minimalist email
    await sendForgotPinOtpEmail({
      to: user.ownerEmail,
      salonName: tenant.name || "Salon",
      otp,
      expiresInMinutes: 15,
    });

    return {
      success: true,
      maskedEmail: maskEmail(user.ownerEmail),
    };
  } catch (error) {
    console.error("[AuthAction] requestForgotPinOtpAction error:", error);
    return {
      success: false,
      error: "Unable to send verification code. Please check SMTP settings or try again.",
    };
  }
}

/**
 * Verifies the 6-digit email OTP and sets new Owner and Staff PINs immediately.
 */
export async function verifyOtpAndResetPinsAction(rawInput: unknown): Promise<{
  success: boolean;
  role?: "owner";
  activeSessionId?: string;
  error?: string;
}> {
  try {
    const parsed = resetPinOtpSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Invalid input";
      return { success: false, error: firstErr };
    }

    const { otp, newOwnerPin, newStaffPin } = parsed.data;

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return { success: false, error: "Salon account not found." };
    }

    if (!user.resetOtpHash || !user.resetOtpExpiresAt) {
      return {
        success: false,
        error: "No active reset request found. Please request a new code.",
      };
    }

    if (new Date() > new Date(user.resetOtpExpiresAt)) {
      return {
        success: false,
        error: "Verification code has expired. Please request a new code.",
      };
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtpHash);
    if (!isMatch) {
      return {
        success: false,
        error: "Invalid 6-digit verification code. Please check your email.",
      };
    }

    // Hashes for new PINs
    const ownerPinHash = await bcrypt.hash(newOwnerPin, 10);
    const staffPinHash = await bcrypt.hash(newStaffPin, 10);

    // Generate new activeSessionId for Owner to unlock counter
    const activeSessionId = crypto.randomUUID();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          ownerPinHash,
          staffPinHash,
          ownerActiveSessionId: activeSessionId,
          lastRoleLoginAt: new Date(),
          resetOtpHash: null,
          resetOtpExpiresAt: null,
        },
      }
    );

    await Tenant.updateOne(
      { _id: user.tenantId },
      { $set: { ownerPinHash, staffPinHash } }
    );

    // Set role session cookie for owner
    await setRoleSessionCookie({
      tenantId: user.tenantId.toString(),
      userId: user._id.toString(),
      role: "owner",
      activeSessionId,
    });

    // Broadcast instant displacement event to any other device currently open as Owner
    await triggerTenantEvent({
      tenantId: user.tenantId.toString(),
      event: "role_session_displaced",
      data: {
        role: "owner",
        newSessionId: activeSessionId,
      },
    });

    return { success: true, role: "owner", activeSessionId };
  } catch (error) {
    console.error("[AuthAction] verifyOtpAndResetPinsAction error:", error);
    return {
      success: false,
      error: "Failed to reset PINs. Please try again.",
    };
  }
}
