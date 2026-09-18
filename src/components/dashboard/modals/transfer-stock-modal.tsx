"use client";

import React, { useState } from "react";
import { X, ArrowRightLeft, AlertCircle, Loader2, IndianRupee } from "lucide-react";
import { DashboardProduct, DashboardExpense } from "@/types/dashboard";
import { transferStockAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface TransferStockModalProps {
  product: DashboardProduct | null;
  allProducts?: DashboardProduct[];
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess: (updatedProduct: DashboardProduct, newExpense?: DashboardExpense) => void;
}

export function TransferStockModal({
  product,
  allProducts,
  isOpen,
  onClose,
  onTransferSuccess,
}: TransferStockModalProps) {
  if (!isOpen || !product) return null;

  return (
    <TransferStockModalContent
      key={product.id}
      product={product}
      allProducts={allProducts}
      onClose={onClose}
      onTransferSuccess={onTransferSuccess}
    />
  );
}

function TransferStockModalContent({
  product,
  allProducts,
  onClose,
  onTransferSuccess,
}: {
  product: DashboardProduct;
  allProducts?: DashboardProduct[];
  onClose: () => void;
  onTransferSuccess: (updatedProduct: DashboardProduct, newExpense?: DashboardExpense) => void;
}) {
  const [quantity, setQuantity] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = Number(quantity);
  const isValidQty = !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= product.sell;

  const estUnitCost = product.purchaseCost !== undefined && product.purchaseCost !== null ? product.purchaseCost : 0;
  const estTotalCost = isValidQty ? numQty * estUnitCost : 0;
  const unitProfit = Math.max(0, product.price - estUnitCost);
  const marginPct = product.price > 0 ? Math.round((unitProfit / product.price) * 100) : 0;

  // Check if sibling batches exist (e.g. Old vs New)
  const baseName = product.name.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim().toLowerCase();
  const siblingBatches = allProducts
    ? allProducts.filter(
        (p) =>
          String(p.id) !== String(product.id) &&
          p.name.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim().toLowerCase() === baseName
      )
    : [];

  const currentMargin = product.price > 0 ? (product.price - estUnitCost) / product.price : 0;
  const lowerMarginSibling = siblingBatches.find((s) => {
    const sCost = s.purchaseCost || 0;
    const sMargin = s.price > 0 ? (s.price - sCost) / s.price : 0;
    return sMargin < currentMargin && s.sell > 0;
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isValidQty) {
      setErrorMsg(`Please enter a valid whole quantity between 1 and ${product.sell}`);
      return;
    }

    setShowConfirm(true);
  };

  const executeTransfer = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const res = await transferStockAction({
        productId: String(product.id),
        quantity: numQty,
      });

      if (res.success && res.updatedProduct) {
        onTransferSuccess(res.updatedProduct, res.newExpense);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to transfer inventory");
      }
    } catch {
      setErrorMsg("Network error occurred during stock transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[420px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                Stock Move (Sell &rarr; Use)
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Move retail items to salon internal treatment use
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-galla-ink-soft hover:text-galla-ink rounded-[4px] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[13px] font-sans mb-4">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Target Product Summary Card */}
          <div className="p-3 bg-galla-paper/50 border border-galla-line rounded-[5px] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans font-semibold text-[14px] text-galla-ink truncate">
                {product.name}
              </span>
              <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                +{formatRupee(unitProfit)} ({marginPct}% margin)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px] font-sans">
              <div className="text-galla-ink-soft">
                Current Retail:{" "}
                <span className="font-medium text-galla-ink">{product.sell} pcs</span>
              </div>
              <div className="text-galla-ink-soft">
                Current Internal:{" "}
                <span className="font-medium text-galla-ink">{product.use} pcs</span>
              </div>
            </div>
            {lowerMarginSibling ? (
              <div className="text-[11.5px] font-sans text-amber-900 bg-amber-50/90 border border-amber-200/90 p-2 rounded-[4px] leading-relaxed">
                💡 <strong>Prioritize Lower Margin Batch:</strong> &ldquo;{lowerMarginSibling.name}&rdquo; has a lower profit margin ({Math.round(((lowerMarginSibling.price - (lowerMarginSibling.purchaseCost || 0)) / (lowerMarginSibling.price || 1)) * 100)}%). Moving the lower-margin batch to salon use is recommended to preserve high-margin stock for retail sales.
              </div>
            ) : siblingBatches.length > 0 ? (
              <div className="text-[11.5px] font-sans text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-[4px] leading-relaxed">
                ✓ <strong>Best for Internal Use:</strong> This batch has the lowest profit margin ({marginPct}%). Recommended for salon treatment usage.
              </div>
            ) : null}
          </div>

          {/* Quantity Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
                Quantity to Move <span className="text-red-600">*</span>
              </label>
              <span className="font-sans text-[11px] text-galla-ink-soft">
                Max: {product.sell} pcs
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                min="1"
                max={product.sell}
                step="1"
                required
                autoFocus
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[14px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
              />
              <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none">
                pcs
              </span>
            </div>
          </div>

          {/* Quick Quantity Buttons */}
          <div className="flex items-center gap-2">
            {[1, 2, 5].map((q) => (
              <button
                key={q}
                type="button"
                disabled={q > product.sell}
                onClick={() => setQuantity(String(q))}
                className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded-[4px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  quantity === String(q)
                    ? "bg-galla-teal-soft text-galla-teal border-galla-teal/30"
                    : "border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper"
                }`}
              >
                +{q} pcs
              </button>
            ))}
            <button
              type="button"
              disabled={product.sell <= 0}
              onClick={() => setQuantity(String(product.sell))}
              className="ml-auto px-2.5 py-1 text-[11px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer"
            >
              All ({product.sell})
            </button>
          </div>

          {/* Estimated Internal Expense notice */}
          {isValidQty && (
            <div className="space-y-1">
              <div className="flex items-center justify-between p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-[4px] text-[12px] font-sans text-amber-950">
                <span className="flex items-center gap-1">
                  <span>Auto-logged internal expense</span>
                  <span className="text-amber-800/80">(purchase price @ {formatRupee(estUnitCost)}/pc):</span>
                </span>
                <span className="font-semibold tabular-nums text-amber-900">{formatRupee(estTotalCost)}</span>
              </div>
              <p className="font-sans text-[11px] text-galla-ink-soft">
                Internal use is valued at purchase price ({formatRupee(estUnitCost)}), not retail sell price ({formatRupee(product.price)}).
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-galla-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-[5px] border border-galla-line font-sans text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidQty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSubmitting ? "Moving..." : `Move ${numQty || 1} pcs to Use`}</span>
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Stock Move"
          description={
            <span>
              Are you sure you want to move <strong className="font-semibold text-galla-ink">{numQty} pcs</strong> of{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> to internal salon use?
              {estTotalCost > 0 && (
                <span className="block mt-2 text-[12px] text-amber-800 font-medium">
                  Internal expense: <strong className="font-semibold text-amber-900">{formatRupee(estTotalCost)}</strong> (valued at purchase price <strong className="font-semibold text-amber-900">{formatRupee(estUnitCost)}/pc</strong>).
                </span>
              )}
            </span>
          }
          confirmLabel="Yes, Move Stock"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeTransfer}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
