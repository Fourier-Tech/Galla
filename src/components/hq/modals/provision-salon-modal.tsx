"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Store,
  Calendar,
  Hash,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { provisionTenantAction, type PlanType } from "@/app/hq/actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function calculateDateFromDays(days: number): string {
  if (!days || days < 1) return "";
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function calculateDaysFromDate(dateStr: string): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function ProvisionSalonModal({ isOpen, onClose }: Props) {
  // Profile fields
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("INR");

  // Credentials fields
  const [showCredentials, setShowCredentials] = useState(false);
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [ownerPin, setOwnerPin] = useState("888888");
  const [staffPin, setStaffPin] = useState("567890");

  // Subscription & Expiry fields
  const [planType, setPlanType] = useState<PlanType>("trial");
  const [trialDays, setTrialDays] = useState(28);
  const [expiresAt, setExpiresAt] = useState(() => calculateDateFromDays(28));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);

  // When switching plan types, set reasonable defaults
  const handlePlanChange = (type: PlanType) => {
    setPlanType(type);
    if (type === "trial") {
      setTrialDays(28);
      setExpiresAt(calculateDateFromDays(28));
    } else if (type === "active") {
      // Yearly plan default: 365 days
      setTrialDays(365);
      setExpiresAt(calculateDateFromDays(365));
    }
  };

  // Synchronized days input handler
  const handleDaysChange = (daysVal: number) => {
    setTrialDays(daysVal);
    if (daysVal > 0) {
      setExpiresAt(calculateDateFromDays(daysVal));
    } else {
      setExpiresAt("");
    }
  };

  // Synchronized date picker handler
  const handleDateChange = (dateVal: string) => {
    setExpiresAt(dateVal);
    if (dateVal) {
      setTrialDays(calculateDaysFromDate(dateVal));
    }
  };

  // Quick Presets
  const applyPreset = (daysCount: number) => {
    setTrialDays(daysCount);
    setExpiresAt(calculateDateFromDays(daysCount));
  };

  if (!isOpen) return null;

  const reset = () => {
    setName("");
    setOwnerEmail("");
    setPhone("");
    setAddress("");
    setCurrency("INR");
    setPassword("password123");
    setOwnerPin("888888");
    setStaffPin("567890");
    setShowCredentials(false);
    setPlanType("trial");
    setTrialDays(28);
    setExpiresAt(calculateDateFromDays(28));
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!name.trim()) {
      setError("Salon name is required.");
      return;
    }
    if (!ownerEmail.trim()) {
      setError("Owner email is required.");
      return;
    }

    if (planType !== "lifetime") {
      if (trialDays < 1 && !expiresAt) {
        setError("Please enter duration in days or select an expiry date.");
        return;
      }
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await provisionTenantAction({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        currency,
        password: password.trim() || "password123",
        ownerPin: ownerPin.trim() || "888888",
        staffPin: staffPin.trim() || "567890",
        planType,
        trialDays: planType !== "lifetime" ? trialDays : undefined,
        expiresAt: planType !== "lifetime" ? expiresAt : undefined,
      });

      if (res.success) {
        reset();
        onClose();
      } else {
        setError(res.error ?? "Failed to provision salon.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const formattedExpiryDisplay = expiresAt
    ? new Date(expiresAt + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-galla-ink/40 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-[560px] flex flex-col max-h-[92vh] overflow-hidden border border-galla-line animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[8px] bg-galla-teal/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-galla-teal" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-galla-ink">Provision New Salon</h2>
              <p className="text-[12px] text-galla-ink-soft">Create full salon profile and access</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-[6px] flex items-center gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          <form id="provision-form" onSubmit={handleSubmit} className="space-y-4">
            {/* ── Salon Basic Details ───────────────────────── */}
            <div className="space-y-3">
              <div className="text-[12px] font-bold text-galla-ink uppercase tracking-wider text-galla-teal">
                Salon Profile Details
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                  Salon Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ghachu Beauty Care"
                  className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all placeholder:text-galla-ink-soft/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                    Owner Login Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@ghachu.com"
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all placeholder:text-galla-ink-soft/40"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all placeholder:text-galla-ink-soft/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                    Salon Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Lila Icon, Nikol, Ahmedabad"
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-2 focus:ring-galla-teal/10 transition-all placeholder:text-galla-ink-soft/40"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal transition-all"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Plan & Subscription ────────────────────────── */}
            <div className="pt-2 border-t border-galla-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-galla-ink uppercase tracking-wider text-galla-teal">
                  Subscription & Expiry Plan
                </span>
                <span className="text-[11px] text-galla-ink-soft">
                  Yearly plan supports free promotional months
                </span>
              </div>

              {/* Plan Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                {(["trial", "active", "lifetime"] as PlanType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlanChange(p)}
                    className={[
                      "py-2.5 rounded-[6px] text-[13px] font-semibold border transition-all cursor-pointer flex flex-col items-center",
                      planType === p
                        ? "bg-galla-ink text-white border-galla-ink shadow-sm"
                        : "bg-white text-galla-ink-soft border-galla-line hover:border-galla-ink/30",
                    ].join(" ")}
                  >
                    <span className="capitalize">{p === "active" ? "Yearly (Paid)" : p}</span>
                  </button>
                ))}
              </div>

              {/* Expiry Settings (if not Lifetime) */}
              {planType !== "lifetime" && (
                <div className="p-3.5 bg-galla-paper rounded-[8px] border border-galla-line space-y-3">
                  {/* Quick presets for duration */}
                  <div>
                    <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>Quick Duration Presets</span>
                      <span className="text-galla-teal flex items-center gap-1 font-medium">
                        <Sparkles className="h-3 w-3" /> Auto-calculates date
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {planType === "trial" ? (
                        <>
                          {[
                            { label: "14 Days", days: 14 },
                            { label: "28 Days", days: 28 },
                            { label: "30 Days (1 Mo)", days: 30 },
                            { label: "60 Days (2 Mo)", days: 60 },
                          ].map((preset) => (
                            <button
                              key={preset.days}
                              type="button"
                              onClick={() => applyPreset(preset.days)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-[4px] border transition-all cursor-pointer ${
                                trialDays === preset.days
                                  ? "bg-galla-teal text-white border-galla-teal font-semibold"
                                  : "bg-white text-galla-ink border-galla-line hover:bg-galla-teal-soft"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { label: "1 Year (365d)", days: 365 },
                            { label: "1 Yr + 1 Mo Free (395d)", days: 395 },
                            { label: "1 Yr + 2 Mo Free (425d)", days: 425 },
                            { label: "1 Yr + 3 Mo Free (455d)", days: 455 },
                            { label: "2 Years (730d)", days: 730 },
                          ].map((preset) => (
                            <button
                              key={preset.days}
                              type="button"
                              onClick={() => applyPreset(preset.days)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-[4px] border transition-all cursor-pointer ${
                                trialDays === preset.days
                                  ? "bg-galla-teal text-white border-galla-teal font-semibold"
                                  : "bg-white text-galla-ink border-galla-line hover:bg-galla-teal-soft"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dual Synchronized Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Hash className="h-3 w-3 text-galla-teal" /> Duration in Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={trialDays || ""}
                        onChange={(e) => handleDaysChange(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 28"
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[14px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-galla-teal" /> Calculated Expiry Date
                      </label>
                      <input
                        type="date"
                        value={expiresAt}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[14px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                      />
                    </div>
                  </div>

                  {/* Live Expiry Summary */}
                  {formattedExpiryDisplay && (
                    <div className="bg-white border border-galla-line/80 rounded-[6px] px-3 py-2 text-[12px] flex items-center justify-between text-galla-ink">
                      <span className="text-galla-ink-soft">Expires on:</span>
                      <span className="font-semibold text-galla-teal">
                        {formattedExpiryDisplay} ({trialDays} days from today)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Security & Credentials (Collapsible) ───────── */}
            <div className="pt-2 border-t border-galla-line">
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="w-full flex items-center justify-between py-1 text-[12px] font-bold text-galla-ink uppercase tracking-wider hover:text-galla-teal transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-galla-teal" />
                  Initial Password & PINs (Defaults)
                </span>
                {showCredentials ? (
                  <ChevronUp className="h-4 w-4 text-galla-ink-soft" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-galla-ink-soft" />
                )}
              </button>

              {showCredentials && (
                <div className="mt-3 p-3 bg-galla-paper rounded-[8px] border border-galla-line space-y-3 animate-in fade-in duration-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                        Default Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-white border border-galla-line rounded-[6px] pl-2.5 pr-8 py-1.5 text-[13px] font-mono text-galla-ink focus:outline-none focus:border-galla-teal"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                        Owner PIN (6 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={ownerPin}
                        onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-white border border-galla-line rounded-[6px] px-2.5 py-1.5 text-[13px] font-mono text-galla-ink focus:outline-none focus:border-galla-teal text-center font-bold tracking-widest"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                        Staff PIN (6 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={staffPin}
                        onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-white border border-galla-line rounded-[6px] px-2.5 py-1.5 text-[13px] font-mono text-galla-ink focus:outline-none focus:border-galla-teal text-center font-bold tracking-widest"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-galla-ink-soft">
                    The owner can update these anytime inside their salon profile and settings.
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-3.5 border-t border-galla-line flex items-center justify-end gap-2 bg-galla-paper/50 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-[13px] font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper rounded-[6px] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="provision-form"
            disabled={loading || !name.trim() || !ownerEmail.trim()}
            className="flex items-center gap-2 bg-galla-teal hover:bg-galla-teal/90 text-white px-5 py-2 rounded-[6px] text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Provision Salon"}
          </button>
        </div>
      </div>
    </div>
  );
}
