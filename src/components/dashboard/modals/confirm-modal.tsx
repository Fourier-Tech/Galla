"use client";

import React from "react";
import { HelpCircle, AlertTriangle, Loader2, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] overscroll-contain animate-in fade-in duration-100"
    >
      <div className="w-full max-w-[400px] bg-galla-surface border border-galla-line rounded-[6px] p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-full shrink-0 ${
                isDestructive
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-galla-teal-soft text-galla-teal border border-galla-teal/20"
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <HelpCircle className="h-4 w-4" />
              )}
            </div>
            <h3
              id="confirm-modal-title"
              className="font-heading font-semibold text-[16px] text-galla-ink tracking-tight"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-galla-ink-soft hover:text-galla-ink rounded transition-colors cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="font-sans text-[13.5px] text-galla-ink-soft leading-relaxed mb-5 [&_strong]:text-galla-ink [&_strong]:font-semibold">
          {description}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-galla-line">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-[5px] border border-galla-line font-sans text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] font-sans text-[13px] font-medium text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-galla-teal hover:opacity-95"
            }`}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
