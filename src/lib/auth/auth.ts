import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { accessCodeSchema } from "@/lib/validations/auth";
import { hashAccessCode } from "@/lib/auth/code-service";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/auth/rate-limiter";

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days session duration
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "AccessCode",
      credentials: {
        code: { label: "8-Digit Shop Access Code", type: "text" },
      },
      async authorize(credentials, req) {
        try {
          const parsed = accessCodeSchema.safeParse(credentials);
          if (!parsed.success) {
            console.warn("[Auth] Invalid code format:", parsed.error.format());
            return null;
          }

          const rawIp =
            req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "127.0.0.1";

          const rateCheck = checkRateLimit(rawIp);
          if (!rateCheck.allowed) {
            console.warn(`[Auth] Rate limit exceeded for IP: ${rawIp}`);
            throw new RateLimitedError();
          }

          const { code } = parsed.data;
          const codeHash = hashAccessCode(code);

          await connectToDatabase();

          const rawUser = await User.collection.findOne({
            $or: [
              { ownerCodeHash: codeHash },
              { staffCodeHash: codeHash },
              { previousOwnerCodeHash: codeHash },
              { previousStaffCodeHash: codeHash },
            ],
          });

          if (!rawUser) {
            const fail = recordFailedAttempt(rawIp);
            console.warn(
              `[Auth] Invalid access code attempt from IP ${rawIp}. Remaining attempts: ${fail.remainingAttempts}`
            );
            return null;
          }

          const now = new Date();
          let role: "owner" | "staff" | null = null;
          let codeType: "current" | "grace" = "current";

          if (rawUser.ownerCodeHash === codeHash) {
            role = "owner";
            codeType = "current";
          } else if (rawUser.staffCodeHash === codeHash) {
            role = "staff";
            codeType = "current";
          } else if (rawUser.previousOwnerCodeHash === codeHash) {
            if (!rawUser.graceExpiresAt || now > new Date(rawUser.graceExpiresAt)) {
              console.warn("[Auth] Expired grace owner code attempt");
              recordFailedAttempt(rawIp);
              return null;
            }
            role = "owner";
            codeType = "grace";
          } else if (rawUser.previousStaffCodeHash === codeHash) {
            if (!rawUser.graceExpiresAt || now > new Date(rawUser.graceExpiresAt)) {
              console.warn("[Auth] Expired grace staff code attempt");
              recordFailedAttempt(rawIp);
              return null;
            }
            role = "staff";
            codeType = "grace";
          }

          if (!role) {
            console.error("[Auth] Unrecognized code hash match in user document");
            return null;
          }

          // Successful authentication -> reset rate limiter
          resetRateLimit(rawIp);

          // Generate single-device session ID
          const activeSessionId = crypto.randomUUID();
          const updateField =
            role === "owner"
              ? { ownerActiveSessionId: activeSessionId }
              : { staffActiveSessionId: activeSessionId };

          await User.collection.updateOne(
            { _id: rawUser._id },
            { $set: updateField }
          );

          console.log(
            `[Auth] Access granted: Role=${role}, CodeType=${codeType}`
          );

          return {
            id: rawUser._id.toString(),
            tenantId: rawUser.tenantId.toString(),
            role,
            activeSessionId,
            codeType,
            graceExpiresAt: rawUser.graceExpiresAt ? new Date(rawUser.graceExpiresAt).toISOString() : null,
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
        token.role = user.role;
        token.activeSessionId = user.activeSessionId;
        token.codeType = user.codeType;
        token.graceExpiresAt = user.graceExpiresAt;
        return token;
      }

      // Check session validity
      if (token.id) {
        try {
          await connectToDatabase();
          const dbUser = await User.collection.findOne(
            { _id: new Types.ObjectId(token.id as string) },
            {
              projection: {
                ownerActiveSessionId: 1,
                staffActiveSessionId: 1,
                graceExpiresAt: 1,
              },
            }
          );

          if (!dbUser) {
            return null;
          }

          // Single-device validation
          const currentDbSession =
            token.role === "owner"
              ? dbUser.ownerActiveSessionId
              : dbUser.staffActiveSessionId;

          if (!token.activeSessionId || currentDbSession !== token.activeSessionId) {
            console.warn(
              `[Auth] Invalidation: token session ${token.activeSessionId} !== DB session ${currentDbSession}`
            );
            return null;
          }

          // Grace period expiration: if logged in with a grace code and grace window has passed
          if (token.codeType === "grace" && dbUser.graceExpiresAt) {
            if (new Date() > new Date(dbUser.graceExpiresAt)) {
              console.warn("[Auth] Invalidation: Grace period expired for session");
              return null;
            }
          }
        } catch (e) {
          console.error("[Auth] Token validation error:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as "owner" | "staff";
        session.user.activeSessionId = token.activeSessionId as string | null | undefined;
        session.user.codeType = token.codeType as "current" | "grace" | undefined;
        session.user.graceExpiresAt = token.graceExpiresAt as string | null | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // fallback
      }
      return baseUrl;
    },
  },
});
