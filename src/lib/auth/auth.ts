import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { Tenant } from "@/lib/db/models/tenant.model";
import { loginCredentialsSchema } from "@/lib/validations/auth";
import {
  checkEmailLoginRateLimit,
  recordFailedEmailLogin,
  resetEmailLoginRateLimit,
} from "@/lib/auth/rate-limiter";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export class SuspendedAccountError extends CredentialsSignin {
  code = "account_suspended";
}

// In production / Vercel, ensure NEXTAUTH_URL and AUTH_URL do not point to localhost
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  const isLocal = (u?: string) => Boolean(u && (u.includes("localhost") || u.includes("127.0.0.1")));
  if (isLocal(process.env.NEXTAUTH_URL) || isLocal(process.env.AUTH_URL)) {
    const liveHost =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      "galla-five.vercel.app";
    process.env.NEXTAUTH_URL = `https://${liveHost}`;
    process.env.AUTH_URL = `https://${liveHost}`;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days maximum shop session duration
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "ShopCredentials",
      credentials: {
        email: { label: "Shop Email Address", type: "email" },
        password: { label: "Shop Password", type: "password" },
      },
      async authorize(credentials, req) {
        try {
          const parsed = loginCredentialsSchema.safeParse(credentials);
          if (!parsed.success) {
            console.warn("[Auth] Invalid login input format:", parsed.error.format());
            return null;
          }

          const rawIp =
            req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "127.0.0.1";

          const rateCheck = checkEmailLoginRateLimit(rawIp);
          if (!rateCheck.allowed) {
            console.warn(`[Auth] Email login rate limit exceeded for IP: ${rawIp}`);
            throw new RateLimitedError();
          }

          const { email, password } = parsed.data;

          await connectToDatabase();

          const rawUser = await User.collection.findOne(
            { ownerEmail: email.toLowerCase().trim() },
            { projection: { ownerEmail: 1, passwordHash: 1, tenantId: 1 } }
          );

          if (!rawUser) {
            recordFailedEmailLogin(rawIp);
            console.warn(`[Auth] No salon user found for email: ${email}`);
            return null;
          }

          // Single approach: verify real password against the hash stored in DB
          if (!rawUser.passwordHash) {
            recordFailedEmailLogin(rawIp);
            console.warn(`[Auth] No password configured for salon user: ${email}`);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, rawUser.passwordHash);
          if (!isPasswordValid) {
            recordFailedEmailLogin(rawIp);
            console.warn(`[Auth] Incorrect password for email: ${email}`);
            return null;
          }

          // Successful authentication -> reset rate limiter
          resetEmailLoginRateLimit(rawIp);

          // Check if salon tenant account is suspended
          const tenantDoc = await Tenant.collection.findOne(
            { _id: rawUser.tenantId },
            { projection: { status: 1 } }
          );

          if (tenantDoc?.status === "suspended") {
            console.warn(`[Auth] Login blocked: Salon tenant ${rawUser.tenantId} is suspended.`);
            throw new SuspendedAccountError();
          }

          console.log(`[Auth] Shop authenticated successfully: ${email}`);

          return {
            id: rawUser._id.toString(),
            tenantId: rawUser.tenantId.toString(),
            email: rawUser.ownerEmail,
          };
        } catch (error) {
          console.error("[Auth] Authorization error:", error);
          if (error instanceof CredentialsSignin) {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.email = user.email;
        token.sessionCreatedAt = Date.now();
        token.shopLoginAt = Date.now();
        token.tokenIssuedAt = Date.now();
        token.lastActive = Date.now();
        return token;
      }

      // Check 7-day inactivity rule directly in token (zero DB roundtrips)
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const lastActive = (token.lastActive as number) || (token.sessionCreatedAt as number) || now;

      if (now - lastActive > SEVEN_DAYS_MS) {
        console.warn("[Auth] Session invalidated: 7 days of inactivity exceeded");
        return null;
      }

      // Invalidate session if shop password was changed after this session token was issued
      if (token.id) {
        try {
          await connectToDatabase();
          const userDoc = await User.collection.findOne(
            { _id: new Types.ObjectId(token.id as string) },
            { projection: { passwordChangedAt: 1 } }
          );
          if (userDoc?.passwordChangedAt) {
            const tokenIssuedAt = (token.tokenIssuedAt || token.shopLoginAt || token.sessionCreatedAt || 0) as number;
            const pwdChangedTime = new Date(userDoc.passwordChangedAt).getTime();
            if (pwdChangedTime > tokenIssuedAt) {
              console.warn(
                `[Auth] Session invalidated: shop password changed at ${new Date(pwdChangedTime).toISOString()} (token issued at ${new Date(tokenIssuedAt).toISOString()})`
              );
              return null;
            }
          }
        } catch (e) {
          console.error("[Auth] Error validating passwordChangedAt in jwt callback:", e);
        }
      }

      // Invalidate session if salon tenant is suspended (unless it's an admin session)
      if (token.tenantId) {
        try {
          await connectToDatabase();
          const tenantDoc = await Tenant.collection.findOne(
            { _id: new Types.ObjectId(token.tenantId as string) },
            { projection: { status: 1 } }
          );
          if (tenantDoc?.status === "suspended") {
            const { getRoleSession } = await import("@/lib/auth/role-session");
            const roleSession = await getRoleSession().catch(() => null);
            if (roleSession?.role !== "admin") {
              console.warn(
                `[Auth] Session invalidated: Salon tenant ${token.tenantId} is suspended.`
              );
              return null;
            }
          }
        } catch (e) {
          console.error("[Auth] Error validating tenant status in jwt callback:", e);
        }
      }

      token.lastActive = now;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.email = token.email as string;
        session.user.shopLoginAt = token.shopLoginAt as number;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      let resolvedBase = baseUrl;
      if (
        (process.env.NODE_ENV === "production" || process.env.VERCEL) &&
        (resolvedBase.includes("localhost") || resolvedBase.includes("127.0.0.1"))
      ) {
        const liveHost =
          process.env.VERCEL_PROJECT_PRODUCTION_URL ||
          process.env.VERCEL_URL ||
          "galla-five.vercel.app";
        resolvedBase = `https://${liveHost}`;
      }

      if (url.startsWith("/")) return `${resolvedBase}${url}`;
      try {
        const urlObj = new URL(url);
        const baseObj = new URL(resolvedBase);
        if (urlObj.host === baseObj.host) return url;
      } catch {
        // fallback
      }
      return resolvedBase;
    },
  },
});
