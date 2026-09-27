"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Package,
  AlertCircle,
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
  getProductBatchesForReturnAction,
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
  const previouslyReplaced = lineItem.replacedQuantity || 0;
  const availableToReturn = Math.max(0, lineItem.quantity - (previouslyReturned + previouslyReplaced));

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

  // Product Shelf Stock & Batches resolution
  const [matchedProduct, setMatchedProduct] = useState<DashboardProduct | null>(() => {
    const found = products.find(
      (p) =>
        (lineItem.itemId && String(p.id) === String(lineItem.itemId)) ||
        (lineItem.name && p.name.trim().toLowerCase() === lineItem.name.trim().toLowerCase())
    );
    return found || null;
  });
  const [availableBatches, setAvailableBatches] = useState<DashboardProduct[]>([]);
  const [selectedReplacementBatchId, setSelectedReplacementBatchId] = useState<string>("");
  const [replacementResolutionType, setReplacementResolutionType] = useState<"upgrade_available" | "wait_original">("upgrade_available");
  const [priceDiffPaymentMode, setPriceDiffPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [customNewPriceStr, setCustomNewPriceStr] = useState<string>("");
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReplacementOrder =
    order.status === "replacement_completed" ||
    order.status === "replacement_pending" ||
    order.status === "replacement" ||
    (lineItem.finalPrice === 0 && lineItem.unitPrice > 0);

  const unitPrice =
    lineItem.finalPrice > 0 && lineItem.quantity > 0
      ? Math.floor(lineItem.finalPrice / lineItem.quantity)
      : Math.floor(lineItem.unitPrice || 0);
  const totalDueDeduction = (order.returns || []).reduce((sum, r) => {
    if (typeof r.dueDeduction === "number") return sum + r.dueDeduction;
    return sum + (r.refundMode === "reduce_due" ? (r.refundAmount || 0) : 0);
  }, 0);
  const pendingAmount = Math.max(0, order.amount - order.paid - totalDueDeduction);

  // Fetch product stock and related batches from server
  useEffect(() => {
    if (isOpen && (lineItem.itemId || lineItem.name)) {
      setIsLoadingStock(true);
      getProductBatchesForReturnAction(lineItem.itemId, lineItem.name)
        .then((res) => {
          if (res.success) {
            if (res.product) setMatchedProduct(res.product);
            if (res.batches) setAvailableBatches(res.batches);
          }
        })
        .finally(() => {
          setIsLoadingStock(false);
        });
    }
  }, [isOpen, lineItem.itemId, lineItem.name]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen && lineItem) {
      setQuantity("1");
      setCustomAmountStr(String(Math.floor(unitPrice)));
      setIsGoodCondition(true);
      setRestockLocation("sellStock");
      setDefectiveResolution("replacement");
      setReplacementOption("immediate_full");
      setSelectedReplacementBatchId("");
      setCustomNewPriceStr("");
      setReplacementResolutionType("upgrade_available");
      setPriceDiffPaymentMode("cash");
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setExpectedPickupDate(getLocalDateString(d));
      setRefundMode("cash");
      setError(null);
      setNotes("");
    }
  }, [isOpen, lineItem, order, unitPrice, pendingAmount]);

  const parsedQty = parseInt(quantity || "0", 10);
  const isValidQty = !isNaN(parsedQty) && parsedQty > 0 && parsedQty <= availableToReturn;
  const defaultReturnTotal = isNaN(parsedQty) ? 0 : Math.floor(parsedQty * unitPrice);
  const finalReturnAmount =
    customAmountStr !== "" ? Math.floor(parseFloat(customAmountStr) || 0) : defaultReturnTotal;

  const dueDeduction = Math.floor(Math.min(pendingAmount, finalReturnAmount));
  const cashRefund = Math.max(0, Math.floor(finalReturnAmount - dueDeduction));

  // Collect all in-stock products matching this item (either matchedProduct or from availableBatches)
  const inStockProducts = useMemo(() => {
    const list: DashboardProduct[] = [];
    const seen = new Set<string>();

    if (matchedProduct && matchedProduct.sell > 0) {
      list.push(matchedProduct);
      seen.add(String(matchedProduct.id));
    }

    for (const b of availableBatches) {
      if (b.sell > 0 && !seen.has(String(b.id))) {
        list.push(b);
        seen.add(String(b.id));
      }
    }

    return list;
  }, [matchedProduct, availableBatches]);

  // Batch having exact same price as customer paid in this order
  const samePriceBatch = useMemo(() => {
    return inStockProducts.find((p) => p.price === unitPrice) || null;
  }, [inStockProducts, unitPrice]);

  const samePriceStock = samePriceBatch ? samePriceBatch.sell : 0;

  // Batches available at a different price / new MRP
  const newMRPProducts = useMemo(() => {
    return inStockProducts.filter((p) => p.price !== unitPrice);
  }, [inStockProducts, unitPrice]);

  // Has new MRP available when old price stock is not enough (or 0)
  const hasNewMRPAvailable = samePriceStock < parsedQty && newMRPProducts.length > 0;

  const selectedNewMRPProduct = useMemo(() => {
    if (selectedReplacementBatchId) {
      const found = newMRPProducts.find((p) => String(p.id) === String(selectedReplacementBatchId));
      if (found) return found;
    }
    return newMRPProducts[0] || null;
  }, [selectedReplacementBatchId, newMRPProducts]);

  // Keep custom price synchronized with the selected batch price
  useEffect(() => {
    if (selectedNewMRPProduct) {
      setCustomNewPriceStr(String(selectedNewMRPProduct.price));
    } else {
      setCustomNewPriceStr("");
    }
  }, [selectedNewMRPProduct?.id, selectedNewMRPProduct?.price]);

  const parsedCustomNewPrice = parseFloat(customNewPriceStr);
  const effectiveNewPrice =
    customNewPriceStr.trim() !== "" && !isNaN(parsedCustomNewPrice) && parsedCustomNewPrice >= 0
      ? parsedCustomNewPrice
      : selectedNewMRPProduct
      ? selectedNewMRPProduct.price
      : unitPrice;

  const targetReplacementProduct = useMemo(() => {
    if (hasNewMRPAvailable && replacementResolutionType === "upgrade_available") {
      return selectedNewMRPProduct;
    }
    return samePriceBatch || matchedProduct;
  }, [hasNewMRPAvailable, replacementResolutionType, selectedNewMRPProduct, samePriceBatch, matchedProduct]);

  const targetPrice =
    hasNewMRPAvailable && replacementResolutionType === "upgrade_available"
      ? effectiveNewPrice
      : samePriceBatch
      ? samePriceBatch.price
      : matchedProduct
      ? matchedProduct.price
      : unitPrice;

  const unitPriceDiff = Math.round(targetPrice - unitPrice);
  const totalPriceDiff = unitPriceDiff * parsedQty;

  const isUpgradingToNewMRP =
    !isGoodCondition &&
    defectiveResolution === "replacement" &&
    hasNewMRPAvailable &&
    replacementResolutionType === "upgrade_available";

  // Auto-adjust replacement option based on available shelf stock
  useEffect(() => {
    if (!isGoodCondition && defectiveResolution === "replacement" && isValidQty) {
      if (isUpgradingToNewMRP && selectedNewMRPProduct) {
        if (selectedNewMRPProduct.sell >= parsedQty) {
          setReplacementOption("immediate_full");
        } else {
          setReplacementOption("immediate_partial");
        }
      } else if (samePriceStock >= parsedQty) {
        setReplacementOption("immediate_full");
      } else if (samePriceStock === 0) {
        setReplacementOption("wait_all");
      } else {
        setReplacementOption("immediate_partial");
      }
    }
  }, [isGoodCondition, defectiveResolution, samePriceStock, parsedQty, isValidQty, isUpgradingToNewMRP, selectedNewMRPProduct]);

  const renderSettlementSection = (label: string) => {
    if (pendingAmount > 0) {
      return (
        <div className="p-3 bg-galla-surface border border-galla-line/80 rounded-[5px] space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider">
              Settlement Breakdown
            </label>
            <span className="font-sans text-[11px] text-amber-800 font-medium">
              Order Due: {formatRupee(pendingAmount)}
            </span>
          </div>

          <div className="space-y-1.5 text-[12px] font-sans bg-galla-paper/50 p-2.5 rounded-[4px] border border-galla-line/50">
            <div className="flex justify-between items-center text-galla-ink">
              <span className="text-galla-ink-soft">Return Credit Total:</span>
              <span className="font-mono font-semibold">{formatRupee(finalReturnAmount)}</span>
            </div>
            {dueDeduction > 0 && (
              <div className="flex justify-between items-center text-emerald-800">
                <span>Deducted from Pending Due:</span>
                <span className="font-mono font-medium">-{formatRupee(dueDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t border-galla-line/60">
              <span className="font-semibold text-galla-ink">Net Cash Payout to Client:</span>
              <span
                className={`font-mono font-bold text-[13px] ${
                  cashRefund > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {formatRupee(cashRefund)}
              </span>
            </div>
          </div>

          {cashRefund > 0 ? (
            <div className="pt-1">
              <PaymentModeSelect
                label="Pay Out Net Refund Via"
                badge={
                  <span className="font-mono text-[11px] font-semibold text-rose-700">
                    Payout: {formatRupee(cashRefund)}
                  </span>
                }
                value={refundMode === "reduce_due" ? "cash" : refundMode}
                onChange={setRefundMode}
                allowedModes={["cash", "upi", "card"]}
              />
            </div>
          ) : (
            <div className="p-2 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] font-sans">
              {formatRupee(dueDeduction)} applied to reduce pending due. No cash payout needed.
            </div>
          )}
        </div>
      );
    }

    return (
      <PaymentModeSelect
        label={label}
        badge={
          <span className="font-mono text-[12px] font-semibold text-rose-700">
            Refund: {formatRupee(finalReturnAmount)}
          </span>
        }
        value={refundMode}
        onChange={setRefundMode}
        allowedModes={["cash", "upi", "card"]}
      />
    );
  };

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

    let handedQty = 0;
    if (!isGoodCondition && customerResolution === "replacement") {
      if (isUpgradingToNewMRP) {
        const availableStock = targetReplacementProduct ? targetReplacementProduct.sell : 0;
        handedQty = Math.min(availableStock, parsedQty);
      } else if (samePriceStock >= parsedQty) {
        handedQty = parsedQty;
      } else if (samePriceStock > 0) {
        handedQty = Math.min(samePriceStock, parsedQty);
      } else {
        handedQty = 0;
      }
    }

    setIsSubmitting(true);
    setError(null);

    const effectiveRefundMode: "cash" | "upi" | "card" | "reduce_due" =
      pendingAmount > 0 && cashRefund === 0
        ? "reduce_due"
        : refundMode === "reduce_due"
        ? "cash"
        : refundMode;

    try {
      const res = await returnCustomerOrderItemAction(
        order.id,
        lineItemIndex,
        parsedQty,
        returnCondition,
        effectiveRefundMode,
        notes.trim() || undefined,
        finalReturnAmount,
        customerResolution,
        {
          restockLocation: isGoodCondition ? restockLocation : undefined,
          replacementOption:
            !isGoodCondition && customerResolution === "replacement"
              ? isUpgradingToNewMRP
                ? handedQty >= parsedQty
                  ? "immediate_full"
                  : handedQty > 0
                  ? "immediate_partial"
                  : "wait_all"
                : samePriceStock >= parsedQty
                ? "immediate_full"
                : samePriceStock > 0
                ? "immediate_partial"
                : "wait_all"
              : undefined,
          handedQuantity: handedQty,
          expectedPickupDate:
            !isGoodCondition && customerResolution === "replacement"
              ? isUpgradingToNewMRP
                ? handedQty < parsedQty
                  ? expectedPickupDate
                  : undefined
                : samePriceStock < parsedQty
                ? expectedPickupDate
                : undefined
              : undefined,
          replacementProductId:
            targetReplacementProduct ? String(targetReplacementProduct.id) : undefined,
          replacementProductPrice: isUpgradingToNewMRP ? effectiveNewPrice : undefined,
          priceDifference: isUpgradingToNewMRP ? totalPriceDiff : 0,
          priceDifferencePaymentMode:
            isUpgradingToNewMRP && totalPriceDiff !== 0 ? priceDiffPaymentMode : undefined,
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
                Order #{formatDisplayNumber(order.id)} &bull; {order.customer}
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
                  Ordered: <strong className="font-mono text-galla-ink font-medium">{lineItem.quantity}</strong>
                  {previouslyReturned > 0 && (
                    <> &bull; Returned: <strong className="font-mono text-galla-ink font-medium">{previouslyReturned}</strong></>
                  )}
                  {previouslyReplaced > 0 && (
                    <> &bull; Replaced: <strong className="font-mono text-galla-ink font-medium">{previouslyReplaced}</strong></>
                  )}
                  &bull; Returnable: <strong className="font-mono text-emerald-800 font-semibold">{availableToReturn}</strong>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[13px] font-semibold text-galla-ink">
                {formatRupee(unitPrice)} <span className="font-sans text-[10px] text-galla-ink-soft font-normal">/pc</span>
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
                ) : isReplacementOrder ? (
                  <span className="text-emerald-700">Original product value &bull; Billed at ₹0 on replacement</span>
                ) : parsedQty > 1 ? (
                  <span>{parsedQty} pcs &times; {formatRupee(unitPrice)} = <strong className="font-mono text-galla-ink">{formatRupee(defaultReturnTotal)}</strong></span>
                ) : customAmountStr !== "" && customAmountStr !== String(defaultReturnTotal) ? (
                  <span>Default: <strong className="font-mono text-galla-ink">{formatRupee(defaultReturnTotal)}</strong></span>
                ) : null}
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
                  Restock item &amp; refund customer.
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
                  Hold in defective inventory for dealer claim.
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
                      <span>Retail Shelf</span>
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

              {renderSettlementSection("Refund Customer Mode")}
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
                      Hand replacement from stock.
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
                      Refund client money.
                    </p>
                  </button>
                </div>
              </div>

              {/* Defective -> Choice 1: Money Refund */}
              {defectiveResolution === "refund" && (
                <div className="space-y-2 pt-2 border-t border-rose-200/60">
                  {renderSettlementSection("Refund Customer via")}
                  <p className="text-[10.5px] font-sans text-rose-800/80">
                    Defective piece ({parsedQty} pcs) held for dealer claim.
                  </p>
                </div>
              )}

              {/* Defective -> Choice 2: Product Replacement */}
              {defectiveResolution === "replacement" && (
                <div className="space-y-3 pt-2 border-t border-rose-200/60">
                  {/* Condition 1: Shelf stock fully available at the exact same price */}
                  {samePriceStock >= parsedQty ? (
                    <div className="p-2.5 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11.5px] font-sans space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Stock Available ({samePriceStock} pcs @ {formatRupee(unitPrice)})</span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Hand over {parsedQty} replacement unit{parsedQty > 1 ? "s" : ""} to the client immediately.
                      </p>
                    </div>
                  ) : hasNewMRPAvailable && selectedNewMRPProduct ? (
                    /* Condition 2: Old price product is NOT available, BUT new MRP product is in stock! */
                    <div className="p-3 rounded-[6px] bg-amber-50/80 border border-amber-300 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-950 text-[12.5px]">
                          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                          <span>Old Price Product Not Available</span>
                        </div>
                        <span className="font-heading text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 shrink-0">
                          New MRP In Stock
                        </span>
                      </div>

                      <div className="text-[11.5px] text-amber-900 leading-snug space-y-1">
                        <p>
                          The product at the original purchase price (<strong>{formatRupee(unitPrice)}</strong>) is no longer available in stock.
                        </p>
                        <p className="font-medium text-amber-950">
                          Would you like to get the new MRP product by paying the above price difference?
                        </p>
                      </div>

                      {/* Product Details & Price Difference Breakdown */}
                      <div className="p-2.5 bg-galla-surface border border-amber-200/90 rounded-[5px] space-y-2 text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-galla-ink-soft">Available Product:</span>
                          {newMRPProducts.length > 1 ? (
                            <select
                              value={selectedNewMRPProduct.id}
                              onChange={(e) => setSelectedReplacementBatchId(e.target.value)}
                              className="h-7 px-2 bg-galla-surface border border-galla-line rounded font-sans text-[11.5px] text-galla-ink font-semibold focus:outline-none focus:border-galla-teal"
                            >
                              {newMRPProducts.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({b.sell} pcs @ {formatRupee(b.price)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-galla-ink">{selectedNewMRPProduct.name}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-galla-ink-soft">Shelf Stock:</span>
                          <span className="font-mono font-medium text-emerald-800">{selectedNewMRPProduct.sell} pcs available</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-galla-line/60 items-center">
                          <div>
                            <span className="text-[11px] text-galla-ink-soft block">Old Purchase Price:</span>
                            <span className="font-mono font-semibold text-galla-ink">{formatRupee(unitPrice)}</span>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <label htmlFor="replacement-price-input" className="text-[11px] text-galla-ink-soft block font-medium">
                                New Price:
                              </label>
                              {customNewPriceStr.trim() !== "" &&
                                !isNaN(parseFloat(customNewPriceStr)) &&
                                parseFloat(customNewPriceStr) !== selectedNewMRPProduct.price && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomNewPriceStr(String(selectedNewMRPProduct.price))}
                                    className="text-[10px] text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                                    title="Reset to original catalog MRP"
                                  >
                                    Reset (₹{selectedNewMRPProduct.price})
                                  </button>
                                )}
                            </div>
                            <div className="inline-flex items-center gap-1 mt-0.5 justify-end">
                              <span className="font-mono text-[12px] text-galla-ink-soft">₹</span>
                              <input
                                id="replacement-price-input"
                                type="number"
                                min={0}
                                step="any"
                                value={customNewPriceStr}
                                onChange={(e) => setCustomNewPriceStr(e.target.value)}
                                placeholder={String(selectedNewMRPProduct.price)}
                                className="w-24 h-7 px-2 text-right bg-white border border-amber-300 rounded font-mono font-bold text-[13px] text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors shadow-2xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-amber-200 bg-amber-100/60 -mx-2.5 -mb-2.5 p-2 rounded-b-[4px]">
                          <span className="font-semibold text-amber-950 text-[11.5px]">
                            {totalPriceDiff > 0 ? "Price Difference to Pay:" : totalPriceDiff < 0 ? "Price Difference to Refund:" : "Price Difference:"}
                          </span>
                          <span className="font-mono font-bold text-[13px] text-amber-950">
                            {totalPriceDiff > 0 ? `+${formatRupee(totalPriceDiff)}` : totalPriceDiff < 0 ? `-${formatRupee(Math.abs(totalPriceDiff))}` : "₹0"}
                            {parsedQty > 1 && (
                              <span className="font-sans text-[10.5px] font-normal text-amber-800 ml-1">
                                ({formatRupee(Math.abs(unitPriceDiff))}/pc &times; {parsedQty})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Choice: Get New MRP Product vs Wait for Old Price Stock */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setReplacementResolutionType("upgrade_available")}
                          className={`p-2 rounded-[4px] border text-left cursor-pointer transition-all ${
                            replacementResolutionType === "upgrade_available"
                              ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-ink font-medium"
                              : "bg-galla-surface/70 border-galla-line text-galla-ink-soft hover:bg-galla-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11.5px] font-semibold">
                            <span>Get New MRP Product</span>
                            {replacementResolutionType === "upgrade_available" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10px] text-galla-ink-soft mt-0.5">
                            {totalPriceDiff > 0
                              ? `Hand over now & pay ${formatRupee(totalPriceDiff)} difference.`
                              : totalPriceDiff < 0
                              ? `Hand over now & refund ${formatRupee(Math.abs(totalPriceDiff))} excess.`
                              : "Hand over replacement unit now (₹0 difference)."}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplacementResolutionType("wait_original")}
                          className={`p-2 rounded-[4px] border text-left cursor-pointer transition-all ${
                            replacementResolutionType === "wait_original"
                              ? "bg-galla-surface border-galla-teal ring-1 ring-galla-teal text-galla-ink font-medium"
                              : "bg-galla-surface/70 border-galla-line text-galla-ink-soft hover:bg-galla-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11.5px] font-semibold">
                            <span>Wait for Old Price Stock</span>
                            {replacementResolutionType === "wait_original" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10px] text-galla-ink-soft mt-0.5">
                            Client will wait for restock (₹0 difference).
                          </p>
                        </button>
                      </div>

                      {/* When Get New MRP: Collect price difference payment mode */}
                      {replacementResolutionType === "upgrade_available" && totalPriceDiff > 0 && (
                        <div className="pt-1.5">
                          <PaymentModeSelect
                            label="Pay Price Difference Via"
                            badge={
                              <span className="font-mono text-[11px] font-semibold text-amber-900">
                                Pay: {formatRupee(totalPriceDiff)}
                              </span>
                            }
                            value={priceDiffPaymentMode}
                            onChange={setPriceDiffPaymentMode}
                            allowedModes={["cash", "upi", "card"]}
                          />
                        </div>
                      )}

                      {/* When price difference is negative (refund to customer) */}
                      {replacementResolutionType === "upgrade_available" && totalPriceDiff < 0 && (
                        <div className="pt-1.5">
                          <PaymentModeSelect
                            label="Refund Price Difference Via"
                            badge={
                              <span className="font-mono text-[11px] font-semibold text-rose-900">
                                Refund: {formatRupee(Math.abs(totalPriceDiff))}
                              </span>
                            }
                            value={priceDiffPaymentMode}
                            onChange={setPriceDiffPaymentMode}
                            allowedModes={["cash", "upi", "card"]}
                          />
                        </div>
                      )}

                      {/* When Wait: Expected pickup date */}
                      {replacementResolutionType === "wait_original" && (
                        <div className="pt-1">
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
                      )}
                    </div>
                  ) : samePriceStock === 0 ? (
                    /* Condition 3: Completely out of stock */
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-950 text-[11.5px] font-sans">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Out of Stock (0 pcs)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Set expected pickup date for client collection.
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
                          <span>Partial Stock ({samePriceStock} of {parsedQty} pcs)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Hand available stock now or wait for all together.
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
                            <span>Hand {samePriceStock} Now, Rest Later</span>
                            {replacementOption === "immediate_partial" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10.5px] text-galla-ink-soft mt-0.5">
                            Remaining {parsedQty - samePriceStock} pcs on pickup date.
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
                            <span>Wait for All ({parsedQty})</span>
                            {replacementOption === "wait_all" && <CheckCircle2 className="h-3.5 w-3.5 text-galla-teal" />}
                          </div>
                          <p className="text-[10.5px] text-galla-ink-soft mt-0.5">
                            Client will collect all once arrived.
                          </p>
                        </button>
                      </div>

                      <div>
                        <label className="block font-heading text-[11px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                          Expected Pickup Date for Remaining ({replacementOption === "immediate_partial" ? parsedQty - samePriceStock : parsedQty} pcs)
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
              placeholder="e.g. Defective seal, client preference, exchange..."
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
                  ? pendingAmount > 0
                    ? cashRefund > 0
                      ? `Confirm Return (Clear ${formatRupee(dueDeduction)} Due + Refund ${formatRupee(cashRefund)})`
                      : `Confirm Return & Clear Due (${formatRupee(dueDeduction)})`
                    : `Confirm Return & Refund (${formatRupee(finalReturnAmount)})`
                  : defectiveResolution === "replacement"
                  ? isUpgradingToNewMRP
                    ? totalPriceDiff > 0
                      ? `Confirm Replacement (Pay ${formatRupee(totalPriceDiff)} Difference)`
                      : totalPriceDiff < 0
                      ? `Confirm Replacement (Refund ${formatRupee(Math.abs(totalPriceDiff))} Excess)`
                      : "Confirm Replacement (₹0 Difference)"
                    : replacementResolutionType === "wait_original" || samePriceStock === 0
                    ? "Schedule Replacement Order"
                    : "Confirm Replacement"
                  : pendingAmount > 0
                  ? cashRefund > 0
                    ? `Confirm Return (Clear ${formatRupee(dueDeduction)} Due + Refund ${formatRupee(cashRefund)})`
                    : `Confirm Return & Clear Due (${formatRupee(dueDeduction)})`
                  : `Confirm Refund (${formatRupee(finalReturnAmount)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
