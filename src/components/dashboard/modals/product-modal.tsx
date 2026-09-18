"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Package, IndianRupee, Tag, AlertCircle, Loader2, Layers } from "lucide-react";
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

export const COMMON_PRODUCT_CATEGORIES = [
  "Shampoos & Conditioners",
  "Hair Color & Developers",
  "Hair Serums & Oils",
  "Hair Spa & Treatment Masks",
  "Facial Kits & Scrubs",
  "Skin Creams & Lotions",
  "Nail Polish & Care",
  "Wax & Hair Removal Supplies",
  "Styling Waxes & Sprays",
  "Salon Disposables & Essentials",
  "Retail Cosmetics & Perfumes",
  "General Supplies",
];

export function ProductModal({
  isOpen,
  onClose,
  onSaveProduct,
  productToEdit,
  existingProducts = [],
}: ProductModalProps) {
  const isEditMode = Boolean(productToEdit);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Shampoos & Conditioners");
  const [customCategory, setCustomCategory] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [sellStock, setSellStock] = useState("0");
  const [useStock, setUseStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or when target product changes
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || "");
      if (COMMON_PRODUCT_CATEGORIES.includes(productToEdit.category || "")) {
        setCategory(productToEdit.category || "Shampoos & Conditioners");
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
    } else {
      setName("");
      setCategory("Shampoos & Conditioners");
      setCustomCategory("");
      setSellPrice("");
      setPurchaseCost("");
      setSellStock("0");
      setUseStock("0");
      setLowStockThreshold("0");
      setDescription("");
    }
    setErrorMsg(null);
  }, [isOpen, productToEdit]);

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

  const isCustomCategory = category === "custom";

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

    setIsSubmitting(true);

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
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overscroll-contain"
    >
      <div className="w-full max-w-[500px] max-h-[90vh] flex flex-col bg-galla-surface border border-galla-line rounded-[5px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-[21px] py-[16px] border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
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
            className="p-1 text-galla-ink-soft hover:text-galla-ink rounded-[4px] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="overflow-y-auto p-[21px] space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[13px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name with Duplicate Detection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
                Product Name <span className="text-red-600">*</span>
              </label>
            </div>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name (e.g. Daily Shampoo 250ml)"
              className={`w-full px-3 py-2 rounded-[5px] bg-galla-paper/30 border font-sans text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:bg-galla-surface outline-none transition-all ${
                duplicateWarning
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

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider">
              Category <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-[5px] bg-galla-paper/30 border border-galla-line font-sans text-[14px] text-galla-ink focus:bg-galla-surface focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all cursor-pointer"
              >
                {COMMON_PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="custom">+ New Category...</option>
              </select>
            </div>

            {isCustomCategory && (
              <input
                type="text"
                autoFocus
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type custom category name..."
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all"
              />
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Sell Price (₹) <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <IndianRupee className="absolute left-3 h-3.5 w-3.5 text-galla-ink-soft pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 rounded-[5px] bg-galla-paper/30 border border-galla-line font-sans text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:bg-galla-surface focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                />
              </div>
              <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Retail counter price</p>
            </div>

            <div>
              <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Purchase Cost (₹)
              </label>
              <div className="relative flex items-center">
                <IndianRupee className="absolute left-3 h-3.5 w-3.5 text-galla-ink-soft pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 rounded-[5px] bg-galla-paper/30 border border-galla-line font-sans text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:bg-galla-surface focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                />
              </div>
              <p className="font-sans text-[11px] text-galla-ink-soft mt-1">Wholesale / buying cost</p>
            </div>
          </div>

          {/* Stock Section: Protected in Edit Mode */}
          {isEditMode ? (
            <div className="p-3 bg-galla-paper/40 rounded-[5px] border border-galla-line space-y-2.5">
              <div className="flex items-center justify-between text-galla-ink font-heading text-[12px] font-semibold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-galla-teal" />
                  <span>Current Stock (Protected)</span>
                </div>
                <span className="text-[10.5px] font-sans font-normal text-galla-ink-soft bg-galla-surface px-1.5 py-0.5 rounded border border-galla-line">
                  Audit Locked
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div className="p-2 rounded bg-galla-surface border border-galla-line">
                  <div className="text-[11px] font-sans text-galla-ink-soft">Retail Sell Stock</div>
                  <div className="text-[15px] font-heading font-semibold text-galla-ink mt-0.5">
                    {productToEdit?.sell ?? 0} pcs
                  </div>
                </div>
                <div className="p-2 rounded bg-galla-surface border border-galla-line">
                  <div className="text-[11px] font-sans text-galla-ink-soft">Internal Use Stock</div>
                  <div className="text-[15px] font-heading font-semibold text-galla-ink mt-0.5">
                    {productToEdit?.use ?? 0} pcs
                  </div>
                </div>
              </div>

              <p className="text-[11px] font-sans text-galla-ink-soft italic leading-tight">
                Stock counts are protected and cannot be directly typed. Use <strong>Stock In (PO)</strong>, <strong>Counter Sale</strong>, or <strong>Move to use</strong> to update quantities.
              </p>

              {/* Threshold is still editable */}
              <div className="pt-2 border-t border-galla-line/60 flex items-center justify-between">
                <label className="font-sans text-[12px] text-galla-ink font-medium">
                  Low Stock Alert Threshold
                </label>
                <div className="w-20 relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-2.5 py-1 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12px] text-galla-ink text-right pr-7 focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                  />
                  <span className="absolute right-2 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                    pcs
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-galla-paper/40 rounded-[5px] border border-galla-line space-y-3">
              <div className="flex items-center gap-1.5 text-galla-ink font-heading text-[12px] font-semibold uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-galla-teal" />
                <span>Initial Stock Split</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-[12px] text-galla-ink font-medium mb-1">
                    Retail Sell Stock
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sellStock}
                      onChange={(e) => setSellStock(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-2.5 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-galla-ink-soft mt-0.5">Available for counter sale</p>
                </div>

                <div>
                  <label className="block font-sans text-[12px] text-galla-ink font-medium mb-1">
                    Internal Use Stock
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={useStock}
                      onChange={(e) => setUseStock(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[13px] text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-2.5 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-galla-ink-soft mt-0.5">For salon treatments</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="font-sans text-[12px] text-galla-ink font-medium">
                    Low Stock Alert Threshold
                  </label>
                  <div className="w-20 relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full px-2.5 py-1 rounded-[4px] bg-galla-surface border border-galla-line font-sans text-[12px] text-galla-ink text-right pr-7 focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all tabular-nums"
                    />
                    <span className="absolute right-2 text-[11px] font-sans text-galla-ink-soft pointer-events-none">
                      pcs
                    </span>
                  </div>
                </div>
                <p className="font-sans text-[11px] text-galla-ink-soft mt-1">
                  Show warning banner when retail stock falls to or below this amount
                </p>
              </div>
            </div>
          )}

          {/* Description (Optional) */}
          <div>
            <label className="block font-heading text-[12px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add product specifications or treatment notes..."
              className="w-full px-3 py-2 rounded-[5px] bg-galla-paper/30 border border-galla-line font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:bg-galla-surface focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none transition-all resize-none"
            />
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
              disabled={isSubmitting || Boolean(duplicateWarning)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
