"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Package,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  DashboardOrder,
  DashboardOrderLineItem,
  DashboardProduct,
} from "@/types/dashboard";
import {
  formatRupee,
  formatDisplayNumber,
  getLocalDateString,
} from "@/lib/utils";
import {
  returnCustomerOrderItemAction,
  getProductByIdAction,
} from "@/app/dashboard/actions";
import { PaymentModeSelect } from "../payment-mode-select";

interface ReturnCustomerOrderItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DashboardOrder;
  lineItem: DashboardOrderLineItem;
  lineItemIndex: number;
  products?: DashboardProduct[];
  onSuccess: () => void;
}

export function ReturnCustomerOrderItemModal({
  isOpen,
  onClose,
  order,
  lineItem,
  lineItemIndex,
  products = [],
  onSuccess,
}: ReturnCustomerOrderItemModalProps) {
  const previouslyReturned = lineItem.returnedQuantity || 0;
  const availableToReturn = lineItem.quantity - previouslyReturned;

  // Basic fields
  const [quantity, setQuantity] = useState<string>("1");
  const [isGoodCondition, setIsGoodCondition] = useState<boolean>(true);
  const [restockLocation, setRestockLocation] = useState<"sellStock" | "useStock">("sellStock");

  // Defective resolution
  const [defectiveResolution, setDefectiveResolution] = useState<"refund" | "replacement">("replacement");
  const [replacementOption, setReplacementOption] = useState<"immediate_full" | "immediate_partial" | "wait_all">("immediate_full");
  const [expectedPickupDate, setExpectedPickupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return getLocalDateString(d);
  });

  // Refund mode
  const [refundMode, setRefundMode] = useState<"cash" | "upi" | "card" | "reduce_due">("cash");
  const [customAmountStr, setCustomAmountStr] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Product Shelf Stock resolution
  const [matchedProduct, setMatchedProduct] = useState<DashboardProduct | null>(() => {
    const found = products.find(
      (p) =>
        (lineItem.itemId && String(p.id) === String(lineItem.itemId)) ||
        (lineItem.name && p.name.trim().toLowerCase() === lineItem.name.trim().toLowerCase())
    );
    return found || null;
  });
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitPrice =
    lineItem.quantity > 0
      ? Math.round((lineItem.finalPrice / lineItem.quantity) * 100) / 100
      : lineItem.unitPrice;
  const pendingAmount = Math.max(0, order.amount - order.paid);

  // Fetch product stock if not provided in props
  useEffect(() => {
    if (isOpen && lineItem.itemId && !matchedProduct) {
      setIsLoadingStock(true);
      getProductByIdAction(lineItem.itemId)
        .then((res) => {
          if (res.success && res.product) {
            setMatchedProduct(res.product);
          }
        })
        .finally(() => {
          setIsLoadingStock(false);
        });
    }
  }, [isOpen, lineItem.itemId, matchedProduct]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen && lineItem) {
      setQuantity("1");
      setCustomAmountStr(String(Math.round(unitPrice * 100) / 100));
      setIsGoodCondition(true);
      setRestockLocation("sellStock");
      setDefectiveResolution("replacement");
      setReplacementOption("immediate_full");
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setExpectedPickupDate(getLocalDateString(d));
      setRefundMode(pendingAmount > 0 ? "reduce_due" : "cash");
      setError(null);
      setNotes("");
    }
  }, [isOpen, lineItem, order, unitPrice, pendingAmount]);

  const parsedQty = parseInt(quantity || "0", 10);
  const isValidQty = !isNaN(parsedQty) && parsedQty > 0 && parsedQty <= availableToReturn;
  const defaultReturnTotal = isNaN(parsedQty) ? 0 : Math.round(parsedQty * unitPrice * 100) / 100;
  const finalReturnAmount =
    customAmountStr !== "" ? parseFloat(customAmountStr) || 0 : defaultReturnTotal;

  const shelfStock = matchedProduct ? matchedProduct.sell : 0;

  // Auto-adjust replacement option based on available shelf stock
  useEffect(() => {
    if (!isGoodCondition && defectiveResolution === "replacement" && isValidQty) {
      if (shelfStock >= parsedQty) {
        setReplacementOption("immediate_full");
      } else if (shelfStock === 0) {
        setReplacementOption("wait_all");
      } else {
        setReplacementOption("immediate_partial");
      }
    }
  }, [isGoodCondition, defectiveResolution, shelfStock, parsedQty, isValidQty]);

  if (!isOpen) return null;

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const qty = parseInt(val || "0", 10);
    if (!isNaN(qty) && qty > 0) {
      setCustomAmountStr(String(Math.round(qty * unitPrice * 100) / 100));
    } else {
      setCustomAmountStr("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidQty) {
      setError(`Please enter a whole quantity between 1 and ${availableToReturn}`);
      return;
    }

    const returnCondition: "restocked" | "defective_dealer_claim" = isGoodCondition
      ? "restocked"
      : "defective_dealer_claim";

    const customerResolution: "refund" | "replacement" = isGoodCondition
      ? "refund"
      : defectiveResolution;

    if (
      customerResolution === "refund" &&
      refundMode === "reduce_due" &&
      finalReturnAmount > pendingAmount
    ) {
      setError(
        `Cannot deduct ${formatRupee(finalReturnAmount)} from due because order pending balance is only ${formatRupee(pendingAmount)}. Choose Cash, UPI, or Card instead.`
      );
      return;
    }

    let handedQty = 0;
    if (!isGoodCondition && customerResolution === "replacement") {
      if (replacementOption === "immediate_full") {
        handedQty = parsedQty;
      } else if (replacementOption === "immediate_partial") {
        handedQty = Math.min(shelfStock, parsedQty);
      } else {
        handedQty = 0;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await returnCustomerOrderItemAction(
        order.id,
        lineItemIndex,
        parsedQty,
        returnCondition,
        refundMode,
        notes.trim() || undefined,
        finalReturnAmount,
        customerResolution,
        {
          restockLocation: isGoodCondition ? restockLocation : undefined,
          replacementOption: !isGoodCondition && customerResolution === "replacement" ? replacementOption : undefined,
          handedQuantity: handedQty,
          expectedPickupDate:
            !isGoodCondition && customerResolution === "replacement" && replacementOption !== "immediate_full"
              ? expectedPickupDate
              : undefined,
        }
      );

      if (!res.success) {
        throw new Error(res.error || "Failed to process return");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process return");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/40 backdrop-blur-[2px] overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[85vh] flex flex-col bg-galla-surface border border-galla-line rounded-[6px] shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-[4px] bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-semibold text-[15px] text-galla-ink leading-tight truncate">
                Customer Return &amp; Replacement
              </h2>
              <p className="font-sans text-[11px] text-galla-ink-soft truncate">
                Order #{formatDisplayNumber(order.id)} &bull; {order.customer} &bull; {lineItem.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] text-galla-ink-soft hover:text-galla-ink hover:bg-galla-line/40 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3.5 custom-scrollbar">
          {/* Product Summary Strip */}
          <div className="flex items-center justify-between px-3 py-2 bg-galla-paper/40 border border-galla-line/70 rounded-[5px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Package className="h-4 w-4 text-galla-teal shrink-0" />
              <div className="min-w-0">
                <div className="font-sans text-[12.5px] font-semibold text-galla-ink truncate">
                  {lineItem.name}
                </div>
                <div className="font-sans text-[11px] text-galla-ink-soft">
                  Ordered: <strong className="font-mono text-galla-ink font-medium">{lineItem.quantity}</strong> &bull; Returned: <strong className="font-mono text-galla-ink font-medium">{previouslyReturned}</strong> &bull; Returnable: <strong className="font-mono text-emerald-800 font-semibold">{availableToReturn}</strong>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[12px] font-semibold text-galla-ink">
                {formatRupee(unitPrice)} <span className="font-sans text-[10px] text-galla-ink-soft font-normal">/pc</span>
              </div>
              <div className="text-[10.5px] font-sans text-galla-ink-soft">
                Shelf Stock: <strong className="font-mono text-galla-ink">{isLoadingStock ? "..." : `${shelfStock} pcs`}</strong>
              </div>
            </div>
          </div>

          {/* Quantity & Return Price (2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Question 1: Quantity to Return */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider">
                  1. Quantity to Return
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange("1")}
                    className="font-sans text-[10.5px] text-galla-teal hover:underline cursor-pointer"
                  >
                    1 pc
                  </button>
                  <span className="text-galla-ink-soft text-[10px]">&bull;</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(String(availableToReturn))}
                    className="font-sans text-[10.5px] text-galla-teal hover:underline cursor-pointer font-medium"
                  >
                    All ({availableToReturn})
                  </button>
                </div>
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="1"
                  max={availableToReturn}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-mono text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
                  required
                />
                <span className="absolute right-3 font-sans text-[11px] text-galla-ink-soft pointer-events-none">
                  pcs
                </span>
              </div>
            </div>

            {/* Editable Return / Refund Price */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider">
                  Return / Refund Price (₹)
                </label>
                {customAmountStr !== String(defaultReturnTotal) && (
                  <button
                    type="button"
                    onClick={() => setCustomAmountStr(String(defaultReturnTotal))}
                    className="font-sans text-[10.5px] text-galla-teal hover:underline cursor-pointer"
                    title="Reset to default calculated price"
                  >
                    Reset ({formatRupee(defaultReturnTotal)})
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 font-mono text-[13px] text-galla-ink-soft pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!isGoodCondition && defectiveResolution === "replacement"}
                  value={customAmountStr}
                  onChange={(e) => setCustomAmountStr(e.target.value)}
                  className="w-full h-8 pl-6 pr-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-mono text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors disabled:bg-galla-paper/50 disabled:text-galla-ink-soft/70 disabled:cursor-not-allowed"
                  placeholder={String(defaultReturnTotal)}
                  required={isGoodCondition || defectiveResolution === "refund"}
                />
              </div>
              <div className="font-sans text-[10.5px] text-galla-ink-soft mt-1 truncate">
                {!isGoodCondition && defectiveResolution === "replacement" ? (
                  <span className="text-amber-800">Replacement selected &mdash; ₹0 refund</span>
                ) : (
                  <>
                    Default: <strong className="font-mono text-galla-ink">{formatRupee(unitPrice)}/pc</strong> &bull; Total: <strong className="font-mono text-galla-ink">{formatRupee(defaultReturnTotal)}</strong>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Question 2: Is the returned product in good condition? */}
          <div>
            <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              2. Is the returned product in good condition?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsGoodCondition(true);
                  setError(null);
                }}
                className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                  isGoodCondition
                    ? "bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 text-emerald-950"
                    : "bg-galla-surface border-galla-line text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-[12.5px] font-semibold">Yes, Good Condition</span>
                  {isGoodCondition && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                  Restock product into shop &amp; refund customer.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsGoodCondition(false);
                  setError(null);
                }}
                className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                  !isGoodCondition
                    ? "bg-rose-50/80 border-rose-500 ring-1 ring-rose-500 text-rose-950"
                    : "bg-galla-surface border-galla-line text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-[12.5px] font-semibold">No, Defective / Damaged</span>
                  {!isGoodCondition && <CheckCircle2 className="h-4 w-4 text-rose-600" />}
                </div>
                <p className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                  Take into salon defective stock for dealer claim.
                </p>
              </button>
            </div>
          </div>

          {/* Condition Flow A: Good Condition -> Where to Restock & Refund */}
          {isGoodCondition ? (
            <div className="space-y-3 p-3 bg-galla-paper/40 border border-galla-line/80 rounded-[5px]">
              <div>
                <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Restock Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestockLocation("sellStock")}
                    className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                      restockLocation === "sellStock"
                        ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-teal font-semibold"
                        : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="font-sans text-[12px] flex items-center justify-between">
                      <span>Retail Shelf (Resell)</span>
                      {restockLocation === "sellStock" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestockLocation("useStock")}
                    className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                      restockLocation === "useStock"
                        ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-teal font-semibold"
                        : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="font-sans text-[12px] flex items-center justify-between">
                      <span>Salon Treatment Use</span>
                      {restockLocation === "useStock" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Refund Customer Mode */}
              <PaymentModeSelect
                label="Refund Customer Mode"
                badge={
                  <span className="font-mono text-[12px] font-semibold text-rose-700">
                    Refund: {formatRupee(finalReturnAmount)}
                  </span>
                }
                value={refundMode}
                onChange={setRefundMode}
                allowedModes={
                  pendingAmount > 0
                    ? [
                        "cash",
                        "upi",
                        "card",
                        {
                          value: "reduce_due",
                          label: "Reduce Customer Due",
                          sublabel: `Reduce pending order balance of ${formatRupee(pendingAmount)}`,
                        },
                      ]
                    : ["cash", "upi", "card"]
                }
              />
            </div>
          ) : (
            /* Condition Flow B: Defective -> Ask Resolution (Refund vs Replace) */
            <div className="space-y-3 p-3 bg-rose-50/40 border border-rose-200/80 rounded-[5px]">
              <div>
                <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  3. What does the client want?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDefectiveResolution("replacement");
                      setError(null);
                    }}
                    className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                      defectiveResolution === "replacement"
                        ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-ink"
                        : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-[12px] font-semibold text-galla-ink">Product Replacement</span>
                      {defectiveResolution === "replacement" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                    </div>
                    <p className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                      Hand from shelf or schedule pickup.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDefectiveResolution("refund");
                      setError(null);
                    }}
                    className={`p-2.5 rounded-[5px] border text-left transition-all cursor-pointer ${
                      defectiveResolution === "refund"
                        ? "bg-galla-surface border-rose-500 ring-1 ring-rose-500 text-galla-ink"
                        : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-[12px] font-semibold text-galla-ink">Money Refund</span>
                      {defectiveResolution === "refund" && <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />}
                    </div>
                    <p className="font-sans text-[10.5px] text-galla-ink-soft mt-0.5">
                      Refund funds &amp; claim dealer credit later.
                    </p>
                  </button>
                </div>
              </div>

              {/* Defective -> Choice 1: Money Refund */}
              {defectiveResolution === "refund" && (
                <div className="space-y-2 pt-2 border-t border-rose-200/60">
                  <PaymentModeSelect
                    label="Refund Customer via"
                    badge={
                      <span className="font-mono text-[12px] font-semibold text-rose-700">
                        Total: {formatRupee(finalReturnAmount)}
                      </span>
                    }
                    value={refundMode}
                    onChange={setRefundMode}
                    allowedModes={
                      pendingAmount > 0
                        ? [
                            "cash",
                            "upi",
                            "card",
                            {
                              value: "reduce_due",
                              label: "Reduce Customer Due",
                              sublabel: `Reduce pending order balance of ${formatRupee(pendingAmount)}`,
                            },
                          ]
                        : ["cash", "upi", "card"]
                    }
                  />
                  <p className="text-[10.5px] font-sans text-rose-800/80">
                    Defective piece ({parsedQty} pcs) will be labeled in defective inventory to claim credit or return to dealer in future.
                  </p>
                </div>
              )}

              {/* Defective -> Choice 2: Product Replacement */}
              {defectiveResolution === "replacement" && (
                <div className="space-y-3 pt-2 border-t border-rose-200/60">
                  {/* Case 1: Shelf stock fully available */}
                  {shelfStock >= parsedQty ? (
                    <div className="p-2.5 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11.5px] font-sans space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Shelf Stock Available ({shelfStock} pcs in retail)</span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Hand over {parsedQty} new unit{parsedQty > 1 ? "s" : ""} to the client immediately from the shelf. The returned defective unit will be stored in salon defective stock.
                      </p>
                    </div>
                  ) : shelfStock === 0 ? (
                    /* Case 2: Shelf is out of stock */
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-950 text-[11.5px] font-sans">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Out of Stock on Shelf (0 pcs available)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Set the date client is expected to collect. A dashboard alert will notify you if dealer replacement hasn&rsquo;t arrived by this date.
                        </p>
                      </div>

                      <div>
                        <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                          Expected Client Pickup Date <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="date"
                          min={getLocalDateString()}
                          value={expectedPickupDate}
                          onChange={(e) => setExpectedPickupDate(e.target.value)}
                          required
                          className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-mono text-[12.5px] text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Case 3: Partial shelf stock available */
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-950 text-[11.5px] font-sans">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Partial Stock Available ({shelfStock} of {parsedQty} pcs)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Choose whether to hand over available items now or wait for all together.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReplacementOption("immediate_partial")}
                          className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                            replacementOption === "immediate_partial"
                              ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-ink"
                              : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                          }`}
                        >
                          <div className="font-heading text-[11.5px] font-semibold flex items-center justify-between">
                            <span>Hand {shelfStock} Now, Rest Later</span>
                            {replacementOption === "immediate_partial" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10.5px] text-galla-ink-soft mt-0.5">
                            Give {shelfStock} now, {parsedQty - shelfStock} on expected date.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplacementOption("wait_all")}
                          className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                            replacementOption === "wait_all"
                              ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-ink"
                              : "bg-galla-surface border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                          }`}
                        >
                          <div className="font-heading text-[11.5px] font-semibold flex items-center justify-between">
                            <span>Wait for All ({parsedQty}) Together</span>
                            {replacementOption === "wait_all" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10.5px] text-galla-ink-soft mt-0.5">
                            Client will pick up all pieces once arrived.
                          </p>
                        </button>
                      </div>

                      <div>
                        <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                          Expected Pickup Date for Remaining ({replacementOption === "immediate_partial" ? parsedQty - shelfStock : parsedQty} pcs)
                        </label>
                        <input
                          type="date"
                          min={getLocalDateString()}
                          value={expectedPickupDate}
                          onChange={(e) => setExpectedPickupDate(e.target.value)}
                          required
                          className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-mono text-[12.5px] text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason / Notes */}
          <div>
            <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
              Reason / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Broken pump, client disliked shade, agreed to exchange on Friday..."
              className="w-full h-8 px-2.5 bg-galla-surface border border-galla-line rounded-[5px] font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 rounded-[4px] text-red-800 text-[11.5px] font-sans">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}



          {/* Action Buttons - Fixed at bottom of form */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-galla-line shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-[4px] border border-galla-line font-sans text-[12px] font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidQty}
              className="px-4 py-1.5 rounded-[4px] bg-rose-700 hover:bg-rose-800 font-sans text-[12px] font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {isGoodCondition
                  ? `Confirm Return & Refund (${formatRupee(finalReturnAmount)})`
                  : defectiveResolution === "replacement"
                  ? "Confirm Replacement"
                  : `Confirm Refund (${formatRupee(finalReturnAmount)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
