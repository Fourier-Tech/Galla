"use client";

import React, { useState } from "react";
import { X, Calendar, Loader2, AlertCircle, CheckCircle2, MessageSquare, Phone } from "lucide-react";
import {
  formatBookingDate,
  formatAppointmentTime,
  getBookingUrgency,
  formatRupee,
  getLocalDateString,
  getWhatsAppRescheduleUrl,
  getWhatsAppReminderUrl,
} from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

export interface BaseRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  referenceText: string;
  entityName: string;
  customerPhone?: string;
  salonName?: string;
  orderType?: string;
  isReplacement?: boolean;
  productName?: string;
  orderNumber?: string;
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
  customerPhone,
  salonName,
  orderType,
  isReplacement,
  productName,
  orderNumber,
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
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rescheduledSuccess, setRescheduledSuccess] = useState(false);
  const [savedDate, setSavedDate] = useState("");
  const [savedTime, setSavedTime] = useState<string | undefined>("");

  const currentUrgency = currentDate ? getBookingUrgency(currentDate) : null;
  const isCurrentDeliveryDay = currentUrgency
    ? currentUrgency.tone === "today" || currentUrgency.tone === "overdue"
    : false;

  const todayWaUrl =
    customerPhone && isCurrentDeliveryDay
      ? getWhatsAppReminderUrl({
          phone: customerPhone,
          customerName: entityName,
          salonName: salonName || "our salon",
          bookingDate: currentDate || undefined,
          bookingTime: currentTime || undefined,
          orderType: orderType as any,
          productName: productName,
          orderId: orderNumber,
          isReplacement: isReplacement,
          isToday: true,
        })
      : null;

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
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await onSave({
        newDate,
        newTime: showTimePicker ? newTime.trim() || undefined : undefined,
      });

      if (res.success) {
        if (customerPhone) {
          setSavedDate(newDate);
          setSavedTime(showTimePicker ? newTime.trim() || undefined : undefined);
          setRescheduledSuccess(true);
        } else {
          onClose();
        }
      } else {
        setErrorMsg(res.error || "Failed to update schedule");
      }
    } catch {
      setErrorMsg("An unexpected error occurred while rescheduling");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  const urgency = newDate ? getBookingUrgency(newDate) : null;

  const setPresetDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNewDate(getLocalDateString(d));
  };

  const whatsappUrl =
    customerPhone && savedDate
      ? getWhatsAppRescheduleUrl({
          phone: customerPhone,
          customerName: entityName,
          salonName: salonName || "our salon",
          orderNumber: orderNumber || referenceText,
          newDate: savedDate,
          newTime: savedTime,
          orderType: orderType,
          isReplacement: isReplacement,
          productName: productName,
        })
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/40">
          <div>
            <h3 className="text-[15px] font-bold text-galla-ink">{title}</h3>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              {referenceText} &bull; <strong className="text-galla-ink">{entityName}</strong>
              {dueAmount !== undefined && dueAmount > 0 ? (
                <span className="text-rose-700 font-semibold ml-1 tabular-nums">
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
        {rescheduledSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-galla-ink">
                Schedule Updated Successfully!
              </h3>
              <p className="text-[13px] text-galla-ink-soft mt-1">
                New scheduled date for <strong className="text-galla-ink">{entityName}</strong>:{" "}
                <strong className="text-galla-teal font-semibold">
                  {formatBookingDate(savedDate)}
                  {savedTime ? ` at ${formatAppointmentTime(savedTime)}` : ""}
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
                  Notify {entityName} {customerPhone ? `(${customerPhone})` : ""} about the new scheduled pickup date.
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
                  {currentDate
                    ? `${formatBookingDate(currentDate)}${currentTime ? ` at ${formatAppointmentTime(currentTime)}` : showTimePicker ? " (Time not set)" : ""}`
                    : "Not set"}
                </strong>
              </div>

              {/* Delivery Day Contact (shown on the day of delivery) */}
              {customerPhone && isCurrentDeliveryDay && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200/90 rounded-[5px] text-[12px]">
                  <span className="text-emerald-950 font-medium">Delivery Day Contact:</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${customerPhone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium transition-colors shadow-2xs"
                      title={`Call ${entityName}: ${customerPhone}`}
                    >
                      <Phone className="h-3 w-3 text-amber-800" />
                      <span>Call</span>
                    </a>
                    {todayWaUrl && (
                      <a
                        href={todayWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-emerald-100/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-medium transition-colors shadow-2xs"
                        title="Send message via WhatsApp"
                      >
                        <MessageSquare className="h-3 w-3 text-emerald-700" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Date and Time Inputs Grid */}
              <div className={`grid gap-3 ${showTimePicker ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                {/* Date Input */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                    {dateLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    autoFocus
                    value={newDate}
                    min={todayStr}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer shadow-xs tabular-nums"
                  />
                </div>

                {/* Time Input */}
                {showTimePicker && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
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
                      className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer shadow-xs tabular-nums"
                    />
                  </div>
                )}
              </div>

              {/* Quick Date Presets */}
              <div className="space-y-1">
                <span className="text-[12px] font-medium text-galla-ink-soft">
                  Quick date shortcuts:
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
                    className="px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper hover:bg-galla-line text-galla-ink transition-colors cursor-pointer"
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
        )}

        <ConfirmModal
          isOpen={showConfirm}
          title={confirmDialogTitle || `Confirm ${title}`}
          description={
            <span>
              Are you sure you want to {currentDate ? "reschedule" : "set schedule for"}{" "}
              {referenceText} for{" "}
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
