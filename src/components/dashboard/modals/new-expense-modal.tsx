"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";

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
    "Day-to-day" | "Inventory purchase" | "Salary" | "Rent"
  >("Day-to-day");
  const [amount, setAmount] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const newExpense: DashboardExpense = {
      desc: desc.trim(),
      category,
      amount: parsedAmount,
      time: "Just now",
    };

    onAddExpense(newExpense);
    setDesc("");
    setAmount("");
    setCategory("Day-to-day");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[377px] bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
            Record Expense
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="text-galla-ink-soft hover:text-galla-ink p-1 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-sans text-[12px] font-medium text-galla-ink-soft mb-1">
              What was it for?
            </label>
            <input
              type="text"
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Tea & snacks, Sharma Dealers"
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
                )
              }
              className="w-full bg-galla-paper/50 border border-galla-line rounded-[5px] px-[13px] py-[8px] text-[14px] text-galla-ink focus:outline-none focus:border-galla-teal focus:ring-1 focus:ring-galla-teal transition-colors"
            >
              <option value="Day-to-day">Day-to-day</option>
              <option value="Inventory purchase">Inventory purchase</option>
              <option value="Salary">Salary</option>
              <option value="Rent">Rent</option>
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
              className="w-full bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium py-[10px] rounded-[5px] shadow-sm transition-opacity cursor-pointer"
            >
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
