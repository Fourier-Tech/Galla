"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  Package,
  Check,
  Loader2,
} from "lucide-react";
import { DashboardOrder, DashboardExpense, DashboardProduct } from "@/types/dashboard";
import { refundOrderAction } from "@/app/dashboard/actions";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";
import { PaymentModeSelect } from "../payment-mode-select";

interface RefundOrderModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onRefundSuccess: (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[],
    linkedOrders?: DashboardOrder[]
  ) => void;
}

export function RefundOrderModal({
  order,
  isOpen,
  onClose,
  onRefundSuccess,
}: RefundOrderModalProps) {
  if (!isOpen || !order) return null;

  return (
    <RefundOrderModalContent
      order={order}
      onClose={onClose}
      onRefundSuccess={onRefundSuccess}
    />
  );
}

function RefundOrderModalContent({
  order,
  onClose,
  onRefundSuccess,
}: {
  order: DashboardOrder;
  onClose: () => void;
  onRefundSuccess: (
    updatedOrder: DashboardOrder,
    newExpense?: DashboardExpense,
    updatedProducts?: DashboardProduct[],
    linkedOrders?: DashboardOrder[]
  ) => void;
}) {
  const isReplacementOrder =
    order.status === "replacement_completed" ||
    order.status === "replacement_pending" ||
    order.status === "replacement";

  const totalPaid =
    (order.payments || [])
      .filter((p) => p.amount > 0 && p.type !== "refund")
      .reduce((sum, p) => sum + p.amount, 0) || (order.paid || 0);

  const totalCashRefunds = (order.returns || []).reduce((sum, r) => {
    const explicit = r.cashRefund;
    if (typeof explicit === "number") return sum + explicit;
    return sum + (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? (r.refundAmount || 0) : 0);
  }, 0);

  const unreturnedCatalogValue = (order.lineItems || []).reduce((sum, item) => {
    const unret = Math.max(0, (item.quantity || 1) - (item.returnedQuantity || 0));
    return sum + Math.floor((item.unitPrice || 0) * unret);
  }, 0);

  const remainingRefundable =
    isReplacementOrder && totalPaid === 0
      ? Math.max(0, unreturnedCatalogValue - totalCashRefunds)
      : Math.max(0, Math.floor(totalPaid - totalCashRefunds));

  const [refundAmount, setRefundAmount] = useState(String(remainingRefundable));
  const [refundMode, setRefundMode] = useState<"cash" | "upi" | "card">(
    (order.paymentMode === "card" || order.paymentMode === "upi") ? order.paymentMode : "cash"
  );
  const [refundReason, setRefundReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isProductOrder =
    order.type === "Product sale" ||
    Boolean(order.lineItems?.some((item) => item.itemType === "product"));

  const productItems = (order.lineItems || []).filter(
    (item) => item.itemType === "product"
  );

  const totalUnreturnedProductQty = productItems.reduce(
    (sum, item) => sum + Math.max(0, (item.quantity || 1) - (item.returnedQuantity || 0)),
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
        onRefundSuccess(res.order, res.newExpense, res.updatedProducts, res.linkedOrders);
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
    >
      <div className={`w-full ${isProductOrder ? "max-w-[460px]" : "max-w-[420px]"} bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-2xl transition-all max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line/60 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-galla-ink">
                {isProductOrder ? "Refund Product Order" : "Process Refund"}
              </h3>
              {isProductOrder && (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal border border-galla-teal/20">
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
            {/* Order Details Snapshot */}
            <div className="p-3 bg-galla-paper/50 border border-galla-line/70 rounded-[5px] text-[12px] font-sans">
              <div className="grid grid-cols-3 gap-2 text-center divide-x divide-galla-line/60">
                <div>
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Total Value</div>
                  <div className="text-[13px] font-semibold text-galla-ink tabular-nums mt-0.5">
                    {formatRupee(isReplacementOrder && order.amount === 0 ? unreturnedCatalogValue : order.amount)}
                  </div>
                </div>
                <div className="pl-2">
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Collected</div>
                  <div className="text-[13px] font-semibold text-galla-teal tabular-nums mt-0.5">{formatRupee(totalPaid)}</div>
                </div>
                <div className="pl-2">
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Refundable</div>
                  <div className="text-[13px] font-semibold text-emerald-700 tabular-nums mt-0.5">{formatRupee(remainingRefundable)}</div>
                </div>
              </div>
              {totalCashRefunds > 0 && (
                <div className="text-center text-[10.5px] text-rose-700 font-medium pt-1.5 mt-1.5 border-t border-galla-line/50">
                  Already refunded: -{formatRupee(totalCashRefunds)}
                </div>
              )}
            </div>

            {/* List of Products in this Order */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[12px] font-semibold text-galla-ink">
                <span>Products In This Order</span>
                <span className="text-galla-teal lowercase font-normal">
                  {totalUnreturnedProductQty} {totalUnreturnedProductQty === 1 ? "item" : "items"} returning
                </span>
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
                {productItems.map((item, idx) => {
                  const unreturned = Math.max(0, (item.quantity || 1) - (item.returnedQuantity || 0));
                  const isFullyReturned = unreturned === 0;
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-[4px] border flex items-center justify-between gap-2 text-[12px] ${
                        isFullyReturned
                          ? "bg-galla-paper/30 border-galla-line/40 opacity-60"
                          : "bg-galla-surface border-galla-line"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className={`h-3.5 w-3.5 shrink-0 ${isFullyReturned ? "text-galla-ink-soft" : "text-galla-teal"}`} />
                        <span className="font-medium text-galla-ink truncate leading-tight">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isFullyReturned ? (
                          <span className="px-1.5 py-0.5 rounded bg-galla-paper border border-galla-line text-galla-ink-soft tabular-nums text-[11px]">
                            Already Returned
                          </span>
                        ) : (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 tabular-nums text-[11px] font-semibold">
                              +{unreturned} pcs
                            </span>
                            <span className="text-galla-ink font-semibold tabular-nums text-[11.5px]">
                              {formatRupee(item.unitPrice * unreturned)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div className="flex items-center gap-1.5 text-[11px] text-galla-ink-soft">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Unreturned items will be restocked to shop inventory.</span>
            </div>

            {/* Editable Refund Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12px] font-medium text-galla-ink">
                  Refund Amount (₹)
                </label>
                <button
                  type="button"
                  onClick={() => setRefundAmount(String(remainingRefundable))}
                  className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                >
                  Full Amount ({formatRupee(remainingRefundable)})
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={String(remainingRefundable)}
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-1.5 text-[14px] font-medium text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal transition-all tabular-nums"
              />

              {/* Live breakdown of refund vs shop retained fee */}
              <div className="flex items-center justify-between text-[11px] text-galla-ink-soft mt-1">
                <span>Refundable: {formatRupee(remainingRefundable)}</span>
                {parsedAmount > 0 && (
                  parsedAmount < remainingRefundable ? (
                    <span className="text-emerald-700 font-semibold">
                      Shop keeps (Charge/Fee): +{formatRupee(remainingRefundable - parsedAmount)}
                    </span>
                  ) : parsedAmount > remainingRefundable ? (
                    <span className="text-amber-700 font-medium">
                      Extra compensation: +{formatRupee(parsedAmount - remainingRefundable)}
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
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
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
                    {parsedAmount < remainingRefundable && ` • Keeps ${formatRupee(remainingRefundable - parsedAmount)}`}
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
            {/* Order Payment Snapshot */}
            <div className="p-3 bg-galla-paper/50 border border-galla-line/70 rounded-[5px] text-[12px] font-sans">
              <div className="grid grid-cols-3 gap-2 text-center divide-x divide-galla-line/60">
                <div>
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Total Bill</div>
                  <div className="text-[13px] font-semibold text-galla-ink tabular-nums mt-0.5">{formatRupee(order.amount)}</div>
                </div>
                <div className="pl-2">
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Collected</div>
                  <div className="text-[13px] font-semibold text-galla-teal tabular-nums mt-0.5">{formatRupee(totalPaid)}</div>
                </div>
                <div className="pl-2">
                  <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider">Refundable</div>
                  <div className="text-[13px] font-semibold text-emerald-700 tabular-nums mt-0.5">{formatRupee(remainingRefundable)}</div>
                </div>
              </div>
              {totalCashRefunds > 0 && (
                <div className="text-center text-[10.5px] text-rose-700 font-medium pt-1.5 mt-1.5 border-t border-galla-line/50">
                  Already refunded: -{formatRupee(totalCashRefunds)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                  Refund Amount (₹)
                </label>
                <button
                  type="button"
                  onClick={() => setRefundAmount(String(remainingRefundable))}
                  className="text-[11px] font-sans text-galla-teal hover:underline cursor-pointer font-medium"
                >
                  Set Full ({formatRupee(remainingRefundable)})
                </button>
              </div>
              <input
                type="text"
                autoFocus
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={String(remainingRefundable)}
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
              />

              {/* Inline Accounting Status */}
              <div className="flex items-center justify-between text-[11px] text-galla-ink-soft mt-1.5">
                <span>
                  Refunding <strong className="font-semibold text-galla-ink tabular-nums">{formatRupee(parsedAmount)}</strong>
                  {parsedAmount < remainingRefundable && (
                    <span className="text-emerald-700 ml-1">
                      (Shop keeps: {formatRupee(remainingRefundable - parsedAmount)})
                    </span>
                  )}
                  {parsedAmount > remainingRefundable && (
                    <span className="text-amber-800 ml-1">
                      (Extra: +{formatRupee(parsedAmount - remainingRefundable)})
                    </span>
                  )}
                </span>
                {totalPaid < order.amount && (
                  <span className="text-galla-brass font-medium">
                    Debt cleared: {formatRupee(order.amount - totalPaid)}
                  </span>
                )}
              </div>
            </div>

            <PaymentModeSelect
              label="Refund Payment Mode"
              value={refundMode}
              onChange={setRefundMode}
              allowedModes={["cash", "upi", "card"]}
            />

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
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
              {parsedAmount > remainingRefundable && (
                <span className="block mt-2 text-amber-700 font-medium">
                  Note: Includes {formatRupee(parsedAmount - remainingRefundable)} extra compensation above refundable amount.
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
