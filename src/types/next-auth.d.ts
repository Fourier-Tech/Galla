import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    tenantId?: string;
    role?: "owner" | "staff";
    activeSessionId?: string | null;
    codeType?: "current" | "grace";
    graceExpiresAt?: string | null;
  }

  interface Session {
    user: {
      id?: string;
      tenantId?: string;
      role?: "owner" | "staff";
      activeSessionId?: string | null;
      codeType?: "current" | "grace";
      graceExpiresAt?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: "owner" | "staff";
    activeSessionId?: string | null;
    codeType?: "current" | "grace";
    graceExpiresAt?: string | null;
  }
}
