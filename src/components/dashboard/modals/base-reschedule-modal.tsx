"use client";

import React, { useState } from "react";
import { X, Calendar, Loader2, AlertCircle } from "lucide-react";
import {
  formatBookingDate,
  formatAppointmentTime,
  getBookingUrgency,
  formatRupee,
  getLocalDateString,
} from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

export interface BaseRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  referenceText: string;
  entityName: string;
  dueAmount?: number;
  dueAmountLabel?: string;
  currentSlotLabel: string;
  currentDate?: Date | string | null;
  currentTime?: string | null;
  dateLabel: string;
  initialDate?: Date | string | null;
  initialTime?: string | null;
  showTimePicker?: boolean;
  submitButtonLabel: string;
  confirmDialogTitle?: string;
  extraHeaderControl?: React.ReactNode;
  onSave: (payload: { newDate: string; newTime?: string }) => Promise<{ success: boolean; error?: string }>;
}

export function BaseRescheduleModal(props: BaseRescheduleModalProps) {
  if (!props.isOpen) return null;

  return (
    <BaseRescheduleModalContent
      key={`${props.referenceText}-${props.initialDate}-${props.initialTime}-${props.title}`}
      {...props}
    />
  );
}

function BaseRescheduleModalContent({
  onClose,
  title,
  referenceText,
  entityName,
  dueAmount,
  dueAmountLabel = "Due",
  currentSlotLabel,
  currentDate,
  currentTime,
  dateLabel,
  initialDate,
  initialTime,
  showTimePicker = true,
  submitButtonLabel,
  confirmDialogTitle,
  extraHeaderControl,
  onSave,
}: BaseRescheduleModalProps) {
  const todayStr = getLocalDateString();
  const resolvedInitialDate = initialDate ? getLocalDateString(initialDate) : todayStr;

  const [newDate, setNewDate] = useState(resolvedInitialDate);
  const [newTime, setNewTime] = useState(initialTime || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setErrorMsg(`Please select a valid ${dateLabel.toLowerCase()}`);
      return;
    }
    setShowConfirm(true);
  };

  const executeReschedule = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await onSave({
        newDate,
        newTime: showTimePicker ? newTime.trim() || undefined : undefined,
      });

      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to update schedule");
      }
    } catch {
      setErrorMsg("An unexpected error occurred while rescheduling");
    } finally {
      setIsSubmitting(false);
    }
  };

  const urgency = newDate ? getBookingUrgency(newDate) : null;

  const setPresetDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNewDate(getLocalDateString(d));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/40">
          <div>
            <h3 className="font-heading font-semibold text-[17px] text-galla-ink">{title}</h3>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              {referenceText} &bull; <strong className="text-galla-ink">{entityName}</strong>
              {dueAmount !== undefined && dueAmount > 0 ? (
                <span className="text-rose-700 font-semibold ml-1">
                  ({dueAmountLabel}: {formatRupee(dueAmount)})
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded hover:bg-galla-line/50 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit}>
          <div className="p-5 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[5px] text-[12.5px] font-sans text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Optional extra switcher, e.g. for PO delivery vs due date */}
            {extraHeaderControl}

            {/* Current Scheduled Date & Time */}
            <div className="p-3 bg-galla-paper/50 border border-galla-line rounded-[5px] text-[12.5px] font-sans flex items-center justify-between text-galla-ink-soft">
              <span>{currentSlotLabel}</span>
              <strong className="text-galla-ink font-medium">
                {formatBookingDate(currentDate || undefined) || "Not set"}
                {currentTime ? ` at ${formatAppointmentTime(currentTime)}` : showTimePicker ? " (Time not set)" : ""}
              </strong>
            </div>

            {/* Date and Time Inputs Grid */}
            <div className={`grid gap-3 ${showTimePicker ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  {dateLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  autoFocus
                  value={newDate}
                  min={todayStr}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer shadow-xs"
                />
              </div>

              {/* Time Input */}
              {showTimePicker && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                      Time <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    {newTime && (
                      <button
                        type="button"
                        onClick={() => setNewTime("")}
                        className="text-[10.5px] text-red-600 hover:underline cursor-pointer"
                      >
                        Clear time
                      </button>
                    )}
                  </div>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* Quick Date Presets */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
                QUICK DATE SHORTCUTS:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setPresetDate(0)}
                  className="px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper hover:bg-galla-line text-galla-ink transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDate(1)}
                  className="px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[4px] border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDate(2)}
                  className="px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[4px] border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition-colors cursor-pointer"
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDate(7)}
                  className="px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper hover:bg-galla-line text-galla-ink transition-colors cursor-pointer"
                >
                  In 1 Week
                </button>
              </div>
            </div>

            {/* New Preview Tag */}
            {newDate && (
              <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px] text-[12px] font-sans flex items-center justify-between">
                <span className="text-galla-ink-soft">New Scheduled Slot:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-galla-teal">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatBookingDate(newDate)}
                    {newTime ? ` at ${formatAppointmentTime(newTime)}` : showTimePicker ? " (Time not set)" : ""}
                    {urgency?.label ? ` • ${urgency.label}` : ""}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-galla-line bg-galla-paper/30">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-[5px] font-sans text-[13px] font-medium text-galla-ink-soft hover:text-galla-ink border border-galla-line hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDate}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[5px] font-sans text-[13px] font-medium bg-galla-teal hover:opacity-95 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{submitButtonLabel}</span>
              )}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={confirmDialogTitle || `Confirm ${title}`}
          description={
            <span>
              Are you sure you want to reschedule {referenceText} for{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{entityName}&rdquo;</strong> to{" "}
              <strong className="font-semibold text-galla-ink">{formatBookingDate(newDate)}</strong>
              {newTime ? (
                <>
                  {" "}at <strong className="font-semibold text-galla-ink">{formatAppointmentTime(newTime)}</strong>
                </>
              ) : showTimePicker ? (
                " (time not specified)"
              ) : (
                ""
              )}?
            </span>
          }
          confirmLabel={`Yes, Confirm`}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeReschedule}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
