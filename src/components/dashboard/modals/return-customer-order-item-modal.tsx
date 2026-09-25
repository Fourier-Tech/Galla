"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Undo2, ArrowRight } from "lucide-react";
import { DashboardOrder, DashboardOrderLineItem, DashboardPurchaseOrder } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";
import { returnCustomerOrderItemAction, getPurchaseOrdersForProductAction } from "@/app/dashboard/actions";

interface ReturnCustomerOrderItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DashboardOrder;
  lineItem: DashboardOrderLineItem;
  lineItemIndex: number;
  onSuccess: () => void;
}

export function ReturnCustomerOrderItemModal({
  isOpen,
  onClose,
  order,
  lineItem,
  lineItemIndex,
  onSuccess,
}: ReturnCustomerOrderItemModalProps) {
  const previouslyReturned = lineItem.returnedQuantity || 0;
  const availableToReturn = lineItem.quantity - previouslyReturned;

  const [quantity, setQuantity] = useState<string>("1");
  const [returnCondition, setReturnCondition] = useState<"restocked" | "defective_dealer_claim">("restocked");
  
  // New Step 1 fields
  const [customerResolution, setCustomerResolution] = useState<"refund" | "replacement">("refund");
  
  const [refundMode, setRefundMode] = useState<"cash" | "upi" | "card" | "reduce_due">(
    order.amount > order.paid ? "reduce_due" : "cash"
  );
  
  // Step 2 fields
  const [step, setStep] = useState<1 | 2>(1);
  const [pos, setPos] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [supplierRefundMode, setSupplierRefundMode] = useState<"reduce_due" | "replacement_pending">("reduce_due");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [customAmountStr, setCustomAmountStr] = useState<string>("");

  useEffect(() => {
    if (isOpen && lineItem) {
      const unitPrice = lineItem.finalPrice / lineItem.quantity;
      setQuantity("1");
      setCustomAmountStr(String(unitPrice));
      setReturnCondition("restocked");
      setCustomerResolution("refund");
      setRefundMode(order.amount > order.paid ? "reduce_due" : "cash");
      setError(null);
      setNotes("");
      setStep(1);
      setSelectedPOId(null);
      setPos([]);
    }
  }, [isOpen, lineItem, order]);

  useEffect(() => {
    if (isOpen && returnCondition === "defective_dealer_claim" && (lineItem.itemId || lineItem.name)) {
      setIsLoadingPOs(true);
      getPurchaseOrdersForProductAction(lineItem.itemId, lineItem.name).then((res: any) => {
        if (res.success && res.pos) {
          setPos(res.pos as any);
        }
        setIsLoadingPOs(false);
      });
    }
  }, [returnCondition, isOpen, lineItem.itemId, lineItem.name]);

  if (!isOpen) return null;

  const parsedQty = parseInt(quantity || "0", 10);
  const unitPrice = lineItem.finalPrice / lineItem.quantity;
  const defaultReturnTotal = isNaN(parsedQty) ? 0 : parsedQty * unitPrice;
  const finalReturnAmount = customAmountStr !== "" ? (parseFloat(customAmountStr) || 0) : defaultReturnTotal;
  
  const isValidQty = !isNaN(parsedQty) && parsedQty > 0 && parsedQty <= availableToReturn;
  const pendingAmount = order.amount - order.paid;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuantity(val);
    const qty = parseInt(val || "0", 10);
    if (!isNaN(qty)) {
      setCustomAmountStr(String(qty * unitPrice));
    } else {
      setCustomAmountStr("");
    }
  };

  const handleNext = () => {
    if (!isValidQty) return;
    if (returnCondition === "defective_dealer_claim") {
      setStep(2);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidQty) return;
    
    if (customerResolution === "refund" && refundMode === "reduce_due" && finalReturnAmount > pendingAmount) {
      setError(`Cannot deduct ${formatRupee(finalReturnAmount)} from due because the pending amount is only ${formatRupee(pendingAmount)}. Please select Cash/UPI/Card refund instead.`);
      return;
    }

    let supplierReturnDetails = undefined;
    if (returnCondition === "defective_dealer_claim") {
      if (!selectedPOId) {
        setError("Please select a Purchase Order to return the defective item to.");
        return;
      }
      
      const selectedPO = pos.find(p => p.id === selectedPOId);
      const availableInPO = selectedPO 
        ? (selectedPO.items || []).find(i => 
            (lineItem.itemId && i.productId === lineItem.itemId) || 
            (lineItem.name && i.productName && i.productName.trim().toLowerCase() === lineItem.name.trim().toLowerCase())
          )
        : null;
      const maxReturnForSelectedPO = availableInPO 
        ? (availableInPO.quantityForSell + availableInPO.quantityForUse) - (availableInPO.returnedQuantity || 0)
        : 0;

      if (parsedQty > maxReturnForSelectedPO) {
        setError(`You can only return up to ${maxReturnForSelectedPO} items to this specific Purchase Order. Please lower the quantity and process the remaining items in a separate return.`);
        return;
      }
      
      supplierReturnDetails = {
        poId: selectedPOId,
        refundMode: supplierRefundMode
      };
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
        notes,
        finalReturnAmount,
        customerResolution,
        supplierReturnDetails
      );

      if (!res.success) {
        throw new Error(res.error || "Failed to process return");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-galla-line">
          <div className="flex items-center gap-2 text-rose-600">
            <Undo2 className="h-5 w-5" />
            <h2 className="font-heading font-bold text-lg text-galla-ink">
              {step === 1 ? "Customer Return" : "Supplier Return (Defective)"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-galla-paper rounded-full transition-colors">
            <X className="h-5 w-5 text-galla-ink-soft" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {step === 1 && (
            <>
              <div className="mb-5 bg-rose-50/50 rounded-lg p-3 border border-rose-100">
                <h3 className="font-sans font-semibold text-galla-ink text-sm">{lineItem.name}</h3>
                <div className="text-xs text-galla-ink-soft mt-1">
                  Bought: {lineItem.quantity} &bull; Returned: {previouslyReturned} &bull; Available to return: {availableToReturn}
                </div>
                <div className="text-xs text-galla-ink-soft mt-1 font-mono">
                  Net Price: {formatRupee(unitPrice)} / unit
                </div>
              </div>

              <div className="space-y-5">
                {/* Quantity */}
                <div>
                  <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                    Quantity to Return
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={availableToReturn}
                    value={quantity}
                    onChange={handleQuantityChange}
                    className="w-full bg-white border border-galla-line rounded-lg px-3 py-2.5 text-[15px] text-galla-ink focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 transition-all font-mono"
                    required
                  />
                </div>

                {/* Return Condition */}
                <div>
                  <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                    Item Condition
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                         setReturnCondition("restocked");
                         setCustomerResolution("refund"); // Defaults to refund for good condition
                      }}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                        returnCondition === "restocked"
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                      }`}
                    >
                      <div className="font-semibold">Good Condition</div>
                      <div className="text-[11px] mt-0.5 opacity-80 font-normal">Add back to shelf</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnCondition("defective_dealer_claim")}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                        returnCondition === "defective_dealer_claim"
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                      }`}
                    >
                      <div className="font-semibold">Defective</div>
                      <div className="text-[11px] mt-0.5 opacity-80 font-normal">Return to supplier</div>
                    </button>
                  </div>
                </div>

                {/* Customer Resolution (Only if defective, else always refund) */}
                {returnCondition === "defective_dealer_claim" && (
                  <div>
                    <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                      Customer Wants
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomerResolution("refund")}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                          customerResolution === "refund"
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                        }`}
                      >
                        <div className="font-semibold">Money Refund</div>
                        <div className="text-[11px] mt-0.5 opacity-80 font-normal">Give money back</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerResolution("replacement")}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                          customerResolution === "replacement"
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                        }`}
                      >
                        <div className="font-semibold">Replacement</div>
                        <div className="text-[11px] mt-0.5 opacity-80 font-normal">Give new working item</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Refund Mode (Only if customer wants a refund) */}
                {customerResolution === "refund" && (
                  <div>
                    <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Refund Customer via</span>
                      <span className="text-rose-600 font-mono text-xs">{formatRupee(finalReturnAmount)}</span>
                    </label>
                    <select
                      value={refundMode}
                      onChange={(e) => setRefundMode(e.target.value as any)}
                      className="w-full bg-white border border-galla-line rounded-lg px-3 py-2 text-sm text-galla-ink font-medium focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 transition-all cursor-pointer"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      {pendingAmount > 0 && (
                        <option value="reduce_due">Reduce Due ({formatRupee(pendingAmount)} pending)</option>
                      )}
                    </select>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                    Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Scratched, expired, customer changed mind..."
                    className="w-full bg-white border border-galla-line rounded-lg px-3 py-2 text-sm text-galla-ink focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-50 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Select Original Supplier Bill
                </label>
                {isLoadingPOs ? (
                  <div className="flex items-center justify-center p-8 border border-dashed border-galla-line rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                  </div>
                ) : pos.length === 0 ? (
                  <div className="p-4 border border-dashed border-galla-line rounded-lg text-center text-sm text-galla-ink-soft">
                    No purchase orders found containing this product.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {pos.map((po) => {
                      const item = (po.items || []).find(i => 
                        (lineItem.itemId && i.productId === lineItem.itemId) || 
                        (lineItem.name && i.productName && i.productName.trim().toLowerCase() === lineItem.name.trim().toLowerCase())
                      );
                      if (!item) return null;
                      const maxRet = (item.quantityForSell + item.quantityForUse) - (item.returnedQuantity || 0);
                      const isDisabled = maxRet < parsedQty;

                      return (
                        <button
                          key={po.id}
                          type="button"
                          onClick={() => {
                            if (!isDisabled) setSelectedPOId(po.id);
                          }}
                          disabled={isDisabled}
                          className={`w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center ${
                            selectedPOId === po.id
                              ? "bg-rose-50 border-rose-300"
                              : isDisabled 
                                ? "bg-galla-paper border-galla-line opacity-50 cursor-not-allowed"
                                : "bg-white border-galla-line hover:border-rose-200"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-galla-ink">{po.supplierName}</div>
                            <div className="text-xs text-galla-ink-soft flex items-center gap-2 mt-0.5">
                              <span className="font-mono">{po.purchaseOrderNumber}</span>
                              <span>&bull;</span>
                              <span>{new Date(po.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-galla-ink">{formatRupee(item.purchaseCost)}</div>
                            <div className={`text-[10px] font-medium ${maxRet < parsedQty ? "text-rose-500" : "text-emerald-600"}`}>
                              Max: {maxRet}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                  Supplier Credit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierRefundMode("reduce_due")}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                      supplierRefundMode === "reduce_due"
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="font-semibold">Reduce Due</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierRefundMode("replacement_pending")}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                      supplierRefundMode === "replacement_pending"
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-white border-galla-line text-galla-ink-soft hover:bg-galla-paper"
                    }`}
                  >
                    <div className="font-semibold">Wait for Replacement</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-galla-line bg-galla-paper/50 flex items-center justify-between gap-3">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => {
                 setStep(1);
                 setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-galla-ink-soft hover:text-galla-ink transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          
          <button
            type="button"
            onClick={step === 1 ? handleNext : () => handleSubmit()}
            disabled={isSubmitting || !isValidQty || (step === 2 && !selectedPOId)}
            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : step === 1 && returnCondition === "defective_dealer_claim" ? (
              <>
                <span>Next: Select Supplier</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <span>Confirm Return</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
