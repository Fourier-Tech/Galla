"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Calendar,
  Hash,
  Sparkles,
  KeyRound,
  Store,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { updateTenantAction, type PlanType } from "@/app/hq/actions";

type Salon = {
  _id: string;
  name: string;
  slug?: string;
  tenantCode?: string;
  phone?: string;
  address?: string;
  ownerEmail?: string;
  status: "active" | "trial" | "suspended";
  planType: PlanType;
  planExpiresAt?: string | null;
};

interface Props {
  salon: Salon;
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

export function ManagePlanModal({ salon, onClose }: Props) {
  // Salon profile fields
  const [name, setName] = useState(salon.name || "");
  const [phone, setPhone] = useState(salon.phone || "");
  const [address, setAddress] = useState(salon.address || "");
  const [ownerEmail, setOwnerEmail] = useState(salon.ownerEmail || "");

  // Plan & Status
  const [planType, setPlanType] = useState<PlanType>(salon.planType || "trial");
  const [status, setStatus] = useState<"active" | "suspended" | "trial">(
    salon.status || "active"
  );

  // Expiry calculation
  const initialDateStr = salon.planExpiresAt
    ? new Date(salon.planExpiresAt).toISOString().split("T")[0]
    : calculateDateFromDays(28);
  const [expiresAt, setExpiresAt] = useState(initialDateStr);
  const [durationDays, setDurationDays] = useState(() =>
    calculateDaysFromDate(initialDateStr)
  );

  // Security / PIN & Password reset (optional)
  const [showSecurity, setShowSecurity] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetOwnerPin, setResetOwnerPin] = useState("");
  const [resetStaffPin, setResetStaffPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);

  const handlePlanChange = (type: PlanType) => {
    setPlanType(type);
    if (type === "active") {
      setStatus("active");
    } else if (type === "trial") {
      setStatus("trial");
    }
  };

  const handleDaysChange = (days: number) => {
    setDurationDays(days);
    if (days > 0) {
      setExpiresAt(calculateDateFromDays(days));
    } else {
      setExpiresAt("");
    }
  };

  const handleDateChange = (dateStr: string) => {
    setExpiresAt(dateStr);
    if (dateStr) {
      setDurationDays(calculateDaysFromDate(dateStr));
    }
  };

  const addExtraDays = (additionalDays: number) => {
    // If currently has a valid future date, extend from that date; otherwise from today
    let base = new Date();
    if (expiresAt) {
      const current = new Date(expiresAt);
      if (current.getTime() > base.getTime()) {
        base = current;
      }
    }
    base.setDate(base.getDate() + additionalDays);
    const newDateStr = base.toISOString().split("T")[0];
    setExpiresAt(newDateStr);
    setDurationDays(calculateDaysFromDate(newDateStr));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!name.trim()) {
      setError("Salon name is required.");
      return;
    }

    if (planType !== "lifetime") {
      if (!expiresAt) {
        setError("Please set a valid expiry date or duration.");
        return;
      }
    }

    if (resetPassword && resetPassword.trim().length < 6) {
      setError("New master password must be at least 6 characters.");
      return;
    }

    if (resetOwnerPin && resetOwnerPin.length !== 6) {
      setError("Owner PIN must be exactly 6 digits.");
      return;
    }
    if (resetStaffPin && resetStaffPin.length !== 6) {
      setError("Staff PIN must be exactly 6 digits.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await updateTenantAction(salon._id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
        planType,
        status,
        expiresAt: planType !== "lifetime" ? expiresAt : undefined,
        resetPassword: resetPassword.trim() || undefined,
        resetOwnerPin: resetOwnerPin || undefined,
        resetStaffPin: resetStaffPin || undefined,
      });

