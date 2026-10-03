"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT } from "jose";
import { connectToDatabase } from "@/lib/db/mongodb";
import SuperAdmin from "@/lib/db/models/super-admin.model";
import Tenant from "@/lib/db/models/tenant.model";
import User from "@/lib/db/models/user.model";
import { Counter } from "@/lib/db/models/counter.model";
import { signHqSession, HQ_COOKIE_NAME, getHqSession, ADMIN_SECRET } from "@/lib/auth/admin-auth";
import { revalidatePath } from "next/cache";

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function hqLoginAction(email: string, password: string) {
  try {
    await connectToDatabase();
    const admin = await SuperAdmin.findOne({ email: email.toLowerCase().trim() });

    if (!admin || !admin.isActive) {
      return { success: false, error: "Invalid credentials." };
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid credentials." };
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = await signHqSession({
      adminId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    });

    (await cookies()).set(HQ_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function hqLogoutAction() {
  (await cookies()).delete(HQ_COOKIE_NAME);
  redirect("/hq/login");
}

// ─── Tenant Provisioning ─────────────────────────────────────────────────────

export type PlanType = "trial" | "active" | "lifetime";

export interface ProvisionTenantInput {
  name: string;
  ownerEmail: string;
  phone?: string;
  address?: string;
  currency?: string;
  password?: string;
  ownerPin?: string;
  staffPin?: string;
  planType: PlanType;
  /** Either trialDays OR expiresAt (or both) */
  trialDays?: number;
  expiresAt?: string; // YYYY-MM-DD or ISO string
}

export async function provisionTenantAction(data: ProvisionTenantInput) {
  try {
    const session = await getHqSession();
    if (!session || session.role !== "superadmin") {
      return { success: false, error: "Unauthorized." };
    }

    await connectToDatabase();

    const cleanEmail = data.ownerEmail.toLowerCase().trim();
    const existingEmail = await User.findOne({ ownerEmail: cleanEmail });
    if (existingEmail) {
      return { success: false, error: "Owner email is already registered to another salon." };
    }

    // Auto-generate slug: sanitize name + random 6-char hex
    const baseSlug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${baseSlug || "salon"}-${crypto.randomBytes(3).toString("hex")}`;

    // Sequential tenant code
    let tenantCode = "TEN-0001";
    try {
      tenantCode = await Counter.getNextTenantCode();
    } catch (e) {
      console.warn("Could not generate sequential tenant code, falling back:", e);
    }

    // Calculate plan expiry
    let planExpiresAt: Date | null = null;
    if (data.planType !== "lifetime") {
      if (data.expiresAt) {
        // End of the selected day
        const d = new Date(data.expiresAt);
        d.setHours(23, 59, 59, 999);
        planExpiresAt = d;
      } else if (data.trialDays && data.trialDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + data.trialDays);
        d.setHours(23, 59, 59, 999);
        planExpiresAt = d;
      }
    }

    // Hash passwords & PINs
    const rawPassword = data.password?.trim() || "password123";
    const rawOwnerPin = data.ownerPin?.trim() || "888888";
    const rawStaffPin = data.staffPin?.trim() || "567890";

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const ownerPinHash = await bcrypt.hash(rawOwnerPin, 10);
    const staffPinHash = await bcrypt.hash(rawStaffPin, 10);

    const tenant: any = await Tenant.create({
      name: data.name.trim(),
      slug,
      tenantCode,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      status: data.planType === "trial" ? "trial" : "active",
      planType: data.planType,
      planExpiresAt,
      ownerPinHash,
      staffPinHash,
      settings: {
        allowBackorders: true,
        lowStockNotification: true,
        currency: data.currency?.trim() || "INR",
      },
    });

    await User.create({
      tenantId: tenant._id,
      ownerEmail: cleanEmail,
      passwordHash,
      ownerPinHash,
      staffPinHash,
    });

    revalidatePath("/hq/salons");
    revalidatePath("/hq");
    return { success: true };
  } catch (err: unknown) {
    console.error("Provision Tenant Error:", err);
    return { success: false, error: "Failed to provision salon. Please try again." };
  }
}

// ─── Tenant Management ───────────────────────────────────────────────────────

export async function getSalonsAction() {
  try {
    const session = await getHqSession();
    if (!session) return { success: false, error: "Unauthorized." };

    await connectToDatabase();
    const salons = await Tenant.find().sort({ createdAt: -1 }).lean();
    const tenantIds = salons.map((s) => s._id);
    const users = await User.find({ tenantId: { $in: tenantIds } }, "tenantId ownerEmail").lean();
    const userMap = new Map(users.map((u) => [u.tenantId.toString(), u.ownerEmail]));

    const formattedSalons = salons.map((salon) => ({
      _id: salon._id.toString(),
      name: salon.name,
      slug: salon.slug,
      tenantCode: salon.tenantCode || "",
      phone: salon.phone || "",
      address: salon.address || "",
      ownerEmail: userMap.get(salon._id.toString()) || "",
      status: salon.status,
      planType: salon.planType || "trial",
      planExpiresAt: salon.planExpiresAt ? salon.planExpiresAt.toISOString() : null,
      currency: salon.settings?.currency || "INR",
      createdAt: salon.createdAt ? salon.createdAt.toISOString() : "",
      updatedAt: salon.updatedAt ? salon.updatedAt.toISOString() : "",
    }));

    return { success: true, salons: formattedSalons };
  } catch (err) {
    console.error("Failed to fetch salons:", err);
    return { success: false, error: "Failed to fetch salons." };
  }
}

export async function updateTenantAction(
  tenantId: string,
  data: {
    name?: string;
    phone?: string;
    address?: string;
    ownerEmail?: string;
    planType: PlanType;
    status: "active" | "suspended" | "trial";
    trialDays?: number;
    expiresAt?: string;
    resetOwnerPin?: string;
    resetStaffPin?: string;
    resetPassword?: string;
  }
) {
  try {
    const session = await getHqSession();
    if (!session || session.role !== "superadmin") return { success: false, error: "Unauthorized." };

    await connectToDatabase();

    let planExpiresAt: Date | null | undefined;
    if (data.planType === "lifetime") {
      planExpiresAt = null;
    } else if (data.expiresAt) {
      const d = new Date(data.expiresAt);
      d.setHours(23, 59, 59, 999);
      planExpiresAt = d;
    } else if (data.trialDays && data.trialDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + data.trialDays);
      d.setHours(23, 59, 59, 999);
      planExpiresAt = d;
    }

    const setFields: Record<string, unknown> = {
      planType: data.planType,
      status: data.status,
    };

    if (data.name?.trim()) setFields.name = data.name.trim();
    if (typeof data.phone !== "undefined") setFields.phone = data.phone.trim() || null;
    if (typeof data.address !== "undefined") setFields.address = data.address.trim() || null;

    if (planExpiresAt !== undefined) {
      setFields.planExpiresAt = planExpiresAt;
    }

    // Optional PIN reset
    if (data.resetOwnerPin && data.resetOwnerPin.trim().length === 6) {
      setFields.ownerPinHash = await bcrypt.hash(data.resetOwnerPin.trim(), 10);
    }
    if (data.resetStaffPin && data.resetStaffPin.trim().length === 6) {
      setFields.staffPinHash = await bcrypt.hash(data.resetStaffPin.trim(), 10);
    }

    await Tenant.updateOne({ _id: tenantId }, { $set: setFields });

    // Update User model if email, PINs, or master password changed
    const userUpdates: Record<string, unknown> = {};
    if (data.ownerEmail?.trim()) {
      userUpdates.ownerEmail = data.ownerEmail.trim().toLowerCase();
    }
    if (data.resetPassword && data.resetPassword.trim().length >= 6) {
      userUpdates.passwordHash = await bcrypt.hash(data.resetPassword.trim(), 10);
    }
    if (setFields.ownerPinHash) {
      userUpdates.ownerPinHash = setFields.ownerPinHash;
    }
    if (setFields.staffPinHash) {
      userUpdates.staffPinHash = setFields.staffPinHash;
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.updateOne({ tenantId }, { $set: userUpdates });
    }

    revalidatePath("/hq/salons");
    revalidatePath("/hq");
    return { success: true };
  } catch (err) {
    console.error("Failed to update salon:", err);
    return { success: false, error: "Failed to update salon." };
  }
}

// Backward-compatible alias
export const updateTenantPlanAction = updateTenantAction;

export async function toggleTenantStatusAction(tenantId: string, suspend: boolean) {
  try {
    const session = await getHqSession();
    if (!session || session.role !== "superadmin") return { success: false, error: "Unauthorized." };

    await connectToDatabase();
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return { success: false, error: "Salon not found." };

    tenant.status = suspend ? "suspended" : (tenant.planType === "trial" ? "trial" : "active");
    await tenant.save();

    revalidatePath("/hq/salons");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update salon status." };
  }
}

export async function createSalonImpersonationUrlAction(tenantId: string) {
  try {
    const session = await getHqSession();
    if (!session || session.role !== "superadmin") {
      return { success: false, error: "Unauthorized." };
    }


    const token = await new SignJWT({
      adminId: session.adminId,
      email: session.email,
      role: "superadmin",
      targetTenantId: tenantId,
    } as any)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(ADMIN_SECRET);

    return {
      success: true,
      url: `/api/hq/impersonate?token=${token}`,
    };
  } catch (err) {
    console.error("Failed to create impersonation URL:", err);
    return { success: false, error: "Failed to generate impersonation session." };
  }
}
