"use client";

import React, { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import {
  Lock,
  Delete,
  AlertTriangle,
  Loader2,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  verifyRolePinAction,
  requestForgotPinOtpAction,
  verifyOtpAndResetPinsAction,
  lockRoleSessionAction,
} from "@/app/actions/auth-actions";
import { UserRole } from "@/types/dashboard";

interface RoleKeypadModalProps {
  isOpen: boolean;
  salonName?: string;
  isEvicted?: boolean;
  onRoleVerified: (role: UserRole, activeSessionId?: string) => void;
}

export function RoleKeypadModal({
  isOpen,
  salonName = "Salon",
  isEvicted = false,
  onRoleVerified,
}: RoleKeypadModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryCooldown, setRetryCooldown] = useState<number | null>(null);

  // Forgot PIN sub-flow states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newOwnerPin, setNewOwnerPin] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [showForgotOwnerPin, setShowForgotOwnerPin] = useState(false);
  const [showForgotStaffPin, setShowForgotStaffPin] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (!retryCooldown || retryCooldown <= 0) return;
    const interval = setInterval(() => {
      setRetryCooldown((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCooldown]);

  const pinRef = React.useRef(pin);
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const loadingRef = React.useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const retryCooldownRef = React.useRef(retryCooldown);
  useEffect(() => {
    retryCooldownRef.current = retryCooldown;
  }, [retryCooldown]);

  const handleSubmitPin = useCallback(async (pinToVerify?: string) => {
    const targetPin = pinToVerify || pinRef.current;
    if (targetPin.length !== 6 || loadingRef.current || retryCooldownRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const res = await verifyRolePinAction(targetPin);
      if (!res.success) {
        setError(res.error || "Incorrect Role PIN.");
        if (res.retryAfterSeconds) {
          setRetryCooldown(res.retryAfterSeconds);
        }
        setPin("");
        setLoading(false);
        return;
      }

      if (res.role) {
        setPin("");
        onRoleVerified(res.role, res.activeSessionId);
      }
    } catch {
      setError("An unexpected connection error occurred.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [onRoleVerified]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (retryCooldownRef.current || loadingRef.current) return;
      if (pinRef.current.length < 6) {
        const next = pinRef.current + digit;
        setPin(next);
        setError(null);
        if (next.length === 6) {
          handleSubmitPin(next);
        }
      }
    },
    [handleSubmitPin]
  );

  const handleBackspace = useCallback(() => {
    if (retryCooldownRef.current || loadingRef.current) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    if (retryCooldownRef.current || loadingRef.current) return;
    setPin("");
    setError(null);
  }, []);

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("galla_role_session");
      try {
        const bc = new BroadcastChannel("galla_role_channel");
        bc.postMessage({ type: "ROLE_LOGOUT" });
        bc.close();
      } catch {}
    }
    await lockRoleSessionAction();
    await signOut({ callbackUrl: "/login" });
  };

  // Physical keyboard listener for digits, backspace, and Enter key
  useEffect(() => {
    if (!isOpen || isForgotMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pinRef.current.length === 6 && !loadingRef.current && !retryCooldownRef.current) {
          handleSubmitPin(pinRef.current);
        }
      } else if (e.key === "Escape") {
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isForgotMode, handleDigit, handleBackspace, handleClear, handleSubmitPin]);

  // Forgot PIN: Step 1 - Request OTP
  const handleRequestOtp = async () => {
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await requestForgotPinOtpAction();
      if (!res.success) {
        setForgotError(res.error || "Failed to send reset code.");
        setForgotLoading(false);
        return;
      }

      setMaskedEmail(res.maskedEmail || "your registered email");
      setForgotStep("reset");
    } catch {
      setForgotError("Unable to connect to security service.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot PIN: Step 2 - Verify OTP & Set New PINs
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    if (otp.length !== 6) {
      setForgotError("Please enter the complete 6-digit verification code.");
      setForgotLoading(false);
      return;
    }

    if (!newOwnerPin && !newStaffPin) {
      setForgotError("Please specify at least one new PIN to reset.");
      setForgotLoading(false);
      return;
    }

    if (newOwnerPin && newOwnerPin.length !== 6) {
      setForgotError("New Owner PIN must be exactly 6 digits.");
      setForgotLoading(false);
      return;
    }

    if (newStaffPin && newStaffPin.length !== 6) {
      setForgotError("New Staff PIN must be exactly 6 digits.");
      setForgotLoading(false);
      return;
    }

    if (newOwnerPin && newStaffPin && newOwnerPin === newStaffPin) {
      setForgotError("Owner PIN and Staff PIN cannot be the same.");
      setForgotLoading(false);
      return;
    }

    try {
      const res = await verifyOtpAndResetPinsAction({
        otp,
        newOwnerPin,
        newStaffPin,
      });

      if (!res.success) {
        setForgotError(res.error || "Failed to reset PINs.");
        setForgotLoading(false);
        return;
      }

      // Reset state and unlock as Owner
      setIsForgotMode(false);
      setForgotStep("request");
      setOtp("");
      setNewOwnerPin("");
      setNewStaffPin("");
      onRoleVerified("owner", res.activeSessionId);
    } catch {
      setForgotError("Connection failed while resetting PINs.");
    } finally {
      setForgotLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[370px] bg-galla-surface border border-galla-line rounded-[8px] p-6 shadow-xl space-y-5">
        {/* Eviction Warning */}
        {isEvicted && (
          <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] flex items-start gap-2 leading-snug">
            <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Session Displaced:</span> This role
              was opened on another device. Enter PIN to resume on this screen.
            </div>
          </div>
        )}

        {!isForgotMode ? (
          /* =========================================================================
             STANDARD ROLE KEYPAD VIEW
             ========================================================================= */
          <>
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 rounded-full bg-galla-paper text-galla-teal mb-1 border border-galla-line">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-[17px] text-galla-ink tracking-tight">
                {salonName}
              </h2>
              <p className="text-[12.5px] text-galla-ink-soft">
                Enter your 6-digit Role Code (Owner or Staff)
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="p-2.5 rounded-[5px] bg-red-50 border border-red-200 text-red-900 text-[12px] flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Rate Limit Cooldown Notice */}
            {retryCooldown && (
              <div className="p-2.5 rounded-[5px] bg-amber-50 border border-amber-200 text-amber-900 text-[12px] text-center font-medium">
                Keypad locked. Retry in {retryCooldown}s
              </div>
            )}

            {/* PIN Indicator Dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const filled = index < pin.length;
                return (
                  <div
                    key={index}
                    className={`h-3 w-3 rounded-full transition-all duration-150 ${
                      filled
                        ? "bg-galla-teal scale-110 shadow-xs"
                        : "bg-galla-paper border border-galla-line"
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad Grid (3 x 4) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={loading || Boolean(retryCooldown)}
                  onClick={() => handleDigit(digit)}
                  className="h-12 rounded-[6px] bg-galla-paper/70 hover:bg-galla-paper active:bg-galla-paper/90 border border-galla-line text-[18px] font-semibold text-galla-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                disabled={loading || pin.length === 0 || Boolean(retryCooldown)}
                onClick={handleClear}
                className="h-12 rounded-[6px] bg-galla-paper/40 hover:bg-galla-paper border border-galla-line text-[12px] font-medium text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
              >
                Clear
              </button>

              {/* Zero */}
              <button
                type="button"
                disabled={loading || Boolean(retryCooldown)}
                onClick={() => handleDigit("0")}
                className="h-12 rounded-[6px] bg-galla-paper/70 hover:bg-galla-paper active:bg-galla-paper/90 border border-galla-line text-[18px] font-semibold text-galla-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                disabled={loading || pin.length === 0 || Boolean(retryCooldown)}
                onClick={handleBackspace}
                className="h-12 rounded-[6px] bg-galla-paper/40 hover:bg-galla-paper border border-galla-line text-galla-ink-soft hover:text-galla-ink flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
              >
                <Delete className="h-4 w-4" />
              </button>
            </div>

            {/* Unlock Action Button */}
            <button
              type="button"
              disabled={loading || pin.length !== 6 || Boolean(retryCooldown)}
              onClick={() => handleSubmitPin()}
              className="w-full inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white text-[13.5px] font-medium py-2.5 rounded-[6px] shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <span>Unlock Counter</span>
                  <ArrowRight className="h-4 w-4 ml-0.5" />
                </>
              )}
            </button>

            {/* Footer Options */}
            <div className="pt-2 flex items-center justify-between text-[12px] text-galla-ink-soft border-t border-galla-line/60">
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(true);
                  setForgotError(null);
                }}
                className="hover:text-galla-teal hover:underline transition-colors cursor-pointer"
              >
                Forgot Role PIN?
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="hover:text-red-700 hover:underline transition-colors cursor-pointer"
              >
                Sign Out of Shop
              </button>
            </div>
          </>
        ) : (
          /* =========================================================================
             FORGOT PIN RECOVERY VIEW (EMAIL OTP)
             ========================================================================= */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsForgotMode(false)}
                className="inline-flex items-center gap-1 text-[12px] text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to PIN Keypad</span>
              </button>
              <span className="text-[11px] font-semibold text-galla-teal uppercase tracking-wider">
                Recovery
              </span>
            </div>

            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 rounded-full bg-galla-paper text-galla-teal mb-1 border border-galla-line">
                <KeyRound className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-[16px] text-galla-ink">
                Reset Role PINs
              </h2>
              <p className="text-[12px] text-galla-ink-soft">
                {forgotStep === "request"
                  ? "We will send a 6-digit verification code to the salon owner's registered email."
                  : `Enter the 6-digit code sent to ${maskedEmail || "your email"}`}
              </p>
            </div>

            {forgotError && (
              <div
                role="alert"
                className="p-2.5 rounded-[5px] bg-red-50 border border-red-200 text-red-900 text-[12px] flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === "request" ? (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={forgotLoading}
                  onClick={handleRequestOtp}
                  className="w-full inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white text-[13px] font-medium py-2.5 rounded-[6px] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      <span>Send Verification Code to Owner</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-3">
                {/* 6-Digit OTP */}
                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] px-3 py-2 text-[16px] text-center font-bold tracking-[4px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal"
                  />
                </div>

                {/* New Owner PIN */}
                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1">
                    New Owner PIN <span className="text-galla-ink-soft text-[11px] font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotOwnerPin ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={6}
                      value={newOwnerPin}
                      onChange={(e) =>
                        setNewOwnerPin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="6 digits"
                      className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-3 pr-8 py-2 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowForgotOwnerPin(!showForgotOwnerPin)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-galla-ink-soft hover:text-galla-ink cursor-pointer"
                    >
                      {showForgotOwnerPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New Staff PIN */}
                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1">
                    New Staff PIN <span className="text-galla-ink-soft text-[11px] font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotStaffPin ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={6}
                      value={newStaffPin}
                      onChange={(e) =>
                        setNewStaffPin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="6 digits"
                      className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-3 pr-8 py-2 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowForgotStaffPin(!showForgotStaffPin)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-galla-ink-soft hover:text-galla-ink cursor-pointer"
                    >
                      {showForgotStaffPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Inline Duplicate Warning */}
                {Boolean(newOwnerPin && newStaffPin && newOwnerPin === newStaffPin) && (
                  <div className="p-2 rounded-[5px] bg-red-50 border border-red-200 text-red-800 text-[11.5px] flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span>Owner PIN and Staff PIN cannot be identical.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    forgotLoading ||
                    otp.length !== 6 ||
                    (!newOwnerPin && !newStaffPin) ||
                    (Boolean(newOwnerPin) && newOwnerPin.length !== 6) ||
                    (Boolean(newStaffPin) && newStaffPin.length !== 6) ||
                    Boolean(newOwnerPin && newStaffPin && newOwnerPin === newStaffPin)
                  }
                  className="w-full inline-flex items-center justify-center gap-2 bg-galla-teal hover:opacity-95 text-white text-[13px] font-medium py-2.5 rounded-[6px] shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving &amp; Unlocking...</span>
                    </>
                  ) : (
                    <span>Save &amp; Unlock Counter</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RoleKeypadModal;
