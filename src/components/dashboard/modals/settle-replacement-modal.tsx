"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";
import { DashboardProduct, DashboardSupplier } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";
import { settleSupplierReplacementAction, getPurchaseOrdersForProductAction } from "@/app/dashboard/actions";
import { PaymentModeSelect } from "../payment-mode-select";

interface SettleReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: DashboardProduct | null;
  onSuccess: (updatedProduct: DashboardProduct, updatedSupplier?: DashboardSupplier) => void;
}

export function SettleReplacementModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: SettleReplacementModalProps) {
  const [quantity, setQuantity] = useState<string>("1");
  const [resolutionType, setResolutionType] = useState<"replace_stock" | "credit_refund">("replace_stock");
  const [targetStock, setTargetStock] = useState<"sellStock" | "useStock">("sellStock");
  const [refundMode, setRefundMode] = useState<"reduce_due" | "cash" | "upi" | "card">("reduce_due");
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
      setResolutionType("replace_stock");
      setTargetStock("sellStock");
      setRefundMode("reduce_due");
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
          refundMode: resolutionType === "credit_refund" ? refundMode : undefined,
          poId: selectedPOId,
          notes: notes.trim() || undefined,
        }
      );

      if (res.success && res.updatedProduct) {
        onSuccess(res.updatedProduct, res.updatedSupplier);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-[2px] overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] max-h-[85vh] flex flex-col bg-galla-surface border border-galla-line rounded-[6px] shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-[4px] bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-galla-ink leading-tight truncate">
                Settle Dealer Replacement
              </h2>
              <p className="font-sans text-[11px] text-galla-ink-soft truncate">
                {product.name} &bull; <span className="tabular-nums">{maxDefective}</span> defective pending
                {product.purchaseCost ? ` • Cost: ${formatRupee(product.purchaseCost)}/pc` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] text-galla-ink-soft hover:text-galla-ink hover:bg-galla-line/40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3.5 custom-scrollbar">

          {/* Quantity Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-galla-ink">
                Quantity to Settle
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity("1")}
                  className="font-sans text-[10.5px] text-galla-teal hover:underline cursor-pointer"
                >
                  1 pc
                </button>
                <span className="text-galla-ink-soft text-[10px]">&bull;</span>
                <button
                  type="button"
                  onClick={() => setQuantity(String(maxDefective))}
                  className="font-sans text-[10.5px] text-galla-teal hover:underline cursor-pointer font-medium tabular-nums"
                >
                  All ({maxDefective})
                </button>
              </div>
            </div>
            <input
              type="number"
              min="1"
              max={maxDefective}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-sans tabular-nums text-[13px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              required
            />
          </div>

          {/* Resolution Type */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              How did the dealer resolve this?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResolutionType("replace_stock")}
                className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                  resolutionType === "replace_stock"
                    ? "bg-galla-teal/10 border-galla-teal text-galla-teal"
                    : "bg-galla-surface border-galla-line text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">New Stock Replaced</span>
                  {resolutionType === "replace_stock" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                </div>
                <div className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                  Dealer exchanged with fresh units
                </div>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType("credit_refund")}
                className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                  resolutionType === "credit_refund"
                    ? "bg-rose-50 border-rose-400 text-rose-700"
                    : "bg-galla-surface border-galla-line text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">Dealer Credit / Refund</span>
                  {resolutionType === "credit_refund" && <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />}
                </div>
                <div className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                  Cannot replace, gave credit / money
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Options: Replace Stock */}
          {resolutionType === "replace_stock" ? (
            <div className="space-y-2 pt-1 border-t border-galla-line/60">
              <label className="block text-[12px] font-medium text-galla-ink">
                Add Replacement Items Into
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetStock("sellStock")}
                  className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                    targetStock === "sellStock"
                      ? "bg-galla-teal/10 border-galla-teal text-galla-teal font-medium"
                      : "bg-galla-surface border-galla-line text-galla-ink hover:bg-galla-paper"
                  }`}
                >
                  <div className="font-sans text-[11.5px] font-semibold">Retail Sell Stock</div>
                  <div className="font-sans text-[10px] text-galla-ink-soft">
                    Currently: {product.sell} pcs &rarr; {product.sell + (isValidQty ? numQty : 0)} pcs
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetStock("useStock")}
                  className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                    targetStock === "useStock"
                      ? "bg-galla-teal/10 border-galla-teal text-galla-teal font-medium"
                      : "bg-galla-surface border-galla-line text-galla-ink hover:bg-galla-paper"
                  }`}
                >
                  <div className="font-sans text-[11.5px] font-semibold">Salon Use Stock</div>
                  <div className="font-sans text-[10px] text-galla-ink-soft">
                    Currently: {product.use} pcs &rarr; {product.use + (isValidQty ? numQty : 0)} pcs
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-1 border-t border-galla-line/60">
              {/* Conditional Options: Credit / Refund */}
              <PaymentModeSelect
                label="Credit / Refund Mode"
                badge={
                  <span className="font-sans text-[12px] font-semibold text-rose-700 tabular-nums">
                    Total: {formatRupee(estimatedCost)}
                  </span>
                }
                value={refundMode}
                onChange={setRefundMode}
                allowedModes={[
                  {
                    value: "reduce_due",
                    label: "Reduce Supplier Due",
                    sublabel: "Deduct from pending bills",
                  },
                  {
                    value: "cash",
                    label: "Cash / Direct Refund",
                    sublabel: "Dealer handed cash or direct refund",
                  },
                  {
                    value: "upi",
                    label: "UPI / Online Refund",
                    sublabel: "Dealer transferred via UPI / Netbanking",
                  },
                  {
                    value: "card",
                    label: "Card Reversal",
                    sublabel: "Refunded to card terminal",
                  },
                ]}
              />
            </div>
          )}

          {/* Mandatory PO Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-galla-ink">
                Link to Original Purchase Bill <span className="text-red-600">*</span>
              </label>
              <span className="font-sans text-[10.5px] text-galla-ink-soft">
                {isLoadingPOs ? (
                  <span className="inline-flex items-center gap-1 text-galla-teal">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </span>
                ) : (
                  `${pos.length} bill${pos.length === 1 ? "" : "s"} found`
                )}
              </span>
            </div>

            {isLoadingPOs ? (
              <div className="p-2.5 border border-galla-line rounded-[5px] bg-galla-paper/30 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
              </div>
            ) : pos.length === 0 ? (
              <div className="p-2.5 border border-dashed border-rose-300 rounded-[5px] text-[11.5px] font-sans text-rose-700 bg-rose-50/50">
                No purchase bills found for &ldquo;{product.name}&rdquo;. A linked supplier bill is required to adjust dues or track settlement history.
              </div>
            ) : (
              <select
                value={selectedPOId}
                onChange={(e) => {
                  setSelectedPOId(e.target.value);
                  setErrorMsg(null);
                }}
                required
                className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-sans text-[12px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors cursor-pointer"
              >
                <option value="">-- Select Original Supplier Bill * --</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchaseOrderNumber} &bull; {p.supplierName} ({new Date(p.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Settlement Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered by distributor agent today"
              className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-[5px] text-red-700 text-[11.5px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="pt-2 border-t border-galla-line flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 px-3 rounded-[5px] border border-galla-line bg-galla-surface text-[12px] font-sans font-medium text-galla-ink hover:bg-galla-paper transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidQty || !selectedPOId}
              className="h-8 px-4 rounded-[5px] bg-galla-teal text-white text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <span>Confirm Settlement</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
