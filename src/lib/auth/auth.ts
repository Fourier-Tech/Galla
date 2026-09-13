import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/user.model";
import { loginSchema } from "@/lib/validations/auth";

import { Tenant } from "@/lib/db/models/tenant.model";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email or Shop ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            console.warn("[Auth] Validation failed:", parsed.error.format());
            return null;
          }

          const { email, password } = parsed.data;

          await connectToDatabase();
          const cleanIdentifier = email.trim().toLowerCase();

          // 1. Direct email match or auto-appended @gmail.com
          let user = await User.findOne({
            $or: [
              { email: cleanIdentifier },
              { email: `${cleanIdentifier}@gmail.com` },
            ],
          });

          // 2. Lookup by Salon Name or Tenant Slug if not found by email
          if (!user) {
            const tenant = await Tenant.findOne({
              $or: [
                { slug: new RegExp(`^${cleanIdentifier}`, "i") },
                { name: new RegExp(`^${cleanIdentifier}$`, "i") },
              ],
            });

            if (tenant) {
              user = await User.findOne({ tenantId: tenant._id, role: "owner" });
            }
          }

          if (!user || !user.passwordHash) {
            console.warn(`[Auth] No account found matching: "${cleanIdentifier}"`);
            return null;
          }

          const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
          if (!isPasswordMatch) {
            console.warn(`[Auth] Incorrect password for account: "${user.email}"`);
            return null;
          }

          const activeSessionId = crypto.randomUUID();
          await User.collection.updateOne(
            { _id: user._id },
            { $set: { activeSessionId } }
          );

          console.log(`[Auth] User authenticated successfully: "${user.email}" (${user.role}) [session: ${activeSessionId}]`);
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            tenantId: user.tenantId.toString(),
            role: user.role,
            activeSessionId,
          };
        } catch (error) {
          console.error("[Auth] Database connection or authorize error:", error);
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
        return token;
      }

      // Validate session on every token evaluation
      if (token.id) {
        try {
          await connectToDatabase();
          const dbUser = await User.collection.findOne(
            { _id: new Types.ObjectId(token.id as string) },
            { projection: { activeSessionId: 1 } }
          );

          // Invalidate if user no longer exists, token has no session ID, or session ID in DB changed (new login elsewhere)
          if (!dbUser || !token.activeSessionId || dbUser.activeSessionId !== token.activeSessionId) {
            console.warn(`[Auth] Invalidation: token session "${token.activeSessionId}" !== DB session "${dbUser?.activeSessionId}"`);
            return null; // NextAuth automatically cleans sessionStore cookies and invalidates session!
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
        session.user.role = token.role as string;
        session.user.activeSessionId = token.activeSessionId as string | undefined;
      }
      return session;
    },
  },
});
