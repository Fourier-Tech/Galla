"use client";

import React, { useState } from "react";
import {
  X,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  PackageMinus,
  Check,
} from "lucide-react";
import { DashboardProduct, DashboardExpense } from "@/types/dashboard";
import { transferStockAction, consumeUseStockAction } from "@/app/dashboard/actions";
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

type ModalMode = "transfer" | "consume";
type TransferDirection = "sell_to_use" | "use_to_sell";
type ConsumeReason = "service" | "finished" | "damaged" | "other";

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
  const [mode, setMode] = useState<ModalMode>("transfer");
  const [direction, setDirection] = useState<TransferDirection>(
    product.sell > 0 ? "sell_to_use" : product.use > 0 ? "use_to_sell" : "sell_to_use"
  );
  const [quantity, setQuantity] = useState("1");
  const [consumeReason, setConsumeReason] = useState<ConsumeReason>("service");
  const [consumeNotes, setConsumeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = Number(quantity);

  // Maximum allowed stock depends on mode and transfer direction
  const maxAvailable =
    mode === "consume"
      ? product.use
      : direction === "sell_to_use"
      ? product.sell
      : product.use;

  const isValidQty =
    !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= maxAvailable;

  const estUnitCost =
    product.purchaseCost !== undefined && product.purchaseCost !== null
      ? product.purchaseCost
      : 0;
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

    if (maxAvailable <= 0) {
      setErrorMsg(
        mode === "consume"
          ? "No salon internal stock available to consume"
          : direction === "sell_to_use"
          ? "No retail stock available to move to salon use"
          : "No salon internal stock available to move to retail"
      );
      return;
    }

    if (!isValidQty) {
      setErrorMsg(`Please enter a valid whole quantity between 1 and ${maxAvailable}`);
      return;
    }

    setShowConfirm(true);
  };

  const executeAction = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (mode === "consume") {
        const res = await consumeUseStockAction({
          productId: String(product.id),
          quantity: numQty,
          reason: consumeReason,
          notes: consumeNotes.trim() || undefined,
        });

        if (res.success && res.updatedProduct) {
          onTransferSuccess(res.updatedProduct, res.newExpense);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to log consumption");
        }
      } else {
        const res = await transferStockAction({
          productId: String(product.id),
          quantity: numQty,
          direction,
        });

        if (res.success && res.updatedProduct) {
          onTransferSuccess(res.updatedProduct);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to transfer inventory");
        }
      }
    } catch {
      setErrorMsg("Network error occurred during operation");
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
      <div className="w-full max-w-[440px] bg-galla-surface border border-galla-line rounded-[5px] p-[20px] shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-[4px] ${
                mode === "consume"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-galla-teal-soft text-galla-teal"
              }`}
            >
              {mode === "consume" ? (
                <PackageMinus className="h-4 w-4" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[16.5px] text-galla-ink">
                {mode === "consume" ? "Log Used / Consumed Stock" : "Transfer Stock"}
              </h3>
              <p className="font-sans text-[11.5px] text-galla-ink-soft">
                {mode === "consume"
                  ? "Deduct opened or consumed items from salon internal stock"
                  : "Move units between retail shelf and salon treatment use"}
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

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-galla-paper/60 rounded-[5px] border border-galla-line mb-3">
          <button
            type="button"
            onClick={() => {
              setMode("transfer");
              setErrorMsg(null);
            }}
            className={`py-1.5 px-3 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "transfer"
                ? "bg-galla-surface text-galla-teal shadow-xs font-semibold"
                : "text-galla-ink-soft hover:text-galla-ink"
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Transfer Stock</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("consume");
              setErrorMsg(null);
            }}
            className={`py-1.5 px-3 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "consume"
                ? "bg-galla-surface text-amber-800 shadow-xs font-semibold"
                : "text-galla-ink-soft hover:text-galla-ink"
            }`}
          >
            <PackageMinus className="h-3.5 w-3.5" />
            <span>Deduct Use Stock</span>
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[12.5px] font-sans mb-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
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
              <div className="p-1.5 rounded bg-galla-surface border border-galla-line">
                <span className="text-galla-ink-soft block text-[11px]">Retail Shelf (Sell):</span>
                <span className="font-heading font-semibold text-[13px] text-galla-ink">
                  {product.sell} pcs
                </span>
              </div>
              <div className="p-1.5 rounded bg-galla-surface border border-galla-line">
                <span className="text-galla-ink-soft block text-[11px]">Salon Internal (Use):</span>
                <span className="font-heading font-semibold text-[13px] text-galla-teal">
                  {product.use} pcs
                </span>
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

          {/* Mode 1: Transfer Stock Direction Toggle */}
          {mode === "transfer" && (
            <div>
              <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block mb-1.5">
                Transfer Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDirection("sell_to_use");
                    setErrorMsg(null);
                  }}
                  className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                    direction === "sell_to_use"
                      ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                  }`}
                >
                  <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                    <span>Retail &rarr; Salon Use</span>
                    {direction === "sell_to_use" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Available: {product.sell} pcs
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirection("use_to_sell");
                    setErrorMsg(null);
                  }}
                  className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                    direction === "use_to_sell"
                      ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                  }`}
                >
                  <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                    <span>Salon Use &rarr; Retail</span>
                    {direction === "use_to_sell" && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Available: {product.use} pcs
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Consume Reason Selector */}
          {mode === "consume" && (
            <div className="space-y-2">
              <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block">
                Reason for Deduction
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "service", label: "Used in Service" },
                  { id: "finished", label: "Emptied / Finished" },
                  { id: "damaged", label: "Damaged / Expired" },
                  { id: "other", label: "Other Consumption" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setConsumeReason(r.id as ConsumeReason)}
                    className={`py-1.5 px-2.5 rounded-[4px] border text-[11.5px] font-sans font-medium transition-colors cursor-pointer text-center ${
                      consumeReason === r.id
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                        : "bg-galla-surface text-galla-ink-soft border-galla-line hover:bg-galla-paper"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div>
                <input
                  type="text"
                  value={consumeNotes}
                  onChange={(e) => setConsumeNotes(e.target.value)}
                  placeholder="Optional notes (e.g., hair spa basin, opened today)..."
                  className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/60 focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                {mode === "consume" ? "Quantity to Deduct" : "Quantity to Move"}{" "}
                <span className="text-red-600">*</span>
              </label>
              <span className="font-sans text-[11px] text-galla-ink-soft">
                Available: {maxAvailable} pcs
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                min="1"
                max={Math.max(1, maxAvailable)}
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
                disabled={q > maxAvailable}
                onClick={() => setQuantity(String(q))}
                className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded-[4px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  quantity === String(q)
                    ? "bg-galla-teal-soft text-galla-teal border-galla-teal/30 font-semibold"
                    : "border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper"
                }`}
              >
                +{q} pcs
              </button>
            ))}
            <button
              type="button"
              disabled={maxAvailable <= 0}
              onClick={() => setQuantity(String(maxAvailable))}
              className="ml-auto px-2.5 py-1 text-[11px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              All ({maxAvailable})
            </button>
          </div>

          {/* Informational notices */}
          {mode === "transfer" && direction === "sell_to_use" && isValidQty && (
            <div className="p-2.5 bg-galla-paper/70 border border-galla-line rounded-[4px] text-[11.5px] font-sans text-galla-ink-soft">
              Moving {numQty} pcs from retail shelf to salon internal use. <span className="text-galla-ink font-medium">Expense will be recorded only when this stock is deducted/consumed.</span>
            </div>
          )}

          {mode === "transfer" && direction === "use_to_sell" && isValidQty && (
            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-[4px] text-[11.5px] font-sans text-emerald-950">
              Returning {numQty} pcs to the retail shelf. They will be available for customer sales at{" "}
              <strong>{formatRupee(product.price)}</strong>.
            </div>
          )}

          {mode === "consume" && isValidQty && (
            <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-[4px] text-[12px] font-sans text-amber-950">
              <div className="flex items-center justify-between">
                <span>Auto-logged internal expense:</span>
                <span className="font-semibold tabular-nums text-amber-900">
                  {formatRupee(estTotalCost)}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 mt-0.5">
                Valued at purchase cost ({formatRupee(estUnitCost)}/pc). Deducting {numQty} pcs will leave {product.use - numQty} pcs in salon use.
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
              disabled={isSubmitting || !isValidQty || maxAvailable <= 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] text-white font-sans text-[13px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === "consume"
                  ? "bg-amber-800 hover:bg-amber-900"
                  : "bg-galla-teal hover:opacity-95"
              }`}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {isSubmitting
                  ? "Processing..."
                  : mode === "consume"
                  ? `Deduct ${numQty || 1} pcs`
                  : direction === "sell_to_use"
                  ? `Move ${numQty || 1} pcs to Use`
                  : `Move ${numQty || 1} pcs to Retail`}
              </span>
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={mode === "consume" ? "Confirm Stock Deduction" : "Confirm Stock Move"}
          description={
            <span>
              {mode === "consume" ? (
                <>
                  Are you sure you want to deduct{" "}
                  <strong className="font-semibold text-galla-ink">{numQty} pcs</strong> of{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> from salon use stock?
                  <span className="block mt-1 text-[12px] text-galla-ink-soft">
                    Reason: <strong>{consumeReason === "service" ? "Used in Service" : consumeReason === "finished" ? "Emptied / Finished" : consumeReason === "damaged" ? "Damaged / Expired" : "Other"}</strong>
                  </span>
                  {estTotalCost > 0 && (
                    <span className="block mt-2 text-[12px] text-amber-800 font-medium">
                      Auto-logged internal expense: <strong className="font-semibold text-amber-900">{formatRupee(estTotalCost)}</strong> (valued at purchase price <strong className="font-semibold text-amber-900">{formatRupee(estUnitCost)}/pc</strong>).
                    </span>
                  )}
                </>
              ) : direction === "sell_to_use" ? (
                <>
                  Are you sure you want to move{" "}
                  <strong className="font-semibold text-galla-ink">{numQty} pcs</strong> of{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> from retail to salon internal use?
                </>
              ) : (
                <>
                  Are you sure you want to return{" "}
                  <strong className="font-semibold text-galla-ink">{numQty} pcs</strong> of{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> from salon use back to the retail shelf?
                </>
              )}
            </span>
          }
          confirmLabel={mode === "consume" ? "Yes, Deduct Stock" : "Yes, Move Stock"}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeAction}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
