"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  PackagePlus,
  Building2,
  Check,
  Calendar,
  Banknote,
  QrCode,
  CreditCard,
  Landmark,
  Sparkles,
} from "lucide-react";
import {
  DashboardProduct,
  DashboardSupplier,
  DashboardPurchaseOrder,
  DashboardExpense,
} from "@/types/dashboard";
import { createPurchaseOrderAction, getSuppliersAction } from "@/app/dashboard/actions";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  getLocalDateString,
} from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: DashboardProduct[];
  suppliers?: DashboardSupplier[];
  onStockInSuccess: (
    updatedProducts: DashboardProduct[],
    createdPO?: DashboardPurchaseOrder,
    newExpense?: DashboardExpense,
    updatedSupplier?: DashboardSupplier
  ) => void;
}

interface StockInItemDraft {
  productId: string;
  productName: string;
  isNewProduct: boolean;
  category: string;
  customCategory: string;
  quantityForSell: string;
  quantityForUse: string;
  purchaseCost: string;
  expectedSellPrice: string;
}

export function StockInModal({
  isOpen,
  onClose,
  products,
  suppliers = [],
  onStockInSuccess,
}: StockInModalProps) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [internalSuppliers, setInternalSuppliers] = useState<DashboardSupplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const supplierInputRef = useRef<HTMLInputElement | null>(null);
  const [dealerInvoiceNumber, setDealerInvoiceNumber] = useState("");

  // Settlement Mode & Payment states
  const [settlementMode, setSettlementMode] = useState<"completed" | "pending" | "advance" | "paid_full">("completed");
  const [payLaterPaid, setPayLaterPaid] = useState("");
  const [advance, setAdvance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash");
  const [notes, setNotes] = useState("");

  // Preload suppliers once if not passed in props (fallback)
  useEffect(() => {
    if (suppliers.length > 0) return;
    let ignore = false;
    getSuppliersAction()
      .then((res) => {
        if (!ignore && res.success && res.suppliers) {
          setInternalSuppliers(res.suppliers);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [suppliers]);

  const allSuppliers = suppliers.length > 0 ? suppliers : internalSuppliers;

  // Filter suppliers in-memory by name query — identical to customer search in NewOrderModal (0ms, 0 network requests)
  const filteredSuppliers = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (!query || allSuppliers.length === 0) return [];

    return allSuppliers
      .filter(
        (s) =>
          s &&
          s.name &&
          (s.name.toLowerCase().includes(query) ||
            (s.companyName && s.companyName.toLowerCase().includes(query)))
      )
      .slice(0, 5);
  }, [supplierName, allSuppliers]);

  // Warn if phone matches an existing supplier with a different name
  const phoneConflictSupplier = useMemo(() => {
    const digits = supplierPhone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10 || !supplierName.trim()) return null;
    return allSuppliers.find((s) => {
      const sDigits = (s.phone || "").replace(/\D/g, "").slice(-10);
      return sDigits === digits && s.name.trim().toLowerCase() !== supplierName.trim().toLowerCase();
    }) || null;
  }, [supplierPhone, supplierName, allSuppliers]);

  // Unique list of categories from active database products
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats).sort();
  }, [products]);

  // Click outside listener for suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        supplierInputRef.current &&
        !supplierInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createInitialDraftItem = useCallback(
    (prodList: DashboardProduct[]): StockInItemDraft => {
      if (prodList.length > 0) {
        const p = prodList[0];
        return {
          productId: String(p.id),
          productName: p.name || "",
          isNewProduct: false,
          category: p.category || (availableCategories[0] ?? "General"),
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost:
            p.purchaseCost !== undefined && p.purchaseCost !== null ? String(p.purchaseCost) : "0",
          expectedSellPrice: p.price ? String(p.price) : "0",
        };
      }
      return {
        productId: "__new__",
        productName: "",
        isNewProduct: true,
        category: availableCategories[0] ?? "General",
        customCategory: "",
        quantityForSell: "0",
        quantityForUse: "0",
        purchaseCost: "0",
        expectedSellPrice: "0",
      };
    },
    [availableCategories]
  );

  const [items, setItems] = useState<StockInItemDraft[]>([createInitialDraftItem(products)]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form with clean defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setSupplierName("");
      setSupplierPhone("");
      setSelectedSupplierId(null);
      setDealerInvoiceNumber("");
      setSettlementMode("completed");
      setPayLaterPaid("");
      setAdvance("");
      setDueDate("");
      setExpectedDeliveryDate("");
      setDeliveryTime("");
      setPaymentMode("cash");
      setNotes("");
      setErrorMsg(null);
      setShowConfirm(false);
      setItems([createInitialDraftItem(products)]);
    }
  }, [isOpen, products, createInitialDraftItem]);

  const handleProductSelect = (index: number, selectedId: string) => {
    if (selectedId === "__new__") {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                productId: "__new__",
                productName: "",
                isNewProduct: true,
                category: availableCategories[0] ?? "General",
                customCategory: "",
                expectedSellPrice: "0",
                purchaseCost: "0",
              }
            : it
        )
      );
      return;
    }

    if (selectedId !== "__new__") {
      const alreadySelected = items.some((it, i) => i !== index && it.productId === selectedId);
      if (alreadySelected) {
        setErrorMsg("This product is already added to this purchase order. Please increase its quantity instead.");
        return;
      }
      setErrorMsg(null);
    }

    const matched = products.find((p) => String(p.id) === selectedId);
    if (!matched) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              productId: String(matched.id),
              productName: matched.name,
              isNewProduct: false,
              category: matched.category || (availableCategories[0] ?? "General"),
              customCategory: "",
              expectedSellPrice: matched.price ? String(matched.price) : "0",
              purchaseCost:
                matched.purchaseCost !== undefined && matched.purchaseCost !== null
                  ? String(matched.purchaseCost)
                  : "0",
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
    setErrorMsg(null);
    const selectedIds = new Set(
      items
        .map((it) => it.productId)
        .filter((id) => id && id !== "__new__")
    );
    const unselectedProd = products.find((p) => !selectedIds.has(String(p.id)));

    if (unselectedProd) {
      setItems((prev) => [
        ...prev,
        {
          productId: String(unselectedProd.id),
          productName: unselectedProd.name || "",
          isNewProduct: false,
          category: unselectedProd.category || (availableCategories[0] ?? "General"),
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost:
            unselectedProd.purchaseCost !== undefined && unselectedProd.purchaseCost !== null
              ? String(unselectedProd.purchaseCost)
              : "0",
          expectedSellPrice: unselectedProd.price ? String(unselectedProd.price) : "0",
        },
      ]);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: "__new__",
          productName: "",
          isNewProduct: true,
          category: availableCategories[0] ?? "General",
          customCategory: "",
          quantityForSell: "0",
          quantityForUse: "0",
          purchaseCost: "0",
          expectedSellPrice: "0",
        },
      ]);
    }
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

  const enteredPayLaterPaid = Number(payLaterPaid) || 0;
  const enteredAdvance = Number(advance) || 0;

  const currentAmountPaid =
    settlementMode === "completed" || settlementMode === "paid_full"
      ? totalCalculatedCost
      : settlementMode === "pending"
      ? Math.min(totalCalculatedCost, enteredPayLaterPaid)
      : settlementMode === "advance"
      ? Math.min(totalCalculatedCost, enteredAdvance)
      : 0;

  const amountPending = Math.max(0, totalCalculatedCost - currentAmountPaid);

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

    // Guard: Prevent duplicate products in the purchase order
    const seenProductKeys = new Map<string, string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let key = "";
      const displayName = it.productName.trim() || `Item #${i + 1}`;

      if (!it.isNewProduct && it.productId && it.productId !== "__new__") {
        key = `id:${it.productId}`;
      } else if (it.productName.trim()) {
        key = `name:${it.productName.trim().toLowerCase()}`;
      }

      if (key) {
        if (seenProductKeys.has(key)) {
          setErrorMsg(
            `Duplicate product "${displayName}": You cannot enter the same product multiple times in a single PO. Please adjust the quantities in a single row instead.`
          );
          return;
        }
        seenProductKeys.set(key, displayName);
      }

      // If new product has the same name as an existing catalog product that's also in the PO
      if (it.isNewProduct && it.productName.trim()) {
        const matchingExisting = products.find(
          (p) => p.name.trim().toLowerCase() === it.productName.trim().toLowerCase()
        );
        if (matchingExisting) {
          const existingKey = `id:${matchingExisting.id}`;
          if (seenProductKeys.has(existingKey)) {
            setErrorMsg(
              `Duplicate product "${it.productName.trim()}": Already selected from catalog in another row. Please adjust its quantities instead.`
            );
            return;
          }
          seenProductKeys.set(existingKey, matchingExisting.name);
        }
      }
    }

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.isNewProduct) {
        if (!it.productName.trim()) {
          setErrorMsg(`Item #${i + 1}: Please enter the name for the new product`);
          return;
        }

        // Check if new product name already exists in inventory (matching Add New Product modal)
        const matchingExisting = products.find(
          (p) => p.isActive !== false && p.name.trim().toLowerCase() === it.productName.trim().toLowerCase()
        );
        if (matchingExisting) {
          setErrorMsg(
            `Item #${i + 1}: A product with this name already exists ("${matchingExisting.name}"). Please select it from the Catalog Products dropdown instead of adding as new.`
          );
          return;
        }

        const resolvedCategory =
          it.category === "custom" ? it.customCategory.trim() : it.category.trim();
        if (!resolvedCategory) {
          setErrorMsg(
            `Item #${i + 1} (${it.productName || "New Product"}): Please select or specify a category`
          );
          return;
        }
      } else if (!it.productId) {
        setErrorMsg(`Item #${i + 1} has no product selected`);
        return;
      }

      const qSell = Number(it.quantityForSell);
      const qUse = Number(it.quantityForUse);
      const cost = Number(it.purchaseCost);
      const sellPrice = Number(it.expectedSellPrice);

      if (isNaN(qSell) || qSell < 0 || !Number.isInteger(qSell)) {
        setErrorMsg(`Item #${i + 1} (${it.productName || "Product"}): invalid sell quantity`);
        return;
      }

      if (isNaN(qUse) || qUse < 0 || !Number.isInteger(qUse)) {
        setErrorMsg(`Item #${i + 1} (${it.productName || "Product"}): invalid use quantity`);
        return;
      }

      if (qSell + qUse <= 0) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): total quantity must be at least 1`
        );
        return;
      }

      if (isNaN(cost) || cost < 0) {
        setErrorMsg(`Item #${i + 1} (${it.productName || "Product"}): invalid purchase cost`);
        return;
      }

      if (isNaN(sellPrice) || sellPrice < 0) {
        setErrorMsg(
          `Item #${i + 1} (${it.productName || "Product"}): invalid expected sell price`
        );
        return;
      }
    }

    // Settlement validations
    if (settlementMode === "advance") {
      if (enteredAdvance <= 0) {
        setErrorMsg("Please enter an advance deposit amount greater than 0");
        return;
      }
      if (enteredAdvance >= totalCalculatedCost) {
        setErrorMsg(
          "Advance amount cannot equal or exceed total batch cost. Use 'Completed' or 'Paid in Full' instead."
        );
        return;
      }
      if (!expectedDeliveryDate) {
        setErrorMsg("Please select expected arrival date for this advance order");
        return;
      }
    }

    if (settlementMode === "paid_full" && !expectedDeliveryDate) {
      setErrorMsg("Please select expected arrival date for this order");
      return;
    }

    if (settlementMode === "pending" && enteredPayLaterPaid > totalCalculatedCost) {
      setErrorMsg(
        `Amount paid now cannot exceed total batch cost of ${formatRupee(totalCalculatedCost)}`
      );
      return;
    }

    setShowConfirm(true);
  };

  const executeStockIn = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Use user-entered supplier name; fallback to conflict supplier or empty
      const trimmedSupplier = supplierName.trim() || phoneConflictSupplier?.name || "";
      const parsedItems = items.map((it) => ({
        productId: it.isNewProduct ? undefined : it.productId,
        isNewProduct: it.isNewProduct,
        productName: it.productName.trim(),
        category: it.isNewProduct
          ? (it.category === "custom" ? it.customCategory.trim() : it.category.trim()) ||
            "General"
          : it.category,
        quantityForSell: Number(it.quantityForSell),
        quantityForUse: Number(it.quantityForUse),
        purchaseCost: Number(it.purchaseCost),
        expectedSellPrice: Number(it.expectedSellPrice),
      }));

      const res = await createPurchaseOrderAction({
        supplierId: phoneConflictSupplier ? phoneConflictSupplier.id : (selectedSupplierId || undefined),
        supplierName: trimmedSupplier,
        supplierPhone: supplierPhone.trim() ? formatPhoneNumber(supplierPhone) : undefined,
        dealerInvoiceNumber: dealerInvoiceNumber.trim() || undefined,
        items: parsedItems,
        settlementMode,
        dueDate: settlementMode === "pending" && dueDate ? dueDate : undefined,
        expectedDeliveryDate:
          (settlementMode === "advance" || settlementMode === "paid_full") && expectedDeliveryDate
            ? expectedDeliveryDate
            : undefined,
        deliveryTime:
          (settlementMode === "advance" || settlementMode === "paid_full") && deliveryTime
            ? deliveryTime
            : undefined,
        paymentMode: currentAmountPaid > 0 ? paymentMode : "credit",
        amountPaid: currentAmountPaid,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.updatedProducts) {
        onStockInSuccess(
          res.updatedProducts,
          res.purchaseOrder,
          res.newExpense,
          res.updatedSupplier
        );
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[660px] max-h-[92vh] flex flex-col bg-galla-surface border border-galla-line rounded-[5px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

        {/* Form Body - Single Screen (Non-Wizard) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-[21px] space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[13px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Supplier Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
                  Supplier <span className="text-red-600">*</span>
                </label>
              </div>
              <input
                ref={supplierInputRef}
                type="text"
                autoFocus
                required
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setSelectedSupplierId(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (supplierName.trim().length > 0) setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                placeholder="Type supplier or company..."
                className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
                autoComplete="off"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && filteredSuppliers.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 z-50 mt-1 w-full sm:w-[320px] min-w-full max-h-56 overflow-y-auto bg-galla-surface border border-galla-line rounded-[5px] shadow-lg divide-y divide-galla-line/60 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-2.5 py-1 bg-galla-paper/60 text-[10.5px] font-sans font-medium text-galla-ink-soft uppercase tracking-wider">
                    Existing Suppliers ({filteredSuppliers.length})
                  </div>
                  {filteredSuppliers.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSupplierName(s.name);
                        if (s.phone) setSupplierPhone(s.phone);
                        setSelectedSupplierId(s.id);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-galla-paper/80 flex flex-col gap-0.5 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <Building2 className="h-3.5 w-3.5 text-galla-teal shrink-0" />
                        <span className="font-heading font-medium text-[13px] text-galla-ink group-hover:text-galla-teal transition-colors">
                          {s.name}
                        </span>
                        {s.companyName && (
                          <span className="text-[11.5px] font-sans text-galla-ink-soft font-normal">
                            ({s.companyName})
                          </span>
                        )}
                      </div>
                      {s.phone && (
                        <span className="font-mono text-[11.5px] text-galla-ink-soft pl-5">
                          {s.phone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

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
                className={`w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border font-sans text-[13px] text-galla-ink focus:ring-1 outline-none transition-all ${phoneConflictSupplier ? "border-amber-400 focus:border-amber-500 focus:ring-amber-400" : "border-galla-line focus:border-galla-teal focus:ring-galla-teal"}`}
              />
              {phoneConflictSupplier && (
                <div className="flex items-start gap-1.5 mt-1 p-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] rounded-[4px] font-sans">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <div className="leading-tight">
                    <span>This number is registered to </span>
                    <strong>{phoneConflictSupplier.name}</strong>{phoneConflictSupplier.companyName ? ` (${phoneConflictSupplier.companyName})` : ""}.
                    <span> Creating this bill will update the supplier name to </span>
                    <strong>{supplierName.trim() || phoneConflictSupplier.name}</strong>
                    <span> permanently.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierName(phoneConflictSupplier.name);
                        setSelectedSupplierId(phoneConflictSupplier.id);
                      }}
                      className="ml-1.5 underline font-medium text-amber-800 hover:text-amber-900 cursor-pointer"
                    >
                      Keep {phoneConflictSupplier.name}
                    </button>
                  </div>
                </div>
              )}
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

          {/* 2. Products In Batch List */}
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

            <div className="space-y-3">
              {items.map((item, idx) => {
                const qSell = Number(item.quantityForSell) || 0;
                const qUse = Number(item.quantityForUse) || 0;
                const cost = Number(item.purchaseCost) || 0;
                const itemTotal = (qSell + qUse) * cost;

                const isDuplicate = items.some(
                  (other, otherIdx) =>
                    otherIdx !== idx &&
                    ((!item.isNewProduct && !other.isNewProduct && item.productId === other.productId) ||
                     (Boolean(item.productName.trim()) && Boolean(other.productName.trim()) && item.productName.trim().toLowerCase() === other.productName.trim().toLowerCase()))
                );

                const trimmedNewName = item.productName.trim().toLowerCase();
                const existingInventoryProduct =
                  item.isNewProduct && trimmedNewName && products.length > 0
                    ? products.find((p) => p.isActive !== false && p.name.trim().toLowerCase() === trimmedNewName)
                    : null;
                const duplicateWarning = existingInventoryProduct
                  ? "A product with this name already exists."
                  : null;

                return (
                  <div
                    key={idx}
                    className={`p-3 bg-galla-paper/40 border rounded-[5px] space-y-2.5 transition-colors ${
                      isDuplicate ? "border-red-300 bg-red-50/20" : "border-galla-line"
                    }`}
                  >
                    {/* Product Selection Dropdown + Remove button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <select
                          value={item.isNewProduct ? "__new__" : item.productId}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-[4px] bg-galla-surface border font-sans text-[13px] text-galla-ink font-medium focus:ring-1 outline-none cursor-pointer ${
                            isDuplicate
                              ? "border-red-400 focus:border-red-500 focus:ring-red-400"
                              : "border-galla-line focus:border-galla-teal focus:ring-galla-teal"
                          }`}
                        >
                          {products.length > 0 && (
                            <optgroup label="Catalog Products">
                              {products.map((p) => {
                                const isSelectedElsewhere = items.some(
                                  (other, otherIdx) =>
                                    otherIdx !== idx && other.productId === String(p.id)
                                );
                                return (
                                  <option
                                    key={p.id}
                                    value={p.id}
                                    disabled={isSelectedElsewhere}
                                    className={isSelectedElsewhere ? "text-galla-ink-soft/40 italic bg-gray-50" : ""}
                                  >
                                    {p.name} {isSelectedElsewhere ? "(Already added)" : `(Current: ${p.sell} sell / ${p.use} use)`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          <optgroup label="New Product Entry">
                            <option value="__new__">✨ + Add New Product...</option>
                          </optgroup>
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

                    {isDuplicate && (
                      <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 text-red-700 text-[11.5px] rounded-[4px] font-sans">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span>Duplicate product: already added in another row. Adjust quantities instead.</span>
                      </div>
                    )}

                    {/* New Product Inline Card (Shown when "+ Add New Product..." is selected) */}
                    {item.isNewProduct && (
                      <div className="p-2.5 bg-galla-teal-soft/25 border border-galla-teal/30 rounded-[4px] space-y-2 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-semibold text-galla-teal uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" />
                            <span>New Product Details</span>
                          </span>
                          <span className="text-[10.5px] font-sans text-galla-ink-soft">
                            Will be automatically created in catalog
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                          <div>
                            <label className="block font-sans font-medium text-galla-ink mb-0.5">
                              Product Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={item.productName}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "productName", e.target.value)
                              }
                              placeholder="e.g. L'Oreal Serum 100ml"
                              className={`w-full px-2.5 py-1.5 rounded-[4px] bg-galla-surface border font-sans text-[12.5px] text-galla-ink outline-none transition-all ${
                                duplicateWarning
                                  ? "border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                  : "border-galla-line focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                              }`}
                            />

                            {/* Real-time Inline Duplicate Warning (Matches Add New Product Modal) */}
                            {duplicateWarning && (
                              <div className="font-sans text-[11.5px] text-amber-800 bg-amber-50/90 border border-amber-200 rounded px-2.5 py-1 mt-1.5 flex items-center justify-between gap-1.5 animate-in fade-in duration-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                  <span>{duplicateWarning}</span>
                                </div>
                                {existingInventoryProduct && (
                                  <button
                                    type="button"
                                    onClick={() => handleProductSelect(idx, String(existingInventoryProduct.id))}
                                    className="shrink-0 text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 cursor-pointer ml-1"
                                    title={`Select "${existingInventoryProduct.name}" from catalog`}
                                  >
                                    Select from catalog
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block font-sans font-medium text-galla-ink mb-0.5">
                              Category <span className="text-red-600">*</span>
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "category", e.target.value)
                              }
                              className="w-full px-2.5 py-1 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12.5px] text-galla-ink focus:border-galla-teal outline-none cursor-pointer"
                            >
                              {availableCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              <option value="custom">+ New Category...</option>
                            </select>
                          </div>
                        </div>

                        {/* Custom Category Input if "+ New Category..." is selected */}
                        {item.category === "custom" && (
                          <div className="text-[12px]">
                            <label className="block font-sans font-medium text-galla-ink mb-0.5">
                              Custom Category Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              autoFocus
                              value={item.customCategory}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "customCategory", e.target.value)
                              }
                              placeholder="Type new category name (e.g. Organic Hair Care)..."
                              className="w-full px-2.5 py-1 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12.5px] text-galla-ink focus:border-galla-teal outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

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

                    {(() => {
                      const matched = products.find((p) => String(p.id) === item.productId);
                      const isPriceChanged =
                        matched &&
                        ((matched.price !== undefined && Number(item.expectedSellPrice) !== matched.price) ||
                          (matched.purchaseCost !== undefined && Number(item.purchaseCost) !== matched.purchaseCost));
                      if (!isPriceChanged) return null;
                      return (
                        <div className="mt-1 text-[11.5px] font-sans text-blue-800 bg-blue-50/80 border border-blue-200/80 px-2 py-1 rounded-[4px]">
                          ✨ <strong>New Price Detected:</strong> Incoming stock will be automatically saved as a separate <em>(New)</em> batch, leaving current stock as <em>(Old)</em>.
                        </div>
                      );
                    })()}

                    {/* Line item subtotal */}
                    <div className="flex items-center justify-between text-[11.5px] pt-1 text-galla-ink-soft border-t border-galla-line/60">
                      <span>Total: {qSell + qUse} units</span>
                      <span className="font-medium text-galla-ink tabular-nums">
                        Subtotal: {formatRupee(itemTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Settlement Mode Section (Mirrors Order Modal) */}
          <div className="pt-2 space-y-3">
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                Settlement Mode <span className="text-red-500">*</span>
              </label>
              <select
                value={settlementMode}
                onChange={(e) =>
                  setSettlementMode(
                    e.target.value as "completed" | "pending" | "advance" | "paid_full"
                  )
                }
                className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-3 py-2 text-[13px] font-sans font-medium text-galla-ink focus:outline-none focus:border-galla-teal transition-all cursor-pointer shadow-2xs"
              >
                <option value="completed">Completed (Paid in full now)</option>
                <option value="pending">Pending / Pay Later (Stock received, payment due)</option>
                <option value="advance">Advance (Partial deposit, delivery later)</option>
                <option value="paid_full">Paid in Full (100% upfront, delivery later)</option>
              </select>
            </div>

            {/* Pending / Pay Later / Due Card */}
            {settlementMode === "pending" && (
              <div className="p-3 rounded-[6px] space-y-2.5 border bg-amber-50/40 border-amber-300/50">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11.5px] font-medium text-galla-ink">
                      Amount Paid Now (₹) <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11.5px] font-sans text-galla-ink-soft">
                      Pending Due: <strong className="text-rose-700 font-semibold">{formatRupee(amountPending)}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={payLaterPaid}
                    onChange={(e) => setPayLaterPaid(e.target.value.replace(/\D/g, ""))}
                    placeholder={`0 (Full ${formatRupee(totalCalculatedCost)} due later)`}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[13px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                {/* Optional Expected Payment Due Date */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11.5px] font-medium text-galla-ink">
                      Expected Payment Due Date <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                    </label>
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => setDueDate("")}
                        className="text-[10.5px] text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    min={getLocalDateString()}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
                  />
                </div>

                <div className="text-[11.5px] text-galla-ink-soft pt-1 leading-snug">
                  ℹ️ Purchase order will be recorded with <strong className="text-amber-800 font-semibold">Payment Due</strong>. You can settle the remaining balance anytime in the Suppliers / Bills tab.
                </div>
              </div>
            )}

            {/* Advance / Paid in Full Details Card */}
            {(settlementMode === "advance" || settlementMode === "paid_full") && (
              <div
                className={`p-3 rounded-[6px] space-y-2.5 border ${
                  settlementMode === "advance"
                    ? "bg-galla-brass-soft/40 border-galla-brass/30"
                    : "bg-galla-teal-soft/40 border-galla-teal/30"
                }`}
              >
                <div className="space-y-2.5">
                  {/* Advance Amount (only for partial deposit) */}
                  {settlementMode === "advance" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11.5px] font-medium text-galla-ink">
                          Advance Paid (₹) <span className="text-red-500">*</span>
                        </label>
                        {advance.trim() !== "" && Number(advance) > 0 && (
                          <span className="text-[11px] font-sans text-galla-ink-soft">
                            Pending: <strong className="text-red-700">{formatRupee(amountPending)}</strong>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={advance}
                        onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g. 500"
                        className="w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[13px] font-heading font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-brass transition-all"
                      />
                    </div>
                  )}

                  {/* Expected Arrival Date & Time Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11.5px] font-medium text-galla-ink whitespace-nowrap">
                        Expected Arrival Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={expectedDeliveryDate}
                        min={getLocalDateString()}
                        onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                        className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer ${
                          settlementMode === "advance"
                            ? "focus:border-galla-brass"
                            : "focus:border-galla-teal"
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11.5px] font-medium text-galla-ink whitespace-nowrap">
                          Expected Time <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
                        </label>
                        {deliveryTime && (
                          <button
                            type="button"
                            onClick={() => setDeliveryTime("")}
                            className="text-[10px] text-galla-ink-soft hover:text-red-600 transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="time"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className={`w-full bg-galla-surface border border-galla-line rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-sans text-galla-ink focus:outline-none transition-all cursor-pointer ${
                          settlementMode === "advance"
                            ? "focus:border-galla-brass"
                            : "focus:border-galla-teal"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between text-[11.5px] pt-1.5 border-t text-galla-ink-soft ${
                    settlementMode === "advance" ? "border-galla-brass/25" : "border-galla-teal/20"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Calendar
                      className={`h-3 w-3 shrink-0 ${
                        settlementMode === "advance" ? "text-galla-brass" : "text-galla-teal"
                      }`}
                    />
                    <span>
                      Expected arrival:{" "}
                      <strong className="text-galla-ink">
                        {formatBookingDate(expectedDeliveryDate) || "Not set"}
                        {deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""}
                      </strong>
                    </span>
                  </span>
                  {settlementMode === "advance" ? (
                    advance.trim() !== "" && Number(advance) > 0 ? (
                      <span>
                        Remaining: <strong className="text-red-700">{formatRupee(amountPending)}</strong>
                      </span>
                    ) : null
                  ) : (
                    <span className="text-galla-teal font-medium">
                      Paid in Full ({formatRupee(totalCalculatedCost)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 4. Payment Method Selector (Shown when paying > 0) */}
            {(settlementMode !== "pending" || enteredPayLaterPaid > 0) && (
              <div>
                <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1.5">
                  {settlementMode === "pending"
                    ? `Mode of Upfront Payment (${formatRupee(enteredPayLaterPaid)})`
                    : settlementMode === "advance"
                    ? `Mode of Advance Payment (${formatRupee(enteredAdvance)})`
                    : "Mode of Payment"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("cash")}
                    className={`py-2 px-2 text-[12px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "cash"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("upi")}
                    className={`py-2 px-2 text-[12px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "upi"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("card")}
                    className={`py-2 px-2 text-[12px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "card"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("bank_transfer")}
                    className={`py-2 px-2 text-[12px] font-sans font-medium rounded-[5px] border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "bank_transfer"
                        ? "bg-galla-teal-soft border-galla-teal text-galla-teal shadow-2xs font-semibold"
                        : "bg-galla-paper/40 border-galla-line text-galla-ink-soft hover:text-galla-ink"
                    }`}
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Notes / Memo (Optional) */}
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                PO Notes / Memo <span className="text-galla-ink-soft/70 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Delivery memo, dealer payment terms, batch notes..."
                className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12.5px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all placeholder:text-galla-ink-soft/50"
              />
            </div>
          </div>

          {/* 5. Financial Summary & Status Box */}
          <div className="p-3 bg-galla-surface border border-galla-line rounded-[5px] space-y-2.5">
            <div className="flex items-center justify-between text-galla-ink">
              <span className="font-heading text-[13px] font-semibold uppercase tracking-wider">
                Total Batch Cost:
              </span>
              <span className="font-heading font-semibold text-[17px] text-galla-teal tabular-nums">
                {formatRupee(totalCalculatedCost)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px] pt-2 border-t border-galla-line/60">
              <div className="flex items-center gap-1.5">
                <span className="text-galla-ink-soft">Status:</span>
                {amountPending <= 0 ? (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                    Paid in Full (₹0 pending)
                  </span>
                ) : currentAmountPaid > 0 ? (
                  <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                    Partial ({formatRupee(amountPending)} pending)
                  </span>
                ) : (
                  <span className="bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded text-[11px] font-medium">
                    Payment Due ({formatRupee(amountPending)} pending)
                  </span>
                )}
              </div>

              <div className="font-sans font-medium text-galla-ink tabular-nums">
                Pending:{" "}
                <span
                  className={
                    amountPending > 0
                      ? "text-rose-700 font-semibold"
                      : "text-emerald-700"
                  }
                >
                  {formatRupee(amountPending)}
                </span>
              </div>
            </div>
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
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {isSubmitting
                  ? "Processing PO..."
                  : settlementMode === "pending"
                  ? enteredPayLaterPaid > 0
                    ? `Confirm Stock In (Paid: ${formatRupee(enteredPayLaterPaid)}, Due: ${formatRupee(amountPending)})`
                    : `Confirm Stock In (Due: ${formatRupee(totalCalculatedCost)})`
                  : settlementMode === "advance"
                  ? `Confirm Stock In (Advance: ${formatRupee(enteredAdvance)}, Due: ${formatRupee(amountPending)})`
                  : settlementMode === "paid_full"
                  ? `Confirm Stock In (Paid in Full: ${formatRupee(totalCalculatedCost)})`
                  : `Confirm Stock In (${formatRupee(totalCalculatedCost)})`}
              </span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title={
          settlementMode === "pending"
            ? "Confirm Pay Later Stock In"
            : settlementMode === "advance"
            ? "Confirm Advance Stock In"
            : settlementMode === "paid_full"
            ? "Confirm Paid in Full Stock In"
            : "Confirm Stock In"
        }
        description={
          settlementMode === "pending" ? (
            <span>
              Record purchase order from <strong className="font-semibold text-galla-ink">&ldquo;{supplierName.trim()}&rdquo;</strong> for{" "}
              <strong className="font-semibold text-galla-ink">{items.length} item(s)</strong> totalling{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(totalCalculatedCost)}</strong> with{" "}
              {enteredPayLaterPaid > 0 ? (
                <>
                  upfront payment of <strong className="font-semibold text-galla-ink">{formatRupee(enteredPayLaterPaid)}</strong> via{" "}
                  <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase().replace("_", " ")}</strong> and{" "}
                </>
              ) : null}
              remaining due balance of <strong className="font-semibold text-rose-700">{formatRupee(amountPending)}</strong>
              {dueDate ? ` due by ${formatBookingDate(dueDate)}` : ""}?
            </span>
          ) : settlementMode === "advance" ? (
            <span>
              Record advance purchase order from <strong className="font-semibold text-galla-ink">&ldquo;{supplierName.trim()}&rdquo;</strong> with{" "}
              deposit of <strong className="font-semibold text-galla-ink">{formatRupee(enteredAdvance)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase().replace("_", " ")}</strong> and{" "}
              pending balance of <strong className="font-semibold text-rose-700">{formatRupee(amountPending)}</strong>
              {expectedDeliveryDate ? ` (Expected arrival: ${formatBookingDate(expectedDeliveryDate)}${deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""})` : ""}?
            </span>
          ) : settlementMode === "paid_full" ? (
            <span>
              Record 100% advance purchase order from <strong className="font-semibold text-galla-ink">&ldquo;{supplierName.trim()}&rdquo;</strong> for{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(totalCalculatedCost)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase().replace("_", " ")}</strong>
              {expectedDeliveryDate ? ` (Expected arrival: ${formatBookingDate(expectedDeliveryDate)}${deliveryTime ? ` at ${formatAppointmentTime(deliveryTime)}` : ""})` : ""}?
            </span>
          ) : (
            <span>
              Record purchase order from <strong className="font-semibold text-galla-ink">&ldquo;{supplierName.trim()}&rdquo;</strong> for{" "}
              <strong className="font-semibold text-galla-ink">{items.length} item(s)</strong> totalling{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(totalCalculatedCost)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase().replace("_", " ")}</strong>?
              Inventory stock levels will be updated atomically.
            </span>
          )
        }
        confirmLabel="Confirm & Record"
        isLoading={isSubmitting}
        onConfirm={executeStockIn}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
