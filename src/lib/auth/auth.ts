import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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

          console.log(`[Auth] User authenticated successfully: "${user.email}" (${user.role})`);
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            tenantId: user.tenantId.toString(),
            role: user.role,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
