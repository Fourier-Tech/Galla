"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password. Please verify your shop credentials.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred while connecting. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[377px] bg-galla-surface border border-galla-line rounded-[5px] p-[34px] shadow-sm">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="Galla"
          width={160}
          height={55}
          className="h-11 w-auto object-contain"
          priority
        />
        <span className="font-heading text-[11px] font-medium tracking-[0.05em] uppercase text-galla-ink-soft mt-2.5">
          Salon &amp; Parlour Management
        </span>
      </div>

      {/* Form Title */}
      <div className="mt-8 mb-6 text-center">
        <h1 className="font-heading font-semibold text-[18px] text-galla-ink">
          Shop Account Login
        </h1>
        <p className="font-sans text-[13px] text-galla-ink-soft mt-1">
          Enter your authorized credentials to access your counter
        </p>
      </div>

      {/* Error Alert (Decoupled Pure Red) */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-[13px] rounded-[5px] bg-red-50 border border-red-300 text-red-900 text-[13px] flex items-start gap-2.5 leading-snug"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-sans text-[13px] font-medium text-galla-ink mb-1.5"
          >
            Shop Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="email"
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="shop@parlour.com"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[5px] pl-9 pr-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-sans text-[13px] font-medium text-galla-ink mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[5px] pl-9 pr-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[10px] rounded-[5px] shadow-sm transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>Sign In to Counter</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Closed Platform Notice */}
      <div className="mt-8 pt-4 border-t border-galla-line text-center">
        <p className="font-sans text-[11px] text-galla-ink-soft leading-relaxed">
          Galla is an invite-only platform. Salon accounts are provisioned exclusively by{" "}
          <span className="font-medium text-galla-ink">FourierTech</span>.
        </p>
      </div>
    </div>
  );
}
