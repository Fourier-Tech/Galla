"use client";

import React, { useState, useEffect } from "react";
import { X, User, AlertCircle, Loader2 } from "lucide-react";
import { DashboardCustomer } from "@/types/dashboard";
import { updateCustomerAction } from "@/app/dashboard/actions";
import { formatPhoneNumber } from "@/lib/utils";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCustomer: (customer: DashboardCustomer) => void;
  customerToEdit: DashboardCustomer | null;
}

export function CustomerModal({
  isOpen,
  onClose,
  onSaveCustomer,
  customerToEdit,
}: CustomerModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other" | "">("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or customerToEdit changes
  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || "");
      setPhone(customerToEdit.phone || "");
      setEmail(customerToEdit.email || "");
      setGender(customerToEdit.gender || "");
      setNotes(customerToEdit.notes || "");
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setGender("");
      setNotes("");
    }
    setErrorMsg(null);
  }, [customerToEdit, isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Lock scroll
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !customerToEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Customer name is required.");
      return;
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setErrorMsg("A valid 10-digit contact phone number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateCustomerAction({
        id: customerToEdit.id,
        originalPhone: customerToEdit.phone,
        name: trimmedName,
        phone: formatPhoneNumber(phone),
        email: email.trim() || undefined,
        gender: gender ? gender : undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.customer) {
        onSaveCustomer(res.customer);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to update customer profile.");
      }
    } catch {
      setErrorMsg("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[460px] max-h-[90vh] flex flex-col bg-galla-surface border border-galla-line rounded-[8px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[6px] bg-galla-teal/10 text-galla-teal border border-galla-teal/20">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                Edit Client Details
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Update name, contact info, gender &amp; internal client preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-galla-ink-soft hover:text-galla-ink rounded-[4px] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[5px] bg-red-50 border border-red-200 text-red-800 text-[12.5px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-mono text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
            />
          </div>

          {/* Email Address & Gender Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Email Address <span className="text-galla-ink-soft text-[11px] font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
              />
            </div>

            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Gender <span className="text-galla-ink-soft text-[11px] font-normal">(Optional)</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none cursor-pointer"
              >
                <option value="">Not Specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Client Preferences &amp; Notes <span className="text-galla-ink-soft text-[11px] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sensitive scalp, prefers herbal oil, allergic to ammonia"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-galla-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[5px] border border-galla-line font-sans text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
