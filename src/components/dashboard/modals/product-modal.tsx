"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Package, IndianRupee, AlertCircle, Loader2, Layers, Tag, AlignLeft, Calendar } from "lucide-react";
import { DashboardProduct } from "@/types/dashboard";
import { createProductAction, updateProductAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (product: DashboardProduct) => void;
  productToEdit?: DashboardProduct | null;
  existingProducts?: DashboardProduct[];
}

export function ProductModal({
  isOpen,
  onClose,
  onSaveProduct,
  productToEdit,
  existingProducts = [],
}: ProductModalProps) {
  const isEditMode = Boolean(productToEdit);

  // Extract existing categories from active database products
  const dbCategories = useMemo(() => {
    const set = new Set<string>();
    existingProducts.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [existingProducts]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [customCategory, setCustomCategory] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [sellStock, setSellStock] = useState("0");
  const [useStock, setUseStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [description, setDescription] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or when target product changes
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || "");
      if (productToEdit.category && dbCategories.includes(productToEdit.category)) {
        setCategory(productToEdit.category);
        setCustomCategory("");
      } else {
        setCategory("custom");
        setCustomCategory(productToEdit.category || "");
      }
      setSellPrice(String(productToEdit.price ?? ""));
      setPurchaseCost(
        productToEdit.purchaseCost !== undefined && productToEdit.purchaseCost !== null
          ? String(productToEdit.purchaseCost)
          : ""
      );
      setSellStock(String(productToEdit.sell ?? 0));
      setUseStock(String(productToEdit.use ?? 0));
      setLowStockThreshold(
        productToEdit.lowStockThreshold !== undefined && productToEdit.lowStockThreshold !== null
          ? String(productToEdit.lowStockThreshold)
          : "0"
      );
      setDescription(productToEdit.description || "");
      setExpiryDate(productToEdit.expiryDate ? productToEdit.expiryDate.split("T")[0] : "");
    } else {
      setName("");
      if (dbCategories.length > 0) {
        setCategory(dbCategories[0]);
        setCustomCategory("");
      } else {
        setCategory("custom");
        setCustomCategory("");
      }
      setSellPrice("");
      setPurchaseCost("");
      setSellStock("0");
      setUseStock("0");
      setLowStockThreshold("0");
      setDescription("");
      setExpiryDate("");
    }
    setErrorMsg(null);
  }, [isOpen, productToEdit, dbCategories]);

  // Real-time duplicate name detection while typing
  const duplicateWarning = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || !existingProducts || existingProducts.length === 0) return null;
    const match = existingProducts.find(
      (p) =>
        p.isActive !== false &&
        p.name.trim().toLowerCase() === trimmed &&
        (!productToEdit || String(p.id) !== String(productToEdit.id))
    );
    return match ? "A product with this name already exists." : null;
  }, [name, existingProducts, productToEdit]);

  if (!isOpen) return null;

  const isCustomCategory = category === "custom" || dbCategories.length === 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a product name");
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setErrorMsg("Please select or specify a category");
      return;
    }

    const parsedPrice = Number(sellPrice);
    if (sellPrice === "" || isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg("Please enter a valid non-negative retail sell price");
      return;
    }

    const parsedCost = purchaseCost === "" ? 0 : Number(purchaseCost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      setErrorMsg("Purchase cost must be a non-negative number");
      return;
    }

    const parsedThreshold = lowStockThreshold === "" ? 0 : Number(lowStockThreshold);
    if (isNaN(parsedThreshold) || parsedThreshold < 0 || !Number.isInteger(parsedThreshold)) {
      setErrorMsg("Low stock threshold must be a valid integer");
      return;
    }

    if (!isEditMode) {
      const parsedSellStock = sellStock === "" ? 0 : Number(sellStock);
      if (isNaN(parsedSellStock) || parsedSellStock < 0 || !Number.isInteger(parsedSellStock)) {
        setErrorMsg("Retail sell stock must be a non-negative whole integer");
        return;
      }

      const parsedUseStock = useStock === "" ? 0 : Number(useStock);
      if (isNaN(parsedUseStock) || parsedUseStock < 0 || !Number.isInteger(parsedUseStock)) {
        setErrorMsg("Internal use stock must be a non-negative whole integer");
        return;
      }
    }

    setShowConfirm(true);
  };

  const executeSaveProduct = async () => {
    setShowConfirm(false);
    setErrorMsg(null);

    const trimmedName = name.trim();
    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    const parsedPrice = Number(sellPrice);
    const parsedCost = purchaseCost === "" ? 0 : Number(purchaseCost);
    const parsedThreshold = lowStockThreshold === "" ? 0 : Number(lowStockThreshold);

    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);

    try {
      if (isEditMode && productToEdit) {
        const res = await updateProductAction({
          id: String(productToEdit.id),
          name: trimmedName,
          category: finalCategory,
          price: parsedPrice,
          purchaseCost: parsedCost,
          lowStockThreshold: parsedThreshold,
          description: description.trim(),
          expiryDate: expiryDate ? expiryDate : null,
        });

        if (res.success && res.product) {
          onSaveProduct(res.product);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update product");
        }
      } else {
        const parsedSellStock = sellStock === "" ? 0 : Number(sellStock);
        const parsedUseStock = useStock === "" ? 0 : Number(useStock);

        const res = await createProductAction({
          name: trimmedName,
          category: finalCategory,
          price: parsedPrice,
          purchaseCost: parsedCost,
          sellStock: parsedSellStock,
          useStock: parsedUseStock,
          lowStockThreshold: parsedThreshold,
          description: description.trim() || undefined,
          expiryDate: expiryDate ? expiryDate : null,
        });

        if (res.success && res.product) {
          onSaveProduct(res.product);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to create product");
        }
      }
    } catch {
      setErrorMsg("A network error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-galla-surface border border-galla-line rounded-[8px] shadow-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-galla-ink">
                {isEditMode ? "Edit Product" : "Add New Product"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                {isEditMode
                  ? "Update product pricing, categories and inventory settings"
                  : "Add retail items and in-salon treatment consumables"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto overflow-x-hidden">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily Shampoo 250ml, Hair Serum"
                className={`w-full bg-galla-paper/50 border rounded-[5px] px-[13px] py-[8px] text-[13.5px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none transition-all ${duplicateWarning
                    ? "border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    : "border-galla-line focus:border-galla-teal focus:ring-1 focus:ring-galla-teal"
                  }`}
              />

              {/* Real-time Inline Duplicate Warning */}
              {duplicateWarning && (
                <p className="font-sans text-[11.5px] text-amber-800 bg-amber-50/90 border border-amber-200 rounded px-2.5 py-1 mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{duplicateWarning}</span>
                </p>
              )}

              {/* Name error banner if backend returns duplicate */}
              {errorMsg && errorMsg.toLowerCase().includes("already exists") && (
                <p className="font-sans text-[11.5px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1 mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              {dbCategories.length > 0 && (
                <div className="relative">
                  <Tag className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13.5px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer"
                  >
                    {dbCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="custom">+ New Category...</option>
                  </select>
                </div>
              )}

              {isCustomCategory && (
                <input
                  type="text"
                  autoFocus={dbCategories.length === 0}
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type category (e.g. Skin Care, Hair Care)..."
                  className={`w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all ${dbCategories.length > 0 ? "mt-2" : ""
                    }`}
                />
              )}
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Retail Sell Price (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                />
              </div>
              <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Customer retail counter price</p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                Purchase Cost (₹)
              </label>
              <div className="relative">
                <IndianRupee className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] font-semibold text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                />
              </div>
              <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Wholesale / vendor buying cost</p>
            </div>
          </div>

          {/* Stock Section */}
          <div className="pt-4 border-t border-galla-line/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-galla-teal" />
                <span className="text-[14px] font-semibold text-galla-ink">
                  {isEditMode ? "Current Stock & Inventory Settings" : "Initial Stock & Inventory Settings"}
                </span>
              </div>
              {isEditMode && (
                <span className="text-[11px] font-sans font-medium text-galla-ink-soft bg-galla-paper px-2 py-0.5 rounded-[4px] border border-galla-line">
                  Audit Locked
                </span>
              )}
            </div>

            {isEditMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-[6px] bg-galla-paper/40 border border-galla-line">
                    <div className="text-[11.5px] font-sans text-galla-ink-soft">Retail Sell Stock</div>
                    <div className="text-[16px] font-bold text-galla-ink mt-0.5 tabular-nums">
                      {productToEdit?.sell ?? 0} <span className="text-[12px] font-normal text-galla-ink-soft">pcs</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-[6px] bg-galla-paper/40 border border-galla-line">
                    <div className="text-[11.5px] font-sans text-galla-ink-soft">Internal Use Stock</div>
                    <div className="text-[16px] font-bold text-galla-ink mt-0.5 tabular-nums">
                      {productToEdit?.use ?? 0} <span className="text-[12px] font-normal text-galla-ink-soft">pcs</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-[6px] bg-galla-paper/40 border border-galla-line flex flex-col justify-between">
                    <label className="text-[11.5px] font-sans text-galla-ink-soft block">
                      Low Stock Alert
                    </label>
                    <div className="relative flex items-center mt-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        className="w-full bg-galla-surface border border-galla-line rounded-[4px] pl-2.5 pr-8 py-1 font-sans text-[13px] font-medium text-galla-ink text-right focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                      />
                      <span className="absolute right-2.5 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                        pcs
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] font-sans text-galla-ink-soft italic leading-tight">
                  Stock counts are protected and cannot be directly typed. Use <strong>Stock In (PO)</strong>, <strong>Counter Sale</strong>, or <strong>Move to use</strong> to update quantities.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                    Retail Sell Stock
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sellStock}
                      onChange={(e) => setSellStock(e.target.value)}
                      className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-3 pr-8 py-[8px] font-sans text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                    />
                    <span className="absolute right-2.5 text-[11.5px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Available for counter sale</p>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                    Internal Use Stock
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={useStock}
                      onChange={(e) => setUseStock(e.target.value)}
                      className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-3 pr-8 py-[8px] font-sans text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                    />
                    <span className="absolute right-2.5 text-[11.5px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-galla-ink-soft mt-1">For in-salon treatments</p>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
                    Low Stock Alert
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-3 pr-8 py-[8px] font-sans text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
                    />
                    <span className="absolute right-2.5 text-[11.5px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Warn when stock falls to this</p>
                </div>
              </div>
            )}
          </div>

          {/* Description (Optional) */}
          <div className="pt-2">
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Description / Notes (Optional)
            </label>
            <div className="relative">
              <AlignLeft className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add product specifications, volume, or treatment notes..."
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all resize-none"
              />
            </div>
          </div>

          {/* Expiration Date (Optional) */}
          <div className="pt-2">
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Expiration Date (Optional)
            </label>
            <div className="relative">
              <Calendar className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer"
              />
            </div>
            <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
              Automated expiry reminder digest email will be sent before this date
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-galla-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[5px] border border-galla-line text-galla-ink font-sans text-[13px] font-medium hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(duplicateWarning)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[5px] bg-galla-teal text-white font-sans text-[13px] font-medium hover:opacity-95 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {isSubmitting
                  ? isEditMode
                    ? "Updating..."
                    : "Adding..."
                  : isEditMode
                    ? "Save Changes"
                    : "Add Product"}
              </span>
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={isEditMode ? "Confirm Update Product" : "Confirm Add Product"}
          description={
            <span>
              {isEditMode ? (
                <>
                  Are you sure you want to save changes to <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to add <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong> to your inventory at sell price{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(Number(sellPrice) || 0)}</strong> (purchase cost:{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(Number(purchaseCost) || 0)}</strong>)?
                </>
              )}
            </span>
          }
          confirmLabel={isEditMode ? "Yes, Save Changes" : "Yes, Add Product"}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSaveProduct}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
