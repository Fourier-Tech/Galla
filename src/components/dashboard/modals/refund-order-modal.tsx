"use client";

import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { DashboardOrder, DashboardExpense } from "@/types/dashboard";
import { refundOrderAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAmount = Number(refundAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid refund amount");
      return;
    }

    if (parsedAmount > order.paid) {
      setErrorMsg(`Refund cannot exceed the amount collected (${formatRupee(order.paid)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await refundOrderAction({
        orderId: order.id,
        refundAmount: parsedAmount,
        refundMode,
        refundReason: refundReason.trim() || "Customer requested refund",
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
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-[400px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
              Process Refund
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft">
              {order.id} &bull; {order.customer}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft">
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
              required
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter amount to refund"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
            />
            <div className="flex items-center justify-between text-[11px] text-galla-ink-soft mt-1">
              <span>Max refundable: {formatRupee(order.paid)}</span>
              {Number(refundAmount) > 0 && Number(refundAmount) < order.paid && (
                <span className="text-galla-teal font-medium">
                  Shop keeps: {formatRupee(order.paid - Number(refundAmount))}
                </span>
              )}
            </div>

            {/* Live Accounting Deduction Preview */}
            {Number(refundAmount) > 0 && Number(refundAmount) <= order.paid && (
              <div className="mt-2.5 p-2.5 bg-galla-paper border border-galla-line rounded-[4px] text-[11.5px] font-sans space-y-1">
                <div className="flex justify-between text-red-700 font-medium">
                  <span>Cash Outflow (Given to Customer):</span>
                  <span className="tabular-nums">−{formatRupee(Number(refundAmount))}</span>
                </div>
                {Number(refundAmount) < order.paid && (
                  <div className="flex justify-between text-galla-teal font-medium">
                    <span>Retained by Salon (Shop Keeps):</span>
                    <span className="tabular-nums">+{formatRupee(order.paid - Number(refundAmount))}</span>
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
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
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
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
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
              disabled={isSubmitting || !refundAmount || Number(refundAmount) <= 0}
              className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting
                ? "Processing..."
                : `Confirm Refund ${refundAmount ? `(${formatRupee(Number(refundAmount))})` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
