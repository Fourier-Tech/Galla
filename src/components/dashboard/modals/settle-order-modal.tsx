"use client";

import React, { useState } from "react";
import { X, AlertCircle, Check, Loader2, Calendar, ChevronDown, Clock } from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { completeOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatBookingDate, formatDisplayNumber, getLocalDateString } from "@/lib/utils";
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

  const [settlementType, setSettlementType] = useState<"complete" | "pending_due">("complete");
  const [dueDate, setDueDate] = useState("");
  const [remainingAmount, setRemainingAmount] = useState(String(defaultDue));
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPendingDue = settlementType === "pending_due";
  const enteredNum = remainingAmount === "" ? 0 : Number(remainingAmount);
  const remainingPendingDue = isPendingDue ? Math.max(0, defaultDue - enteredNum) : 0;
  const finalCalculatedTotal = isPendingDue ? order.amount : order.paid + enteredNum;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (remainingAmount === "" || isNaN(enteredNum) || enteredNum < 0) {
      setErrorMsg("Please enter a valid amount (₹0 or more)");
      return;
    }

    if (isPendingDue && enteredNum > defaultDue) {
      setErrorMsg(`Payment collected today cannot exceed the balance due (${formatRupee(defaultDue)})`);
      return;
    }

    setShowConfirm(true);
  };

  const executeSettleOrder = async () => {
    setShowConfirm(false);
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    try {
      const res = await completeOrderAction({
        orderId: order.id,
        remainingAmount: enteredNum,
        paymentMode,
        notes: notes.trim() || undefined,
        settlementType,
        dueDate: isPendingDue && dueDate ? dueDate : undefined,
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
      isSubmittingRef.current = false; setIsSubmitting(false);
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
          {/* Settlement Status Dropdown (when there is balance due) */}
          {!isReplacement && defaultDue > 0 && (
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Settlement Status
              </label>
              <div className="relative">
                <select
                  value={settlementType}
                  onChange={(e) => {
                    const next = e.target.value as "complete" | "pending_due";
                    setSettlementType(next);
                    if (next === "pending_due") {
                      setRemainingAmount("0");
                    } else {
                      setRemainingAmount(String(defaultDue));
                    }
                  }}
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-[13px] pr-[32px] py-[8px] text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors cursor-pointer appearance-none"
                >
                  <option value="complete">Complete (Payment Done &amp; Settled)</option>
                  <option value="pending_due">Pending Due (Service Done, Payment Pending)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-galla-ink-soft pointer-events-none" />
              </div>
            </div>
          )}

          {isPendingDue && (
            <div className="p-2.5 bg-amber-50/80 border border-amber-200/90 rounded-[5px] text-[12px] text-amber-950 font-sans flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong>Payment Not Done:</strong> Service/product will be delivered, and remaining{" "}
                <strong className="text-amber-900 tabular-nums">{formatRupee(remainingPendingDue)}</strong> will be recorded as Payment Due under &ldquo;Dues to Clear&rdquo;.
              </div>
            </div>
          )}

          {/* Editable Payment Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                {isPendingDue
                  ? "Payment Collected Today (₹)"
                  : isReplacement
                    ? "Balance to Collect (₹0 - Free Warranty Swap)"
                    : defaultDue === 0
                      ? "Payment to Collect (₹0 - Paid in full)"
                      : "Remaining Payment to Collect (₹)"}
              </label>
              <div className="flex items-center gap-2">
                {isPendingDue ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRemainingAmount("0")}
                      className="text-[11px] font-sans text-amber-800 hover:underline cursor-pointer font-medium"
                    >
                      ₹0 (None today)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemainingAmount(String(defaultDue))}
                      className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                    >
                      Full ({formatRupee(defaultDue)})
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
            <input
              type="text"
              autoFocus
              required
              value={remainingAmount}
              onChange={(e) => setRemainingAmount(e.target.value.replace(/\D/g, ""))}
              placeholder={isPendingDue ? "Enter amount collected today (₹0 if none)" : "Enter remaining amount to collect"}
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
            />

            {/* Inline Financial Status */}
            <div className="mt-1.5 text-[11px] font-sans flex items-center justify-between text-galla-ink-soft">
              <span>
                Collecting <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(enteredNum)}</strong>
                {isPendingDue ? (
                  <span className="text-amber-800 ml-1">
                    (Remaining Due: <strong className="font-semibold">{formatRupee(remainingPendingDue)}</strong>)
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </span>
              <span>
                Total: <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(finalCalculatedTotal)}</strong>
              </span>
            </div>
          </div>

          {/* Payment Mode Selection - only when money is collected today */}
          {enteredNum > 0 && (
            <PaymentModeSelect
              label={isPendingDue ? "Payment Mode for Today's Collection" : "Payment Mode for Remaining Balance"}
              value={paymentMode}
              onChange={setPaymentMode}
              allowedModes={["cash", "upi", "card"]}
            />
          )}

          {/* Payment Due Date Selection (When Pending Due) */}
          {isPendingDue && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12px] font-medium text-galla-ink">
                  Payment Due Date (Optional)
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "+3d", days: 3 },
                    { label: "+7d", days: 7 },
                    { label: "+15d", days: 15 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + preset.days);
                        setDueDate(getLocalDateString(d));
                      }}
                      className="text-[10.5px] px-1.5 py-0.5 rounded bg-galla-paper hover:bg-galla-line/50 border border-galla-line text-galla-ink-soft transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => setDueDate("")}
                      className="text-[10.5px] text-rose-700 hover:underline cursor-pointer ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                type="date"
                min={getLocalDateString()}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[7px] text-[13px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors cursor-pointer"
              />
              <p className="text-[11px] text-galla-ink-soft mt-1">
                {dueDate
                  ? `Reminder will appear in "Dues to Clear" for ${formatBookingDate(dueDate)}`
                  : "Date customer promised to clear the balance"}
              </p>
            </div>
          )}

          {/* Notes / Remarks */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Settlement Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isPendingDue ? "e.g. Service completed, balance due next week" : "e.g. Settled at counter upon service completion"}
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
              className={`w-2/3 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                isPendingDue
                  ? "bg-amber-700 hover:bg-amber-800"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isPendingDue ? "Marking Due..." : defaultDue === 0 && enteredNum === 0 ? "Delivering..." : "Settling..."}</span>
                </>
              ) : (
                <>
                  <span>
                    {isPendingDue
                      ? `Mark Due (${formatRupee(remainingPendingDue)})`
                      : defaultDue === 0 && enteredNum === 0
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
              : isPendingDue
                ? "Confirm Payment Due"
                : defaultDue === 0 && enteredNum === 0
                  ? "Confirm Product Delivery & Handover"
                  : "Confirm Order Settlement"
          }
          description={
            isReplacement || (!isPendingDue && defaultDue === 0 && enteredNum === 0) ? (
              <span>
                Confirm that the {isReplacement ? "replacement product" : "order items"} for Order{" "}
                <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> have been handed over to{" "}
                <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> with{" "}
                <strong className="font-semibold text-emerald-700">₹0 remaining balance</strong> to collect?
              </span>
            ) : isPendingDue ? (
              <span>
                Confirm marking Order <strong className="font-semibold text-galla-ink">{formatDisplayNumber(order.id)}</strong> for{" "}
                <strong className="font-semibold text-galla-ink">&ldquo;{order.customer}&rdquo;</strong> as{" "}
                <strong className="font-semibold text-amber-800">Payment Due</strong> with{" "}
                <strong className="font-semibold text-amber-900">{formatRupee(remainingPendingDue)}</strong> outstanding balance
                {enteredNum > 0 ? (
                  <span> (collecting <strong className="font-semibold text-galla-ink">{formatRupee(enteredNum)}</strong> via {paymentMode.toUpperCase()} today)</span>
                ) : ""}?
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
              : isPendingDue
                ? "Yes, Mark as Payment Due"
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
