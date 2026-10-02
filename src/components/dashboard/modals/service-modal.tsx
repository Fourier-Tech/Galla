"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  IndianRupee,
  Tag,
  AlignLeft,
  AlertCircle,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { DashboardService, DashboardProduct } from "@/types/dashboard";
import { createServiceAction, updateServiceAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: DashboardService | null;
  existingCategories: string[];
  availableProducts?: DashboardProduct[];
  onSaveService: (service: DashboardService) => void;
}

export function ServiceModal({
  isOpen,
  onClose,
  serviceToEdit,
  existingCategories,
  availableProducts = [],
  onSaveService,
}: ServiceModalProps) {
  // Categories derived strictly from existing database services
  const allCategories = useMemo<string[]>(() => {
    return Array.from(new Set((existingCategories || []).filter(Boolean))).sort();
  }, [existingCategories]);

  // Alphabetically sorted products for selection dropdown
  const sortedAvailableProducts = useMemo(() => {
    return [...(availableProducts || [])].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [availableProducts]);

  const initialCategoryIsCustom =
    Boolean(serviceToEdit)
      ? !allCategories.includes(serviceToEdit?.category || "")
      : allCategories.length === 0;

  const [name, setName] = useState(serviceToEdit?.name || "");
  const [category, setCategory] = useState(
    initialCategoryIsCustom
      ? "custom"
      : serviceToEdit?.category || (allCategories[0] ?? "custom")
  );
  const [customCategory, setCustomCategory] = useState(
    initialCategoryIsCustom
      ? serviceToEdit?.category || ""
      : allCategories.length === 0
      ? serviceToEdit?.category || ""
      : ""
  );
  const isCustomCategory = category === "custom" || allCategories.length === 0;
  const [price, setPrice] = useState(serviceToEdit ? String(serviceToEdit.price) : "");
  const [description, setDescription] = useState(serviceToEdit?.description || "");
  const [isActive, setIsActive] = useState(serviceToEdit?.isActive ?? true);
  const [selectedProducts, setSelectedProducts] = useState<
    { productId: string; name: string; quantity: number; unitCost?: number }[]
  >(
    serviceToEdit?.products?.map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      unitCost: p.unitCost,
    })) || []
  );
  const [productToAdd, setProductToAdd] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddProductItem = () => {
    if (!productToAdd) return;
    const prod = (availableProducts || []).find((p) => String(p.id) === productToAdd);
    if (!prod) return;

    if (selectedProducts.some((p) => p.productId === String(prod.id))) {
      setErrorMsg(`Product "${prod.name}" is already attached to this service.`);
      return;
    }

    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: String(prod.id),
        name: prod.name,
        quantity: 1,
        unitCost: prod.purchaseCost || 0,
      },
    ]);
    setProductToAdd("");
  };

  const handleUpdateProductQuantity = (productId: string, qty: number) => {
    const validQty = Math.max(1, isNaN(qty) ? 1 : Math.floor(qty));
    setSelectedProducts((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: validQty } : item
      )
    );
  };

  const handleRemoveProductItem = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a service name");
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setErrorMsg("Please select or enter a category");
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg("Please enter a valid non-negative price");
      return;
    }

    setShowConfirm(true);
  };

  const executeSaveService = async () => {
    setShowConfirm(false);
    setErrorMsg(null);

    const trimmedName = name.trim();
    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    const numPrice = Number(price);

    if (isSubmittingRef.current) return; isSubmittingRef.current = true; setIsSubmitting(true);

    try {
      if (serviceToEdit) {
        const res = await updateServiceAction({
          id: serviceToEdit.id,
          name: trimmedName,
          category: finalCategory,
          price: numPrice,
          description: description.trim(),
          isActive,
          products: selectedProducts,
        });

        if (res.success && res.service) {
          onSaveService(res.service);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update service");
        }
      } else {
        const res = await createServiceAction({
          name: trimmedName,
          category: finalCategory,
          price: numPrice,
          description: description.trim() || undefined,
          products: selectedProducts,
        });

        if (res.success && res.service) {
          onSaveService(res.service);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to create service");
        }
      }
    } catch {
      setErrorMsg("Network error occurred. Please try again.");
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-galla-surface border border-galla-line rounded-[8px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-galla-ink">
                {serviceToEdit ? "Edit Service" : "Add New Service"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                {serviceToEdit
                  ? "Update menu details, treatment pricing, and consumed products"
                  : "Add a new salon treatment or service with attached inventory consumption"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto overflow-x-hidden">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hair Spa & Blow Dry, Hydra Facial"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13.5px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            {allCategories.length > 0 && (
              <div className="relative">
                <Tag className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13.5px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all cursor-pointer"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="custom">+ Add Custom Category...</option>
                </select>
              </div>
            )}

            {isCustomCategory && (
              <input
                type="text"
                autoFocus={allCategories.length === 0}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter category name (e.g. Hair Care, Facial)..."
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[7px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all mt-1.5"
              />
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <IndianRupee className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
              <input
                type="number"
                required
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[14px] font-semibold text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all tabular-nums"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-medium text-galla-ink mb-1.5">
              Description / Notes (Optional)
            </label>
            <div className="relative">
              <AlignLeft className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key treatment benefits, products used, or steps..."
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all resize-none"
              />
            </div>
          </div>

          {/* Products Consumed in Service */}
          <div className="space-y-2 pt-2 border-t border-galla-line/80">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[12px] font-medium text-galla-ink">
                  Products Consumed in Service (Optional)
                </label>
                <p className="font-sans text-[11.5px] text-galla-ink-soft">
                  Items automatically deducted from stock &amp; logged as internal expense when service is served.
                </p>
              </div>
              {selectedProducts.length > 0 && (
                <span className="text-[11px] font-medium text-galla-teal bg-galla-teal/10 px-2 py-0.5 rounded-[4px]">
                  {selectedProducts.length} linked
                </span>
              )}
            </div>

            {/* Product Selector Row */}
            <div className="flex gap-2">
              <select
                value={productToAdd}
                onChange={(e) => setProductToAdd(e.target.value)}
                className="w-full max-w-full min-w-0 flex-1 bg-galla-paper/50 border border-galla-line rounded-[5px] px-3 py-2 text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal cursor-pointer"
              >
                <option value="">-- Choose an inventory product consumed in this service --</option>
                {sortedAvailableProducts.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.name} (In-Use: {p.use || 0} pcs, Retail: {p.sell || 0} pcs, Cost: {formatRupee(p.purchaseCost || 0)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddProductItem}
                disabled={!productToAdd}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-galla-teal text-white rounded-[5px] text-[12.5px] font-sans font-medium hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Selected Products List */}
            {selectedProducts.length > 0 ? (
              <div className="divide-y divide-galla-line/60 bg-galla-paper/30 rounded-[5px] border border-galla-line overflow-hidden">
                {selectedProducts.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between px-3 py-2.5 text-[13px] gap-2"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div
                        title={item.name}
                        className="font-sans text-galla-ink font-medium line-clamp-2 break-words"
                      >
                        {item.name}
                      </div>
                      <div className="text-[11px] text-galla-ink-soft flex items-center gap-1.5 mt-0.5 shrink-0 flex-wrap">
                        <span className="shrink-0 text-emerald-700 font-medium">
                          Purchase Cost: {formatRupee(item.unitCost || 0)}/pc
                        </span>
                        <span>&bull;</span>
                        <span className="shrink-0 text-galla-ink-soft">
                          Total Expense: {formatRupee((item.unitCost || 0) * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] text-galla-ink-soft shrink-0">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateProductQuantity(item.productId, Number(e.target.value))
                        }
                        className="shrink-0 w-14 bg-galla-surface border border-galla-line rounded-[4px] px-2 py-1 text-center font-medium text-[12.5px] text-galla-ink focus:outline-none focus:border-galla-teal tabular-nums"
                      />
                      <span className="text-[11.5px] text-galla-ink-soft shrink-0">pcs</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProductItem(item.productId)}
                        className="shrink-0 text-galla-ink-soft hover:text-red-600 p-1 transition-colors cursor-pointer ml-1"
                        title="Remove product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2.5 text-[12px] text-galla-ink-soft border border-dashed border-galla-line rounded-[5px] bg-galla-paper/20">
                No products linked. Service will not deduct any inventory upon completion.
              </div>
            )}

            <div className="flex items-start gap-1.5 p-2 rounded-[5px] bg-blue-50/50 border border-blue-100 text-[11px] text-blue-900 leading-normal">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> Customer is charged only the overall service price ({formatRupee(Number(price) || 0)}). Consumed product costs are recorded as an internal expense upon service delivery.
              </span>
            </div>
          </div>

          {/* Status (when editing) */}
          {serviceToEdit && (
            <div className="flex items-center justify-between p-3 rounded-[5px] bg-galla-paper/60 border border-galla-line">
              <div>
                <div className="font-sans text-[13px] font-medium text-galla-ink">
                  Service Availability
                </div>
                <div className="font-sans text-[11.5px] text-galla-ink-soft">
                  Enable or disable this service from counter bookings
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-gray-100 text-gray-600 border border-gray-300"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </button>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-galla-line">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-[5px] border border-galla-line text-galla-ink font-sans text-[13px] font-medium hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-[5px] bg-galla-teal text-white font-sans text-[13px] font-medium hover:opacity-95 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : serviceToEdit
                ? "Save Changes"
                : "Create Service"}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title={serviceToEdit ? "Confirm Update Service" : "Confirm Add Service"}
          description={
            <span>
              {serviceToEdit ? (
                <>
                  Are you sure you want to save changes to <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong>
                  {selectedProducts.length > 0 && (
                    <> with <strong className="font-semibold text-galla-ink">{selectedProducts.length} linked product(s)</strong></>
                  )}?
                </>
              ) : (
                <>
                  Are you sure you want to add <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong> to your menu for{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(Number(price) || 0)}</strong> under category{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{isCustomCategory ? customCategory.trim() : category}&rdquo;</strong>
                  {selectedProducts.length > 0 && (
                    <> with <strong className="font-semibold text-galla-ink">{selectedProducts.length} linked product(s)</strong></>
                  )}?
                </>
              )}
            </span>
          }
          confirmLabel={serviceToEdit ? "Yes, Save Changes" : "Yes, Add Service"}
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeSaveService}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
