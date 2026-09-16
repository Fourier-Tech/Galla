"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";
import { createExpenseAction } from "@/app/dashboard/actions";
import { formatRupee } from "@/lib/utils";
import { ConfirmModal } from "./confirm-modal";

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: DashboardExpense) => void;
}

export function NewExpenseModal({
  isOpen,
  onClose,
  onAddExpense,
}: NewExpenseModalProps) {
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<
    "Day-to-day" | "Inventory purchase" | "Salary" | "Rent" | "Refund"
  >("Day-to-day");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!desc.trim() || !amount) return;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid expense amount");
      return;
    }

    setShowConfirm(true);
  };

  const executeCreateExpense = async () => {
    setShowConfirm(false);
    const parsedAmount = Number(amount);
    setIsSubmitting(true);
    try {
      const res = await createExpenseAction({
        desc: desc.trim(),
        category,
        amount: parsedAmount,
      });

      if (res.success && res.expense) {
        onAddExpense(res.expense);
        setDesc("");
        setAmount("");
        setCategory("Day-to-day");
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to record expense");
      }
    } catch {
      setErrorMsg("Network error occurred while recording expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[377px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
            Record Expense
          </h3>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[4px]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              What was it for?
            </label>
            <input
              type="text"
              autoFocus
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Tea & snacks, shop supplies, utilities"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as
                    | "Day-to-day"
                    | "Inventory purchase"
                    | "Salary"
                    | "Rent"
                    | "Refund"
                )
              }
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            >
              <option value="Day-to-day">Day-to-day</option>
              <option value="Inventory purchase">Inventory purchase</option>
              <option value="Salary">Salary</option>
              <option value="Rent">Rent</option>
              <option value="Refund">Refund</option>
            </select>
          </div>

          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              Amount (₹)
            </label>
            <input
              type="text"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 150"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium py-[10px] rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Recording to Database..." : "Save Expense"}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Expense"
          description={
            <span>
              Are you sure you want to record an expense of{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(Number(amount) || 0)}</strong> under{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{category}&rdquo;</strong> for{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{desc.trim()}&rdquo;</strong>?
            </span>
          }
          confirmLabel="Yes, Save Expense"
          cancelLabel="Cancel"
          isLoading={isSubmitting}
          onConfirm={executeCreateExpense}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
