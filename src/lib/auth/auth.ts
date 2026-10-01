import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { loginCredentialsSchema } from "@/lib/validations/auth";
import {
  checkEmailLoginRateLimit,
  recordFailedEmailLogin,
  resetEmailLoginRateLimit,
} from "@/lib/auth/rate-limiter";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
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

          const rawUser = await User.collection.findOne({
            ownerEmail: email.toLowerCase().trim(),
          });

          if (!rawUser) {
            recordFailedEmailLogin(rawIp);
            console.warn(`[Auth] No salon user found for email: ${email}`);
            return null;
          }

          // If no passwordHash is set yet, check if default password applies (e.g. "shreehari123" or "password123")
          let isPasswordValid = false;
          if (rawUser.passwordHash) {
            isPasswordValid = await bcrypt.compare(password, rawUser.passwordHash);
          } else {
            // Default fallback for initial migration
            isPasswordValid = password === "shreehari123" || password === "password123";
            if (isPasswordValid) {
              const newHash = await bcrypt.hash(password, 10);
              await User.collection.updateOne(
                { _id: rawUser._id },
                { $set: { passwordHash: newHash } }
              );
            }
          }

          if (!isPasswordValid) {
            recordFailedEmailLogin(rawIp);
            console.warn(`[Auth] Incorrect password for email: ${email}`);
            return null;
          }

          // Successful authentication -> reset rate limiter
          resetEmailLoginRateLimit(rawIp);

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
        return token;
      }

      // Check 7-day inactivity rule
      if (token.id) {
        try {
          await connectToDatabase();
          const dbUser = await User.collection.findOne(
            { _id: new Types.ObjectId(token.id as string) },
            {
              projection: {
                lastRoleLoginAt: 1,
                updatedAt: 1,
                createdAt: 1,
              },
            }
          );

          if (!dbUser) {
            return null;
          }

          const lastActivityDate = dbUser.lastRoleLoginAt
            ? new Date(dbUser.lastRoleLoginAt).getTime()
            : dbUser.updatedAt
            ? new Date(dbUser.updatedAt).getTime()
            : dbUser.createdAt
            ? new Date(dbUser.createdAt).getTime()
            : Date.now();

          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - lastActivityDate > SEVEN_DAYS_MS) {
            console.warn("[Auth] Session invalidated: 7 days of inactivity exceeded");
            return null;
          }
        } catch (e) {
          console.error("[Auth] Inactivity check error:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.email = token.email as string;
        session.user.role = (token.role as "owner" | "staff") || undefined;
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
