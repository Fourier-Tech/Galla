"use client";

import React, { useState } from "react";
import { X, Lock, KeyRound, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { changeRolePinsAction } from "@/app/actions/auth-actions";

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePinModal({ isOpen, onClose }: ChangePinModalProps) {
  const [emailPassword, setEmailPassword] = useState("");
  const [newOwnerPin, setNewOwnerPin] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!emailPassword) {
      setError("Please enter the shop email password to verify your identity.");
      return;
    }

    if (!newOwnerPin && !newStaffPin) {
      setError("Please specify at least one new PIN to update.");
      return;
    }

    if (newOwnerPin && newOwnerPin.length !== 6) {
      setError("New Owner PIN must be exactly 6 digits.");
      return;
    }

    if (newStaffPin && newStaffPin.length !== 6) {
      setError("New Staff PIN must be exactly 6 digits.");
      return;
    }

    if (newOwnerPin && newStaffPin && newOwnerPin === newStaffPin) {
      setError("Owner PIN and Staff PIN cannot be the same.");
      return;
    }

    setLoading(true);

    try {
      const res = await changeRolePinsAction({
        emailPassword,
        newOwnerPin: newOwnerPin || undefined,
        newStaffPin: newStaffPin || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to update role PINs.");
        setLoading(false);
        return;
      }

      setSuccessMsg(res.message || "Role PINs updated successfully.");
      setEmailPassword("");
      setNewOwnerPin("");
      setNewStaffPin("");
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch {
      setError("An unexpected error occurred while updating PINs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-galla-surface border border-galla-line rounded-[8px] p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-galla-paper border border-galla-line text-galla-teal">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-galla-ink tracking-tight">
                Update Role PINs
              </h3>
              <p className="text-[12.5px] text-galla-ink-soft">
                Manage your counter access codes (Owner &amp; Staff)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-[5px] bg-red-50 border border-red-200 text-red-900 text-[12.5px] flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-[5px] bg-emerald-50 border border-emerald-200 text-emerald-900 text-[12.5px] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* Email Password */}
          <div>
            <label className="block text-[12.5px] font-medium text-galla-ink mb-1">
              Shop Email Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-galla-ink-soft">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                disabled={loading}
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Enter shop account password"
                className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] pl-9 pr-3 py-2 text-[13.5px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />
            </div>
            <p className="text-[11px] text-galla-ink-soft mt-1">
              Required to verify owner authorization
            </p>
          </div>

          <div className="pt-2 border-t border-galla-line/60 grid grid-cols-2 gap-3">
            {/* New Owner PIN */}
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1">
                New Owner PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
                value={newOwnerPin}
                onChange={(e) =>
                  setNewOwnerPin(e.target.value.replace(/\D/g, ""))
                }
                placeholder="6 digits"
                className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] px-3 py-2 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal"
              />
            </div>

            {/* New Staff PIN */}
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1">
                New Staff PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
                value={newStaffPin}
                onChange={(e) =>
                  setNewStaffPin(e.target.value.replace(/\D/g, ""))
                }
                placeholder="6 digits"
                className="w-full bg-galla-paper/60 border border-galla-line rounded-[6px] px-3 py-2 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-galla-line">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[5px] border border-galla-line text-galla-ink font-sans text-[13px] font-medium hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !emailPassword ||
                (!newOwnerPin && !newStaffPin) ||
                (Boolean(newOwnerPin) && newOwnerPin.length !== 6) ||
                (Boolean(newStaffPin) && newStaffPin.length !== 6)
              }
              className="px-4 py-1.5 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update PINs</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePinModal;
