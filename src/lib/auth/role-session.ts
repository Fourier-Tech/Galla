import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { auth } from "@/lib/auth/auth";

export const ROLE_SESSION_COOKIE = "galla_role_session";

export interface RoleSessionPayload {
  tenantId: string;
  userId: string;
  role: "owner" | "staff" | "admin";
  activeSessionId: string;
  issuedAt: number;
}

export function getJwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "galla-fallback-role-session-secret-2026-secure";
  return new TextEncoder().encode(secret);
}

/**
 * Creates and sets an ephemeral, session-scoped cookie for the verified Role (Owner or Staff).
 * Omission of maxAge/expires ensures the browser clears it when the browser window closes.
 */
export async function setRoleSessionCookie(payload: Omit<RoleSessionPayload, "issuedAt">): Promise<string> {
  const fullPayload: RoleSessionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };

  const jwt = await new SignJWT(fullPayload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(getJwtSecret());

  const isSecure = Boolean(
    process.env.VERCEL ||
    (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith("https://")) ||
    (process.env.AUTH_URL && process.env.AUTH_URL.startsWith("https://"))
  );

  const cookieStore = await cookies();
  cookieStore.set(ROLE_SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    // Ephemeral session cookie: clears automatically when browser/session ends
  });

  return jwt;
}

/**
 * Clears the ephemeral role session cookie (used on manual lock, shop login, or sign out).
 */
export async function clearRoleSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ROLE_SESSION_COOKIE);
  } catch (err) {
    // Ignore cookie deletion failure if headers were already sent
  }
}

export interface GetRoleSessionResult {
  role: "owner" | "staff" | "admin" | null;
  tenantId?: string;
  userId?: string;
  activeSessionId?: string;
  evicted?: boolean;
}

/**
 * Reads and verifies the role session cookie, checking single-device concurrency against MongoDB
 * and guaranteeing that the role was authenticated AFTER the current shop account login.
 */
export async function getRoleSession(): Promise<GetRoleSessionResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ROLE_SESSION_COOKIE)?.value;

    if (!token) {
      return { role: null, evicted: false };
    }

    const { payload } = await jwtVerify(token, getJwtSecret());
    const rolePayload = payload as unknown as RoleSessionPayload;

    if (!rolePayload.userId || !rolePayload.role || !rolePayload.activeSessionId) {
      return { role: null, evicted: false };
    }

    // HQ Admin impersonation sessions have full access without concurrency displacement
    if (rolePayload.role === "admin") {
      return {
        role: "admin",
        tenantId: rolePayload.tenantId,
        userId: rolePayload.userId,
        activeSessionId: rolePayload.activeSessionId,
        evicted: false,
      };
    }

    // Verify against current shop account session
    const shopSession = await auth();
    if (!shopSession?.user) {
      return { role: null, evicted: false };
    }

    // If shop account logged in AFTER this role session was issued, the role session is stale and must be discarded
    const shopLoginAt = shopSession.user.shopLoginAt;
    if (shopLoginAt && rolePayload.issuedAt && rolePayload.issuedAt < shopLoginAt) {
      try {
        cookieStore.delete(ROLE_SESSION_COOKIE);
      } catch {}
      return { role: null, evicted: false };
    }

    // Verify concurrency in database: Has this role been displaced on another device?
    await connectToDatabase();
    const dbUser = await User.collection.findOne(
      { _id: new Types.ObjectId(rolePayload.userId) },
      {
        projection: {
          ownerActiveSessionId: 1,
          staffActiveSessionId: 1,
        },
      }
    );

    if (!dbUser) {
      return { role: null, evicted: false };
    }

    const currentActiveId =
      rolePayload.role === "owner"
        ? dbUser.ownerActiveSessionId
        : dbUser.staffActiveSessionId;

    if (currentActiveId && currentActiveId !== rolePayload.activeSessionId) {
      // Evicted! Another device logged into this role.
      return { role: null, evicted: true };
    }

    return {
      role: rolePayload.role,
      tenantId: rolePayload.tenantId,
      userId: rolePayload.userId,
      activeSessionId: rolePayload.activeSessionId,
      evicted: false,
    };
  } catch (err) {
    console.error("[getRoleSession Verification Error]:", err);
    return { role: null, evicted: false };
  }
}

