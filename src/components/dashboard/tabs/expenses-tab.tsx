"use client";

import React from "react";
import { Plus } from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";

interface ExpensesTabProps {
  expenses: DashboardExpense[];
  onOpenNewExpense: () => void;
}

export function ExpensesTab({ expenses, onOpenNewExpense }: ExpensesTabProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Expenses &amp; Petty Cash Outflows
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Operational shop overhead, stock purchases, salon day-to-day &amp; staff advances
          </p>
        </div>

        <button
          onClick={onOpenNewExpense}
          className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Expenses List */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] divide-y divide-galla-line overflow-hidden">
        {expenses.map((expense, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
          >
            <div>
              <div className="font-sans font-semibold text-[15px] text-galla-ink">
                {expense.desc}
              </div>
              <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                <span className="inline-block bg-galla-paper px-2 py-0.5 rounded-[3px] border border-galla-line mr-2">
                  {expense.category}
                </span>
                <span>{expense.time}</span>
              </div>
            </div>

            <div className="font-heading font-semibold text-[16px] text-galla-brick tabular-nums">
              &minus;{formatRupee(expense.amount)}
            </div>
          </div>
        ))}

        {expenses.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No expenses recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
