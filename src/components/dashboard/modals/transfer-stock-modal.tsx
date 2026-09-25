"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  PackageMinus,
  Check,
  Undo2,
} from "lucide-react";
import { DashboardProduct, DashboardExpense } from "@/types/dashboard";
import {
  transferStockAction,
  consumeUseStockAction,
  returnInventoryToSupplierAction,
  getPurchaseOrdersForProductAction,
} from "@/app/dashboard/actions";
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

type ModalMode = "transfer" | "consume" | "return_supplier";
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

  // Supplier Return State
  const [supplierStockSource, setSupplierStockSource] = useState<"defectiveStock" | "sellStock" | "useStock">(
    (product.defectiveStock || 0) > 0 ? "defectiveStock" : product.sell > 0 ? "sellStock" : "useStock"
  );
  const [supplierRefundMode, setSupplierRefundMode] = useState<"reduce_due" | "replacement_pending">("reduce_due");
  const [pos, setPos] = useState<any[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "return_supplier") {
      setIsLoadingPOs(true);
      getPurchaseOrdersForProductAction(String(product.id), product.name).then((res) => {
        if (res.success && res.pos) {
          setPos(res.pos);
          if (res.pos.length > 0) {
            setSelectedPOId((prev) => prev || res.pos[0].id);
          }
        }
        setIsLoadingPOs(false);
      });
    }
  }, [mode, product.id, product.name]);

  const numQty = Number(quantity);

  const selectedPO = pos.find((p) => p.id === selectedPOId);
  const selectedItem = selectedPO?.items?.find(
    (i: any) =>
      (product.id && (i.productId === String(product.id) || i.productId === product.id)) ||
      (product.name && i.productName && i.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
  );
  const maxReturnableFromBill = selectedItem
    ? Math.max(0, (selectedItem.quantityForSell || 0) + (selectedItem.quantityForUse || 0) - (selectedItem.returnedQuantity || 0))
    : 0;

  const physicalStockAvailable =
    mode === "return_supplier"
      ? supplierStockSource === "defectiveStock"
        ? (product.defectiveStock || 0)
        : supplierStockSource === "sellStock"
        ? product.sell
        : product.use
      : mode === "consume"
      ? product.use
      : direction === "sell_to_use"
      ? product.sell
      : product.use;

  const maxAvailable =
    mode === "return_supplier"
      ? selectedPOId
        ? Math.min(physicalStockAvailable, maxReturnableFromBill)
        : physicalStockAvailable
      : physicalStockAvailable;

  const isValidQty =
    !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= maxAvailable;

  const estUnitCost =
    product.purchaseCost !== undefined && product.purchaseCost !== null
      ? product.purchaseCost
      : 0;
  const returnUnitCost = selectedItem?.purchaseCost !== undefined ? selectedItem.purchaseCost : estUnitCost;
  const estTotalCost = isValidQty ? numQty * estUnitCost : 0;
  const estReturnCost = isValidQty ? numQty * returnUnitCost : 0;
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

  const currentProfit = Math.max(0, product.price - estUnitCost);
  const lowerProfitSibling = siblingBatches.find((s) => {
    const sCost = s.purchaseCost || 0;
    const sProfit = Math.max(0, s.price - sCost);
    return sProfit < currentProfit && s.sell > 0;
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === "return_supplier") {
      if (!selectedPOId) {
        setErrorMsg("Please select the original supplier bill to return against");
        return;
      }
      if (maxAvailable <= 0) {
        setErrorMsg(
          supplierStockSource === "defectiveStock"
            ? "No defective pieces or returnable quantity available on selected bill"
            : supplierStockSource === "sellStock"
            ? "No retail shelf stock or returnable quantity available on selected bill"
            : "No salon internal stock or returnable quantity available on selected bill"
        );
        return;
      }
    } else if (maxAvailable <= 0) {
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
      if (mode === "return_supplier") {
        if (!selectedPOId) {
          setErrorMsg("Please select a purchase bill");
          return;
        }
        const res = await returnInventoryToSupplierAction(
          String(product.id),
          selectedPOId,
          numQty,
          supplierStockSource,
          supplierRefundMode,
          consumeNotes.trim() || undefined
        );

        if (res.success) {
          const updated: DashboardProduct = {
            ...product,
            sell: supplierStockSource === "sellStock" ? Math.max(0, product.sell - numQty) : product.sell,
            use: supplierStockSource === "useStock" ? Math.max(0, product.use - numQty) : product.use,
            defectiveStock: supplierStockSource === "defectiveStock"
              ? Math.max(0, (product.defectiveStock || 0) - numQty)
              : supplierRefundMode === "replacement_pending"
              ? (product.defectiveStock || 0) + numQty
              : (product.defectiveStock || 0),
          };
          onTransferSuccess(updated);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to process supplier return");
        }
      } else if (mode === "consume") {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[680px] max-h-[85vh] flex flex-col bg-galla-surface border border-galla-line rounded-[6px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed top */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-[4px] ${
                mode === "consume"
                  ? "bg-amber-50 text-amber-700"
                  : mode === "return_supplier"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-galla-teal-soft text-galla-teal"
              }`}
            >
              {mode === "consume" ? (
                <PackageMinus className="h-4 w-4" />
              ) : mode === "return_supplier" ? (
                <Undo2 className="h-4 w-4" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[16px] text-galla-ink">
                {mode === "consume"
                  ? "Log Used / Consumed Stock"
                  : mode === "return_supplier"
                  ? "Return Product to Supplier"
                  : "Transfer Stock"}
              </h3>
              <p className="font-sans text-[11.5px] text-galla-ink-soft">
                {mode === "consume"
                  ? "Deduct opened or consumed items from salon internal stock"
                  : mode === "return_supplier"
                  ? "Return stock directly to supplier and adjust dues or replacements"
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3">
          {/* Mode Selector Tabs (3 Tabs) */}
          <div className="grid grid-cols-3 p-1 bg-galla-paper/60 rounded-[5px] border border-galla-line">
            <button
              type="button"
              onClick={() => {
                setMode("transfer");
                setErrorMsg(null);
              }}
              className={`py-1.5 px-2.5 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                mode === "transfer"
                  ? "bg-galla-surface text-galla-teal shadow-xs font-semibold"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Transfer Stock</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("consume");
                setErrorMsg(null);
              }}
              className={`py-1.5 px-2.5 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                mode === "consume"
                  ? "bg-galla-surface text-amber-800 shadow-xs font-semibold"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              <PackageMinus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Deduct Use Stock</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("return_supplier");
                setErrorMsg(null);
              }}
              className={`py-1.5 px-2.5 rounded-[4px] text-[12px] font-sans font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                mode === "return_supplier"
                  ? "bg-galla-surface text-rose-700 shadow-xs font-semibold"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              <Undo2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Return to Supplier</span>
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-2.5 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[12px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Compact Product Summary Card */}
          <div className="p-2.5 bg-galla-paper/40 border border-galla-line rounded-[5px] space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-sans font-semibold text-[13.5px] text-galla-ink truncate">
                  {product.name}
                </span>
                <span className="text-[10.5px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                  +{formatRupee(unitProfit)} ({marginPct}% margin)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11.5px] font-sans shrink-0">
                {(product.defectiveStock || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                    Defective: <strong className="font-heading text-[12px] text-rose-700 font-semibold">{product.defectiveStock}</strong> pcs
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-galla-surface border border-galla-line text-galla-ink-soft">
                  Retail Shelf: <strong className="font-heading text-[12px] text-galla-ink font-semibold">{product.sell}</strong> pcs
                </span>
                <span className="px-2 py-0.5 rounded bg-galla-surface border border-galla-line text-galla-ink-soft">
                  Salon Use: <strong className="font-heading text-[12px] text-galla-teal font-semibold">{product.use}</strong> pcs
                </span>
              </div>
            </div>
            {lowerProfitSibling ? (
              <div className="text-[11px] font-sans text-amber-900 bg-amber-50/90 border border-amber-200/90 p-1.5 rounded-[4px] leading-relaxed">
                ⚠️ <strong>Keep This for Retail:</strong> This batch earns {formatRupee(unitProfit)} profit/unit. Use &ldquo;{lowerProfitSibling.name}&rdquo; ({formatRupee(Math.max(0, lowerProfitSibling.price - (lowerProfitSibling.purchaseCost || 0)))}/unit) for salon use instead.
              </div>
            ) : siblingBatches.length > 0 ? (
              <div className="text-[11px] font-sans text-emerald-800 bg-emerald-50 border border-emerald-200 p-1.5 rounded-[4px] leading-relaxed">
                ✓ <strong>Best for Internal Use:</strong> Lowest profit batch at {formatRupee(unitProfit)}/unit. Recommended for salon usage.
              </div>
            ) : null}
          </div>

          {/* Mode 1: Transfer Stock Form (Side-by-Side 2-Column Grid) */}
          {mode === "transfer" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Left: Direction */}
                <div>
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block mb-1">
                    Transfer Direction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDirection("sell_to_use");
                        setErrorMsg(null);
                      }}
                      className={`p-2 rounded-[5px] border text-left transition-all cursor-pointer ${
                        direction === "sell_to_use"
                          ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                        <span>Retail &rarr; Use</span>
                        {direction === "sell_to_use" && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                        Available: {product.sell} pcs
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDirection("use_to_sell");
                        setErrorMsg(null);
                      }}
                      className={`p-2 rounded-[5px] border text-left transition-all cursor-pointer ${
                        direction === "use_to_sell"
                          ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                        <span>Use &rarr; Retail</span>
                        {direction === "use_to_sell" && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                        Available: {product.use} pcs
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right: Quantity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                      Quantity to Move <span className="text-red-600">*</span>
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
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13.5px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 2, 5].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={q > maxAvailable}
                        onClick={() => setQuantity(String(q))}
                        className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          quantity === String(q)
                            ? "bg-galla-teal-soft text-galla-teal border-galla-teal/30 font-semibold"
                            : "border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper"
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={maxAvailable <= 0}
                      onClick={() => setQuantity(String(maxAvailable))}
                      className="ml-auto px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      All ({maxAvailable})
                    </button>
                  </div>
                </div>
              </div>

              {/* Informational notices */}
              {direction === "sell_to_use" && isValidQty && (
                <div className="p-2 bg-galla-paper/70 border border-galla-line rounded-[4px] text-[11.5px] font-sans text-galla-ink-soft">
                  Moving {numQty} pcs from retail shelf to salon internal use.
                </div>
              )}

              {direction === "use_to_sell" && isValidQty && (
                <div className="p-2 bg-emerald-50/80 border border-emerald-200/80 rounded-[4px] text-[11.5px] font-sans text-emerald-950">
                  Returning {numQty} pcs to the retail shelf. They will be available for customer sales at{" "}
                  <strong>{formatRupee(product.price)}</strong>.
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Consume Reason Selector (Side-by-Side 2-Column Grid) */}
          {mode === "consume" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Left: Reason */}
                <div className="space-y-1.5">
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block">
                    Reason for Deduction
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "service", label: "Used in Service" },
                      { id: "finished", label: "Finished" },
                      { id: "damaged", label: "Damaged" },
                      { id: "other", label: "Other" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setConsumeReason(r.id as ConsumeReason)}
                        className={`py-1.5 px-2 rounded-[4px] border text-[11.5px] font-sans font-medium transition-colors cursor-pointer text-center truncate ${
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
                      className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[11.5px] text-galla-ink placeholder:text-galla-ink-soft/60 focus:border-amber-700 focus:ring-1 focus:ring-amber-700 outline-none transition-all mt-1"
                    />
                  </div>
                </div>

                {/* Right: Quantity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                      Quantity to Deduct <span className="text-red-600">*</span>
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
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13.5px] text-galla-ink focus:border-amber-700 focus:ring-1 focus:ring-amber-700 outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 2, 5].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={q > maxAvailable}
                        onClick={() => setQuantity(String(q))}
                        className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          quantity === String(q)
                            ? "bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                            : "border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper"
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={maxAvailable <= 0}
                      onClick={() => setQuantity(String(maxAvailable))}
                      className="ml-auto px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      All ({maxAvailable})
                    </button>
                  </div>
                </div>
              </div>

              {isValidQty && (
                <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-[4px] text-[11.5px] font-sans text-amber-950">
                  <div className="flex items-center justify-between">
                    <span>Auto-logged internal expense:</span>
                    <span className="font-semibold tabular-nums text-amber-900 font-mono">
                      {formatRupee(estTotalCost)}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Valued at purchase cost ({formatRupee(estUnitCost)}/pc). Deducting {numQty} pcs will leave {product.use - numQty} pcs in salon use.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Supplier Return Form (Compact, Multi-Column Layout) */}
          {mode === "return_supplier" && (
            <div className="space-y-2.5">
              {/* Row 1: Deduct Return From & Supplier Settlement Mode side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block mb-1">
                    Deduct Return From
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierStockSource("defectiveStock");
                        setErrorMsg(null);
                      }}
                      className={`p-1.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                        supplierStockSource === "defectiveStock"
                          ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-900"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[11px] font-semibold flex items-center justify-between">
                        <span className="truncate">Defective</span>
                        {supplierStockSource === "defectiveStock" && <Check className="h-3 w-3 text-rose-600 shrink-0" />}
                      </div>
                      <div className="text-[10.5px] opacity-80 mt-0.5 font-mono">
                        {product.defectiveStock || 0} pcs
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSupplierStockSource("sellStock");
                        setErrorMsg(null);
                      }}
                      className={`p-1.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                        supplierStockSource === "sellStock"
                          ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-900"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[11px] font-semibold flex items-center justify-between">
                        <span className="truncate">Retail</span>
                        {supplierStockSource === "sellStock" && <Check className="h-3 w-3 text-rose-600 shrink-0" />}
                      </div>
                      <div className="text-[10.5px] opacity-80 mt-0.5 font-mono">
                        {product.sell} pcs
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSupplierStockSource("useStock");
                        setErrorMsg(null);
                      }}
                      className={`p-1.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                        supplierStockSource === "useStock"
                          ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-900"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[11px] font-semibold flex items-center justify-between">
                        <span className="truncate">Salon Use</span>
                        {supplierStockSource === "useStock" && <Check className="h-3 w-3 text-rose-600 shrink-0" />}
                      </div>
                      <div className="text-[10.5px] opacity-80 mt-0.5 font-mono">
                        {product.use} pcs
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block mb-1">
                    Supplier Settlement Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSupplierRefundMode("reduce_due")}
                      className={`p-2 rounded-[5px] border text-left transition-all cursor-pointer ${
                        supplierRefundMode === "reduce_due"
                          ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-900"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                        <span>Reduce Due</span>
                        {supplierRefundMode === "reduce_due" && <Check className="h-3.5 w-3.5 text-rose-600" />}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">Deduct from bill</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierRefundMode("replacement_pending")}
                      className={`p-2 rounded-[5px] border text-left transition-all cursor-pointer ${
                        supplierRefundMode === "replacement_pending"
                          ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-900"
                          : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft"
                      }`}
                    >
                      <div className="font-sans text-[12px] font-semibold flex items-center justify-between">
                        <span>Wait Replace</span>
                        {supplierRefundMode === "replacement_pending" && <Check className="h-3.5 w-3.5 text-rose-600" />}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">Stock later</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Original Supplier Bill Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                    Select Original Supplier Bill <span className="text-red-600">*</span>
                  </label>
                  <span className="font-sans text-[11px] text-galla-ink-soft">
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
                  <div className="p-3 border border-galla-line rounded-[5px] bg-galla-paper/30 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
                  </div>
                ) : pos.length === 0 ? (
                  <div className="p-2.5 border border-dashed border-galla-line rounded-[5px] text-[11.5px] font-sans text-galla-ink-soft text-center bg-galla-paper/20">
                    No supplier purchase bills found for &ldquo;{product.name}&rdquo;.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[105px] overflow-y-auto pr-1">
                    {pos.map((po) => {
                      const item = (po.items || []).find(
                        (i: any) =>
                          (product.id && (i.productId === String(product.id) || i.productId === product.id)) ||
                          (product.name && i.productName && i.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
                      );
                      if (!item) return null;
                      const maxRet = Math.max(
                        0,
                        (item.quantityForSell || 0) + (item.quantityForUse || 0) - (item.returnedQuantity || 0)
                      );
                      const isSelected = selectedPOId === po.id;
                      const isNoStockOnBill = maxRet <= 0;

                      return (
                        <button
                          key={po.id}
                          type="button"
                          disabled={isNoStockOnBill}
                          onClick={() => {
                            setSelectedPOId(po.id);
                            setErrorMsg(null);
                          }}
                          className={`w-full text-left p-1.5 px-2.5 rounded-[5px] border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-galla-ink"
                              : isNoStockOnBill
                              ? "border-galla-line/60 bg-galla-paper/50 opacity-50 cursor-not-allowed text-galla-ink-soft"
                              : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-sans font-semibold text-[12px] truncate">
                                {po.supplierName}
                              </span>
                              <span className="font-mono text-[10px] text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line/60">
                                {po.purchaseOrderNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-galla-ink-soft mt-0.5">
                              Cost: <strong className="font-mono text-galla-ink">{formatRupee(item.purchaseCost)}</strong> &bull; {new Date(po.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block font-sans text-[10.5px] font-medium px-2 py-0.5 rounded ${
                                maxRet > 0
                                  ? isSelected
                                    ? "bg-rose-100 text-rose-800 font-semibold"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-galla-paper text-galla-ink-soft"
                              }`}
                            >
                              Max: {maxRet} pcs
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Row 3: Quantity & Reason side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider">
                      Quantity to Return <span className="text-red-600">*</span>
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
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13.5px] text-galla-ink focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 2, 5].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={q > maxAvailable}
                        onClick={() => setQuantity(String(q))}
                        className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          quantity === String(q)
                            ? "bg-rose-50 text-rose-700 border-rose-300 font-semibold"
                            : "border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper"
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={maxAvailable <= 0}
                      onClick={() => setQuantity(String(maxAvailable))}
                      className="ml-auto px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] border border-galla-line bg-galla-paper/30 text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      All ({maxAvailable})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider block mb-1">
                    Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={consumeNotes}
                    onChange={(e) => setConsumeNotes(e.target.value)}
                    placeholder="e.g. damaged seal, defective pump, expired..."
                    className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all mt-0.5"
                  />
                </div>
              </div>

              {isValidQty && selectedPO && (
                <div className="p-2 bg-rose-50/80 border border-rose-200/80 rounded-[4px] text-[11.5px] font-sans text-rose-950">
                  <div className="flex items-center justify-between">
                    <span>Total Return Value:</span>
                    <span className="font-semibold tabular-nums text-rose-900 font-mono">
                      {formatRupee(estReturnCost)}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800/80 mt-0.5">
                    {supplierRefundMode === "reduce_due"
                      ? `Will deduct ${numQty} pcs from ${supplierStockSource === "defectiveStock" ? "defective pieces" : supplierStockSource === "sellStock" ? "retail shelf" : "salon use"} and reduce ${formatRupee(estReturnCost)} from ${selectedPO.supplierName}'s pending dues.`
                      : `Will deduct ${numQty} pcs from ${supplierStockSource === "defectiveStock" ? "defective pieces" : supplierStockSource === "sellStock" ? "retail shelf" : "salon use"}. Supplier will provide replacement stock later.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer - Fixed bottom */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-2.5 border-t border-galla-line bg-galla-paper/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-[5px] border border-galla-line font-sans text-[12.5px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={
              isSubmitting ||
              !isValidQty ||
              maxAvailable <= 0 ||
              (mode === "return_supplier" && !selectedPOId)
            }
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[5px] text-white font-sans text-[12.5px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "consume"
                ? "bg-amber-800 hover:bg-amber-900"
                : mode === "return_supplier"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-galla-teal hover:opacity-95"
            }`}
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {isSubmitting
                ? "Processing..."
                : mode === "consume"
                ? `Deduct ${numQty || 1} pcs`
                : mode === "return_supplier"
                ? `Return ${numQty || 1} pcs to Supplier`
                : direction === "sell_to_use"
                ? `Move ${numQty || 1} pcs to Use`
                : `Move ${numQty || 1} pcs to Retail`}
            </span>
          </button>
        </div>

        <ConfirmModal
          isOpen={showConfirm}
          title={
            mode === "consume"
              ? "Confirm Stock Deduction"
              : mode === "return_supplier"
              ? "Confirm Supplier Return"
              : "Confirm Stock Move"
          }
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
              ) : mode === "return_supplier" ? (
                <>
                  Are you sure you want to return{" "}
                  <strong className="font-semibold text-galla-ink">{numQty} pcs</strong> of{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> to{" "}
                  <strong className="font-semibold text-galla-ink">{selectedPO?.supplierName || "supplier"}</strong>?
                  <span className="block mt-1 text-[12px] text-galla-ink-soft">
                    Deducted from: <strong>{supplierStockSource === "defectiveStock" ? "Defective Pieces" : supplierStockSource === "sellStock" ? "Retail Shelf" : "Salon Use"}</strong> &bull; Total Value: <strong className="font-mono text-galla-ink">{formatRupee(estReturnCost)}</strong>
                  </span>
                  <span className="block mt-1 text-[12px] text-rose-800 font-medium">
                    Settlement: {supplierRefundMode === "reduce_due" ? "Deducts from supplier pending due balance" : "Wait for replacement stock from supplier"}
                  </span>
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
          confirmLabel={
            mode === "consume"
              ? "Yes, Deduct Stock"
              : mode === "return_supplier"
              ? "Yes, Return to Supplier"
              : "Yes, Move Stock"
          }
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeAction}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
