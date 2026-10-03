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
  return verifyHqSession(token);
}
