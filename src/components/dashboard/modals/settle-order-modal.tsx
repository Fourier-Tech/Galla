"use client";

import React, { useState } from "react";
import { X, AlertCircle, Check, Loader2 } from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { completeOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatBookingDate, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { PaymentModeSelect } from "../payment-mode-select";

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
  const isReplacement =
    order.status === "replacement_pending" || order.status === "replacement";
  const totalDueDeduction = (order.returns || []).reduce((sum, r) => {
    if (typeof r.dueDeduction === "number") return sum + r.dueDeduction;
    return sum + (r.refundMode === "reduce_due" ? (r.refundAmount || 0) : 0);
  }, 0);
  const defaultDue = isReplacement ? 0 : Math.max(0, order.amount - order.paid - totalDueDeduction);

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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[420px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-galla-ink">
              {isReplacement
                ? "Deliver Replacement Product"
                : defaultDue === 0
                ? "Deliver & Fulfill Order"
                : "Settle Due & Complete Order"}
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft">
              {formatDisplayNumber(order.id)} &bull; <strong className="text-galla-ink font-medium">{order.customer}</strong>
              {order.scheduledFor ? ` • ${isReplacement ? "Expected Delivery" : "Booked"}: ${formatBookingDate(order.scheduledFor)}` : ""}
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

        {/* Order Payment Snapshot */}
        <div className="mb-4 p-3 bg-galla-paper/50 border border-galla-line/70 rounded-[5px] text-[12px] font-sans">
          {isReplacement ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-galla-ink-soft">Replacement: </span>
                <span className="font-medium text-galla-ink">{order.itemsSummary || order.type}</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Zero balance (Free swap)
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-galla-line/60">
              <div>
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Total Bill</div>
                <div className="text-[13px] font-semibold text-galla-ink tabular-nums mt-0.5">{formatRupee(order.amount)}</div>
              </div>
              <div className="pl-2">
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Paid So Far</div>
                <div className="text-[13px] font-semibold text-galla-teal tabular-nums mt-0.5">{formatRupee(order.paid)}</div>
              </div>
              <div className="pl-2">
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Balance Due</div>
                <div className={`text-[13px] font-semibold tabular-nums mt-0.5 ${defaultDue > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                  {formatRupee(defaultDue)}
                </div>
              </div>
            </div>
          )}
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
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                {isReplacement
                  ? "Balance to Collect (₹0 - Free Warranty Swap)"
                  : defaultDue === 0
                  ? "Payment to Collect (₹0 - Paid in full)"
                  : "Remaining Payment to Collect (₹)"}
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

            {/* Inline Financial Status */}
            <div className="mt-1.5 text-[11px] font-sans flex items-center justify-between text-galla-ink-soft">
              <span>
                Collecting <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(enteredNum)}</strong>
                {enteredNum < defaultDue && (
                  <span className="text-amber-800 ml-1">
                    ({formatRupee(defaultDue - enteredNum)} discount)
                  </span>
                )}
                {enteredNum > defaultDue && (
                  <span className="text-blue-800 ml-1">
                    (+{formatRupee(enteredNum - defaultDue)} extra)
                  </span>
                )}
              </span>
              <span>
                Final Total: <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(finalCalculatedTotal)}</strong>
              </span>
            </div>
          </div>

          {/* Payment Mode Selection */}
          <PaymentModeSelect
            label="Payment Mode for Remaining Balance"
            value={paymentMode}
            onChange={setPaymentMode}
            allowedModes={["cash", "upi", "card"]}
          />

          {/* Notes / Remarks */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
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
                  <span>{defaultDue === 0 && enteredNum === 0 ? "Delivering..." : "Settling..."}</span>
                </>
              ) : (
                <>
                  <span>
                    {defaultDue === 0 && enteredNum === 0
                      ? "Deliver & Done"
                      : `Settle (${formatRupee(enteredNum)}) & Done`}
                  </span>
                  <Check className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={
            isReplacement
              ? "Confirm Replacement Delivery"
              : defaultDue === 0 && enteredNum === 0
              ? "Confirm Product Delivery & Handover"
              : "Confirm Order Settlement"
          }
          description={
            isReplacement || (defaultDue === 0 && enteredNum === 0) ? (
              <span>
                Confirm that the {isReplacement ? "replacement product" : "order items"} for Order{" "}
                <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> have been handed over to{" "}
                <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> with{" "}
                <strong className="font-semibold text-emerald-700">₹0 remaining balance</strong> to collect?
              </span>
            ) : (
              <span>
                Are you sure you want to collect <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via{" "}
                <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong> from{" "}
                <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> and mark Order{" "}
                <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> as fully settled &amp; completed?
              </span>
            )
          }
          confirmLabel={
            isReplacement
              ? "Yes, Confirm Handover"
              : defaultDue === 0 && enteredNum === 0
              ? "Yes, Confirm Delivery"
              : "Yes, Settle Order"
          }
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSettleOrder}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
