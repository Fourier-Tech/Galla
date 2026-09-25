"use client";

import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { DashboardOrder, DashboardExpense } from "@/types/dashboard";
import { refundOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatBookingDate, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface RefundOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onRefundSuccess: (updatedOrder: DashboardOrder, newExpense?: DashboardExpense) => void;
}

export function RefundOrderModal({
  order,
  isOpen,
  onClose,
  onRefundSuccess,
}: RefundOrderModalProps) {
  const [refundAmount, setRefundAmount] = useState(order ? String(order.paid) : "");
  const [refundMode, setRefundMode] = useState<"cash" | "upi" | "card">("cash");
  const [refundReason, setRefundReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const parsedAmount = Number(refundAmount) || 0;

  const hasUnreturnedProducts = order?.lineItems?.some(
    (item) => item.itemType === "product" && (!item.returnedQuantity || item.returnedQuantity < item.quantity)
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid refund amount");
      return;
    }

    setShowConfirm(true);
  };

  const executeRefund = async () => {
    setShowConfirm(false);
    const parsedAmount = Number(refundAmount);
    setIsSubmitting(true);
    try {
      const res = await refundOrderAction({
        orderId: order.id,
        refundAmount: parsedAmount,
        refundMode,
        refundReason: refundReason.trim() || undefined,
      });

      if (res.success && res.order) {
        onRefundSuccess(res.order, res.newExpense);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to process refund");
      }
    } catch {
      setErrorMsg("Network error occurred while processing refund");
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
      <div className="w-full max-w-[400px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
              Process Refund
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft">
              {formatDisplayNumber(order.id)} &bull; {order.customer}
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
            <span>Total Bill:</span>
            <span className="font-medium text-galla-ink tabular-nums">{formatRupee(order.amount)}</span>
          </div>
          <div className="flex justify-between text-galla-teal font-medium">
            <span>Collected So Far:</span>
            <span className="tabular-nums">{formatRupee(order.paid)}</span>
          </div>
          {order.paid < order.amount && (
            <div className="flex justify-between text-galla-brass">
              <span>Pending Dues:</span>
              <span className="tabular-nums">{formatRupee(order.amount - order.paid)}</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {hasUnreturnedProducts ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[5px]">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-heading font-semibold text-[13px] text-amber-900">
                    Products Must Be Returned First
                  </h4>
                  <p className="font-sans text-[12px] text-amber-800 leading-relaxed">
                    This order contains physical products that have not been returned. 
                    To ensure your inventory remains accurate, please close this modal and use the <strong>&quot;Return&quot;</strong> button next to each product on the Order Details screen.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-galla-ink text-white font-heading font-semibold tracking-wider text-[11px] uppercase py-[11px] px-4 rounded-[5px] hover:bg-galla-ink/90 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : (

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Refund Amount (₹)
              </label>
              <button
                type="button"
                onClick={() => setRefundAmount(String(order.paid))}
                className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
              >
                Set Full ({formatRupee(order.paid)})
              </button>
            </div>
            <input
              type="text"
              autoFocus
              required
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter amount to refund"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
            />
            <div className="flex items-center justify-between text-[11px] text-galla-ink-soft mt-1">
              <span>Collected: {formatRupee(order.paid)}</span>
              {parsedAmount > 0 && (
                parsedAmount < order.paid ? (
                  <span className="text-galla-teal font-medium">
                    Shop keeps: {formatRupee(order.paid - parsedAmount)}
                  </span>
                ) : parsedAmount > order.paid ? (
                  <span className="text-amber-700 font-medium">
                    Extra compensation: +{formatRupee(parsedAmount - order.paid)}
                  </span>
                ) : (
                  <span className="text-galla-ink-soft font-medium">Shop keeps: ₹0</span>
                )
              )}
            </div>

            {/* Live Accounting Deduction Preview */}
            {parsedAmount > 0 && (
              <div className="mt-2.5 p-2.5 bg-galla-paper border border-galla-line rounded-[4px] text-[11.5px] font-sans space-y-1">
                <div className="flex justify-between text-red-700 font-medium">
                  <span>Cash Outflow (Given to Customer):</span>
                  <span className="tabular-nums">−{formatRupee(parsedAmount)}</span>
                </div>
                {parsedAmount < order.paid && (
                  <div className="flex justify-between text-galla-teal font-medium">
                    <span>Retained by Salon (Shop Keeps):</span>
                    <span className="tabular-nums">+{formatRupee(order.paid - parsedAmount)}</span>
                  </div>
                )}
                {parsedAmount > order.paid && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Extra Compensation (Above Paid):</span>
                    <span className="tabular-nums">+{formatRupee(parsedAmount - order.paid)}</span>
                  </div>
                )}
                {order.paid < order.amount && (
                  <div className="flex justify-between text-galla-brass font-medium">
                    <span>Pending Debt Cleared:</span>
                    <span className="tabular-nums">−{formatRupee(order.amount - order.paid)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRefundMode(mode)}
                  className={`py-1.5 text-[12.5px] font-sans font-medium rounded-[4px] border uppercase tracking-wider transition-all cursor-pointer ${
                    refundMode === mode
                      ? "bg-red-50 text-red-800 border-red-300 shadow-2xs font-semibold"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Refund Reason (Optional)
            </label>
            <input
              type="text"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Customer cancelled appointment"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

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
              disabled={isSubmitting || !refundAmount || parsedAmount <= 0}
              className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting
                ? "Processing..."
                : `Confirm Refund ${refundAmount ? `(${formatRupee(parsedAmount)})` : ""}`}
            </button>
          </div>
        </form>
        )}

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Refund & Cancellation"
          isDestructive={true}
          description={
            <span>
              Are you sure you want to cancel and refund{" "}
              <strong className="font-semibold text-red-600">{formatRupee(parsedAmount)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{refundMode.toUpperCase()}</strong> for Order{" "}
              <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> (
              <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong>)?
              {parsedAmount > order.paid && (
                <span className="block mt-2 text-amber-700 font-medium">
                  Note: Includes {formatRupee(parsedAmount - order.paid)} extra compensation above collected amount.
                </span>
              )}
              {" "}This will update the order status and record a refund expense.
            </span>
          }
          confirmLabel="Yes, Process Refund"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeRefund}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
