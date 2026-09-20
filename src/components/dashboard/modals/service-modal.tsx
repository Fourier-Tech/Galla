"use client";

import React, { useState, useMemo } from "react";
import { X, Sparkles, IndianRupee, Tag, AlignLeft, AlertCircle } from "lucide-react";
import { DashboardService } from "@/types/dashboard";
import { createServiceAction, updateServiceAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: DashboardService | null;
  existingCategories: string[];
  onSaveService: (service: DashboardService) => void;
}

export function ServiceModal({
  isOpen,
  onClose,
  serviceToEdit,
  existingCategories,
  onSaveService,
}: ServiceModalProps) {
  // Categories derived strictly from existing database services
  const allCategories = useMemo<string[]>(() => {
    return Array.from(new Set((existingCategories || []).filter(Boolean))).sort();
  }, [existingCategories]);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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

    setIsSubmitting(true);

    try {
      if (serviceToEdit) {
        const res = await updateServiceAction({
          id: serviceToEdit.id,
          name: trimmedName,
          category: finalCategory,
          price: numPrice,
          description: description.trim(),
          isActive,
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-galla-surface border border-galla-line rounded-[8px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-galla-line">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink tracking-tight">
                {serviceToEdit ? "Edit Service" : "Add New Service"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                {serviceToEdit
                  ? "Update menu details and treatment pricing"
                  : "Add a new salon treatment or service to your counter menu"}
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
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-[5px]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
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
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft">
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
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
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
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13.5px] font-heading font-semibold text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
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
                  Are you sure you want to save changes to <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to add <strong className="font-semibold text-galla-ink">&ldquo;{name.trim()}&rdquo;</strong> to your menu for{" "}
                  <strong className="font-semibold text-galla-ink">{formatRupee(Number(price) || 0)}</strong> under category{" "}
                  <strong className="font-semibold text-galla-ink">&ldquo;{category}&rdquo;</strong>?
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
