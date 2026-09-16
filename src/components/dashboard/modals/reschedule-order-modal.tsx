"use client";

import React, { useState } from "react";
import { X, Calendar, Loader2, AlertCircle } from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { rescheduleOrderAction } from "@/app/dashboard/actions";
import { formatBookingDate, formatAppointmentTime, getBookingUrgency, formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface RescheduleOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onRescheduleSuccess: (updatedOrder: DashboardOrder) => void;
}

export function RescheduleOrderModal({
  order,
  isOpen,
  onClose,
  onRescheduleSuccess,
}: RescheduleOrderModalProps) {
  if (!isOpen || !order) return null;

  return (
    <RescheduleOrderModalContent
      key={`${order.id}-${order.scheduledFor}-${order.scheduledTime}`}
      order={order}
      onClose={onClose}
      onRescheduleSuccess={onRescheduleSuccess}
    />
  );
}

function RescheduleOrderModalContent({
  order,
  onClose,
  onRescheduleSuccess,
}: {
  order: DashboardOrder;
  onClose: () => void;
  onRescheduleSuccess: (updatedOrder: DashboardOrder) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const initialDate = order.scheduledFor
    ? new Date(order.scheduledFor).toISOString().split("T")[0]
    : todayStr;

  const isDueOrder =
    order.status === "created" ||
    (order.paid < order.amount &&
      order.status !== "advance_paid" &&
      order.status !== "paid_full" &&
      order.status !== "cancelled_refunded" &&
      order.status !== "cancelled_converted");

  const [newDate, setNewDate] = useState(initialDate);
  const [newTime, setNewTime] = useState(order.scheduledTime || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setErrorMsg(isDueOrder ? "Please select a payment due date" : "Please select a new appointment date");
      return;
    }

    setShowConfirm(true);
  };

  const executeReschedule = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await rescheduleOrderAction({
        orderId: order.id,
        newDate,
        newTime: newTime.trim() || undefined,
      });

      if (res.success && res.order) {
        onRescheduleSuccess(res.order);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to reschedule booking");
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
    setNewDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/40">
          <div>
            <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
              {isDueOrder
                ? order.scheduledFor
                  ? "Reschedule Due Date"
                  : "Set Payment Due Date"
                : "Reschedule & Set Time"}
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              Order {order.id} &bull; <strong className="text-galla-ink">{order.customer}</strong>
              {order.amount > order.paid ? (
                <span className="text-rose-700 font-semibold ml-1">
                  (Due: {formatRupee(order.amount - order.paid)})
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

            {/* Current Scheduled Date & Time */}
            <div className="p-3 bg-galla-paper/50 border border-galla-line rounded-[5px] text-[12.5px] font-sans flex items-center justify-between text-galla-ink-soft">
              <span>{isDueOrder ? "Current Due Date:" : "Current Booking:"}</span>
              <strong className="text-galla-ink font-medium">
                {formatBookingDate(order.scheduledFor) || "Not set"}
                {order.scheduledTime ? ` at ${formatAppointmentTime(order.scheduledTime)}` : isDueOrder ? "" : " (Time not set)"}
              </strong>
            </div>

            {/* Date and Time Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-galla-ink">
                  {isDueOrder ? "Payment Due Date" : "Booking Date"} <span className="text-red-500">*</span>
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[12px] font-medium text-galla-ink">
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
            </div>

            {/* Quick Date Presets */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
                Quick Date Shortcuts:
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
                    {newTime ? ` at ${formatAppointmentTime(newTime)}` : " (Time not set)"}
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
                <span>{isDueOrder ? "Confirm Due Date" : "Confirm Booking Slot"}</span>
              )}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={
            isDueOrder
              ? order.scheduledFor
                ? "Confirm Reschedule Due Date"
                : "Confirm Payment Due Date"
              : "Confirm Reschedule"
          }
          description={
            <span>
              Are you sure you want to {isDueOrder ? (order.scheduledFor ? "reschedule the payment due date for" : "set the payment due date for") : "reschedule"} Order{" "}
              <strong className="font-semibold text-galla-ink">#{order.id}</strong> for{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> to{" "}
              <strong className="font-semibold text-galla-ink">{formatBookingDate(newDate)}</strong>
              {newTime ? (
                <>
                  {" "}at <strong className="font-semibold text-galla-ink">{formatAppointmentTime(newTime)}</strong>
                </>
              ) : isDueOrder ? "" : (
                " (time not specified)"
              )}?
            </span>
          }
          confirmLabel={isDueOrder ? "Yes, Confirm Due Date" : "Yes, Reschedule"}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeReschedule}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}

