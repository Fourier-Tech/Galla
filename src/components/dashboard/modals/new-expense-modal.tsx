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

type ExpenseCategoryType = "Day-to-day" | "Salary" | "Rent";
type ExpensePaymentMode = "cash" | "upi" | "card";

const CATEGORIES: ExpenseCategoryType[] = ["Day-to-day", "Salary", "Rent"];
const PAYMENT_MODES: ExpensePaymentMode[] = ["cash", "upi", "card"];

export function NewExpenseModal({
  isOpen,
  onClose,
  onAddExpense,
}: NewExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategoryType>("Day-to-day");
  const [desc, setDesc] = useState("");
  const [staffName, setStaffName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("cash");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedAmount = Number(amount) || 0;

  const getComputedDesc = () => {
    if (category === "Day-to-day") {
      return desc.trim();
    }
    if (category === "Salary") {
      return staffName.trim() ? `Salary — ${staffName.trim()}` : "";
    }
    // Rent
    return notes.trim() ? `Rent (${notes.trim()})` : "Shop Rent";
  };

  const isFormValid =
    parsedAmount > 0 &&
    (category === "Day-to-day"
      ? Boolean(desc.trim())
      : category === "Salary"
      ? Boolean(staffName.trim())
      : true);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (category === "Day-to-day" && !desc.trim()) {
      setErrorMsg("Please enter what the expense was for");
      return;
    }

    if (category === "Salary" && !staffName.trim()) {
      setErrorMsg("Please enter whom you paid (staff name)");
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid expense amount");
      return;
    }

    setShowConfirm(true);
  };

  const executeCreateExpense = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    const computedDesc = getComputedDesc();

    try {
      const res = await createExpenseAction({
        desc: computedDesc,
        category,
        amount: parsedAmount,
        paymentMode,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.expense) {
        onAddExpense(res.expense);
        setDesc("");
        setStaffName("");
        setAmount("");
        setCategory("Day-to-day");
        setPaymentMode("cash");
        setNotes("");
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
      <div className="w-full max-w-[390px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
            Record Expense
          </h3>
          <button
            onClick={onClose}
            type="button"
            disabled={isSubmitting}
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
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
          {/* Category Selector */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 text-[12.5px] font-sans font-medium rounded-[4px] border transition-all cursor-pointer ${
                    category === cat
                      ? "bg-galla-teal/10 text-galla-teal border-galla-teal/40 font-semibold shadow-2xs"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Second Field */}
          {category === "Day-to-day" && (
            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                What was it for?
              </label>
              <input
                type="text"
                autoFocus
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Tea & snacks, utilities, cleaning"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13.5px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />
            </div>
          )}

          {category === "Salary" && (
            <div>
              <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
                Whom did you pay?
              </label>
              <input
                type="text"
                autoFocus
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Staff name, stylist, helper"
                className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13.5px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Amount (₹)
            </label>
            <input
              type="text"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 150"
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors tabular-nums"
            />
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 text-[12.5px] font-sans font-medium rounded-[4px] border uppercase tracking-wider transition-all cursor-pointer ${
                    paymentMode === mode
                      ? "bg-galla-teal/10 text-galla-teal border-galla-teal/40 font-semibold shadow-2xs"
                      : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-heading text-[11.5px] font-semibold text-galla-ink uppercase tracking-wider mb-1.5">
              {category === "Rent" ? "Month / Remarks (Optional)" : "Notes (Optional)"}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                category === "Rent"
                  ? "e.g. October rent, maintenance"
                  : category === "Salary"
                  ? "e.g. Advance, overtime, bonus"
                  : "e.g. Bill #, paid to Rahul"
              }
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-1/3 bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink font-sans text-[13px] font-medium py-[9px] rounded-[5px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-2/3 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium py-[9px] rounded-[5px] shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : `Save Expense ${parsedAmount > 0 ? `(${formatRupee(parsedAmount)})` : ""}`}
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showConfirm}
          title="Confirm Expense"
          description={
            <span>
              Are you sure you want to record an expense of{" "}
              <strong className="font-semibold text-galla-ink">{formatRupee(parsedAmount)}</strong> via{" "}
              <strong className="font-semibold text-galla-ink">{paymentMode.toUpperCase()}</strong> under{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{category}&rdquo;</strong> for{" "}
              <strong className="font-semibold text-galla-ink">&ldquo;{getComputedDesc()}&rdquo;</strong>
              {category !== "Rent" && notes.trim() ? (
                <> (<em>{notes.trim()}</em>)</>
              ) : null}?
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
