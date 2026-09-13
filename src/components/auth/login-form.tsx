"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

function LoginFormContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Map NextAuth error query codes to human-readable error messages
  const getErrorMessage = () => {
    if (error) return error;
    if (urlError === "CredentialsSignin") {
      return "Invalid shop account ID or password. Please verify your credentials.";
    }
    if (urlError === "AccessDenied") {
      return "Access denied. Your salon account is not active.";
    }
    if (urlError === "session_expired") {
      return "You were logged out because this account was opened on another device.";
    }
    if (urlError === "Configuration") {
      return "Server or database configuration error. Please verify MongoDB connection.";
    }
    if (urlError) {
      return "Authentication failed. Please verify your credentials.";
    }
    return null;
  };

  const activeError = getErrorMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // In NextAuth v5 client, signIn with redirect: true handles cookie setting
      // and redirects directly to callbackUrl (/dashboard) on success,
      // or to /login?error=CredentialsSignin on failure!
      await signIn("credentials", {
        email: identifier.trim(),
        password,
        callbackUrl: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
        redirect: true,
      });
    } catch (err) {
      console.error("[Login] Sign in exception:", err);
      setError("An unexpected connection error occurred. Please try again.");
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

      {/* Decoupled Pure Red Failure Status Banner */}
      {activeError && (
        <div
          role="alert"
          className="mb-5 p-[13px] rounded-[5px] bg-red-50 border border-red-300 text-red-900 text-[13px] flex items-start gap-2.5 leading-snug shadow-xs"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-900">Sign In Failed</div>
            <div className="text-[12px] text-red-800 mt-0.5">{activeError}</div>
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="identifier"
            className="block font-sans text-[13px] font-medium text-galla-ink mb-1.5"
          >
            Shop Email or Account ID
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <User className="h-4 w-4" />
            </div>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              disabled={loading}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. shreehari or shreehari@gmail.com"
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
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[5px] pl-9 pr-10 py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
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

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[377px] bg-galla-surface border border-galla-line rounded-[5px] p-[34px] flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-galla-teal" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
