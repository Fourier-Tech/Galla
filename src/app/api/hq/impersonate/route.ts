import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { SignJWT } from "jose";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import Tenant from "@/lib/db/models/tenant.model";
import User from "@/lib/db/models/user.model";
import { cookies } from "next/headers";
import { verifyHqSession } from "@/lib/auth/admin-auth";
import { ROLE_SESSION_COOKIE, getJwtSecret } from "@/lib/auth/role-session";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return new NextResponse("Missing impersonation token", { status: 400 });
    }

    // Verify token came from verified SuperAdmin
    const payload = await verifyHqSession(token);
    const tenantId = (payload as any)?.targetTenantId;

    if (!payload || payload.role !== "superadmin" || !tenantId) {
      return new NextResponse("Unauthorized or expired impersonation token", { status: 401 });
    }

    await connectToDatabase();
    const tenant = await Tenant.findById(tenantId);
    const user = await User.findOne({ tenantId });

    if (!tenant || !user) {
      return new NextResponse("Salon or owner user not found", { status: 404 });
    }

    const isSecure = Boolean(
      process.env.VERCEL ||
      (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith("https://")) ||
      (process.env.AUTH_URL && process.env.AUTH_URL.startsWith("https://"))
    );

    const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "galla-auth-secret";
    const sessionCookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const legacyCookieName = isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

    const now = Date.now();

    // 1. NextAuth Session Token (Authenticates shop tenant)
    const nextAuthToken = await encode({
      token: {
        id: user._id.toString(),
        tenantId: tenant._id.toString(),
        email: user.ownerEmail,
        shopLoginAt: now,
        sessionCreatedAt: now,
        tokenIssuedAt: now,
        lastActive: now,
      },
      secret: authSecret,
      salt: sessionCookieName,
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // 2. NextAuth Legacy Token (Encoded with matching legacy salt to prevent decryption error)
    const legacyAuthToken = await encode({
      token: {
        id: user._id.toString(),
        tenantId: tenant._id.toString(),
        email: user.ownerEmail,
        shopLoginAt: now,
        sessionCreatedAt: now,
        tokenIssuedAt: now,
        lastActive: now,
      },
      secret: authSecret,
      salt: legacyCookieName,
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // 3. Galla Role Session Token (Sets role strictly to "admin")
    const roleSessionJwt = await new SignJWT({
      tenantId: tenant._id.toString(),
      userId: user._id.toString(),
      role: "admin",
      activeSessionId: `admin_impersonate_${crypto.randomUUID()}`,
      issuedAt: now,
    } as any)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecret());

    // Redirect to dashboard
    const dashboardUrl = new URL("/dashboard", request.nextUrl.origin);
    const response = NextResponse.redirect(dashboardUrl);

    const cookieOpts = {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    };

    // Set shop session & role cookies in both cookieStore and response headers
    try {
      const cookieStore = await cookies();
      cookieStore.set(sessionCookieName, nextAuthToken, cookieOpts);
      cookieStore.set(legacyCookieName, legacyAuthToken, cookieOpts);
      cookieStore.set(ROLE_SESSION_COOKIE, roleSessionJwt, cookieOpts);
    } catch {}

    response.cookies.set(sessionCookieName, nextAuthToken, cookieOpts);
    response.cookies.set(legacyCookieName, legacyAuthToken, cookieOpts);
    response.cookies.set(ROLE_SESSION_COOKIE, roleSessionJwt, cookieOpts);

    return response;
  } catch (err) {
    console.error("[Impersonation Error]:", err);
    return new NextResponse("Internal server error during impersonation", { status: 500 });
  }
}
