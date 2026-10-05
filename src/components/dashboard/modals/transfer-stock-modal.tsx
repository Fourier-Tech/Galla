"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  PackageMinus,
  Check,
  CheckCircle2,
  Undo2,
  ArrowRight,
  Minus,
  Plus,
  RotateCcw,
  RefreshCw,
  Receipt,
  ArrowLeft,
} from "lucide-react";
import { DashboardProduct, DashboardExpense, DashboardSupplier, DashboardPurchaseOrder } from "@/types/dashboard";
import {
  transferStockAction,
  consumeUseStockAction,
  returnInventoryToSupplierAction,
  getPurchaseOrdersForProductAction,
} from "@/app/dashboard/actions";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";
import { PaymentModeSelect } from "@/components/dashboard/payment-mode-select";
import { ConfirmModal } from "./confirm-modal";

interface TransferStockModalProps {
  product: DashboardProduct | null;
  allProducts?: DashboardProduct[];
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess: (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number,
    updatedPO?: DashboardPurchaseOrder
  ) => void;
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
  onTransferSuccess: (
    updatedProduct: DashboardProduct,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier,
    refundAmount?: number,
    updatedPO?: DashboardPurchaseOrder
  ) => void;
}) {
  const [mode, setMode] = useState<ModalMode>("transfer");
  const [direction, setDirection] = useState<TransferDirection>(
    product.sell > 0 ? "sell_to_use" : product.use > 0 ? "use_to_sell" : "sell_to_use"
  );
  const [quantity, setQuantity] = useState("1");
  const [consumeReason, setConsumeReason] = useState<ConsumeReason>("service");
  const [consumeNotes, setConsumeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Supplier Return State
  const [supplierResolution, setSupplierResolution] = useState<"return" | "replacement">("return");
  const [deductFromDue, setDeductFromDue] = useState<boolean>(true);
  const [supplierPaymentMode, setSupplierPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer" | "credit">("cash");
  const [pos, setPos] = useState<any[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  // Per-location breakdown for supplier return
  const [retSellInput, setRetSellInput] = useState<string>("0");
  const [retUseInput, setRetUseInput] = useState<string>("0");
  const [retDefInput, setRetDefInput] = useState<string>("0");

  const parsedReturnSell = Math.max(0, parseInt(retSellInput || "0", 10) || 0);
  const parsedReturnUse = Math.max(0, parseInt(retUseInput || "0", 10) || 0);
  const parsedReturnDef = Math.max(0, parseInt(retDefInput || "0", 10) || 0);
  const totalReturnSupplierQty = parsedReturnSell + parsedReturnUse + parsedReturnDef;

  useEffect(() => {
    if (mode === "return_supplier") {
      setIsLoadingPOs(true);
      getPurchaseOrdersForProductAction(String(product.id), product.name).then((res) => {
        if (res.success && res.pos) {
          setPos(res.pos);
          if (res.pos.length > 0) {
            setSelectedPOId((prev) => prev || res.pos[0].id);
          } else {
            setSelectedPOId("no_bill");
          }
        } else {
          setSelectedPOId("no_bill");
        }
        setIsLoadingPOs(false);
      });

      // Default initial allocation if empty
      if (parsedReturnSell === 0 && parsedReturnUse === 0 && parsedReturnDef === 0) {
        if ((product.defectiveStock || 0) > 0) {
          setRetDefInput("1");
        } else if (product.sell > 0) {
          setRetSellInput("1");
        } else if (product.use > 0) {
          setRetUseInput("1");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, product.id, product.name]);

  const numQty = Number(quantity);

  const isNoBill = selectedPOId === "no_bill";
  const selectedPO = isNoBill ? null : pos.find((p) => p.id === selectedPOId);
  const selectedItem = selectedPO?.items?.find(
    (i: any) =>
      (product.id && (i.productId === String(product.id) || i.productId === product.id)) ||
      (product.name && i.productName && i.productName.trim().toLowerCase() === product.name.trim().toLowerCase())
  );
  const maxReturnableFromBill = isNoBill
    ? 999999
    : selectedItem
      ? Math.max(0, (selectedItem.quantityForSell || 0) + (selectedItem.quantityForUse || 0) - ((selectedItem.returnedQuantity || 0) + (selectedItem.replacedQuantity || 0)))
      : 0;

  const totalPhysicalStock = product.sell + product.use + (product.defectiveStock || 0);
  const maxAutoAll = selectedPOId && !isNoBill && maxReturnableFromBill > 0
    ? Math.min(totalPhysicalStock, maxReturnableFromBill)
    : totalPhysicalStock;

  const handleReturnAllStock = () => {
    let rem = maxAutoAll;
    const defAlloc = Math.min(product.defectiveStock || 0, rem);
    rem -= defAlloc;
    const sellAlloc = Math.min(product.sell, rem);
    rem -= sellAlloc;
    const useAlloc = Math.min(product.use, rem);

    setRetDefInput(String(defAlloc));
    setRetSellInput(String(sellAlloc));
    setRetUseInput(String(useAlloc));
    setErrorMsg(null);
  };

  const handleClearReturnBreakdown = () => {
    setRetDefInput("0");
    setRetSellInput("0");
    setRetUseInput("0");
    setErrorMsg(null);
  };

  const physicalStockAvailable =
    mode === "consume"
      ? product.use
      : direction === "sell_to_use"
        ? product.sell
        : product.use;

  const maxAvailable = physicalStockAvailable;

  const isValidQty =
    mode === "return_supplier"
      ? totalReturnSupplierQty > 0 &&
      parsedReturnSell <= product.sell &&
      parsedReturnUse <= product.use &&
      parsedReturnDef <= (product.defectiveStock || 0) &&
      (!selectedPOId || maxReturnableFromBill <= 0 || totalReturnSupplierQty <= maxReturnableFromBill)
      : !isNaN(numQty) && Number.isInteger(numQty) && numQty > 0 && numQty <= maxAvailable;

  const estUnitCost =
    product.purchaseCost !== undefined && product.purchaseCost !== null
      ? product.purchaseCost
      : 0;
  const returnUnitCost = selectedItem?.purchaseCost !== undefined ? selectedItem.purchaseCost : estUnitCost;
  const estTotalCost = isValidQty ? numQty * estUnitCost : 0;
  const estReturnCost =
    mode === "return_supplier"
      ? totalReturnSupplierQty * returnUnitCost
      : isValidQty
        ? numQty * returnUnitCost
        : 0;

  // Return to Supplier settlement breakdown calculations
  const pendingDue = Math.max(0, selectedPO?.amountPending || 0);
  const hasDue = Boolean(selectedPO && pendingDue > 0);
  const effectiveDeductFromDue = hasDue && deductFromDue;
  const dueDeduction = effectiveDeductFromDue ? Math.min(pendingDue, estReturnCost) : 0;
  const cashRefund = isNoBill ? 0 : Math.max(0, estReturnCost - dueDeduction);
  const remainingDueAfterReturn = hasDue ? Math.max(0, pendingDue - dueDeduction) : 0;

  // Auto-adjust default due deduction when switching selected purchase bill
  useEffect(() => {
    if (selectedPO) {
      if ((selectedPO.amountPending || 0) > 0) {
        setDeductFromDue(true);
      } else {
        setDeductFromDue(false);
      }
    }
  }, [selectedPOId, selectedPO?.amountPending]);

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
      if (totalReturnSupplierQty <= 0) {
        setErrorMsg("Please specify at least 1 unit to return from Retail, Salon Use, or Defective stock");
        return;
      }
      if (parsedReturnSell > product.sell) {
        setErrorMsg(`Retail quantity (${parsedReturnSell} pcs) exceeds available shelf stock (${product.sell} pcs)`);
        return;
      }
      if (parsedReturnUse > product.use) {
        setErrorMsg(`Salon use quantity (${parsedReturnUse} pcs) exceeds available internal stock (${product.use} pcs)`);
        return;
      }
      if (parsedReturnDef > (product.defectiveStock || 0)) {
        setErrorMsg(`Defective quantity (${parsedReturnDef} pcs) exceeds available defective stock (${product.defectiveStock || 0} pcs)`);
        return;
      }
      if (!isNoBill && maxReturnableFromBill > 0 && totalReturnSupplierQty > maxReturnableFromBill) {
        setErrorMsg(`Total return quantity (${totalReturnSupplierQty} pcs) exceeds remaining quantity on this bill (${maxReturnableFromBill} pcs)`);
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
    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (mode === "return_supplier") {
        if (!selectedPOId) {
          setErrorMsg("Please select a purchase bill");
          return;
        }

        const effectiveStockSource =
          parsedReturnSell > 0 && parsedReturnUse === 0 && parsedReturnDef === 0
            ? "sellStock"
            : parsedReturnUse > 0 && parsedReturnSell === 0 && parsedReturnDef === 0
              ? "useStock"
              : parsedReturnDef > 0 && parsedReturnSell === 0 && parsedReturnUse === 0
                ? "defectiveStock"
                : "mixed";

        const isReplacement = supplierResolution === "replacement";

        const res = await returnInventoryToSupplierAction(
          String(product.id),
          selectedPOId,
          totalReturnSupplierQty,
          effectiveStockSource,
          isReplacement ? "replacement_pending" : "reduce_due",
          consumeNotes.trim() || undefined,
          {
            sellStock: parsedReturnSell,
            useStock: parsedReturnUse,
            defectiveStock: parsedReturnDef,
          },
          {
            resolution: supplierResolution,
            deductFromDue: effectiveDeductFromDue,
            paymentMode: supplierPaymentMode,
          }
        );

        if (res.success) {
          const updated: DashboardProduct = {
            ...product,
            sell: Math.max(0, product.sell - parsedReturnSell),
            use: Math.max(0, product.use - parsedReturnUse),
            defectiveStock: Math.max(
              0,
              (product.defectiveStock || 0) -
              parsedReturnDef +
              (isReplacement
                ? parsedReturnSell + parsedReturnUse
                : 0)
            ),
          };
          onTransferSuccess(
            updated,
            undefined,
            res.updatedSupplier,
            res.refundAmount ?? (cashRefund > 0 ? cashRefund : undefined),
            res.updatedPO
          );
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
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Transfer Stock"
      className="fixed inset-0 z-50 bg-galla-paper flex flex-col overflow-y-auto"
    >
      {/* Top Header (Sticky) */}
      <header className="sticky top-0 z-30 bg-galla-surface border-b border-galla-line px-5 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Back to inventory"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-[5px] border ${mode === "consume"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : mode === "return_supplier"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : "bg-galla-teal-soft text-galla-teal border-galla-teal/30"
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
              <h1 className="text-[16px] font-bold text-galla-ink leading-tight">
                {mode === "consume"
                  ? "Log Used / Consumed Stock"
                  : mode === "return_supplier"
                    ? "Return Product to Supplier"
                    : "Transfer Stock"}
              </h1>
              <p className="text-[11.5px] text-galla-ink-soft hidden sm:block">
                {mode === "consume"
                  ? "Deduct opened or consumed items from salon internal stock and auto-log expense"
                  : mode === "return_supplier"
                    ? "Return defective or excess stock against original purchase bill"
                    : "Move units between retail shelf and salon treatment stations seamlessly"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[6px] flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-800 p-0.5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Workbench Layout */}
      <form
        onSubmit={handleFormSubmit}
        className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start flex-1"
      >
        {/* ====================================================== */}
        {/* LEFT COLUMN: MODE SELECTOR & CONFIGURATION FORMS       */}
        {/* ====================================================== */}
        <main className="space-y-6 min-w-0 order-1">
          {/* Card 1: Operation Mode Tabs */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-galla-ink uppercase tracking-wider">
                1. Select Operation Mode
              </h2>
              <span className="text-[11.5px] text-galla-ink-soft">
                Choose stock workflow
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("transfer");
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${mode === "transfer"
                  ? "bg-galla-teal-soft/40 border-galla-teal text-galla-teal shadow-xs ring-1 ring-galla-teal/30"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:bg-galla-paper hover:text-galla-ink"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-[5px] ${mode === "transfer" ? "bg-galla-teal text-white" : "bg-galla-paper text-galla-ink-soft"}`}>
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  {mode === "transfer" && <Check className="h-4 w-4 text-galla-teal" />}
                </div>
                <div>
                  <div className="font-sans text-[13.5px] font-bold text-galla-ink">Transfer Stock</div>
                  <div className="text-[11.5px] text-galla-ink-soft mt-0.5">Move between retail shelf &amp; salon stations</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("consume");
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${mode === "consume"
                  ? "bg-amber-50 border-amber-400 text-amber-900 shadow-xs ring-1 ring-amber-300"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:bg-galla-paper hover:text-galla-ink"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-[5px] ${mode === "consume" ? "bg-amber-600 text-white" : "bg-galla-paper text-galla-ink-soft"}`}>
                    <PackageMinus className="h-4 w-4" />
                  </div>
                  {mode === "consume" && <Check className="h-4 w-4 text-amber-700" />}
                </div>
                <div>
                  <div className="font-sans text-[13.5px] font-bold text-galla-ink">Deduct Use Stock</div>
                  <div className="text-[11.5px] text-galla-ink-soft mt-0.5">Log internal consumption &amp; auto-expense</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("return_supplier");
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${mode === "return_supplier"
                  ? "bg-rose-50 border-rose-400 text-rose-900 shadow-xs ring-1 ring-rose-300"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:bg-galla-paper hover:text-galla-ink"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-[5px] ${mode === "return_supplier" ? "bg-rose-600 text-white" : "bg-galla-paper text-galla-ink-soft"}`}>
                    <Undo2 className="h-4 w-4" />
                  </div>
                  {mode === "return_supplier" && <Check className="h-4 w-4 text-rose-700" />}
                </div>
                <div>
                  <div className="font-sans text-[13.5px] font-bold text-galla-ink">Return to Supplier</div>
                  <div className="text-[11.5px] text-galla-ink-soft mt-0.5">Deduct dues, credit note, or replacement</div>
                </div>
              </button>
            </div>
          </section>

          {/* Card 2: Mode Parameters Form */}
          {mode === "transfer" && (
            <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-galla-ink uppercase tracking-wider">
                  2. Transfer Parameters
                </h2>
                <span className="text-xs text-galla-ink-soft">
                  Max available: <strong className="text-galla-ink">{maxAvailable} pcs</strong>
                </span>
              </div>

              {/* Direction selector */}
              <div>
                <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider mb-2">
                  Select Direction
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("sell_to_use");
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${direction === "sell_to_use"
                      ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal shadow-xs"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="font-sans text-[13.5px] font-bold text-galla-ink flex items-center gap-2">
                        <span>Retail Shelf</span>
                        <ArrowRight className="h-4 w-4 text-galla-teal" />
                        <span>Salon Use</span>
                      </div>
                      <div className="text-xs text-galla-ink-soft">
                        Transfer sellable stock to service treatment stations
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-[4px] bg-galla-paper border border-galla-line tabular-nums text-galla-ink">
                        Avail: {product.sell}
                      </span>
                      {direction === "sell_to_use" && (
                        <div className="mt-1 flex justify-end">
                          <span className="p-0.5 rounded-full bg-galla-teal text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDirection("use_to_sell");
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${direction === "use_to_sell"
                      ? "border-galla-teal bg-galla-teal-soft/60 ring-1 ring-galla-teal text-galla-teal shadow-xs"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="font-sans text-[13.5px] font-bold text-galla-ink flex items-center gap-2">
                        <span>Salon Use</span>
                        <ArrowRight className="h-4 w-4 text-galla-teal" />
                        <span>Retail Shelf</span>
                      </div>
                      <div className="text-xs text-galla-ink-soft">
                        Return excess internal items back to customer shelf
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-[4px] bg-galla-paper border border-galla-line tabular-nums text-galla-ink">
                        Avail: {product.use}
                      </span>
                      {direction === "use_to_sell" && (
                        <div className="mt-1 flex justify-end">
                          <span className="p-0.5 rounded-full bg-galla-teal text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Quantity input & Steppers */}
              <div className="space-y-3 pt-3 border-t border-galla-line/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider">
                    Quantity to Move <span className="text-red-600">*</span>
                  </label>
                  <span className="font-sans text-xs text-galla-ink-soft">
                    Available in source: <strong className="text-galla-ink font-semibold">{maxAvailable} pcs</strong>
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="number"
                    autoFocus
                    min="1"
                    max={Math.max(1, maxAvailable)}
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-[5px] bg-galla-surface border border-galla-line font-sans tabular-nums text-[14px] font-medium text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
                  />
                  <span className="absolute right-4 font-sans text-xs font-semibold text-galla-ink-soft pointer-events-none">
                    Units / Pcs
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {[1, 2, 5, 10].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={q > maxAvailable}
                      onClick={() => setQuantity(String(q))}
                      className={`px-3 py-1.5 text-xs font-sans font-medium rounded-[5px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${quantity === String(q)
                        ? "bg-galla-teal-soft text-galla-teal border-galla-teal/30 font-semibold"
                        : "border-galla-line bg-galla-paper/40 text-galla-ink-soft hover:bg-galla-paper hover:text-galla-ink"
                        }`}
                    >
                      +{q}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={maxAvailable <= 0}
                    onClick={() => setQuantity(String(maxAvailable))}
                    className="ml-auto px-3.5 py-1.5 text-xs font-sans font-semibold rounded-[5px] border border-galla-line bg-galla-paper/40 text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    All ({maxAvailable} pcs)
                  </button>
                </div>

                {/* Live Stock Balance Flow Preview */}
                <div className="p-4 rounded-[6px] border border-galla-line bg-galla-paper/40 space-y-2.5 mt-3">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wider text-galla-ink-soft flex items-center justify-between">
                    <span>Live Stock Balance Preview</span>
                    <span className="text-[11px] font-normal lowercase">calculated instantly</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans pt-1">
                    <div className="p-3 rounded-[5px] bg-galla-surface border border-galla-line/70">
                      <div className="text-galla-ink-soft text-xs font-medium">Retail Shelf Stock</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-semibold text-galla-ink tabular-nums">{product.sell}</span>
                        <ArrowRight className="h-4 w-4 text-galla-ink-soft shrink-0" />
                        <span className={`text-base font-bold tabular-nums ${direction === "sell_to_use" ? "text-amber-800" : "text-emerald-700"}`}>
                          {isValidQty ? (direction === "sell_to_use" ? product.sell - numQty : product.sell + numQty) : product.sell} pcs
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-[5px] bg-galla-surface border border-galla-line/70">
                      <div className="text-galla-ink-soft text-xs font-medium">Salon Internal Use Stock</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-semibold text-galla-ink tabular-nums">{product.use}</span>
                        <ArrowRight className="h-4 w-4 text-galla-ink-soft shrink-0" />
                        <span className={`text-base font-bold tabular-nums ${direction === "sell_to_use" ? "text-emerald-700" : "text-amber-800"}`}>
                          {isValidQty ? (direction === "sell_to_use" ? product.use + numQty : product.use - numQty) : product.use} pcs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {mode === "consume" && (
            <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-galla-ink uppercase tracking-wider">
                  2. Consumption Details
                </h2>
                <span className="text-xs text-galla-ink-soft">
                  Available in Salon: <strong className="text-galla-ink">{product.use} pcs</strong>
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider mb-2">
                  Reason for Deduction
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "service", label: "Used in Service", desc: "Standard salon treatment application" },
                    { id: "finished", label: "Empty / Finished", desc: "Bottle, jar, or container disposed" },
                    { id: "damaged", label: "Damaged / Spilled", desc: "Broken packaging, leak, or expired batch" },
                    { id: "other", label: "Other Reason", desc: "Internal salon operational use" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setConsumeReason(r.id as ConsumeReason)}
                      className={`p-3 rounded-[5px] border text-left transition-all cursor-pointer ${consumeReason === r.id
                        ? "bg-amber-100/80 text-amber-950 border-amber-300 ring-1 ring-amber-300 shadow-xs"
                        : "bg-galla-surface text-galla-ink-soft border-galla-line hover:bg-galla-paper hover:text-galla-ink"
                        }`}
                    >
                      <div className="font-sans text-[13px] font-bold text-galla-ink">
                        {r.label}
                      </div>
                      <div className="text-[11.5px] text-galla-ink-soft mt-0.5 leading-snug">
                        {r.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider mb-1.5">
                  Consumption Notes (Optional)
                </label>
                <input
                  type="text"
                  value={consumeNotes}
                  onChange={(e) => setConsumeNotes(e.target.value)}
                  placeholder="e.g., hair spa station 2, opened for today's client treatment..."
                  className="w-full px-3.5 py-2 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:border-amber-700 focus:ring-1 focus:ring-amber-700 outline-none transition-all"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-3 pt-3 border-t border-galla-line/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider">
                    Quantity to Deduct <span className="text-red-600">*</span>
                  </label>
                  <span className="font-sans text-xs text-galla-ink-soft">
                    Available in Salon: <strong className="text-galla-ink font-semibold">{maxAvailable} pcs</strong>
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
                    className="w-full px-4 py-2.5 rounded-[5px] bg-galla-surface border border-galla-line font-sans tabular-nums text-[14px] font-medium text-galla-ink focus:border-amber-700 focus:ring-1 focus:ring-amber-700 outline-none transition-all"
                  />
                  <span className="absolute right-4 font-sans text-xs font-semibold text-galla-ink-soft pointer-events-none">
                    Units / Pcs
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {[1, 2, 5].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={q > maxAvailable}
                      onClick={() => setQuantity(String(q))}
                      className={`px-3 py-1.5 text-xs font-sans font-medium rounded-[5px] border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${quantity === String(q)
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                        : "border-galla-line bg-galla-paper/40 text-galla-ink-soft hover:bg-galla-paper hover:text-galla-ink"
                        }`}
                    >
                      +{q}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={maxAvailable <= 0}
                    onClick={() => setQuantity(String(maxAvailable))}
                    className="ml-auto px-3.5 py-1.5 text-xs font-sans font-semibold rounded-[5px] border border-galla-line bg-galla-paper/40 text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    All ({maxAvailable} pcs)
                  </button>
                </div>

                {isValidQty && (
                  <div className="p-4 rounded-[6px] border border-amber-200 bg-amber-50/80 space-y-2 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-950 text-sm">
                        Auto-logged Internal Expense:
                      </span>
                      <span className="text-base font-bold tabular-nums text-amber-950">
                        {formatRupee(estTotalCost)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-amber-900/90 border-t border-amber-200/60 pt-2">
                      <span>Valued at purchase cost ({formatRupee(estUnitCost)}/pc)</span>
                      <span className="font-medium">Remaining in salon: {product.use - numQty} pcs</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {mode === "return_supplier" && (
            <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-galla-ink uppercase tracking-wider">
                  2. Supplier Return Parameters
                </h2>
                <span className="text-xs text-galla-ink-soft">
                  Total inventory: <strong className="text-galla-ink">{totalPhysicalStock} pcs</strong>
                </span>
              </div>

              {/* Settlement Mode Cards */}
              <div>
                <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider mb-2">
                  Settlement Resolution
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierResolution("return");
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex items-start gap-3 ${supplierResolution === "return"
                      ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-950 shadow-xs"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    <div className={`p-2 rounded-[5px] mt-0.5 ${supplierResolution === "return" ? "bg-rose-100 text-rose-700" : "bg-galla-paper text-galla-ink-soft"}`}>
                      <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-[13.5px] font-bold text-galla-ink flex items-center justify-between">
                        <span>Return Product</span>
                        {supplierResolution === "return" && <Check className="h-4 w-4 text-rose-600" />}
                      </div>
                      <div className="text-xs text-galla-ink-soft mt-1 leading-snug">
                        Return units for bill refund, due deduction, or cash payout
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSupplierResolution("replacement");
                      setErrorMsg(null);
                    }}
                    className={`p-3.5 rounded-[6px] border text-left transition-all cursor-pointer flex items-start gap-3 ${supplierResolution === "replacement"
                      ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500 text-rose-950 shadow-xs"
                      : "border-galla-line bg-galla-surface hover:bg-galla-paper text-galla-ink-soft hover:text-galla-ink"
                      }`}
                  >
                    <div className={`p-2 rounded-[5px] mt-0.5 ${supplierResolution === "replacement" ? "bg-rose-100 text-rose-700" : "bg-galla-paper text-galla-ink-soft"}`}>
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-[13.5px] font-bold text-galla-ink flex items-center justify-between">
                        <span>Replace Product</span>
                        {supplierResolution === "replacement" && <Check className="h-4 w-4 text-rose-600" />}
                      </div>
                      <div className="text-xs text-galla-ink-soft mt-1 leading-snug">
                        Removes defective units from stock and queues pending exchange from dealer
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bill selector */}
              <div className="space-y-2 pt-3 border-t border-galla-line/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider">
                    Link to Original Purchase Bill <span className="text-red-600">*</span>
                  </label>
                  <span className="font-sans text-xs text-galla-ink-soft font-medium">
                    {isLoadingPOs ? (
                      <span className="inline-flex items-center gap-1.5 text-galla-teal font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching bills...
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
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedPOId || ""}
                      onChange={(e) => {
                        setSelectedPOId(e.target.value);
                        setErrorMsg(null);
                      }}
                      required
                      className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="">-- Select Original Supplier Bill * --</option>
                      {pos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatDisplayNumber(p.purchaseOrderNumber)} &bull; {p.supplierName} ({new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
                        </option>
                      ))}
                      <option value="no_bill">No Bill (Direct Write-off to Expense)</option>
                    </select>

                    {pos.length === 0 && (
                      <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-[5px] flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span>No purchase bills found for &ldquo;{product.name}&rdquo;. Select &ldquo;No Bill&rdquo; to write off directly to expenses.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Stock allocation breakdown */}
              <div className="space-y-3 pt-3 border-t border-galla-line/60">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider">
                      Deduct Return Units From (Stock Allocation) <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs text-galla-ink-soft">
                      Specify units to remove from Retail Shelf, Salon Use, or Defective inventory
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReturnAllStock}
                      disabled={maxAutoAll <= 0}
                      className="px-2.5 py-1 text-xs font-semibold rounded-[5px] border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Return All ({maxAutoAll} pcs)
                    </button>
                    <button
                      type="button"
                      onClick={handleClearReturnBreakdown}
                      className="px-2.5 py-1 text-xs font-sans text-galla-ink-soft hover:text-galla-ink rounded-[5px] border border-galla-line bg-galla-surface hover:bg-galla-paper transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Retail Shelf Card */}
                  <div className={`p-3.5 rounded-[6px] border transition-all ${parsedReturnSell > 0 ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300" : "border-galla-line bg-galla-surface"}`}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-sans font-bold text-galla-ink">Retail Shelf</span>
                      <span className="tabular-nums text-xs text-galla-ink-soft">
                        Avail: <strong className="text-galla-ink font-semibold">{product.sell}</strong> pcs
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={parsedReturnSell <= 0}
                        onClick={() => {
                          setRetSellInput(String(Math.max(0, parsedReturnSell - 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={product.sell}
                        step="1"
                        value={retSellInput}
                        onChange={(e) => {
                          setRetSellInput(e.target.value);
                          setErrorMsg(null);
                        }}
                        className="flex-1 h-8 text-center font-sans tabular-nums text-[13.5px] font-medium bg-galla-surface border border-galla-line rounded-[5px] text-galla-ink focus:border-rose-500 outline-none"
                      />
                      <button
                        type="button"
                        disabled={parsedReturnSell >= product.sell}
                        onClick={() => {
                          setRetSellInput(String(Math.min(product.sell, parsedReturnSell + 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-galla-ink-soft">Left: {Math.max(0, product.sell - parsedReturnSell)} pcs</span>
                      <button
                        type="button"
                        disabled={product.sell <= 0}
                        onClick={() => {
                          setRetSellInput(String(product.sell));
                          setErrorMsg(null);
                        }}
                        className="text-rose-700 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                      >
                        All ({product.sell})
                      </button>
                    </div>
                  </div>

                  {/* Salon Use Card */}
                  <div className={`p-3.5 rounded-[6px] border transition-all ${parsedReturnUse > 0 ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300" : "border-galla-line bg-galla-surface"}`}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-sans font-bold text-galla-ink">Salon Use</span>
                      <span className="tabular-nums text-xs text-galla-ink-soft">
                        Avail: <strong className="text-galla-ink font-semibold">{product.use}</strong> pcs
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={parsedReturnUse <= 0}
                        onClick={() => {
                          setRetUseInput(String(Math.max(0, parsedReturnUse - 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={product.use}
                        step="1"
                        value={retUseInput}
                        onChange={(e) => {
                          setRetUseInput(e.target.value);
                          setErrorMsg(null);
                        }}
                        className="flex-1 h-8 text-center font-sans tabular-nums text-[13.5px] font-medium bg-galla-surface border border-galla-line rounded-[5px] text-galla-ink focus:border-rose-500 outline-none"
                      />
                      <button
                        type="button"
                        disabled={parsedReturnUse >= product.use}
                        onClick={() => {
                          setRetUseInput(String(Math.min(product.use, parsedReturnUse + 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-galla-ink-soft">Left: {Math.max(0, product.use - parsedReturnUse)} pcs</span>
                      <button
                        type="button"
                        disabled={product.use <= 0}
                        onClick={() => {
                          setRetUseInput(String(product.use));
                          setErrorMsg(null);
                        }}
                        className="text-rose-700 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                      >
                        All ({product.use})
                      </button>
                    </div>
                  </div>

                  {/* Defective Card */}
                  <div className={`p-3.5 rounded-[6px] border transition-all ${parsedReturnDef > 0 ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300" : "border-galla-line bg-galla-surface"}`}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-sans font-bold text-galla-ink">Defective Stock</span>
                      <span className="tabular-nums text-xs text-galla-ink-soft">
                        Avail: <strong className="text-galla-ink font-semibold">{product.defectiveStock || 0}</strong> pcs
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={parsedReturnDef <= 0}
                        onClick={() => {
                          setRetDefInput(String(Math.max(0, parsedReturnDef - 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={product.defectiveStock || 0}
                        step="1"
                        value={retDefInput}
                        onChange={(e) => {
                          setRetDefInput(e.target.value);
                          setErrorMsg(null);
                        }}
                        className="flex-1 h-8 text-center font-sans tabular-nums text-[13.5px] font-medium bg-galla-surface border border-galla-line rounded-[5px] text-galla-ink focus:border-rose-500 outline-none"
                      />
                      <button
                        type="button"
                        disabled={parsedReturnDef >= (product.defectiveStock || 0)}
                        onClick={() => {
                          setRetDefInput(String(Math.min(product.defectiveStock || 0, parsedReturnDef + 1)));
                          setErrorMsg(null);
                        }}
                        className="h-8 w-8 rounded-[5px] border border-galla-line bg-galla-paper flex items-center justify-center font-bold text-galla-ink hover:bg-galla-line/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-galla-ink-soft">Left: {Math.max(0, (product.defectiveStock || 0) - parsedReturnDef)} pcs</span>
                      <button
                        type="button"
                        disabled={(product.defectiveStock || 0) <= 0}
                        onClick={() => {
                          setRetDefInput(String(product.defectiveStock || 0));
                          setErrorMsg(null);
                        }}
                        className="text-rose-700 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                      >
                        All ({product.defectiveStock || 0})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settlement & Refund Section for Return Product */}
              {supplierResolution === "return" ? (
                isNoBill ? (
                  <div className="space-y-3 pt-3 border-t border-galla-line/60">
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-[8px] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[12.5px] font-bold text-amber-950">
                          Direct Expense Write-off
                        </label>
                        <span className="font-sans text-[11px] text-amber-900 font-semibold px-2 py-0.5 rounded bg-amber-100/80 border border-amber-300">
                          No Bill Linked
                        </span>
                      </div>
                      <p className="font-sans text-[11.5px] text-amber-900 leading-relaxed">
                        Since no supplier purchase bill is linked, this will remove <strong className="text-amber-950">{totalReturnSupplierQty} pcs</strong> from inventory and record the purchase valuation (<strong className="text-amber-950">{formatRupee(estReturnCost)}</strong>) directly into salon expenses under category &ldquo;other&rdquo;.
                      </p>
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
                              Max: {formatRupee(Math.min(pendingDue, estReturnCost))}
                            </span>
                          </div>
                        </label>
                      )}

                      <div className="space-y-2 text-[12.5px] font-sans bg-white p-3 rounded-[6px] border border-galla-line/70 shadow-2xs">
                        <div className="flex justify-between items-center text-galla-ink">
                          <span className="text-galla-ink-soft">Total Return Value:</span>
                          <span className="font-semibold tabular-nums">{formatRupee(estReturnCost)}</span>
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
                            className={`font-bold tabular-nums text-[14px] ${cashRefund > 0 ? "text-emerald-700" : "text-galla-ink-soft"
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
                )
              ) : (
                /* Replacement Stock Info */
                <div className="space-y-3 pt-3 border-t border-galla-line/60">
                  <div className="p-3.5 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-900 font-bold text-[13px]">
                      <RefreshCw className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Wait for Replacement Stock</span>
                    </div>
                    <p className="text-xs text-galla-ink-soft leading-relaxed">
                      {totalReturnSupplierQty > 0
                        ? `${totalReturnSupplierQty} unit${totalReturnSupplierQty > 1 ? "s" : ""} will be returned to ${selectedPO?.supplierName || "dealer"} for 1-to-1 replacement exchange.`
                        : "Units will be sent to dealer for replacement stock delivery."}
                    </p>
                    <div className="p-2.5 rounded-[6px] bg-white border border-galla-line/80 text-[11.5px] text-galla-ink-soft flex items-center justify-between">
                      <span>Monetary Settlement:</span>
                      <span className="font-semibold text-galla-ink">None (Stock exchange only)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="pt-2 border-t border-galla-line/60">
                <label className="text-xs font-semibold text-galla-ink block uppercase tracking-wider mb-1.5">
                  Return Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={consumeNotes}
                  onChange={(e) => setConsumeNotes(e.target.value)}
                  placeholder="e.g. damaged seal on delivery, defective pump, batch return..."
                  className="w-full px-3.5 py-2 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                />
              </div>
            </section>
          )}
        </main>

        {/* ====================================================== */}
        {/* RIGHT COLUMN: PRODUCT METRICS, SUMMARY & SUBMIT        */}
        {/* ====================================================== */}
        <aside className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-[68px] order-2 space-y-0">
          {/* Header */}
          <div className="p-4 border-b border-galla-line/60 flex items-center justify-between shrink-0 bg-galla-paper/30">
            <h2 className="text-[14px] font-bold text-galla-ink">Product &amp; Action Summary</h2>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] ${mode === "consume"
                ? "bg-amber-100 text-amber-800"
                : mode === "return_supplier"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-galla-teal-soft text-galla-teal"
                }`}
            >
              {mode === "consume" ? "Consumption" : mode === "return_supplier" ? "Supplier Return" : "Transfer"}
            </span>
          </div>

          <div className="p-5 space-y-5">
            {/* Product Card */}
            <div className="space-y-3">
              <div>
                <h3 className="font-sans font-bold text-base text-galla-ink leading-tight">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-galla-ink-soft">
                  <span>Price: <strong className="text-galla-ink font-semibold">{formatRupee(product.price)}</strong></span>
                  <span>&bull;</span>
                  <span>Cost: <strong className="text-galla-ink font-semibold">{formatRupee(estUnitCost)}</strong></span>
                  <span className="text-[10.5px] tabular-nums font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-[4px] shrink-0">
                    +{formatRupee(unitProfit)} ({marginPct}%)
                  </span>
                </div>
              </div>

              {/* Sibling batch advice */}
              {lowerProfitSibling ? (
                <div className="text-[11.5px] font-sans text-amber-900 bg-amber-50/90 border border-amber-200/90 p-2.5 rounded-[6px] leading-relaxed flex items-start gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <div>
                    <strong>Keep for Retail:</strong> This batch earns {formatRupee(unitProfit)} profit. Use &ldquo;{lowerProfitSibling.name}&rdquo; ({formatRupee(Math.max(0, lowerProfitSibling.price - (lowerProfitSibling.purchaseCost || 0)))}/unit) for salon use instead.
                  </div>
                </div>
              ) : siblingBatches.length > 0 ? (
                <div className="text-[11.5px] font-sans text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-[6px] leading-relaxed flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <strong>Best for Internal Use:</strong> Lowest profit batch at {formatRupee(unitProfit)}/unit. Recommended for salon service usage.
                  </div>
                </div>
              ) : null}
            </div>

            {/* Impact Details Callout */}
            <div className="pt-4 border-t border-galla-line space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-galla-ink-soft">
                Transaction Impact
              </div>

              {mode === "transfer" && (
                <div className="p-3 rounded-[6px] border border-galla-teal/30 bg-galla-teal-soft/30 text-xs space-y-2">
                  <div className="flex justify-between items-center text-galla-ink font-semibold">
                    <span>Moving Quantity:</span>
                    <span className="tabular-nums font-bold text-sm text-galla-teal">{numQty || 0} pcs</span>
                  </div>
                  <div className="text-[11.5px] text-galla-ink-soft">
                    {direction === "sell_to_use"
                      ? "Moving from Retail Shelf into Salon Internal Stock"
                      : "Returning from Salon Internal Stock back to Retail Shelf"}
                  </div>
                </div>
              )}

              {mode === "consume" && (
                <div className="p-3 rounded-[6px] border border-amber-200 bg-amber-50/70 text-xs space-y-2">
                  <div className="flex justify-between items-center text-amber-950 font-semibold">
                    <span>Deducting:</span>
                    <span className="tabular-nums font-bold text-sm">{numQty || 0} pcs</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-950 font-semibold border-t border-amber-200/60 pt-1.5">
                    <span>Auto-logged Expense:</span>
                    <span className="tabular-nums font-bold text-base text-amber-950">{formatRupee(estTotalCost)}</span>
                  </div>
                </div>
              )}

              {mode === "return_supplier" && (
                <div className="p-3.5 rounded-[6px] border border-rose-200 bg-rose-50/70 text-xs space-y-2.5">
                  <div className="flex justify-between items-center text-rose-950 font-semibold">
                    <span>Total Returning:</span>
                    <span className="tabular-nums font-bold text-sm text-rose-900">{totalReturnSupplierQty} pcs</span>
                  </div>

                  {supplierResolution === "return" ? (
                    <>
                      <div className="flex justify-between items-center text-rose-950 font-semibold border-t border-rose-200/60 pt-1.5">
                        <span>Total Return Value:</span>
                        <span className="tabular-nums font-bold text-base text-rose-900">{formatRupee(estReturnCost)}</span>
                      </div>

                      {isNoBill ? (
                        <>
                          <div className="flex justify-between items-center text-amber-950 font-semibold border-t border-rose-200/60 pt-1.5">
                            <span>Direct Salon Expense:</span>
                            <span className="tabular-nums font-bold text-amber-900">{formatRupee(estReturnCost)}</span>
                          </div>
                          <p className="text-[11px] text-amber-900/90 leading-relaxed border-t border-rose-200/60 pt-1.5">
                            No supplier bill linked. Valuation will be logged directly into salon expenses under category &ldquo;other&rdquo;.
                          </p>
                        </>
                      ) : (
                        <>
                          {effectiveDeductFromDue && dueDeduction > 0 && (
                            <div className="flex justify-between items-center text-emerald-800 font-medium">
                              <span>Deducted from Bill Due:</span>
                              <span className="tabular-nums font-semibold">-{formatRupee(dueDeduction)}</span>
                            </div>
                          )}

                          {cashRefund > 0 && (
                            <div className="flex justify-between items-center text-emerald-800 font-semibold">
                              <span>To Receive ({supplierPaymentMode === "credit" ? "Credit" : supplierPaymentMode.toUpperCase()}):</span>
                              <span className="tabular-nums font-bold">{formatRupee(cashRefund)}</span>
                            </div>
                          )}

                          {selectedPO && (
                            <p className="text-[11px] text-rose-900/90 leading-relaxed border-t border-rose-200/60 pt-1.5">
                              {effectiveDeductFromDue
                                ? cashRefund > 0
                                  ? `Clears pending due of ${formatRupee(dueDeduction)} on this bill + ${formatRupee(cashRefund)} received via ${supplierPaymentMode === "credit" ? "Supplier Credit" : supplierPaymentMode.toUpperCase()}.`
                                  : `Reduces ${formatRupee(dueDeduction)} from pending due on this bill. Remaining due: ${formatRupee(remainingDueAfterReturn)}.`
                                : `Full return value of ${formatRupee(cashRefund)} received via ${supplierPaymentMode === "credit" ? "Supplier Credit" : supplierPaymentMode.toUpperCase()}. Bill due remains ${formatRupee(pendingDue)}.`}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-rose-950 font-semibold border-t border-rose-200/60 pt-1.5">
                        <span>Resolution:</span>
                        <span className="font-bold text-xs text-rose-900">Replacement Pending</span>
                      </div>
                      <p className="text-[11px] text-rose-900/90 leading-relaxed border-t border-rose-200/60 pt-1.5">
                        Items removed from active stock to pending replacement. Dealer will deliver replacement units. No monetary settlement.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !isValidQty ||
                  (mode === "return_supplier" ? totalReturnSupplierQty <= 0 || !selectedPOId : maxAvailable <= 0)
                }
                className={`w-full py-3 px-4 rounded-[5px] text-white font-sans text-sm font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${mode === "consume"
                  ? "bg-amber-800 hover:bg-amber-900"
                  : mode === "return_supplier"
                    ? isNoBill
                      ? "bg-amber-700 hover:bg-amber-800"
                      : "bg-rose-600 hover:bg-rose-700"
                    : "bg-galla-teal hover:opacity-95"
                  }`}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {isSubmitting
                    ? "Processing..."
                    : mode === "consume"
                      ? `Deduct ${numQty || 1} pcs`
                      : mode === "return_supplier"
                        ? isNoBill
                          ? supplierResolution === "replacement"
                            ? `Replace ${totalReturnSupplierQty || 1} pcs Stock`
                            : `Write-off ${totalReturnSupplierQty || 1} pcs to Expense (${formatRupee(estReturnCost)})`
                          : supplierResolution === "replacement"
                            ? `Replace ${totalReturnSupplierQty || 1} pcs with Supplier`
                            : `Return ${totalReturnSupplierQty || 1} pcs to Supplier`
                        : direction === "sell_to_use"
                          ? `Move ${numQty || 1} pcs to Use`
                          : `Move ${numQty || 1} pcs to Retail`}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-[5px] border border-galla-line font-sans text-xs font-semibold text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </aside>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        title={
          mode === "consume"
            ? "Confirm Stock Deduction"
            : mode === "return_supplier"
              ? isNoBill
                ? supplierResolution === "replacement"
                  ? "Confirm Stock Replacement"
                  : "Confirm Expense Write-off"
                : "Confirm Supplier Return"
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
                {isNoBill ? (
                  <>
                    Are you sure you want to {supplierResolution === "replacement" ? "replace" : "write off"}{" "}
                    <strong className="font-semibold text-galla-ink">{totalReturnSupplierQty} pcs</strong> of{" "}
                    <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong>{supplierResolution === "replacement" ? " without linking a bill" : " directly to salon expenses"}?
                    <span className="block mt-1 text-[12px] text-galla-ink-soft">
                      Allocation: <strong>{[
                        parsedReturnSell > 0 ? `${parsedReturnSell}x Retail Shelf` : null,
                        parsedReturnUse > 0 ? `${parsedReturnUse}x Salon Use` : null,
                        parsedReturnDef > 0 ? `${parsedReturnDef}x Defective` : null,
                      ].filter(Boolean).join(" + ") || "None"}</strong> &bull; Total Value: <strong className="tabular-nums text-galla-ink">{formatRupee(estReturnCost)}</strong>
                    </span>
                    {supplierResolution === "return" ? (
                      <span className="block mt-1 text-[12px] text-amber-800 font-medium">
                        Direct expense write-off: {formatRupee(estReturnCost)} will be booked into salon expenses under category &ldquo;other&rdquo;.
                      </span>
                    ) : (
                      <span className="block mt-1 text-[12px] text-rose-800 font-medium">
                        Direct replacement: Units removed from active inventory to await replacement stock.
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Are you sure you want to return{" "}
                    <strong className="font-semibold text-galla-ink">{totalReturnSupplierQty} pcs</strong> of{" "}
                    <strong className="font-semibold text-galla-ink">&ldquo;{product.name}&rdquo;</strong> to{" "}
                    <strong className="font-semibold text-galla-ink">{selectedPO?.supplierName || "supplier"}</strong>?
                    <span className="block mt-1 text-[12px] text-galla-ink-soft">
                      Allocation: <strong>{[
                        parsedReturnSell > 0 ? `${parsedReturnSell}x Retail Shelf` : null,
                        parsedReturnUse > 0 ? `${parsedReturnUse}x Salon Use` : null,
                        parsedReturnDef > 0 ? `${parsedReturnDef}x Defective` : null,
                      ].filter(Boolean).join(" + ") || "None"}</strong> &bull; Total Value: <strong className="tabular-nums text-galla-ink">{formatRupee(estReturnCost)}</strong>
                    </span>
                    <span className="block mt-1 text-[12px] text-rose-800 font-medium">
                      Settlement:{" "}
                      {supplierResolution === "replacement"
                        ? "Wait for replacement stock from supplier (no monetary transaction)"
                        : effectiveDeductFromDue
                          ? cashRefund > 0
                            ? `Deducts ${formatRupee(dueDeduction)} from bill due + receives ${formatRupee(cashRefund)} via ${supplierPaymentMode === "credit" ? "Supplier Credit" : supplierPaymentMode.toUpperCase()}`
                            : `Deducts full return value of ${formatRupee(dueDeduction)} from bill due (Remaining due: ${formatRupee(remainingDueAfterReturn)})`
                          : `Full return value of ${formatRupee(cashRefund)} received via ${supplierPaymentMode === "credit" ? "Supplier Credit" : supplierPaymentMode.toUpperCase()}`}
                    </span>
                  </>
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
        confirmLabel={
          mode === "consume"
            ? "Yes, Deduct Stock"
            : mode === "return_supplier"
              ? isNoBill
                ? supplierResolution === "replacement"
                  ? "Yes, Replace Stock"
                  : "Yes, Write-off to Expense"
                : supplierResolution === "replacement"
                  ? "Yes, Send for Replacement"
                  : "Yes, Return to Supplier"
              : "Yes, Move Stock"
        }
        cancelLabel="Cancel"
        isLoading={isSubmitting}
        onConfirm={executeAction}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
