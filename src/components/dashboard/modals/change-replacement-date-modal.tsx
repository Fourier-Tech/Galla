"use client";

import React, { useState } from "react";
import { DashboardCustomerReplacement } from "@/types/dashboard";
import { updateCustomerReplacementDateAction } from "@/app/dashboard/actions";
import { X, Calendar, Loader2, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { getLocalDateString, formatDisplayNumber, formatBookingDate, getWhatsAppRescheduleUrl } from "@/lib/utils";

interface ChangeReplacementDateModalProps {
  replacement: DashboardCustomerReplacement | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: DashboardCustomerReplacement) => void;
  salonName?: string;
}

export function ChangeReplacementDateModal({
  replacement,
  isOpen,
  onClose,
  onSuccess,
  salonName,
}: ChangeReplacementDateModalProps) {
  if (!isOpen || !replacement) return null;

  return (
    <ChangeReplacementDateModalContent
      key={replacement.id}
      replacement={replacement}
      onClose={onClose}
      onSuccess={onSuccess}
      salonName={salonName}
    />
  );
}

function ChangeReplacementDateModalContent({
  replacement,
  onClose,
  onSuccess,
  salonName,
}: {
  replacement: DashboardCustomerReplacement;
  onClose: () => void;
  onSuccess: (updated: DashboardCustomerReplacement) => void;
  salonName?: string;
}) {
  const initialDateStr = replacement.expectedDate
    ? getLocalDateString(replacement.expectedDate)
    : getLocalDateString();
  const [newDate, setNewDate] = useState(initialDateStr);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rescheduledSuccess, setRescheduledSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setErrorMsg("Please select a date");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await updateCustomerReplacementDateAction(
        replacement.id,
        newDate,
        notes.trim() || undefined
      );

      if (res.success) {
        onSuccess({
          ...replacement,
          expectedDate: new Date(newDate).toISOString(),
          notes: notes.trim()
            ? replacement.notes
              ? `${replacement.notes}\n${notes.trim()}`
              : notes.trim()
            : replacement.notes,
        });
        if (replacement.customerPhone) {
          setRescheduledSuccess(true);
        } else {
          onClose();
        }
      } else {
        setErrorMsg(res.error || "Failed to update date");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const whatsappUrl =
    replacement.customerPhone && newDate
      ? getWhatsAppRescheduleUrl({
          phone: replacement.customerPhone,
          customerName: replacement.customerName,
          salonName: salonName || "our salon",
          orderNumber: formatDisplayNumber(replacement.orderNumber),
          newDate: newDate,
          isReplacement: true,
          productName: replacement.productName,
        })
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-galla-surface border border-galla-line rounded-[6px] shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-galla-line bg-galla-paper/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-amber-50 text-amber-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-galla-ink">
                Change Expected Pickup Date
              </h3>
              <p className="font-sans text-[11px] text-galla-ink-soft">
                Order #{formatDisplayNumber(replacement.orderNumber)} &bull; {replacement.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] text-galla-ink-soft hover:text-galla-ink transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {rescheduledSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-galla-ink">
                Expected Pickup Date Updated!
              </h3>
              <p className="text-[13px] text-galla-ink-soft mt-1">
                New expected pickup date for <strong className="text-galla-ink">{replacement.customerName}</strong>:{" "}
                <strong className="text-amber-800 font-semibold">
                  {formatBookingDate(newDate)}
                </strong>
              </p>
            </div>

            {whatsappUrl && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-[6px] space-y-2 text-left">
                <div className="text-[12px] font-semibold text-emerald-950 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Send Update to Customer on WhatsApp</span>
                </div>
                <p className="text-[11.5px] text-emerald-900/80 leading-snug">
                  Notify {replacement.customerName} {replacement.customerPhone ? `(${replacement.customerPhone})` : ""} about the new replacement pickup date.
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[13px] shadow-2xs transition-colors cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Send WhatsApp Update</span>
                </a>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-[5px] border border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink font-medium text-[13px] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="p-2.5 bg-galla-paper/50 border border-galla-line rounded-[5px] text-[12px] font-sans text-galla-ink space-y-0.5">
              <div className="font-semibold text-galla-ink">
                <span className="tabular-nums">{replacement.pendingQuantity}</span>x {replacement.productName}
              </div>
              <div className="text-[11px] text-galla-ink-soft">
                Current Date:{" "}
                <strong className="font-sans tabular-nums text-galla-ink">
                  {new Date(replacement.expectedDate).toLocaleDateString(
                    "en-IN",
                    { dateStyle: "medium" }
                  )}
                </strong>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                New Expected Pickup Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                min={getLocalDateString()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="w-full h-9 px-3 bg-galla-surface border border-galla-line rounded-[5px] font-sans tabular-nums text-[13px] text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Dealer delivering Thursday, customer agreed via call..."
                className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 rounded-[4px] text-red-800 text-[11.5px] font-sans">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-galla-line/60">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-[4px] border border-galla-line font-sans text-[12px] font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-[4px] bg-amber-700 hover:bg-amber-800 font-sans text-[12px] font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isSubmitting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Save New Date</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
