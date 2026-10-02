"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Package,
  Store,
  Sparkles,
  Banknote,
  Receipt,
  Check,
} from "lucide-react";
import { DashboardProduct, DashboardSupplier } from "@/types/dashboard";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";
import { settleSupplierReplacementAction, getPurchaseOrdersForProductAction } from "@/app/dashboard/actions";
import { PaymentModeSelect } from "../payment-mode-select";

interface SettleReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: DashboardProduct | null;
  onSuccess: (
    updatedProduct: DashboardProduct,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number
  ) => void;
}

export function SettleReplacementModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: SettleReplacementModalProps) {
  const [quantity, setQuantity] = useState<string>("1");
  const [resolutionType, setResolutionType] = useState<"credit_refund" | "replace_stock">("credit_refund");
  const [targetStock, setTargetStock] = useState<"sellStock" | "useStock">("sellStock");
  const [deductFromDue, setDeductFromDue] = useState(true);
  const [supplierPaymentMode, setSupplierPaymentMode] = useState<
    "cash" | "upi" | "card" | "bank_transfer" | "credit"
  >("cash");
  const [notes, setNotes] = useState("");
  const [pos, setPos] = useState<any[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>("");
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      const defQty = product.defectiveStock || 1;
      setQuantity(String(defQty));
      setResolutionType("credit_refund");
      setTargetStock("sellStock");
      setDeductFromDue(true);
      setSupplierPaymentMode("cash");
      setNotes("");
      setSelectedPOId("");
      setErrorMsg(null);

      // Load purchase bills that might have replacement_pending
      setIsLoadingPOs(true);
      getPurchaseOrdersForProductAction(String(product.id), product.name)
        .then((res: any) => {
          if (res.success && res.pos) {
            setPos(res.pos);
            if (res.pos.length === 1) {
              setSelectedPOId(res.pos[0].id);
            }
          }
        })
        .finally(() => {
          setIsLoadingPOs(false);
        });
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const maxDefective = product.defectiveStock || 0;
  const numQty = parseInt(quantity, 10);
  const isValidQty = !isNaN(numQty) && numQty > 0 && numQty <= maxDefective;
  const estimatedCost = (product.purchaseCost || 0) * (isValidQty ? numQty : 0);

  const selectedPO = pos.find((p) => String(p.id) === String(selectedPOId));
  const pendingDue = Math.max(0, selectedPO?.amountPending || 0);
  const hasDue = Boolean(selectedPO && pendingDue > 0);
  const effectiveDeductFromDue = hasDue && deductFromDue;
  const dueDeduction = effectiveDeductFromDue ? Math.min(pendingDue, estimatedCost) : 0;
  const remainingDueAfterReturn = hasDue ? Math.max(0, pendingDue - dueDeduction) : 0;
  const cashRefund = Math.max(0, estimatedCost - dueDeduction);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidQty) {
      setErrorMsg(`Please enter a valid whole quantity between 1 and ${maxDefective}`);
      return;
    }

    if (!selectedPOId) {
      setErrorMsg("Please select an original supplier bill to link this settlement.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await settleSupplierReplacementAction(
        String(product.id),
        numQty,
        resolutionType,
        {
          targetStock: resolutionType === "replace_stock" ? targetStock : undefined,
          deductFromDue: resolutionType === "credit_refund" ? effectiveDeductFromDue : undefined,
          paymentMode: resolutionType === "credit_refund" ? supplierPaymentMode : undefined,
          poId: selectedPOId,
          notes: notes.trim() || undefined,
        }
      );

      if (res.success && res.updatedProduct) {
        onSuccess(res.updatedProduct, res.updatedSupplier, res.refundAmount);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to settle replacement");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/50 backdrop-blur-[3px] overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[660px] max-h-[90vh] flex flex-col bg-galla-surface border border-galla-line rounded-[10px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line bg-galla-paper/50 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 rounded-[8px] bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-galla-ink leading-tight truncate">
                Settle Dealer Replacement
              </h2>
              <p className="font-sans text-[12px] text-galla-ink-soft truncate mt-0.5">
                {product.name} &bull; <span className="tabular-nums font-semibold text-rose-800">{maxDefective} defective pending</span>
                {product.purchaseCost ? ` • Cost: ${formatRupee(product.purchaseCost)}/pc` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-galla-ink-soft hover:text-galla-ink hover:bg-galla-line/60 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {/* Product Summary Header Banner */}
          <div className="p-3.5 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-[6px] bg-white border border-galla-line flex items-center justify-center text-galla-teal shrink-0 shadow-2xs">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-sans text-[14px] font-bold text-galla-ink truncate leading-tight">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap mt-1 text-[11.5px] font-sans text-galla-ink-soft">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                    Defective Pending: {maxDefective} pcs
                  </span>
                  <span>&bull;</span>
                  <span>Retail Stock: <strong className="tabular-nums text-galla-ink font-semibold">{product.sell}</strong> pcs</span>
                  <span>&bull;</span>
                  <span>Salon Stock: <strong className="tabular-nums text-galla-ink font-semibold">{product.use}</strong> pcs</span>
                </div>
              </div>
            </div>
            {product.purchaseCost ? (
              <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-galla-line/60">
                <div className="text-[10.5px] text-galla-ink-soft uppercase tracking-wider font-semibold">Unit Purchase Cost</div>
                <div className="tabular-nums text-[14.5px] font-bold text-galla-ink">
                  {formatRupee(product.purchaseCost)} <span className="font-sans text-[10.5px] text-galla-ink-soft font-normal">/pc</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Quantity Section */}
          <div className="p-4 bg-galla-surface border border-galla-line rounded-[8px] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-galla-line/60 pb-2">
              <label className="text-[12.5px] font-bold text-galla-ink">
                Quantity to Settle
              </label>
              <div className="flex items-center gap-1.5 text-[11.5px]">
                <span className="text-galla-ink-soft">Quick:</span>
                <button
                  type="button"
                  onClick={() => setQuantity("1")}
                  className="px-2 py-0.5 rounded bg-galla-paper hover:bg-galla-line/60 border border-galla-line text-galla-ink text-[11px] font-medium transition-colors cursor-pointer"
                >
                  1 pc
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(String(maxDefective))}
                  className="px-2 py-0.5 rounded bg-galla-paper hover:bg-galla-line/60 border border-galla-line text-galla-teal text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  All ({maxDefective})
                </button>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                autoFocus
                min="1"
                max={maxDefective}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors shadow-2xs"
                required
              />
              <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none font-medium">
                pcs
              </span>
            </div>
            <div className="flex items-center justify-between text-[11.5px] font-sans text-galla-ink-soft">
              <span>Settling <strong className="text-galla-ink">{isValidQty ? numQty : 0}</strong> of <strong className="text-galla-ink">{maxDefective}</strong> defective units</span>
              {product.purchaseCost ? (
                <span className="tabular-nums">Estimated Value: <strong className="text-galla-ink font-semibold">{formatRupee(estimatedCost)}</strong></span>
              ) : null}
            </div>
          </div>

          {/* Mandatory PO Selection */}
          <div className="p-4 bg-galla-surface border border-galla-line rounded-[8px] space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[12.5px] font-bold text-galla-ink">
                Link to Original Purchase Bill <span className="text-red-600">*</span>
              </label>
              <span className="font-sans text-[11px] text-galla-ink-soft font-medium">
                {isLoadingPOs ? (
                  <span className="inline-flex items-center gap-1 text-galla-teal">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading bills...
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-galla-paper border border-galla-line text-galla-ink">
                    {pos.length} bill{pos.length === 1 ? "" : "s"} found
                  </span>
                )}
              </span>
            </div>

            {isLoadingPOs ? (
              <div className="p-3 border border-galla-line rounded-[6px] bg-galla-paper/30 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
              </div>
            ) : pos.length === 0 ? (
              <div className="p-3 border border-dashed border-rose-300 rounded-[6px] text-[12px] font-sans text-rose-700 bg-rose-50/50 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>No purchase bills found for &ldquo;{product.name}&rdquo;. A linked supplier bill is required to adjust dues or track settlement history.</span>
              </div>
            ) : (
              <select
                value={selectedPOId}
                onChange={(e) => {
                  setSelectedPOId(e.target.value);
                  setErrorMsg(null);
                }}
                required
                className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors cursor-pointer shadow-2xs"
              >
                <option value="">-- Select Original Supplier Bill * --</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatDisplayNumber(p.purchaseOrderNumber)} &bull; {p.supplierName} ({new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Resolution Type Section */}
          <div className="p-4 bg-galla-surface border border-galla-line rounded-[8px] space-y-3 shadow-2xs">
            <label className="block text-[12.5px] font-bold text-galla-ink">
              How did the dealer resolve this?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResolutionType("credit_refund")}
                className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                  resolutionType === "credit_refund"
                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                    : "bg-white border-galla-line text-galla-ink hover:border-galla-teal/40 hover:bg-galla-paper/30"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13.5px]">
                  <RotateCcw className={`h-4.5 w-4.5 ${resolutionType === "credit_refund" ? "text-galla-teal" : "text-galla-ink-soft"}`} />
                  <span>Return</span>
                </div>
                <p className="font-sans text-[11.5px] text-galla-ink-soft mt-1.5 leading-relaxed">
                  Return defective units to dealer for refund or bill credit.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType("replace_stock")}
                className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                  resolutionType === "replace_stock"
                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                    : "bg-white border-galla-line text-galla-ink hover:border-galla-teal/40 hover:bg-galla-paper/30"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[13.5px]">
                  <CheckCircle2 className={`h-4.5 w-4.5 ${resolutionType === "replace_stock" ? "text-galla-teal" : "text-galla-ink-soft"}`} />
                  <span>Replacement</span>
                </div>
                <p className="font-sans text-[11.5px] text-galla-ink-soft mt-1.5 leading-relaxed">
                  Dealer delivered brand-new replacement units into inventory.
                </p>
              </button>
            </div>

            {/* Conditional Destination / Refund */}
            {resolutionType === "replace_stock" ? (
              <div className="space-y-2 pt-2 border-t border-galla-line/60">
                <label className="block text-[12px] font-semibold text-galla-ink">
                  Add Replacement Items Into
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetStock("sellStock")}
                    className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${
                      targetStock === "sellStock"
                        ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                        : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                        <Store className="h-4 w-4 text-galla-teal" />
                        <span>Retail Sell Stock</span>
                      </div>
                      {targetStock === "sellStock" && <Check className="h-4 w-4 text-galla-teal" />}
                    </div>
                    <div className="font-sans text-[11px] text-galla-ink-soft mt-1.5">
                      Currently: <span className="tabular-nums font-medium text-galla-ink">{product.sell}</span> pcs &rarr; <strong className="tabular-nums text-emerald-700 font-bold">{product.sell + (isValidQty ? numQty : 0)} pcs</strong>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStock("useStock")}
                    className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${
                      targetStock === "useStock"
                        ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                        : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                        <Sparkles className="h-4 w-4 text-galla-teal" />
                        <span>Salon Treatment Use</span>
                      </div>
                      {targetStock === "useStock" && <Check className="h-4 w-4 text-galla-teal" />}
                    </div>
                    <div className="font-sans text-[11px] text-galla-ink-soft mt-1.5">
                      Currently: <span className="tabular-nums font-medium text-galla-ink">{product.use}</span> pcs &rarr; <strong className="tabular-nums text-emerald-700 font-bold">{product.use + (isValidQty ? numQty : 0)} pcs</strong>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3 border-t border-galla-line/60">
                <div className="p-3.5 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-bold text-galla-ink">
                      Settlement Breakdown
                    </label>
                    {selectedPO ? (
                      hasDue ? (
                        <span className="font-sans text-[11px] text-amber-900 font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                          Pending Bill Due: {formatRupee(pendingDue)}
                        </span>
                      ) : (
                        <span className="font-sans text-[11px] text-emerald-800 font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                          Bill Fully Paid
                        </span>
                      )
                    ) : null}
                  </div>

                  {/* Checkbox: ONLY shown if there is pending due */}
                  {hasDue && (
                    <label className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-white border border-galla-line/80 cursor-pointer hover:bg-galla-paper/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={deductFromDue}
                        onChange={(e) => setDeductFromDue(e.target.checked)}
                        className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-galla-line cursor-pointer"
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-galla-ink">
                          Deduct from supplier pending due
                        </span>
                        <span className="text-[11.5px] font-medium text-galla-ink-soft">
                          Max: {formatRupee(Math.min(pendingDue, estimatedCost))}
                        </span>
                      </div>
                    </label>
                  )}

                  <div className="space-y-2 text-[12.5px] font-sans bg-white p-3 rounded-[6px] border border-galla-line/70 shadow-2xs">
                    <div className="flex justify-between items-center text-galla-ink">
                      <span className="text-galla-ink-soft">Total Return Value:</span>
                      <span className="font-semibold tabular-nums">{formatRupee(estimatedCost)}</span>
                    </div>

                    {effectiveDeductFromDue && dueDeduction > 0 && (
                      <div className="flex justify-between items-center text-emerald-800">
                        <span>Deducted from Bill Due:</span>
                        <span className="font-semibold tabular-nums">-{formatRupee(dueDeduction)}</span>
                      </div>
                    )}

                    {hasDue && (
                      <div className="flex justify-between items-center text-galla-ink-soft text-[11.5px]">
                        <span>Remaining Bill Due (Retailer owes):</span>
                        <span className="font-semibold tabular-nums text-galla-ink">
                          {formatRupee(remainingDueAfterReturn)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-galla-line/60">
                      <span className="font-bold text-galla-ink">Net Money to Receive from Supplier:</span>
                      <span
                        className={`font-bold tabular-nums text-[14px] ${
                          cashRefund > 0 ? "text-emerald-700" : "text-galla-ink-soft"
                        }`}
                      >
                        {formatRupee(cashRefund)}
                      </span>
                    </div>
                  </div>

                  {cashRefund > 0 ? (
                    <div className="pt-1">
                      <PaymentModeSelect
                        label={effectiveDeductFromDue ? "Receive Remaining Refund Via" : "Receive Refund Via"}
                        badge={
                          <span className="text-[11.5px] font-semibold tabular-nums text-emerald-700">
                            To Receive: {formatRupee(cashRefund)}
                          </span>
                        }
                        value={supplierPaymentMode}
                        onChange={setSupplierPaymentMode}
                        allowedModes={[
                          "cash",
                          "upi",
                          "card",
                          "bank_transfer",
                          {
                            value: "credit",
                            label: "Supplier Credit",
                            sublabel: "Credit balance with supplier for next purchase",
                            icon: Receipt,
                            tone: "rose",
                          },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-950 text-[12px] font-sans flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        {formatRupee(dueDeduction)} applied to reduce pending due. Remaining due: {formatRupee(remainingDueAfterReturn)}. No money to receive.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="p-4 bg-galla-surface border border-galla-line rounded-[8px] space-y-2 shadow-2xs">
            <label className="block text-[12.5px] font-bold text-galla-ink">
              Settlement Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered by distributor agent; verified fresh seal..."
              className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors shadow-2xs"
            />
          </div>

          {/* Settlement Impact Strip */}
          <div className="p-3.5 bg-galla-paper/50 border border-galla-line rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] font-sans">
            <div className="flex items-center gap-2 flex-wrap">
              <Receipt className="h-4 w-4 text-galla-teal shrink-0" />
              <span className="text-galla-ink-soft">Impact:</span>
              <span className="font-semibold text-galla-ink">
                {isValidQty ? numQty : 0} defective pcs settled
              </span>
              <span>&bull;</span>
              <span className="text-galla-ink-soft">
                Remaining defective: <strong className="text-galla-ink font-semibold">{maxDefective - (isValidQty ? numQty : 0)} pcs</strong>
              </span>
            </div>
            <div className="font-semibold text-galla-ink shrink-0">
              {resolutionType === "replace_stock" ? (
                <span className="text-emerald-800 font-bold">
                  +{isValidQty ? numQty : 0} pcs &rarr; {targetStock === "sellStock" ? "Retail Stock" : "Salon Use"}
                </span>
              ) : (
                <span className="text-rose-800 font-bold">
                  {effectiveDeductFromDue && dueDeduction > 0
                    ? cashRefund > 0
                      ? `-${formatRupee(dueDeduction)} Due + ${formatRupee(cashRefund)} Refund`
                      : `-${formatRupee(dueDeduction)} Due Deduction`
                    : `${formatRupee(cashRefund)} ${supplierPaymentMode === "credit" ? "Credit" : supplierPaymentMode.toUpperCase()}`}
                </span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[6px] text-red-800 text-[12px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="pt-3 border-t border-galla-line flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-[6px] border border-galla-line bg-galla-surface text-[13px] font-sans font-medium text-galla-ink hover:bg-galla-paper transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidQty || !selectedPOId}
              className="h-10 px-5 rounded-[6px] bg-rose-700 hover:bg-rose-800 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Settling Replacement...</span>
                </>
              ) : (
                <span>Confirm Replacement Settlement</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
