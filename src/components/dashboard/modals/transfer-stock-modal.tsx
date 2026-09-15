"use client";

import React, { useState } from "react";
import { X, ArrowRightLeft, AlertCircle, Loader2, IndianRupee } from "lucide-react";
import { DashboardProduct, DashboardExpense } from "@/types/dashboard";
import { transferStockAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";

interface TransferStockModalProps {
  product: DashboardProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess: (updatedProduct: DashboardProduct, newExpense?: DashboardExpense) => void;
}

export function TransferStockModal({
  product,
  isOpen,
  onClose,
  onTransferSuccess,
}: TransferStockModalProps) {
  if (!isOpen || !product) return null;

  return (
    <TransferStockModalContent
      key={product.id}
      product={product}
      onClose={onClose}
      onTransferSuccess={onTransferSuccess}
    />
  );
}

function TransferStockModalContent({
  product,
  onClose,
  onTransferSuccess,
}: {
  product: DashboardProduct;
  onClose: () => void;
  onTransferSuccess: (updatedProduct: DashboardProduct, newExpense?: DashboardExpense) => void;
}) {
  const [quantity, setQuantity] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = Number(quantity);
  const isValidQty = !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= product.sell;

  const estUnitCost = product.purchaseCost !== undefined && product.purchaseCost !== null ? product.purchaseCost : 0;
  const estTotalCost = isValidQty ? numQty * estUnitCost : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isValidQty) {
      setErrorMsg(`Please enter a valid whole quantity between 1 and ${product.sell}`);
      return;
    }

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
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Product Summary Card */}
          <div className="p-3 bg-galla-paper/50 border border-galla-line rounded-[5px] space-y-2">
            <div className="font-sans font-semibold text-[14px] text-galla-ink">
              {product.name}
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
          {isValidQty && estTotalCost > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-[4px] text-[12px] font-sans text-amber-900">
              <span>Auto-logged as internal expense:</span>
              <span className="font-semibold tabular-nums">{formatRupee(estTotalCost)}</span>
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
      </div>
    </div>
  );
}
