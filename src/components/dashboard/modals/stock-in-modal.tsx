"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, IndianRupee, AlertCircle, Loader2, PackagePlus, Building2, Check } from "lucide-react";
import { DashboardProduct } from "@/types/dashboard";
import { createPurchaseOrderAction, searchSuppliersAction } from "@/app/dashboard/actions";
import { formatRupee, formatPhoneNumber } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: DashboardProduct[];
  onStockInSuccess: (updatedProducts: DashboardProduct[]) => void;
}

interface StockInItemDraft {
  productId: string;
  productName: string;
  quantityForSell: string;
  quantityForUse: string;
  purchaseCost: string;
  expectedSellPrice: string;
}

export function StockInModal({
  isOpen,
  onClose,
  products,
  onStockInSuccess,
}: StockInModalProps) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState<
    { id: string; name: string; phone: string; companyName?: string }[]
  >([]);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const supplierContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [dealerInvoiceNumber, setDealerInvoiceNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer" | "credit">("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");

  // Debounced supplier search (~300ms)
  React.useEffect(() => {
    const trimmed = supplierName.trim();
    if (!trimmed || selectedSupplierId) {
      setSupplierSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuppliers(true);
      try {
        const res = await searchSuppliersAction(trimmed);
        if (res.success && res.suppliers) {
          setSupplierSuggestions(res.suppliers);
          setIsSuggestionsOpen(res.suppliers.length > 0);
        } else {
          setSupplierSuggestions([]);
          setIsSuggestionsOpen(false);
        }
      } catch {
        setSupplierSuggestions([]);
        setIsSuggestionsOpen(false);
      } finally {
        setIsSearchingSuppliers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [supplierName, selectedSupplierId]);

  // Click outside listener for suggestions dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        supplierContainerRef.current &&
        !supplierContainerRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [items, setItems] = useState<StockInItemDraft[]>([
    {
      productId: products[0]?.id ? String(products[0].id) : "",
      productName: products[0]?.name || "",
      quantityForSell: "0",
      quantityForUse: "0",
      purchaseCost: products[0]?.purchaseCost !== undefined && products[0]?.purchaseCost !== null ? String(products[0].purchaseCost) : "0",
      expectedSellPrice: products[0]?.price ? String(products[0].price) : "0",
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form with clean zeroed defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setSupplierName("");
      setSupplierPhone("");
      setSelectedSupplierId(null);
      setDealerInvoiceNumber("");
      setPaymentMode("cash");
      setAmountPaid("");
      setNotes("");
      setErrorMsg(null);
      setShowConfirm(false);
      setItems([
        {
          productId: products[0]?.id ? String(products[0].id) : "",
          productName: products[0]?.name || "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost: products[0]?.purchaseCost !== undefined && products[0]?.purchaseCost !== null ? String(products[0].purchaseCost) : "0",
          expectedSellPrice: products[0]?.price ? String(products[0].price) : "0",
        },
      ]);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const handleProductSelect = (index: number, selectedId: string) => {
    const matched = products.find((p) => String(p.id) === selectedId);
    if (!matched) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              productId: String(matched.id),
              productName: matched.name,
              expectedSellPrice: matched.price ? String(matched.price) : "0",
              purchaseCost: matched.purchaseCost !== undefined && matched.purchaseCost !== null ? String(matched.purchaseCost) : "0",
            }
          : it
      )
    );
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof StockInItemDraft,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleAddItem = () => {
    const defaultProduct = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: defaultProduct ? String(defaultProduct.id) : "",
        productName: defaultProduct ? defaultProduct.name : "",
        quantityForSell: "0",
        quantityForUse: "0",
        purchaseCost: defaultProduct?.purchaseCost !== undefined && defaultProduct?.purchaseCost !== null ? String(defaultProduct.purchaseCost) : "0",
        expectedSellPrice: defaultProduct?.price ? String(defaultProduct.price) : "0",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCalculatedCost = items.reduce((sum, it) => {
    const qSell = Number(it.quantityForSell) || 0;
    const qUse = Number(it.quantityForUse) || 0;
    const cost = Number(it.purchaseCost) || 0;
    return sum + (qSell + qUse) * cost;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedSupplier = supplierName.trim();
    if (!trimmedSupplier) {
      setErrorMsg("Please enter supplier or distributor name");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Please add at least one item to this purchase order");
      return;
    }

    // Validate all items
    const parsedItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setErrorMsg(`Item #${i + 1} has no product selected`);
        return;
      }

      const qSell = Number(it.quantityForSell);
      const qUse = Number(it.quantityForUse);
      const cost = Number(it.purchaseCost);
      const sellPrice = Number(it.expectedSellPrice);

      if (isNaN(qSell) || qSell < 0 || !Number.isInteger(qSell)) {
        setErrorMsg(`Item #${i + 1} (${it.productName}): invalid sell quantity`);
        return;
      }

      if (isNaN(qUse) || qUse < 0 || !Number.isInteger(qUse)) {
        setErrorMsg(`Item #${i + 1} (${it.productName}): invalid use quantity`);
        return;
      }

      if (qSell + qUse <= 0) {
        setErrorMsg(`Item #${i + 1} (${it.productName}): total quantity must be at least 1`);
        return;
      }

      if (isNaN(cost) || cost < 0) {
        setErrorMsg(`Item #${i + 1} (${it.productName}): invalid purchase cost`);
        return;
      }

      if (isNaN(sellPrice) || sellPrice < 0) {
        setErrorMsg(`Item #${i + 1} (${it.productName}): invalid expected sell price`);
        return;
      }

      parsedItems.push({
        productId: it.productId,
        productName: it.productName,
        quantityForSell: qSell,
        quantityForUse: qUse,
        purchaseCost: cost,
        expectedSellPrice: sellPrice,
      });
    }

    let parsedPaid: number;
    if (amountPaid === "") {
      parsedPaid = paymentMode === "credit" ? 0 : totalCalculatedCost;
    } else {
      parsedPaid = Number(amountPaid);
    }
    if (isNaN(parsedPaid) || parsedPaid < 0) {
      setErrorMsg("Please enter a valid non-negative amount paid");
      return;
    }

    setShowConfirm(true);
  };

  const executeStockIn = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const trimmedSupplier = supplierName.trim();
      const parsedItems = items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantityForSell: Number(it.quantityForSell),
        quantityForUse: Number(it.quantityForUse),
        purchaseCost: Number(it.purchaseCost),
        expectedSellPrice: Number(it.expectedSellPrice),
      }));

      let parsedPaid: number;
      if (amountPaid === "") {
        parsedPaid = paymentMode === "credit" ? 0 : totalCalculatedCost;
      } else {
        parsedPaid = Number(amountPaid);
      }

      const res = await createPurchaseOrderAction({
        supplierId: selectedSupplierId || undefined,
        supplierName: trimmedSupplier,
        supplierPhone: supplierPhone.trim() ? formatPhoneNumber(supplierPhone) : undefined,
        dealerInvoiceNumber: dealerInvoiceNumber.trim() || undefined,
        items: parsedItems,
        paymentMode,
        amountPaid: parsedPaid,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.updatedProducts) {
        onStockInSuccess(res.updatedProducts);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to record purchase entry");
      }
    } catch {
      setErrorMsg("Network error occurred during purchase entry");
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
      <div className="w-full max-w-[620px] max-h-[92vh] flex flex-col bg-galla-surface border border-galla-line rounded-[5px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-[21px] py-[16px] border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                Stock In (Purchase Order Entry)
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Add inventory batch from dealer with atomic stock allocation
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-[21px] space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[13px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div ref={supplierContainerRef} className="sm:col-span-1 relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
                  Supplier <span className="text-red-600">*</span>
                </label>
                {isSearchingSuppliers && (
                  <span className="flex items-center gap-1 text-[11px] text-galla-teal font-sans">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    <span>Searching...</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setSelectedSupplierId(null);
                }}
                onFocus={() => {
                  if (supplierSuggestions.length > 0) setIsSuggestionsOpen(true);
                }}
                placeholder="Type supplier or company..."
                className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
                autoComplete="off"
              />

              {/* Suggestions Dropdown (Top 5-8 matches) */}
              {isSuggestionsOpen && supplierSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-galla-surface border border-galla-line rounded-[5px] shadow-lg divide-y divide-galla-line/60 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 bg-galla-paper/60 text-[10.5px] font-sans font-medium text-galla-ink-soft uppercase tracking-wider">
                    Existing Suppliers ({supplierSuggestions.length})
                  </div>
                  {supplierSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setSupplierName(s.name);
                        if (s.phone) setSupplierPhone(s.phone);
                        setSelectedSupplierId(s.id);
                        setIsSuggestionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-galla-paper/70 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-heading font-medium text-[13px] text-galla-ink truncate flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                          <span>{s.name}</span>
                          {s.companyName && (
                            <span className="text-[11px] font-sans text-galla-ink-soft truncate font-normal">
                              ({s.companyName})
                            </span>
                          )}
                        </div>
                        {s.phone && (
                          <div className="font-sans text-[11.5px] text-galla-ink-soft flex items-center gap-1 mt-0.5 ml-5">
                            <span>Phone: {s.phone}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-sans text-galla-teal font-medium bg-galla-teal-soft/40 px-2 py-0.5 rounded-[3px] shrink-0">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected existing indicator */}
              {selectedSupplierId && (
                <div className="flex items-center gap-1 mt-1 text-[11px] font-sans text-emerald-700">
                  <Check className="h-3 w-3" />
                  <span>Linked to existing supplier profile</span>
                </div>
              )}
            </div>

            <div>
              <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                Dealer Phone
              </label>
              <input
                type="tel"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                onBlur={() => {
                  if (supplierPhone.trim()) setSupplierPhone(formatPhoneNumber(supplierPhone));
                }}
                placeholder="+91 98250 00000"
                className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
              />
            </div>

            <div>
              <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider mb-1">
                Invoice / Bill #
              </label>
              <input
                type="text"
                value={dealerInvoiceNumber}
                onChange={(e) => setDealerInvoiceNumber(e.target.value)}
                placeholder="INV-2026-89"
                className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
              />
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
                Products In Batch
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-[12px] font-sans font-medium text-galla-teal hover:opacity-85 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Another Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-galla-paper/40 border border-galla-line rounded-[5px] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink font-medium focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none cursor-pointer"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Current: {p.sell} sell / {p.use} use)
                          </option>
                        ))}
                      </select>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-galla-ink-soft hover:text-red-700 rounded-[4px] transition-colors cursor-pointer"
                        title="Remove product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Quantity & Cost Grid */}
                  <div className="grid grid-cols-4 gap-2 text-[12px] font-sans">
                    <div>
                      <span className="text-galla-ink-soft block mb-0.5">+ Retail Sell</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantityForSell}
                        onChange={(e) =>
                          handleItemFieldChange(idx, "quantityForSell", e.target.value)
                        }
                        className="w-full px-2 py-1 rounded-[4px] bg-galla-surface border border-galla-line tabular-nums"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-galla-ink-soft block mb-0.5">+ Salon Use</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantityForUse}
                        onChange={(e) =>
                          handleItemFieldChange(idx, "quantityForUse", e.target.value)
                        }
                        className="w-full px-2 py-1 rounded-[4px] bg-galla-surface border border-galla-line tabular-nums"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-galla-ink-soft block mb-0.5">Unit Cost (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.purchaseCost}
                        onChange={(e) =>
                          handleItemFieldChange(idx, "purchaseCost", e.target.value)
                        }
                        className="w-full px-2 py-1 rounded-[4px] bg-galla-surface border border-galla-line tabular-nums"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-galla-ink-soft block mb-0.5">Sell Price (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.expectedSellPrice}
                        onChange={(e) =>
                          handleItemFieldChange(idx, "expectedSellPrice", e.target.value)
                        }
                        className="w-full px-2 py-1 rounded-[4px] bg-galla-surface border border-galla-line tabular-nums"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Summary */}
          <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px] space-y-3">
            <div className="flex items-center justify-between text-galla-ink">
              <span className="font-heading text-[13px] font-semibold uppercase tracking-wider">
                Total Batch Cost:
              </span>
              <span className="font-heading font-semibold text-[17px] text-galla-teal tabular-nums">
                {formatRupee(totalCalculatedCost)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-galla-line">
              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => {
                    const newMode = e.target.value as "cash" | "upi" | "card" | "bank_transfer" | "credit";
                    setPaymentMode(newMode);
                    if (newMode === "credit" && (amountPaid === "" || Number(amountPaid) === totalCalculatedCost)) {
                      setAmountPaid("0");
                    } else if (newMode !== "credit" && amountPaid === "0") {
                      setAmountPaid(String(totalCalculatedCost));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-paper/30 border border-galla-line font-sans text-[12px] text-galla-ink outline-none cursor-pointer"
                >
                  <option value="cash">Cash on desk</option>
                  <option value="upi">UPI</option>
                  <option value="credit">Pay later</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink mb-1">
                  Amount Paid Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={paymentMode === "credit" ? "0" : String(totalCalculatedCost)}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-galla-paper/30 border border-galla-line font-sans text-[12px] text-galla-ink outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Live Payment Status & Pending Calculation */}
            {(() => {
              const curPaid = amountPaid === "" ? (paymentMode === "credit" ? 0 : totalCalculatedCost) : Number(amountPaid) || 0;
              const pending = Math.max(0, totalCalculatedCost - curPaid);
              const status = curPaid >= totalCalculatedCost ? "paid" : curPaid <= 0 ? "unpaid" : "partial";

              return (
                <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-galla-line/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-galla-ink-soft">Status:</span>
                    {status === "paid" && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                        Paid (₹0 pending)
                      </span>
                    )}
                    {status === "partial" && (
                      <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                        Partial ({formatRupee(pending)} pending)
                      </span>
                    )}
                    {status === "unpaid" && (
                      <span className="bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                        {paymentMode === "credit" ? "Credit" : "Unpaid"} ({formatRupee(pending)} pending)
                      </span>
                    )}
                  </div>

                  <div className="font-sans font-medium text-galla-ink tabular-nums">
                    Pending: <span className={pending > 0 ? "text-amber-800 font-semibold" : "text-emerald-700"}>{formatRupee(pending)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

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
              disabled={isSubmitting || products.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSubmitting ? "Processing PO..." : "Confirm Stock In"}</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Confirm Stock In"
        description={
          <span>
            Record purchase order from <strong className="font-semibold text-galla-ink">&ldquo;{supplierName.trim()}&rdquo;</strong> for{" "}
            <strong className="font-semibold text-galla-ink">{items.length} item(s)</strong> totalling{" "}
            <strong className="font-semibold text-galla-ink">{formatRupee(totalCalculatedCost)}</strong> via{" "}
            <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong>?
            Inventory stock levels will be updated atomically.
          </span>
        }
        confirmLabel="Confirm & Record"
        isLoading={isSubmitting}
        onConfirm={executeStockIn}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
