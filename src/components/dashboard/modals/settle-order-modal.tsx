"use client";

import React, { useState } from "react";
import { X, AlertCircle, Check, Loader2 } from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { completeOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatBookingDate, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface SettleOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSettleSuccess: (updatedOrder: DashboardOrder) => void;
}

export function SettleOrderModal({
  order,
  isOpen,
  onClose,
  onSettleSuccess,
}: SettleOrderModalProps) {
  if (!isOpen || !order) return null;

  return (
    <SettleOrderModalContent
      key={order.id}
      order={order}
      onClose={onClose}
      onSettleSuccess={onSettleSuccess}
    />
  );
}

function SettleOrderModalContent({
  order,
  onClose,
  onSettleSuccess,
}: {
  order: DashboardOrder;
  onClose: () => void;
  onSettleSuccess: (updatedOrder: DashboardOrder) => void;
}) {
  const defaultDue = Math.max(0, order.amount - order.paid);

  const [remainingAmount, setRemainingAmount] = useState(String(defaultDue));
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enteredNum = remainingAmount === "" ? 0 : Number(remainingAmount);
  const finalCalculatedTotal = order.paid + enteredNum;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (remainingAmount === "" || isNaN(enteredNum) || enteredNum < 0) {
      setErrorMsg("Please enter a valid remaining payment amount (₹0 or more)");
      return;
    }

    setShowConfirm(true);
  };

  const executeSettleOrder = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const res = await completeOrderAction({
        orderId: order.id,
        remainingAmount: enteredNum,
        paymentMode,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.order) {
        onSettleSuccess(res.order);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to settle order");
      }
    } catch {
      setErrorMsg("Network error occurred while settling order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[420px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
              {defaultDue === 0 ? "Deliver & Fulfill Order" : "Settle Due & Complete Order"}
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft">
              {formatDisplayNumber(order.id)} &bull; <strong className="text-galla-ink font-medium">{order.customer}</strong>
              {order.scheduledFor ? ` • Booked: ${formatBookingDate(order.scheduledFor)}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Order Payment Summary Card */}
        <div className="mb-4 p-3 bg-galla-paper/70 border border-galla-line rounded-[5px] space-y-1.5 text-[12.5px] font-sans">
          <div className="flex justify-between text-galla-ink-soft">
            <span>Original Total Bill:</span>
            <span className="font-medium text-galla-ink tabular-nums">{formatRupee(order.amount)}</span>
          </div>
          <div className={`flex justify-between ${order.paid > 0 ? "text-galla-teal font-medium" : "text-galla-ink-soft"}`}>
            <span>{order.scheduledFor ? "Advance Collected:" : "Paid Upfront:"}</span>
            <span className="tabular-nums">
              {formatRupee(order.paid)}
              {order.paid > 0 && order.paymentMode ? (
                <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60 ml-1">
                  {order.paymentMode}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex justify-between text-galla-brass font-medium">
            <span>Current Due:</span>
            <span className="tabular-nums">{formatRupee(defaultDue)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Editable Remaining Due Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Remaining Payment to Collect (₹)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRemainingAmount(String(defaultDue))}
                  className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                >
                  Reset ({formatRupee(defaultDue)})
                </button>
                <button
                  type="button"
                  onClick={() => setRemainingAmount("0")}
                  className="text-[11px] font-sans text-amber-700 hover:underline cursor-pointer font-medium"
                >
                  Waive (₹0)
                </button>
              </div>
            </div>
            <input
              type="text"
              autoFocus
              required
              value={remainingAmount}
              onChange={(e) => setRemainingAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter remaining amount to collect"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
            />

            {/* Live Financial Breakdown */}
            <div className="mt-2.5 p-2.5 bg-galla-paper border border-galla-line rounded-[4px] text-[11.5px] font-sans space-y-1">
              <div className="flex justify-between text-emerald-800 font-medium">
                <span>Collecting Now:</span>
                <span className="tabular-nums">+{formatRupee(enteredNum)}</span>
              </div>
              {enteredNum < defaultDue && (
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>Concession / Discount:</span>
                  <span className="tabular-nums">−{formatRupee(defaultDue - enteredNum)}</span>
                </div>
              )}
              {enteredNum > defaultDue && (
                <div className="flex justify-between text-blue-800 font-medium">
                  <span>Extra Service / Adjustment:</span>
                  <span className="tabular-nums">+{formatRupee(enteredNum - defaultDue)}</span>
                </div>
              )}
              <div className="flex justify-between text-galla-ink font-semibold pt-1 border-t border-galla-line/60">
                <span>Final Order Total:</span>
                <span className="tabular-nums">{formatRupee(finalCalculatedTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Mode Selection */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Payment Mode for Remaining Balance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 text-[12.5px] font-sans font-medium rounded-[4px] border uppercase tracking-wider transition-all cursor-pointer ${
                    paymentMode === mode
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-semibold"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Settlement Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Settled at counter upon service completion"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-1/3 bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink font-sans text-[13px] font-medium py-[9px] rounded-[5px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || remainingAmount === ""}
              className="w-2/3 bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <>
                  <span>Settle ({formatRupee(enteredNum)}) &amp; Done</span>
                  <Check className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Order Settlement"
          description={
            <span>
              Are you sure you want to collect <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong> from{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> and mark Order{" "}
              <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> as fully settled &amp; completed?
            </span>
          }
          confirmLabel="Yes, Settle Order"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSettleOrder}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
