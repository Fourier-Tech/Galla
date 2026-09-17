"use client";

import React, { useState, useEffect } from "react";
import { X, Truck, AlertCircle, Loader2 } from "lucide-react";
import { DashboardSupplier } from "@/types/dashboard";
import { createSupplierAction, updateSupplierAction } from "@/app/dashboard/actions";
import { formatPhoneNumber } from "@/lib/utils";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSupplier: (supplier: DashboardSupplier) => void;
  supplierToEdit?: DashboardSupplier | null;
}

export function SupplierModal({
  isOpen,
  onClose,
  onSaveSupplier,
  supplierToEdit,
}: SupplierModalProps) {
  const isEditMode = Boolean(supplierToEdit);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or target changes
  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || "");
      setCompanyName(supplierToEdit.companyName || "");
      setPhone(supplierToEdit.phone || "");
      setEmail(supplierToEdit.email || "");
      setAddress(supplierToEdit.address || "");
      setGstin(supplierToEdit.gstin || "");
      setNotes(supplierToEdit.notes || "");
    } else {
      setName("");
      setCompanyName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setGstin("");
      setNotes("");
    }
    setErrorMsg(null);
  }, [supplierToEdit, isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Lock scroll
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Supplier name is required.");
      return;
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setErrorMsg("Valid 10-digit contact number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && supplierToEdit) {
        const res = await updateSupplierAction({
          id: supplierToEdit.id,
          name: trimmedName,
          companyName: companyName.trim() || undefined,
          phone: formatPhoneNumber(phone),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          notes: notes.trim() || undefined,
        });

        if (res.success && res.supplier) {
          onSaveSupplier(res.supplier);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update supplier.");
        }
      } else {
        const res = await createSupplierAction({
          name: trimmedName,
          companyName: companyName.trim() || undefined,
          phone: formatPhoneNumber(phone),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          notes: notes.trim() || undefined,
        });

        if (res.success && res.supplier) {
          onSaveSupplier(res.supplier);
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to create supplier.");
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
      <div className="w-full max-w-[480px] max-h-[90vh] flex flex-col bg-galla-surface border border-galla-line rounded-[5px] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-[21px] py-[16px] border-b border-galla-line bg-galla-paper/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-galla-teal-soft text-galla-teal">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
                {isEditMode ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                {isEditMode
                  ? "Update dealer info, GSTIN, and contact details"
                  : "Register a vendor or distributor for stock-in & bills"}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-[21px] space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[4px] bg-red-50 border border-red-200 text-red-800 text-[13px] font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier Name */}
          <div>
            <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
              Contact / Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
            />
          </div>

          {/* Company / Agency Name */}
          <div>
            <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
              Company / Agency Name <span className="text-galla-ink-soft text-[11.5px] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. L'Oréal Pro Distributors, Surat"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
            />
          </div>

          {/* Phone & Email Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98250 12345"
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
              />
            </div>
            <div>
              <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
                Email Address <span className="text-galla-ink-soft text-[11.5px] font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dealer@example.com"
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
              />
            </div>
          </div>

          {/* GSTIN & Office Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
                GSTIN / Tax ID <span className="text-galla-ink-soft text-[11.5px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="24ABCDE1234F1Z5"
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-mono uppercase text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
              />
            </div>
            <div>
              <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
                City / Address <span className="text-galla-ink-soft text-[11.5px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ring Road, Surat"
                className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13.5px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-sans text-[12.5px] font-medium text-galla-ink mb-1">
              Internal Notes <span className="text-galla-ink-soft text-[11.5px] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 15-day credit cycle, deliveries on Thursdays"
              className="w-full px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line text-[13px] font-sans text-galla-ink focus:border-galla-teal focus:ring-1 focus:ring-galla-teal outline-none resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-galla-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[5px] border border-galla-line font-sans text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isEditMode ? "Save Changes" : "Register Supplier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
