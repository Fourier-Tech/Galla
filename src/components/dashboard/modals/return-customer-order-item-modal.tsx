"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Package,
  AlertCircle,
  AlertTriangle,
  Store,
  Sparkles,
  Calendar,
  Banknote,
  Check,
  RefreshCw,
  Receipt,
  Clock,
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
  const [replaceFromUseStock, setReplaceFromUseStock] = useState<boolean>(false);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
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
      setReplaceFromUseStock(false);
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
    return inStockProducts
      .filter((p) => p.price !== unitPrice)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );
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
  }, [selectedNewMRPProduct]);

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

  const handedQuantityPreview = useMemo(() => {
    if (isGoodCondition || defectiveResolution !== "replacement") return 0;
    if (replaceFromUseStock) {
      return parsedQty;
    }
    if (isUpgradingToNewMRP) {
      const availableStock = targetReplacementProduct ? targetReplacementProduct.sell : 0;
      return Math.min(availableStock, parsedQty);
    } else if (samePriceStock >= parsedQty) {
      return parsedQty;
    } else if (samePriceStock > 0) {
      return Math.min(samePriceStock, parsedQty);
    }
    return 0;
  }, [
    isGoodCondition,
    defectiveResolution,
    replaceFromUseStock,
    isUpgradingToNewMRP,
    targetReplacementProduct,
    samePriceStock,
    parsedQty,
  ]);

  const renderSettlementSection = (label: string) => {
    if (pendingAmount > 0) {
      return (
        <div className="p-3.5 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12.5px] font-bold text-galla-ink">
              Settlement Breakdown
            </label>
            <span className="font-sans text-[11px] text-amber-900 font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              Pending Order Due: {formatRupee(pendingAmount)}
            </span>
          </div>

          <div className="space-y-2 text-[12.5px] font-sans bg-white p-3 rounded-[6px] border border-galla-line/70 shadow-2xs">
            <div className="flex justify-between items-center text-galla-ink">
              <span className="text-galla-ink-soft">Return Credit Total:</span>
              <span className="font-semibold tabular-nums">{formatRupee(finalReturnAmount)}</span>
            </div>
            {dueDeduction > 0 && (
              <div className="flex justify-between items-center text-emerald-800">
                <span>Deducted from Pending Due:</span>
                <span className="font-semibold tabular-nums">-{formatRupee(dueDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-galla-line/60">
              <span className="font-bold text-galla-ink">Net Cash Payout to Client:</span>
              <span
                className={`font-bold tabular-nums text-[14px] ${cashRefund > 0 ? "text-rose-700" : "text-emerald-700"
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
                  <span className="text-[11.5px] font-semibold tabular-nums text-rose-700">
                    Payout: {formatRupee(cashRefund)}
                  </span>
                }
                value={refundMode === "reduce_due" ? "cash" : refundMode}
                onChange={setRefundMode}
                allowedModes={["cash", "upi", "card"]}
              />
            </div>
          ) : (
            <div className="p-2.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-950 text-[12px] font-sans flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{formatRupee(dueDeduction)} applied to clear pending due. No cash payout needed.</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="p-3.5 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] space-y-2">
        <PaymentModeSelect
          label={label}
          badge={
            <span className="text-[12px] font-semibold tabular-nums text-rose-700">
              Refund: {formatRupee(finalReturnAmount)}
            </span>
          }
          value={refundMode}
          onChange={setRefundMode}
          allowedModes={["cash", "upi", "card"]}
        />
      </div>
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
      if (replaceFromUseStock) {
        handedQty = parsedQty;
      } else if (isUpgradingToNewMRP) {
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

    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);
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
          replaceFromUseStock: !isGoodCondition && customerResolution === "replacement" ? replaceFromUseStock : false,
          replacementOption:
            !isGoodCondition && customerResolution === "replacement"
              ? replaceFromUseStock
                ? "immediate_full"
                : isUpgradingToNewMRP
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
              ? replaceFromUseStock
                ? undefined
                : isUpgradingToNewMRP
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
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/50 backdrop-blur-[3px] overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col bg-galla-surface border border-galla-line rounded-[10px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line bg-galla-paper/50 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 rounded-[8px] bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-bold text-galla-ink leading-tight">
                  Customer Return &amp; Replacement
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-galla-teal-soft text-galla-teal border border-galla-teal/20">
                  {formatDisplayNumber(order.id)}
                </span>
              </div>
              <p className="font-sans text-[12px] text-galla-ink-soft truncate mt-0.5">
                Customer: <strong className="text-galla-ink font-semibold">{order.customer}</strong>
                {order.customerPhone ? ` (${order.customerPhone})` : ""}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
          {/* Product Summary Header Banner */}
          <div className="p-4 bg-galla-paper/50 border border-galla-line/80 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="h-10 w-10 rounded-[8px] bg-white border border-galla-line flex items-center justify-center text-galla-teal shrink-0 shadow-2xs">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-sans text-[15px] font-bold text-galla-ink truncate leading-tight">
                  {lineItem.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px] font-sans text-galla-ink-soft">
                  <span>Ordered: <strong className="tabular-nums text-galla-ink font-semibold">{lineItem.quantity}</strong></span>
                  {previouslyReturned > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>Returned: <strong className="tabular-nums text-galla-ink font-semibold">{previouslyReturned}</strong></span>
                    </>
                  )}
                  {previouslyReplaced > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>Replaced: <strong className="tabular-nums text-galla-ink font-semibold">{previouslyReplaced}</strong></span>
                    </>
                  )}
                  <span>&bull;</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    Returnable: {availableToReturn} pcs
                  </span>
                  {isLoadingStock && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-galla-teal font-medium ml-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking stock...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-galla-line/60">
              <div className="text-[11px] text-galla-ink-soft uppercase tracking-wider font-semibold">Billed Unit Price</div>
              <div className="tabular-nums text-[16px] font-bold text-galla-ink">
                {formatRupee(unitPrice)} <span className="font-sans text-[11px] text-galla-ink-soft font-normal">/pc</span>
              </div>
            </div>
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Configuration (Left 7 Cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Step 1: Quantity to Return & Price */}
              <div className="p-4 sm:p-5 bg-galla-surface border border-galla-line rounded-[8px] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-galla-line/60 pb-2.5">
                  <h4 className="text-[13px] font-bold text-galla-ink flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-galla-teal/10 text-galla-teal text-[11px] font-bold">1</span>
                    <span>Quantity &amp; Value</span>
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="text-galla-ink-soft">Quick:</span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange("1")}
                      className="px-2 py-0.5 rounded bg-galla-paper hover:bg-galla-line/60 border border-galla-line text-galla-ink text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      1 pc
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(String(availableToReturn))}
                      className="px-2 py-0.5 rounded bg-galla-paper hover:bg-galla-line/60 border border-galla-line text-galla-teal text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      All ({availableToReturn})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Quantity */}
                  <div>
                    <label className="block text-[12px] font-semibold text-galla-ink mb-1.5">
                      Quantity to Return
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        autoFocus
                        min="1"
                        max={availableToReturn}
                        value={quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        className="w-full h-10 px-3 pr-10 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors shadow-2xs"
                        required
                      />
                      <span className="absolute right-3 font-sans text-[12px] text-galla-ink-soft pointer-events-none font-medium">
                        pcs
                      </span>
                    </div>
                    <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                      Max returnable: <strong className="text-galla-ink">{availableToReturn} pcs</strong>
                    </p>
                  </div>

                  {/* Return / Refund Price */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-semibold text-galla-ink">
                        Return Value (₹)
                      </label>
                      {customAmountStr !== String(defaultReturnTotal) && (
                        <button
                          type="button"
                          onClick={() => setCustomAmountStr(String(defaultReturnTotal))}
                          className="font-sans text-[11px] text-galla-teal hover:underline cursor-pointer font-medium"
                          title="Reset to default calculated price"
                        >
                          Reset ({formatRupee(defaultReturnTotal)})
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 tabular-nums text-[14px] font-semibold text-galla-ink-soft pointer-events-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        disabled={!isGoodCondition && defectiveResolution === "replacement"}
                        value={customAmountStr}
                        onChange={(e) => setCustomAmountStr(e.target.value)}
                        className="w-full h-10 pl-7 pr-3 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors shadow-2xs disabled:bg-galla-paper/60 disabled:text-galla-ink-soft/70 disabled:cursor-not-allowed"
                        placeholder={String(defaultReturnTotal)}
                        required={isGoodCondition || defectiveResolution === "refund"}
                      />
                    </div>
                    <div className="font-sans text-[11px] text-galla-ink-soft mt-1">
                      {!isGoodCondition && defectiveResolution === "replacement" ? (
                        <span className="text-amber-800 font-medium">Replacement selected &mdash; value credited to replacement unit</span>
                      ) : isReplacementOrder ? (
                        <span className="text-emerald-700 font-medium">Original product value &bull; Billed at ₹0 on replacement</span>
                      ) : parsedQty > 1 ? (
                        <span>{parsedQty} pcs &times; {formatRupee(unitPrice)} = <strong className="tabular-nums text-galla-ink font-semibold">{formatRupee(defaultReturnTotal)}</strong></span>
                      ) : customAmountStr !== "" && customAmountStr !== String(defaultReturnTotal) ? (
                        <span>Standard value: <strong className="tabular-nums text-galla-ink">{formatRupee(defaultReturnTotal)}</strong></span>
                      ) : (
                        <span>Standard return total for {parsedQty} pc</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Condition of Returned Product */}
              <div className="p-4 sm:p-5 bg-galla-surface border border-galla-line rounded-[8px] space-y-3.5 shadow-2xs">
                <div className="border-b border-galla-line/60 pb-2.5">
                  <h4 className="text-[13px] font-bold text-galla-ink flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-galla-teal/10 text-galla-teal text-[11px] font-bold">2</span>
                    <span>Condition of Returned Item</span>
                  </h4>
                  <p className="font-sans text-[11.5px] text-galla-ink-soft mt-0.5">
                    Is this product unopened and resellable, or defective / damaged?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGoodCondition(true);
                      setError(null);
                    }}
                    className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${isGoodCondition
                        ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs"
                        : "bg-white border-galla-line text-galla-ink hover:border-galla-teal/40 hover:bg-galla-paper/30"
                      }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-[13.5px]">
                      <CheckCircle2 className={`h-4.5 w-4.5 ${isGoodCondition ? "text-emerald-600" : "text-galla-ink-soft"}`} />
                      <span>Good Condition</span>
                    </div>
                    <p className="font-sans text-[11.5px] text-galla-ink-soft mt-1.5 leading-relaxed">
                      Product is sealed/undamaged. Restock to salon shelf and refund customer.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsGoodCondition(false);
                      setError(null);
                    }}
                    className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${!isGoodCondition
                        ? "bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 shadow-xs"
                        : "bg-white border-galla-line text-galla-ink hover:border-rose-400/40 hover:bg-galla-paper/30"
                      }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-[13.5px]">
                      <AlertTriangle className={`h-4.5 w-4.5 ${!isGoodCondition ? "text-rose-600" : "text-galla-ink-soft"}`} />
                      <span>Defective / Damaged</span>
                    </div>
                    <p className="font-sans text-[11.5px] text-galla-ink-soft mt-1.5 leading-relaxed">
                      Faulty or damaged. Hold in defective quarantine for dealer claim.
                    </p>
                  </button>
                </div>
              </div>

              {/* Step 3: Destination & Settlement (Condition-dependent) */}
              <div className="p-4 sm:p-5 bg-galla-surface border border-galla-line rounded-[8px] space-y-4 shadow-2xs">
                <div className="border-b border-galla-line/60 pb-2.5">
                  <h4 className="text-[13px] font-bold text-galla-ink flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-galla-teal/10 text-galla-teal text-[11px] font-bold">3</span>
                    <span>{isGoodCondition ? "Restock Destination & Payout" : "Customer Resolution"}</span>
                  </h4>
                  <p className="font-sans text-[11.5px] text-galla-ink-soft mt-0.5">
                    {isGoodCondition
                      ? "Specify where the good item should be returned and how to pay the customer."
                      : "Specify whether customer wants an exchange replacement or a money refund."}
                  </p>
                </div>

                {/* Condition Branch A: Good Condition */}
                {isGoodCondition ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-galla-ink mb-2">
                        Restock Destination
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRestockLocation("sellStock")}
                          className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${restockLocation === "sellStock"
                              ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                              : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                              <Store className="h-4 w-4 text-galla-teal" />
                              <span>Retail Shelf Stock</span>
                            </div>
                            {restockLocation === "sellStock" && <Check className="h-4 w-4 text-galla-teal" />}
                          </div>
                          <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                            Put item back on shelf available for new sales.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestockLocation("useStock")}
                          className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${restockLocation === "useStock"
                              ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                              : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                              <Sparkles className="h-4 w-4 text-galla-teal" />
                              <span>Salon Treatment Use</span>
                            </div>
                            {restockLocation === "useStock" && <Check className="h-4 w-4 text-galla-teal" />}
                          </div>
                          <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                            Allocate for internal salon client treatments.
                          </p>
                        </button>
                      </div>
                    </div>

                    {renderSettlementSection("Refund Customer Mode")}
                  </div>
                ) : (
                  /* Condition Branch B: Defective */
                  <div className="space-y-4">
                    {/* Resolution Choice: Replacement vs Refund */}
                    <div>
                      <label className="block text-[12px] font-semibold text-galla-ink mb-2">
                        Client Preference
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDefectiveResolution("replacement");
                            setError(null);
                          }}
                          className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${defectiveResolution === "replacement"
                              ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                              : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                              <RefreshCw className="h-4 w-4 text-galla-teal" />
                              <span>Product Replacement</span>
                            </div>
                            {defectiveResolution === "replacement" && <Check className="h-4 w-4 text-galla-teal" />}
                          </div>
                          <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                            Provide exchange unit from stock or schedule pickup.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDefectiveResolution("refund");
                            setError(null);
                          }}
                          className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${defectiveResolution === "refund"
                              ? "bg-white border-rose-500 ring-2 ring-rose-500/20 text-galla-ink shadow-xs"
                              : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper/30"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-[13px] text-galla-ink">
                              <Banknote className="h-4 w-4 text-rose-600" />
                              <span>Money Refund</span>
                            </div>
                            {defectiveResolution === "refund" && <Check className="h-4 w-4 text-rose-600" />}
                          </div>
                          <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                            Issue money refund to customer and close claim.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Defective -> Choice 1: Money Refund */}
                    {defectiveResolution === "refund" && (
                      <div className="space-y-3 pt-2">
                        {renderSettlementSection("Refund Customer via")}
                        <div className="p-3 rounded-[6px] bg-rose-50/60 border border-rose-200/80 text-[12px] font-sans text-rose-900 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
                          <span>Defective piece ({parsedQty} pcs) will be quarantined in inventory for dealer claim.</span>
                        </div>
                      </div>
                    )}

                    {/* Defective -> Choice 2: Product Replacement */}
                    {defectiveResolution === "replacement" && (
                      <div className="space-y-4 pt-2">
                        {/* Case 1: Same Price Stock Available */}
                        {samePriceStock >= parsedQty ? (
                          <div className="p-3.5 rounded-[8px] bg-emerald-50/80 border border-emerald-300 text-emerald-950 text-[12.5px] font-sans space-y-1 shadow-2xs">
                            <div className="flex items-center gap-2 font-bold text-emerald-900 text-[13.5px]">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              <span>Replacement Available in Stock ({samePriceStock} pcs ready @ {formatRupee(unitPrice)})</span>
                            </div>
                            <p className="text-[12px] text-emerald-800 pl-7 leading-relaxed">
                              Hand over <strong className="font-semibold text-emerald-950">{parsedQty} replacement unit{parsedQty > 1 ? "s" : ""}</strong> to the client immediately. The defective unit will be moved to dealer claim stock.
                            </p>
                          </div>
                        ) : hasNewMRPAvailable && selectedNewMRPProduct ? (
                          /* Case 2: New MRP Product Available */
                          <div className="p-4 rounded-[8px] bg-amber-50/90 border border-amber-300 space-y-3.5 shadow-2xs">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2 font-bold text-amber-950 text-[13.5px]">
                                <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
                                <span>Original Price Batch Exhausted</span>
                              </div>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 shrink-0 uppercase tracking-wider">
                                New MRP in Stock
                              </span>
                            </div>

                            <div className="text-[12px] text-amber-900 leading-relaxed space-y-1">
                              <p>
                                The product at the original purchase price (<strong>{formatRupee(unitPrice)}</strong>) is no longer available in stock.
                              </p>
                              <p className="font-semibold text-amber-950">
                                Would you like to provide the new MRP batch by settling the price difference?
                              </p>
                            </div>

                            {/* New Batch Comparison Box */}
                            <div className="p-3.5 bg-white border border-amber-200/90 rounded-[6px] space-y-3 text-[12.5px] shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-galla-ink-soft font-medium">Available Replacement Batch:</span>
                                {newMRPProducts.length > 1 ? (
                                  <select
                                    value={selectedNewMRPProduct.id}
                                    onChange={(e) => setSelectedReplacementBatchId(e.target.value)}
                                    className="h-8 px-2.5 bg-white border border-galla-line rounded font-sans text-[12.5px] font-medium text-galla-ink focus:outline-none focus:border-galla-teal shadow-2xs"
                                  >
                                    {newMRPProducts.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.name} ({b.sell} pcs @ {formatRupee(b.price)})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-bold text-galla-ink">{selectedNewMRPProduct.name}</span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-galla-ink-soft font-medium">Shelf Stock Available:</span>
                                <span className="tabular-nums font-semibold text-emerald-800">{selectedNewMRPProduct.sell} pcs on shelf</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-galla-line/60 items-center">
                                <div>
                                  <span className="text-[11.5px] text-galla-ink-soft block font-medium">Old Purchase Price:</span>
                                  <span className="tabular-nums font-bold text-galla-ink text-[14px]">{formatRupee(unitPrice)}</span>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <label htmlFor="replacement-price-input" className="text-[11.5px] text-galla-ink-soft block font-medium">
                                      New Shelf Price:
                                    </label>
                                    {customNewPriceStr.trim() !== "" &&
                                      !isNaN(parseFloat(customNewPriceStr)) &&
                                      parseFloat(customNewPriceStr) !== selectedNewMRPProduct.price && (
                                        <button
                                          type="button"
                                          onClick={() => setCustomNewPriceStr(String(selectedNewMRPProduct.price))}
                                          className="text-[10.5px] text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                                          title="Reset to original catalog MRP"
                                        >
                                          Reset (₹{selectedNewMRPProduct.price})
                                        </button>
                                      )}
                                  </div>
                                  <div className="inline-flex items-center gap-1 mt-0.5 justify-end">
                                    <span className="tabular-nums text-[13px] text-galla-ink-soft font-semibold">₹</span>
                                    <input
                                      id="replacement-price-input"
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={customNewPriceStr}
                                      onChange={(e) => setCustomNewPriceStr(e.target.value)}
                                      placeholder={String(selectedNewMRPProduct.price)}
                                      className="w-28 h-8 px-2 text-right bg-white border border-amber-300 rounded font-sans tabular-nums font-medium text-[13.5px] text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors shadow-2xs"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-amber-200 bg-amber-100/70 -mx-3.5 -mb-3.5 p-2.5 rounded-b-[6px]">
                                <span className="font-bold text-amber-950 text-[12px]">
                                  {totalPriceDiff > 0 ? "Price Difference to Collect:" : totalPriceDiff < 0 ? "Price Difference to Refund:" : "Price Difference:"}
                                </span>
                                <span className="tabular-nums font-bold text-[14px] text-amber-950">
                                  {totalPriceDiff > 0 ? `+${formatRupee(totalPriceDiff)}` : totalPriceDiff < 0 ? `-${formatRupee(Math.abs(totalPriceDiff))}` : "₹0"}
                                  {parsedQty > 1 && (
                                    <span className="font-sans text-[11px] font-normal text-amber-800 ml-1">
                                      ({formatRupee(Math.abs(unitPriceDiff))}/pc &times; {parsedQty})
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Choice: Upgrade vs Wait */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <button
                                type="button"
                                onClick={() => setReplacementResolutionType("upgrade_available")}
                                className={`p-3 rounded-[6px] border text-left cursor-pointer transition-all ${replacementResolutionType === "upgrade_available"
                                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                                    : "bg-white/80 border-galla-line text-galla-ink-soft hover:bg-white"
                                  }`}
                              >
                                <div className="flex items-center justify-between text-[12.5px] font-bold">
                                  <span>Get New MRP Product</span>
                                  {replacementResolutionType === "upgrade_available" && <Check className="h-4 w-4 text-galla-teal" />}
                                </div>
                                <p className="text-[11px] text-galla-ink-soft mt-1 leading-snug">
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
                                className={`p-3 rounded-[6px] border text-left cursor-pointer transition-all ${replacementResolutionType === "wait_original"
                                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                                    : "bg-white/80 border-galla-line text-galla-ink-soft hover:bg-white"
                                  }`}
                              >
                                <div className="flex items-center justify-between text-[12.5px] font-bold">
                                  <span>Wait for Old Price Stock</span>
                                  {replacementResolutionType === "wait_original" && <Check className="h-4 w-4 text-galla-teal" />}
                                </div>
                                <p className="text-[11px] text-galla-ink-soft mt-1 leading-snug">
                                  Client will wait for restock (₹0 difference).
                                </p>
                              </button>
                            </div>

                            {/* Payment Mode for New MRP Difference */}
                            {replacementResolutionType === "upgrade_available" && totalPriceDiff > 0 && (
                              <div className="pt-2">
                                <PaymentModeSelect
                                  label="Pay Price Difference Via"
                                  badge={
                                    <span className="text-[11.5px] font-semibold tabular-nums text-amber-900">
                                      Pay: {formatRupee(totalPriceDiff)}
                                    </span>
                                  }
                                  value={priceDiffPaymentMode}
                                  onChange={setPriceDiffPaymentMode}
                                  allowedModes={["cash", "upi", "card"]}
                                />
                              </div>
                            )}

                            {replacementResolutionType === "upgrade_available" && totalPriceDiff < 0 && (
                              <div className="pt-2">
                                <PaymentModeSelect
                                  label="Refund Price Difference Via"
                                  badge={
                                    <span className="text-[11.5px] font-semibold tabular-nums text-rose-900">
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
                              <div className="pt-2">
                                <label className="block text-[12px] font-semibold text-galla-ink mb-1.5">
                                  Expected Client Pickup Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                  type="date"
                                  min={getLocalDateString()}
                                  value={expectedPickupDate}
                                  onChange={(e) => setExpectedPickupDate(e.target.value)}
                                  required
                                  className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors shadow-2xs"
                                />
                              </div>
                            )}
                          </div>
                        ) : samePriceStock === 0 ? (
                          /* Case 3: Out of Stock */
                          <div className="p-4 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-950 text-[12.5px] font-sans space-y-3.5 shadow-2xs">
                            <div className="flex items-center gap-2 font-bold text-amber-900 text-[13.5px]">
                              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                              <span>Out of Retail Stock &mdash; Schedule Replacement</span>
                            </div>
                            <p className="text-[12px] text-amber-800 leading-relaxed">
                              No shelf inventory is currently available for immediate handover. Set an expected pickup date when restocked item will be ready.
                            </p>

                            {/* Use-Stock Checkbox: available in useStock */}
                            {(matchedProduct?.use || 0) > 0 && (
                              <div className="p-3 bg-white border border-amber-300 rounded-[6px] shadow-2xs">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={replaceFromUseStock}
                                    onChange={(e) => setReplaceFromUseStock(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded text-galla-teal focus:ring-galla-teal cursor-pointer"
                                  />
                                  <div className="text-[12px]">
                                    <span className="font-semibold text-galla-ink block">
                                      Replace from salon use-stock ({matchedProduct?.use} pcs available)
                                    </span>
                                    <span className="text-[11.5px] text-galla-ink-soft block mt-0.5 leading-snug">
                                      Take replacement unit immediately from salon internal station stock. No pickup scheduling needed.
                                    </span>
                                  </div>
                                </label>
                              </div>
                            )}

                            {replaceFromUseStock ? (
                              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-[6px] text-emerald-950 text-[12px] flex items-center gap-2 shadow-2xs">
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                                <span>
                                  Ready for immediate handover! {parsedQty} unit{parsedQty > 1 ? "s" : ""} will be deducted from salon station use-stock.
                                </span>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[12px] font-semibold text-galla-ink mb-1.5">
                                  Expected Client Pickup Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                  type="date"
                                  min={getLocalDateString()}
                                  value={expectedPickupDate}
                                  onChange={(e) => setExpectedPickupDate(e.target.value)}
                                  required
                                  className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors shadow-2xs"
                                />
                                <p className="text-[11px] text-amber-800/90 mt-1 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                  <span>An urgency alert will appear on the Overview tab 1 day before this date to inform the salon.</span>
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Case 4: Partial Stock */
                          <div className="p-4 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-950 text-[12.5px] font-sans space-y-3.5 shadow-2xs">
                            <div className="flex items-center gap-2 font-bold text-amber-900 text-[13.5px]">
                              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                              <span>Partial Stock Available ({samePriceStock} of {parsedQty} pcs)</span>
                            </div>
                            <p className="text-[12px] text-amber-800 leading-relaxed">
                              You can hand over available inventory now and schedule the remaining balance, or client can collect all items together.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setReplacementOption("immediate_partial")}
                                className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${replacementOption === "immediate_partial"
                                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                                    : "bg-white border-galla-line text-galla-ink-soft hover:bg-white/80"
                                  }`}
                              >
                                <div className="text-[12.5px] font-bold flex items-center justify-between">
                                  <span>Hand {samePriceStock} Now, Rest Later</span>
                                  {replacementOption === "immediate_partial" && <Check className="h-4 w-4 text-galla-teal" />}
                                </div>
                                <p className="text-[11px] text-galla-ink-soft mt-1 leading-snug">
                                  Client receives {samePriceStock} pcs today; remaining {parsedQty - samePriceStock} pcs upon restock.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => setReplacementOption("wait_all")}
                                className={`p-3 rounded-[6px] border text-left transition-all cursor-pointer ${replacementOption === "wait_all"
                                    ? "bg-white border-galla-teal ring-2 ring-galla-teal/20 text-galla-ink shadow-xs"
                                    : "bg-white border-galla-line text-galla-ink-soft hover:bg-white/80"
                                  }`}
                              >
                                <div className="text-[12.5px] font-bold flex items-center justify-between">
                                  <span>Wait for All ({parsedQty})</span>
                                  {replacementOption === "wait_all" && <Check className="h-4 w-4 text-galla-teal" />}
                                </div>
                                <p className="text-[11px] text-galla-ink-soft mt-1 leading-snug">
                                  Client will collect all {parsedQty} pcs once full order arrives.
                                </p>
                              </button>
                            </div>

                            <div>
                              <label className="block text-[12px] font-semibold text-galla-ink mb-1.5">
                                Expected Pickup Date for Remaining ({replacementOption === "immediate_partial" ? parsedQty - samePriceStock : parsedQty} pcs) <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="date"
                                min={getLocalDateString()}
                                value={expectedPickupDate}
                                onChange={(e) => setExpectedPickupDate(e.target.value)}
                                required
                                className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans tabular-nums text-[13.5px] font-medium text-galla-ink focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors shadow-2xs"
                              />
                              <p className="text-[11px] text-amber-800/90 mt-1 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                <span>An urgency alert will appear on the Overview tab 1 day before this date to inform the salon.</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Reason / Notes */}
              <div className="p-4 sm:p-5 bg-galla-surface border border-galla-line rounded-[8px] space-y-2 shadow-2xs">
                <label className="block text-[12px] font-semibold text-galla-ink">
                  Reason &amp; Return Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Defective nozzle, client preference change, damaged box during transit..."
                  className="w-full h-10 px-3 bg-white border border-galla-line rounded-[6px] font-sans text-[13.5px] font-medium text-galla-ink placeholder:text-galla-ink-soft/40 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Right Column: Live Summary & Submission (5 Cols) */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-0">
              {/* Live Summary Card */}
              <div className="p-4 sm:p-5 bg-galla-paper/50 border border-galla-line rounded-[8px] space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-galla-line/60 pb-3">
                  <Receipt className="h-4.5 w-4.5 text-galla-teal" />
                  <h4 className="text-[14px] font-bold text-galla-ink">
                    Return Summary &amp; Impact
                  </h4>
                </div>

                {/* Status Pills */}
                <div className="space-y-2 text-[12.5px] font-sans">
                  <div className="flex justify-between items-center py-1 border-b border-galla-line/40">
                    <span className="text-galla-ink-soft">Item:</span>
                    <span className="font-semibold text-galla-ink text-right truncate max-w-[200px]">
                      {parsedQty} &times; {lineItem.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-galla-line/40">
                    <span className="text-galla-ink-soft">Condition:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${isGoodCondition
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}>
                      {isGoodCondition ? "Good Condition" : "Defective / Damaged"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-galla-line/40">
                    <span className="text-galla-ink-soft">Stock Destination:</span>
                    <span className="font-semibold text-galla-ink">
                      {isGoodCondition
                        ? restockLocation === "sellStock"
                          ? "Retail Shelf"
                          : "Salon Treatment"
                        : "Defective Claim"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-galla-line/40">
                    <span className="text-galla-ink-soft">Resolution:</span>
                    <span className="font-semibold text-galla-ink">
                      {isGoodCondition
                        ? "Money Refund"
                        : defectiveResolution === "replacement"
                          ? isUpgradingToNewMRP
                            ? "New MRP Replacement"
                            : "Stock Replacement"
                          : "Money Refund"}
                    </span>
                  </div>
                </div>

                {/* Financial Box */}
                <div className="p-3.5 bg-white border border-galla-line rounded-[6px] space-y-2 text-[12.5px] shadow-2xs">
                  <div className="flex justify-between items-center text-galla-ink">
                    <span className="text-galla-ink-soft">Return Item Valuation:</span>
                    <span className="font-bold tabular-nums">{formatRupee(finalReturnAmount)}</span>
                  </div>

                  {/* If Refund Mode */}
                  {(isGoodCondition || defectiveResolution === "refund") && (
                    <>
                      {dueDeduction > 0 && (
                        <div className="flex justify-between items-center text-emerald-800">
                          <span>Applied to Pending Due:</span>
                          <span className="font-semibold tabular-nums">-{formatRupee(dueDeduction)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-galla-line/60">
                        <span className="font-bold text-galla-ink">Net Payout to Client:</span>
                        <span className={`font-bold tabular-nums text-[16px] ${cashRefund > 0 ? "text-rose-700" : "text-emerald-700"
                          }`}>
                          {formatRupee(cashRefund)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* If Replacement Mode */}
                  {!isGoodCondition && defectiveResolution === "replacement" && (
                    <>
                      {isUpgradingToNewMRP ? (
                        <>
                          <div className="flex justify-between items-center text-galla-ink">
                            <span className="text-galla-ink-soft">Replacement Unit MRP:</span>
                            <span className="font-semibold tabular-nums">{formatRupee(targetPrice * parsedQty)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-galla-line/60">
                            <span className="font-bold text-galla-ink">
                              {totalPriceDiff > 0 ? "Net Amount to Collect:" : totalPriceDiff < 0 ? "Net Refund to Client:" : "Net Difference:"}
                            </span>
                            <span className={`font-bold tabular-nums text-[16px] ${totalPriceDiff > 0 ? "text-amber-800" : totalPriceDiff < 0 ? "text-rose-700" : "text-emerald-700"
                              }`}>
                              {totalPriceDiff > 0 ? `+${formatRupee(totalPriceDiff)}` : totalPriceDiff < 0 ? `-${formatRupee(Math.abs(totalPriceDiff))}` : "₹0"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center pt-2 border-t border-galla-line/60">
                          <span className="font-bold text-galla-ink">Net Balance:</span>
                          <span className="font-bold tabular-nums text-[16px] text-emerald-700">₹0 (Even Exchange)</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Handover & Schedule Banner */}
                {!isGoodCondition && defectiveResolution === "replacement" && (
                  <div className="p-3 rounded-[6px] bg-galla-surface border border-galla-line text-[11.5px] space-y-1.5">
                    {handedQuantityPreview > 0 && (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          Immediate Handover: {handedQuantityPreview} unit(s)
                          {replaceFromUseStock ? " (from salon use-stock)" : ""}
                        </span>
                      </div>
                    )}
                    {!replaceFromUseStock && parsedQty - handedQuantityPreview > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                        <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Scheduled Pickup: {parsedQty - handedQuantityPreview} unit(s) on {expectedPickupDate}</span>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[6px] text-red-800 text-[12px] font-sans">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !isValidQty}
                    className="w-full py-2.5 px-4 rounded-[6px] bg-rose-700 hover:bg-rose-800 font-sans text-[13px] font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {isGoodCondition
                        ? pendingAmount > 0
                          ? cashRefund > 0
                            ? `Confirm Return (${formatRupee(dueDeduction)} Due + ${formatRupee(cashRefund)} Refund)`
                            : `Confirm Return & Clear ${formatRupee(dueDeduction)} Due`
                          : `Confirm Return & Refund (${formatRupee(finalReturnAmount)})`
                        : defectiveResolution === "replacement"
                          ? isUpgradingToNewMRP
                            ? totalPriceDiff > 0
                              ? `Confirm Replacement (Collect ${formatRupee(totalPriceDiff)})`
                              : totalPriceDiff < 0
                                ? `Confirm Replacement (Refund ${formatRupee(Math.abs(totalPriceDiff))})`
                                : "Confirm Replacement (₹0 Diff)"
                            : replaceFromUseStock
                              ? "Confirm Immediate Replacement"
                              : replacementResolutionType === "wait_original" || samePriceStock === 0
                                ? "Schedule Replacement"
                                : "Confirm Immediate Replacement"
                          : pendingAmount > 0
                            ? cashRefund > 0
                              ? `Confirm Return (${formatRupee(dueDeduction)} Due + ${formatRupee(cashRefund)} Refund)`
                              : `Confirm Return & Clear ${formatRupee(dueDeduction)} Due`
                            : `Confirm Refund (${formatRupee(finalReturnAmount)})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="w-full py-2 px-4 rounded-[6px] border border-galla-line font-sans text-[12.5px] font-semibold text-galla-ink-soft hover:text-galla-ink hover:bg-galla-surface transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