      if (res.success) {
        onClose();
      } else {
        setError(res.error ?? "Failed to update salon.");
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
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-[540px] flex flex-col max-h-[92vh] overflow-hidden border border-galla-line animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[8px] bg-galla-teal/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-galla-teal" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-galla-ink">Manage Salon & Plan</h2>
              <p className="text-[12px] text-galla-ink-soft">
                {salon.tenantCode ? `${salon.tenantCode} • ` : ""}
                {salon.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

          <form id="manage-form" onSubmit={handleSubmit} className="space-y-4">
            {/* ── Profile Details ───────────────────────── */}
            <div className="space-y-3">
              <div className="text-[12px] font-bold text-galla-ink uppercase tracking-wider text-galla-teal">
                Salon Profile
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                  Salon Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                    Owner Login Email
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal"
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
                    className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                  Salon Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Lila Icon, Nikol, Ahmedabad"
                  className="w-full bg-galla-paper border border-galla-line rounded-[6px] px-3.5 py-2 text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal"
                />
              </div>
            </div>

            {/* ── Plan & Subscription ───────────────────── */}
            <div className="pt-2 border-t border-galla-line space-y-3">
              <div className="text-[12px] font-bold text-galla-ink uppercase tracking-wider text-galla-teal">
                Plan & Account Status
              </div>

              {/* Plan Type Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                  Current Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["trial", "active", "lifetime"] as PlanType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePlanChange(p)}
                      className={[
                        "py-2 rounded-[6px] text-[13px] font-semibold border transition-all cursor-pointer",
                        planType === p
                          ? "bg-galla-ink text-white border-galla-ink shadow-sm"
                          : "bg-white text-galla-ink-soft border-galla-line hover:border-galla-ink/30",
                      ].join(" ")}
                    >
                      <span className="capitalize">{p === "active" ? "Yearly (Paid)" : p}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Switcher */}
              <div>
                <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5">
                  Access Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "active", label: "Active", cls: "bg-galla-sage text-white border-galla-sage" },
                    { id: "trial", label: "Trial", cls: "bg-galla-brass text-white border-galla-brass" },
                    { id: "suspended", label: "Suspended", cls: "bg-galla-brick text-white border-galla-brick" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(s.id as any)}
                      className={[
                        "py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all cursor-pointer",
                        status === s.id
                          ? `${s.cls} shadow-sm`
                          : "bg-white text-galla-ink-soft border-galla-line hover:bg-galla-paper",
                      ].join(" ")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry Settings */}
              {planType !== "lifetime" && (
                <div className="p-3.5 bg-galla-paper rounded-[8px] border border-galla-line space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>Add Duration / Free Months</span>
                      <span className="text-galla-teal flex items-center gap-1 font-medium">
                        <Sparkles className="h-3 w-3" /> Extends date automatically
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "+14 Days", days: 14 },
                        { label: "+28 Days", days: 28 },
                        { label: "+1 Month Free (30d)", days: 30 },
                        { label: "+2 Months Free (60d)", days: 60 },
                        { label: "+3 Months Free (90d)", days: 90 },
                        { label: "+1 Year (365d)", days: 365 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => addExtraDays(preset.days)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-[4px] border border-galla-line bg-white hover:bg-galla-teal-soft text-galla-ink transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dual Synchronized Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Hash className="h-3 w-3 text-galla-teal" /> Days from Today
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={durationDays || ""}
                        onChange={(e) => handleDaysChange(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 28"
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[14px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-galla-teal" /> Expiry Date
                      </label>
                      <input
                        type="date"
                        value={expiresAt}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[14px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                      />
                    </div>
                  </div>

                  {formattedExpiryDisplay && (
                    <div className="bg-white border border-galla-line/80 rounded-[6px] px-3 py-2 text-[12px] flex items-center justify-between text-galla-ink">
                      <span className="text-galla-ink-soft">Expires on:</span>
                      <span className="font-semibold text-galla-teal">
                        {formattedExpiryDisplay} ({durationDays} days remaining)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Security / Reset PINs (Collapsible) ───── */}
            <div className="pt-2 border-t border-galla-line">
              <button
                type="button"
                onClick={() => setShowSecurity(!showSecurity)}
                className="w-full flex items-center justify-between py-1 text-[12px] font-bold text-galla-ink uppercase tracking-wider hover:text-galla-teal transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-galla-teal" />
                  Master Shop Password & PIN Reset (Optional)
                </span>
                {showSecurity ? (
                  <ChevronUp className="h-4 w-4 text-galla-ink-soft" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-galla-ink-soft" />
                )}
              </button>

              {showSecurity && (
                <div className="mt-3 p-3 bg-galla-paper rounded-[8px] border border-galla-line space-y-3 animate-in fade-in duration-100">
                  <p className="text-[11px] text-galla-ink-soft">
                    Leave any field blank if you do not want to alter their current credentials.
                  </p>

                  <div>
                    <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                      New Master Shop Login Password
                    </label>
                    <input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Leave blank to keep existing password"
                      className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[13px] font-mono text-galla-ink focus:outline-none focus:border-galla-teal"
                    />
                    <p className="text-[10px] text-galla-ink-soft mt-0.5">
                      Resets the shop owner&apos;s primary login password. Minimum 6 characters.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-galla-line/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                        New Owner PIN (6 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={resetOwnerPin}
                        onChange={(e) => setResetOwnerPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 888888"
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[13px] font-mono text-center font-bold tracking-widest text-galla-ink focus:outline-none focus:border-galla-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wide mb-1">
                        New Staff PIN (6 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={resetStaffPin}
                        onChange={(e) => setResetStaffPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 567890"
                        className="w-full bg-white border border-galla-line rounded-[6px] px-3 py-1.5 text-[13px] font-mono text-center font-bold tracking-widest text-galla-ink focus:outline-none focus:border-galla-teal"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-3.5 border-t border-galla-line flex items-center justify-end gap-2 bg-galla-paper/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper rounded-[6px] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="manage-form"
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 bg-galla-teal hover:bg-galla-teal/90 text-white px-5 py-2 rounded-[6px] text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
