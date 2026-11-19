import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In — Galla",
  description: "Sign in to your Galla Salon & Parlour counter account.",
};

export default function LoginPage() {
  return <LoginForm />;
}

// This is a client component, so we can use hooks and other client-side features here.
