"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  PackageMinus,
  Check,
  Undo2
} from "lucide-react";
import { DashboardProduct, DashboardExpense, DashboardPurchaseOrder } from "@/types/dashboard";
import { transferStockAction, consumeUseStockAction, returnInventoryToSupplierAction, getPurchaseOrdersForProductAction } from "@/app/dashboard/actions";
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
  const [supplierStockSource, setSupplierStockSource] = useState<"sellStock" | "useStock">("sellStock");
  const [supplierRefundMode, setSupplierRefundMode] = useState<"reduce_due" | "replacement_pending">("reduce_due");
  const [pos, setPos] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "return_supplier") {
      setIsLoadingPOs(true);
      getPurchaseOrdersForProductAction(product.id.toString(), product.name).then(res => {
        if (res.success && res.pos) setPos(res.pos as any);
        setIsLoadingPOs(false);
      });
    }
  }, [mode, product.id, product.name]);

  const numQty = Number(quantity);

  const maxAvailable =
    mode === "consume"
      ? product.use
      : mode === "return_supplier"
      ? (supplierStockSource === "sellStock" ? product.sell : product.use)
      : direction === "sell_to_use"
      ? product.sell
      : product.use;

  const isValidQty =
    !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= maxAvailable;

  const estUnitCost = product.purchaseCost || 0;
  const estTotalCost = isValidQty ? numQty * estUnitCost : 0;
  const unitProfit = Math.max(0, product.price - estUnitCost);
  const marginPct = product.price > 0 ? Math.round((unitProfit / product.price) * 100) : 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (maxAvailable <= 0) {
      setErrorMsg("No stock available for this operation.");
      return;
    }

    if (!isValidQty) {
      setErrorMsg(`Please enter a valid whole quantity between 1 and ${maxAvailable}`);
      return;
    }

    if (mode === "return_supplier") {
      if (!selectedPOId) {
        setErrorMsg("Please select a Purchase Order to return the item to.");
        return;
      }
      const selectedPO = pos.find(p => p.id === selectedPOId);
      const availableInPO = selectedPO 
        ? (selectedPO.items || []).find(i => 
            (product.id && i.productId === product.id) || 
            (product.name && i.productName && i.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
          )
        : null;
      const maxReturnForSelectedPO = availableInPO 
        ? (availableInPO.quantityForSell + availableInPO.quantityForUse) - (availableInPO.returnedQuantity || 0)
        : 0;
      if (numQty > maxReturnForSelectedPO) {
        setErrorMsg(`You can only return up to ${maxReturnForSelectedPO} items to this specific Purchase Order.`);
        return;
      }
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
      } else if (mode === "return_supplier") {
        const res = await returnInventoryToSupplierAction(
          String(product.id),
          selectedPOId!,
          numQty,
          supplierStockSource,
          supplierRefundMode,
          consumeNotes.trim() || undefined
        );

        if (res.success) {
          // Fake a product update since action doesn't return it
          const updated = { ...product };
          if (supplierStockSource === "sellStock") updated.sell -= numQty;
          else updated.use -= numQty;
          onTransferSuccess(updated);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to return to supplier");
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
      <div className="w-full max-w-[480px] bg-galla-surface border border-galla-line rounded-[5px] p-[20px] shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-galla-line mb-3">
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
              <h3 className="font-heading font-semibold text-[16.5px] text-galla-ink">
                {mode === "consume" ? "Log Used / Consumed Stock" : mode === "return_supplier" ? "Return to Supplier" : "Transfer Stock"}
              </h3>
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
        <div className="grid grid-cols-3 p-1 bg-galla-paper/60 rounded-[5px] border border-galla-line mb-3">
          <button
            type="button"
            onClick={() => { setMode("transfer"); setErrorMsg(null); }}
            className={`py-1.5 px-2 rounded-[4px] text-[11.5px] font-sans font-medium transition-all flex justify-center gap-1.5 ${mode === "transfer" ? "bg-galla-surface text-galla-teal shadow-xs font-semibold" : "text-galla-ink-soft hover:text-galla-ink"}`}
          >
            <span>Transfer</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("consume"); setErrorMsg(null); }}
            className={`py-1.5 px-2 rounded-[4px] text-[11.5px] font-sans font-medium transition-all flex justify-center gap-1.5 ${mode === "consume" ? "bg-galla-surface text-amber-800 shadow-xs font-semibold" : "text-galla-ink-soft hover:text-galla-ink"}`}
          >
            <span>Deduct</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("return_supplier"); setErrorMsg(null); }}
            className={`py-1.5 px-2 rounded-[4px] text-[11.5px] font-sans font-medium transition-all flex justify-center gap-1.5 ${mode === "return_supplier" ? "bg-galla-surface text-rose-700 shadow-xs font-semibold" : "text-galla-ink-soft hover:text-galla-ink"}`}
          >
            <span>Return</span>
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
                +{formatRupee(unitProfit)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px] font-sans">
              <div className="p-1.5 rounded bg-galla-surface border border-galla-line">
                <span className="text-galla-ink-soft block text-[11px]">Retail Shelf (Sell):</span>
                <span className="font-heading font-semibold text-[13px] text-galla-ink">{product.sell} pcs</span>
              </div>
              <div className="p-1.5 rounded bg-galla-surface border border-galla-line">
                <span className="text-galla-ink-soft block text-[11px]">Salon Internal (Use):</span>
                <span className="font-heading font-semibold text-[13px] text-galla-teal">{product.use} pcs</span>
              </div>
            </div>
          </div>

          {/* Supplier Return Options */}
          {mode === "return_supplier" && (
            <div className="space-y-3.5">
              <div>
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Deduct Return From
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSupplierStockSource("sellStock")} className={`p-2 rounded border text-sm transition-all ${supplierStockSource === "sellStock" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"}`}>Retail Shelf</button>
                  <button type="button" onClick={() => setSupplierStockSource("useStock")} className={`p-2 rounded border text-sm transition-all ${supplierStockSource === "useStock" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"}`}>Salon Use</button>
                </div>
              </div>
              <div>
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Select Original Supplier Bill
                </label>
                {isLoadingPOs ? (
                  <div className="flex items-center justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-rose-500" /></div>
                ) : pos.length === 0 ? (
                  <div className="p-3 border border-dashed rounded text-sm text-galla-ink-soft text-center">No bills found for this product.</div>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {pos.map(po => {
                      const item = (po.items || []).find(i => 
                        (product.id && i.productId === product.id) || 
                        (product.name && i.productName && i.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
                      );
                      if (!item) return null;
                      const maxRet = (item.quantityForSell + item.quantityForUse) - (item.returnedQuantity || 0);
                      const isDisabled = maxRet < numQty;
                      return (
                        <button key={po.id} type="button" onClick={() => { if (!isDisabled) setSelectedPOId(po.id); }} disabled={isDisabled} className={`w-full text-left p-2 rounded border transition-all flex justify-between items-center ${selectedPOId === po.id ? "bg-rose-50 border-rose-300" : isDisabled ? "bg-galla-paper opacity-50" : "hover:border-rose-200"}`}>
                          <div>
                            <div className="text-sm font-semibold">{po.supplierName}</div>
                            <div className="text-xs text-galla-ink-soft font-mono mt-0.5">{po.purchaseOrderNumber} &bull; {new Date(po.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono">{formatRupee(item.purchaseCost)}</div>
                            <div className={`text-[10px] ${maxRet < numQty ? "text-rose-500" : "text-emerald-600"}`}>Max: {maxRet}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Supplier Credit Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSupplierRefundMode("reduce_due")} className={`p-2 rounded border text-sm transition-all ${supplierRefundMode === "reduce_due" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"}`}>Reduce Due</button>
                  <button type="button" onClick={() => setSupplierRefundMode("replacement_pending")} className={`p-2 rounded border text-sm transition-all ${supplierRefundMode === "replacement_pending" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"}`}>Wait for Replacement</button>
                </div>
              </div>
            </div>
          )}

          {/* ... existing fields for mode transfer/consume */}
          {mode === "transfer" && (
            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Transfer Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setDirection("sell_to_use"); setErrorMsg(null); }} className={`p-2.5 rounded-[5px] border text-left transition-all ${direction === "sell_to_use" ? "border-galla-teal bg-galla-teal-soft/60 text-galla-teal" : "border-galla-line"}`}>Retail &rarr; Salon Use</button>
                <button type="button" onClick={() => { setDirection("use_to_sell"); setErrorMsg(null); }} className={`p-2.5 rounded-[5px] border text-left transition-all ${direction === "use_to_sell" ? "border-galla-teal bg-galla-teal-soft/60 text-galla-teal" : "border-galla-line"}`}>Salon Use &rarr; Retail</button>
              </div>
            </div>
          )}
          {mode === "consume" && (
            <div className="grid grid-cols-2 gap-1.5">
              {[{ id: "service", label: "Used in Service" }, { id: "finished", label: "Finished" }, { id: "damaged", label: "Damaged" }, { id: "other", label: "Other" }].map((r) => (
                <button key={r.id} type="button" onClick={() => setConsumeReason(r.id as ConsumeReason)} className={`py-1.5 px-2.5 rounded-[4px] border text-[11.5px] ${consumeReason === r.id ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-galla-surface text-galla-ink-soft"}`}>{r.label}</button>
              ))}
            </div>
          )}

          {(mode === "consume" || mode === "return_supplier") && (
            <input type="text" value={consumeNotes} onChange={(e) => setConsumeNotes(e.target.value)} placeholder="Reason / notes..." className="w-full px-3 py-1.5 rounded-[4px] border text-[12px] focus:ring-1 outline-none transition-all" />
          )}

          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">Quantity <span className="text-red-600">*</span></label>
            <input type="number" min="1" max={Math.max(1, maxAvailable)} required value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2 rounded-[5px] border text-[14px] outline-none" />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-[5px] border text-[13px]">Cancel</button>
            <button type="submit" disabled={isSubmitting || !isValidQty || maxAvailable <= 0} className={`px-4 py-2 rounded-[5px] text-white text-[13px] font-medium ${mode === "consume" ? "bg-amber-800" : mode === "return_supplier" ? "bg-rose-600" : "bg-galla-teal"}`}>
              {isSubmitting ? "Processing..." : "Confirm"}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Action"
          description={<span>Are you sure you want to proceed with {numQty} pcs?</span>}
          confirmLabel="Yes, Proceed"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeAction}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
