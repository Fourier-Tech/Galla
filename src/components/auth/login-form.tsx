"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { lockRoleSessionAction } from "@/app/actions/auth-actions";
import {
  AlertTriangle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
} from "lucide-react";

function LoginFormContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlCode = searchParams.get("code");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // Invalidate any leftover role session state from previous logins
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("galla_role_session");
    }
    lockRoleSessionAction().catch(() => {});
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Map error query codes to human-readable error messages
  const getErrorMessage = () => {
    if (error) return error;
    if (urlCode === "rate_limited" || urlError === "rate_limited") {
      return "Too many failed attempts. For your salon's security, login is temporarily locked for 15 minutes.";
    }
    if (urlError === "CredentialsSignin") {
      return "Invalid email address or password. Please check your credentials.";
    }
    if (urlError === "inactive_session") {
      return "Your counter session expired after 7 days of inactivity. Please sign in again.";
    }
    if (urlError === "session_expired") {
      return "Your shop session has expired. Please sign in again.";
    }
    if (urlError === "AccessDenied") {
      return "Access denied. Your salon account is not active.";
    }
    if (urlError) {
      return "Authentication failed. Please verify your shop account.";
    }
    return null;
  };

  const activeError = getErrorMessage();

  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid shop email address.");
      isSubmittingRef.current = false;
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);

    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("galla_role_session");
      }
      await lockRoleSessionAction();

      const res = await signIn("credentials", {
        email: cleanEmail,
        password,
        callbackUrl: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
        redirect: false,
      });

      if (res?.error) {
        if (res.code === "rate_limited" || res.error === "rate_limited") {
          setError(
            "Too many failed attempts. For your salon's security, login is temporarily locked for 15 minutes."
          );
        } else {
          setError(
            "Invalid email address or password. Please check your salon credentials."
          );
        }
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      // Explicitly wipe client role session state so user must verify PIN on arrival
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("galla_role_session");
      }

      // Navigate to dashboard where Role Keypad will authenticate role
      const targetUrl =
        callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/dashboard";
      window.location.href = targetUrl;
    } catch (err) {
      console.error("[Login] Sign in exception:", err);
      setError("An unexpected connection error occurred. Please try again.");
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-[390px] bg-galla-surface border border-galla-line rounded-[8px] p-[32px] shadow-sm">
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
        <span className="text-[12px] font-normal text-galla-ink-soft mt-1.5">
          Salon &amp; parlour management
        </span>
      </div>

      {/* Form Title */}
      <div className="mt-7 mb-6 text-center">
        <h1 className="font-bold text-[18px] text-galla-ink">
          Counter Sign In
        </h1>
        <p className="text-[13px] text-galla-ink-soft mt-1">
          Sign in to your salon&apos;s billing counter account
        </p>
      </div>

      {/* Failure Status Banner */}
      {activeError && (
        <div
          role="alert"
          className="mb-5 p-[13px] rounded-[6px] bg-red-50 border border-red-300 text-red-900 text-[13px] flex items-start gap-2.5 leading-snug shadow-xs"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-900">Sign In Failed</div>
            <div className="text-[12px] text-red-800 mt-0.5">{activeError}</div>
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-[13px] font-medium text-galla-ink mb-1.5"
          >
            Shop Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              disabled={loading}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="owner@example.com"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-9 pr-4 py-2.5 text-[14px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-[13px] font-medium text-galla-ink mb-1.5"
          >
            Shop Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="••••••••••••"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-9 pr-10 py-2.5 text-[14px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white text-[14px] font-medium px-[13px] py-[10px] rounded-[6px] shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

      {/* Security & Lifecycle Info */}
      <div className="mt-6 pt-5 border-t border-galla-line/80 space-y-2">
        <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft">
          <Clock className="h-3.5 w-3.5 text-galla-teal shrink-0" />
          <span>30-day counter session with 7-day inactivity protection</span>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-galla-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-galla-teal shrink-0" />
          <span>Two-tier authentication &amp; single-device counter security</span>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[390px] h-[350px] bg-galla-surface border border-galla-line rounded-[8px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-galla-teal" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}

export default LoginForm;
