import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "galla-fallback-admin-secret-2026"
);

export const HQ_COOKIE_NAME = "galla_hq_session";

export interface HqSessionPayload {
  adminId: string;
  email: string;
  role: string;
  activeSessionId?: string | null;
}

export async function signHqSession(payload: HqSessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(ADMIN_SECRET);
}

export async function verifyHqSession(token: string): Promise<HqSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_SECRET);
    return payload as unknown as HqSessionPayload;
  } catch {
    return null;
  }
}

export async function getHqSession(): Promise<HqSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyHqSession(token);
  if (!payload || !payload.adminId) return null;

  try {
    const { connectToDatabase } = await import("@/lib/db/mongodb");
    const { default: SuperAdmin } = await import("@/lib/db/models/super-admin.model");
    await connectToDatabase();

    const safeDeleteCookie = () => {
      try {
        cookieStore.delete(HQ_COOKIE_NAME);
      } catch {
        // cookies() is read-only in Server Components; cookie deletion is handled on redirect by middleware
      }
    };

    const admin = await SuperAdmin.findById(payload.adminId).select("activeSessionId isActive");
    if (!admin || !admin.isActive) {
      safeDeleteCookie();
      return null;
    }

    // Single-device concurrency check:
    // If activeSessionId is not present or doesn't match the current DB session, session is displaced.
    if (!payload.activeSessionId || admin.activeSessionId !== payload.activeSessionId) {
      safeDeleteCookie();
      return null;
    }

    return payload;
  } catch (err) {
    console.error("[getHqSession] Failed to verify activeSessionId:", err);
    return null;
  }
}
