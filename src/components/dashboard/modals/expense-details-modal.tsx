"use client";

import React, { useEffect } from "react";
import {
  X,
  Calendar,
  CreditCard,
  User,
  Tag,
  FileText,
  Receipt,
  ArrowDownRight,
} from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";
import { formatRupee, formatDisplayNumber } from "@/lib/utils";

interface ExpenseDetailsModalProps {
  expense: DashboardExpense | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExpenseDetailsModal({
  expense,
  isOpen,
  onClose,
}: ExpenseDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !expense) return null;

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Salary":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "Rent":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "Day-to-day":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-galla-paper text-galla-ink-soft border-galla-line";
    }
  };

  const formattedDate = expense.createdAt
    ? new Date(expense.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : expense.time;

  const paymentModeLabel = expense.paymentMode
    ? expense.paymentMode.toUpperCase()
    : "CASH";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[420px] bg-galla-surface border border-galla-line rounded-[8px] p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-galla-line/60 pb-3.5">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-semibold text-[17px] text-galla-ink">
                Expense Details
              </span>
              {expense.expenseNumber && (
                <span className="font-mono text-[11px] font-semibold text-galla-brick bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  {formatDisplayNumber(expense.expenseNumber)}
                </span>
              )}
            </div>
            <p className="font-sans text-[12px] text-galla-ink-soft flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-galla-ink-soft/70 shrink-0" />
              <span>{formattedDate}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount Outflow Card */}
        <div className="p-4 rounded-[6px] bg-rose-50/50 border border-rose-200/70 text-center space-y-1">
          <div className="text-[11px] font-sans font-medium uppercase tracking-wider text-rose-800 flex items-center justify-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-700" />
            <span>Total Outflow</span>
          </div>
          <div className="font-heading font-bold text-[28px] text-galla-brick tabular-nums">
            &minus;{formatRupee(expense.amount)}
          </div>
          <div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-[4px] border text-[11.5px] font-medium ${getCategoryBadgeClass(
                expense.category
              )}`}
            >
              {expense.category}
            </span>
          </div>
        </div>

        {/* Expense Info Breakdown */}
        <div className="space-y-3 bg-galla-paper/30 p-3.5 rounded-[6px] border border-galla-line/60 text-[13px] font-sans">
          {/* Reason / Title */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-galla-line/40">
            <span className="text-galla-ink-soft flex items-center gap-1.5 shrink-0">
              <Receipt className="h-3.5 w-3.5 text-galla-teal" />
              <span>Purpose:</span>
            </span>
            <span className="font-semibold text-galla-ink text-right break-words max-w-[240px]">
              {expense.desc}
            </span>
          </div>

          {/* Category */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-galla-line/40">
            <span className="text-galla-ink-soft flex items-center gap-1.5 shrink-0">
              <Tag className="h-3.5 w-3.5 text-galla-brass" />
              <span>Category:</span>
            </span>
            <span className="font-medium text-galla-ink text-right">
              {expense.category}
            </span>
          </div>

          {/* Payment Mode */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-galla-line/40">
            <span className="text-galla-ink-soft flex items-center gap-1.5 shrink-0">
              <CreditCard className="h-3.5 w-3.5 text-galla-teal" />
              <span>Payment Mode:</span>
            </span>
            <span className="font-medium text-galla-ink uppercase tracking-wide">
              {paymentModeLabel}
            </span>
          </div>

          {/* Recorded By */}
          {expense.recordedBy && (
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-galla-line/40">
              <span className="text-galla-ink-soft flex items-center gap-1.5 shrink-0">
                <User className="h-3.5 w-3.5 text-galla-ink-soft" />
                <span>Recorded By:</span>
              </span>
              <span className="font-medium text-galla-ink capitalize">
                {expense.recordedBy}
              </span>
            </div>
          )}

          {/* Recipient */}
          {expense.recipient && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-galla-ink-soft flex items-center gap-1.5 shrink-0">
                <User className="h-3.5 w-3.5 text-galla-ink-soft" />
                <span>Paid To:</span>
              </span>
              <span className="font-medium text-galla-ink">
                {expense.recipient}
              </span>
            </div>
          )}
        </div>

        {/* Notes (if present) */}
        {expense.notes && (
          <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-[6px] space-y-1">
            <div className="flex items-center gap-1.5 text-amber-950 font-semibold text-[11.5px]">
              <FileText className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span className="uppercase tracking-wider">Note</span>
            </div>
            <p className="text-[12px] text-amber-900 leading-relaxed font-sans break-words whitespace-pre-wrap">
              {expense.notes}
            </p>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-galla-line/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[5px] bg-galla-paper hover:bg-galla-paper/80 border border-galla-line text-galla-ink font-sans text-[13px] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
