"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  Package,
  Check,
  Info,
  Loader2,
} from "lucide-react";
import { DashboardOrder, DashboardExpense, DashboardProduct } from "@/types/dashboard";
import { refundOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatBookingDate, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { PaymentModeSelect } from "../payment-mode-select";

interface RefundOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onRefundSuccess: (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[]
  ) => void;
}

export function RefundOrderModal({
  order,
  isOpen,
  onClose,
  onRefundSuccess,
}: RefundOrderModalProps) {
  const [refundAmount, setRefundAmount] = useState(order ? String(order.paid) : "");
  const [refundMode, setRefundMode] = useState<"cash" | "upi" | "card">(
    (order?.paymentMode === "card" || order?.paymentMode === "upi") ? order.paymentMode : "cash"
  );
  const [refundReason, setRefundReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isProductOrder =
    order.type === "Product sale" ||
    Boolean(order.lineItems?.some((item) => item.itemType === "product"));

  const productItems = (order.lineItems || []).filter(
    (item) => item.itemType === "product"
  );

  const totalUnreturnedProductQty = productItems.reduce(
    (sum, item) => sum + ((item.quantity || 1) - (item.returnedQuantity || 0)),
    0
  );

  const parsedAmount = Number(refundAmount) || 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid refund amount");
      return;
    }

    if (isProductOrder) {
      // Direct execution for product order
      executeRefund();
    } else {
      setShowConfirm(true);
    }
  };

  const executeRefund = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await refundOrderAction({
        orderId: order.id,
        refundAmount: parsedAmount,
        refundMode,
        refundReason: refundReason.trim() || undefined,
      });

      if (res.success && res.order) {
        onRefundSuccess(res.order, res.newExpense, res.updatedProducts);
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
      <div className={`w-full ${isProductOrder ? "max-w-[460px]" : "max-w-[420px]"} bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-2xl transition-all max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line/60 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                {isProductOrder ? "Refund Product Order" : "Process Refund"}
              </h3>
              {isProductOrder && (
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal border border-galla-teal/20 uppercase tracking-wider">
                  Product Sale
                </span>
              )}
            </div>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              Order {formatDisplayNumber(order.id)} &bull; {order.customer}
              {order.customerPhone ? ` (${order.customerPhone})` : ""}
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

        {errorMsg && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isProductOrder ? (
          /* ======================================================== */
          /* PRODUCT ORDER DEDICATED REFUND & RESTOCK CONFIRMATION     */
          /* ======================================================== */
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {/* Order Details Summary */}
            <div className="p-2.5 bg-galla-paper/50 border border-galla-line rounded-[5px] space-y-1 text-[12px] font-sans">
              <div className="flex justify-between text-galla-ink-soft">
                <span>Total Order Value:</span>
                <span className="font-medium text-galla-ink tabular-nums">{formatRupee(order.amount)}</span>
              </div>
              <div className="flex justify-between text-galla-ink-soft">
                <span>Collected from Customer:</span>
                <span className="tabular-nums font-semibold text-galla-ink">{formatRupee(order.paid)}</span>
              </div>
            </div>

            {/* List of Products in this Order */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-heading font-semibold text-galla-ink uppercase tracking-wider">
                <span>Products In This Order</span>
                <span className="text-galla-teal font-sans lowercase font-normal">
                  {totalUnreturnedProductQty} {totalUnreturnedProductQty === 1 ? "item" : "items"} returning
                </span>
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                {productItems.map((item, idx) => {
                  const unreturned = (item.quantity || 1) - (item.returnedQuantity || 0);
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-[4px] bg-galla-surface border border-galla-line flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                        <span className="font-medium text-galla-ink truncate leading-tight">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[10.5px] font-semibold">
                          +{unreturned} pcs
                        </span>
                        <span className="text-galla-ink font-semibold tabular-nums text-[11.5px]">
                          {formatRupee(item.finalPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compact Short Instructions */}
            <div className="p-2 bg-galla-paper/60 border border-galla-line rounded-[5px] text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>All items in this order will be restocked to shop inventory.</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-800">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>For partial/individual item returns, use &ldquo;Return / Replace&rdquo; in Order Details.</span>
              </div>
            </div>

            {/* Editable Refund Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                  Refund Amount (₹)
                </label>
                <button
                  type="button"
                  onClick={() => setRefundAmount(String(order.paid))}
                  className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                >
                  Full Amount ({formatRupee(order.paid)})
                </button>
              </div>
              <input
                type="text"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={String(order.paid)}
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[14px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all tabular-nums"
              />

              {/* Live breakdown of refund vs shop retained fee */}
              <div className="flex items-center justify-between text-[11px] text-galla-ink-soft mt-1">
                <span>Collected: {formatRupee(order.paid)}</span>
                {parsedAmount > 0 && (
                  parsedAmount < order.paid ? (
                    <span className="text-emerald-700 font-semibold">
                      Shop keeps (Charge/Fee): +{formatRupee(order.paid - parsedAmount)}
                    </span>
                  ) : parsedAmount > order.paid ? (
                    <span className="text-amber-700 font-medium">
                      Extra compensation: +{formatRupee(parsedAmount - order.paid)}
                    </span>
                  ) : (
                    <span className="text-galla-ink-soft font-medium">Full refund (Shop keeps: ₹0)</span>
                  )
                )}
              </div>
            </div>

            {/* Refund Mode Selection */}
            <PaymentModeSelect
              label="Refund Paid Via"
              value={refundMode}
              onChange={setRefundMode}
              allowedModes={["cash", "upi", "card"]}
            />

            {/* Refund Reason (Optional) */}
            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                Refund Reason / Notes (Optional)
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Returned items, deduction of ₹100 charge"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-3 py-1.5 text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-1.5 flex gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="w-1/3 bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink font-sans text-[13px] font-medium py-2 rounded-[5px] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !refundAmount || parsedAmount <= 0}
                className="w-2/3 bg-red-600 hover:bg-red-700 text-white font-sans text-[13px] font-semibold py-2 rounded-[5px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    Confirm Refund ({formatRupee(parsedAmount)})
                    {parsedAmount < order.paid && ` • Keeps ${formatRupee(order.paid - parsedAmount)}`}
                  </span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ======================================================== */
          /* SERVICE BOOKING REFUND FORM                              */
          /* ======================================================== */
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Order Payment Summary Card */}
            <div className="p-3 bg-galla-paper/70 border border-galla-line rounded-[5px] space-y-1.5 text-[12.5px] font-sans">
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

            <PaymentModeSelect
              label="Refund Payment Mode"
              value={refundMode}
              onChange={setRefundMode}
              allowedModes={["cash", "upi", "card"]}
            />

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
