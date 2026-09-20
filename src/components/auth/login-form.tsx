"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, KeyRound, ArrowRight, Loader2, ShieldCheck, Clock } from "lucide-react";

function LoginFormContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlCode = searchParams.get("code");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [rawCode, setRawCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Map NextAuth error query codes to human-readable error messages
  const getErrorMessage = () => {
    if (error) return error;
    if (urlCode === "rate_limited" || urlError === "rate_limited") {
      return "Too many failed attempts. For your salon's security, login is temporarily locked. Please try again in 15 minutes.";
    }
    if (urlError === "CredentialsSignin") {
      return "Invalid 8-digit access code. Please check your salon code or email dispatch.";
    }
    if (urlError === "AccessDenied") {
      return "Access denied. Your salon account is not active.";
    }
    if (urlError === "session_expired") {
      return "You were logged out because this account was opened on another device.";
    }
    if (urlError) {
      return "Authentication failed. Please verify your access code.";
    }
    return null;
  };

  const activeError = getErrorMessage();

  // Format code input with a clean space in the middle: e.g. "8291 0394"
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 8);
    setRawCode(digitsOnly);
    if (error) setError(null);
  };

  const formattedDisplay =
    rawCode.length > 4
      ? `${rawCode.slice(0, 4)}  ${rawCode.slice(4)}`
      : rawCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rawCode.length !== 8) {
      setError("Please enter a complete 8-digit access code.");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("credentials", {
        code: rawCode,
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
            "Invalid 8-digit access code. Please check your salon code or email dispatch."
          );
        }
        setLoading(false);
        return;
      }

      // Always navigate using relative path so the browser stays on the current origin (production Vercel or localhost)
      const targetUrl =
        callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
          ? callbackUrl
          : "/dashboard";
      window.location.href = targetUrl;
    } catch (err) {
      console.error("[Login] Sign in exception:", err);
      setError("An unexpected connection error occurred. Please try again.");
      setLoading(false);
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
        <span className="font-heading text-[11px] font-medium tracking-[0.05em] uppercase text-galla-ink-soft mt-2.5">
          Salon &amp; Parlour Management
        </span>
      </div>

      {/* Form Title */}
      <div className="mt-7 mb-6 text-center">
        <h1 className="font-heading font-semibold text-[18px] text-galla-ink">
          Shop Access Code
        </h1>
        <p className="font-sans text-[13px] text-galla-ink-soft mt-1">
          Enter your 8-digit salon code (Owner or Staff)
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
        <div>
          <label
            htmlFor="accessCode"
            className="block font-sans text-[13px] font-medium text-galla-ink mb-2 text-center"
          >
            8-Digit Code
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
              <KeyRound className="h-4 w-4" />
            </div>
            <input
              id="accessCode"
              name="accessCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              disabled={loading}
              value={formattedDisplay}
              onChange={handleCodeChange}
              placeholder="••••  ••••"
              className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-9 pr-4 py-3 text-[18px] text-center font-mono font-bold tracking-[4px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>
          <p className="text-[11px] text-galla-ink-soft text-center mt-2">
            Weekly codes are sent to the shop owner&apos;s registered email
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || rawCode.length !== 8}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[11px] rounded-[6px] shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying Code...</span>
            </>
          ) : (
            <>
              <span>Enter Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Security & Grace Period Info */}
      <div className="mt-6 pt-5 border-t border-galla-line/80 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-galla-ink-soft">
          <Clock className="h-3.5 w-3.5 text-galla-teal shrink-0" />
          <span>Codes rotate weekly at 7:00 AM with a 12h grace period</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-galla-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-galla-teal shrink-0" />
          <span>Single-device session protection &amp; anti-brute force active</span>
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
