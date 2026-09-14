"use client";

import React, { useState } from "react";
import { X, Sparkles, Clock, IndianRupee, Tag, AlignLeft, AlertCircle } from "lucide-react";
import { DashboardService } from "@/types/dashboard";
import { createServiceAction, updateServiceAction } from "@/app/dashboard/actions";

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: DashboardService | null;
  existingCategories: string[];
  onSaveService: (service: DashboardService) => void;
}

const COMMON_CATEGORIES = [
  "Hair Care",
  "Skin Care",
  "Nails",
  "Facial",
  "Waxing & Threading",
  "Spa & Massage",
  "Bridal & Groom",
  "General",
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function ServiceModal({
  isOpen,
  onClose,
  serviceToEdit,
  existingCategories,
  onSaveService,
}: ServiceModalProps) {
  // Combine and deduplicate categories
  const allCategories = Array.from(
    new Set([...COMMON_CATEGORIES, ...existingCategories.filter(Boolean)])
  );

  const initialCategoryIsCustom =
    Boolean(serviceToEdit) && !allCategories.includes(serviceToEdit?.category || "");

  const [name, setName] = useState(serviceToEdit?.name || "");
  const [category, setCategory] = useState(
    initialCategoryIsCustom
      ? "custom"
      : serviceToEdit?.category || "Hair Care"
  );
  const [customCategory, setCustomCategory] = useState(
    initialCategoryIsCustom ? serviceToEdit?.category || "" : ""
  );
  const [isCustomCategory, setIsCustomCategory] = useState(initialCategoryIsCustom);
  const [price, setPrice] = useState(serviceToEdit ? String(serviceToEdit.price) : "");
  const [durationMinutes, setDurationMinutes] = useState(serviceToEdit?.durationMinutes || 30);
  const [description, setDescription] = useState(serviceToEdit?.description || "");
  const [isActive, setIsActive] = useState(serviceToEdit?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      setIsCustomCategory(true);
    } else {
      setIsCustomCategory(false);
      setCategory(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true);

    try {
      if (serviceToEdit) {
        const res = await updateServiceAction({
          id: serviceToEdit.id,
          name: trimmedName,
          category: finalCategory,
          price: numPrice,
          durationMinutes: Number(durationMinutes) || 30,
          description: description.trim() || undefined,
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
          durationMinutes: Number(durationMinutes) || 30,
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
                  ? "Update menu details, treatment pricing and duration"
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <div className="relative">
              <Tag className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={isCustomCategory ? "custom" : category}
                onChange={handleCategoryChange}
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

            {isCustomCategory && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[7px] text-[13px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all mt-1.5"
              />
            )}
          </div>

          {/* Price & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13.5px] font-mono font-medium text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
                Duration (minutes)
              </label>
              <div className="relative">
                <Clock className="h-4 w-4 text-galla-ink-soft/60 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  placeholder="30"
                  className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] pl-9 pr-3 py-[8px] text-[13.5px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-all"
                />
              </div>
            </div>
          </div>

          {/* Duration Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="font-sans text-[11px] text-galla-ink-soft mr-1">Presets:</span>
            {DURATION_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDurationMinutes(mins)}
                className={`px-2 py-0.5 rounded-[4px] text-[11.5px] font-sans transition-colors cursor-pointer ${
                  durationMinutes === mins
                    ? "bg-galla-teal text-white font-medium shadow-2xs"
                    : "bg-galla-paper hover:bg-galla-paper/80 border border-galla-line text-galla-ink-soft"
                }`}
              >
                {mins}m
              </button>
            ))}
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
      </div>
    </div>
  );
}
