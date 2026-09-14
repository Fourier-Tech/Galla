"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, X, Calendar, ArrowUpDown } from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";
import {
  formatRupee,
  getLocalDateString,
  getFirstDayOfCurrentMonth,
  formatDisplayDate,
} from "@/lib/utils";

interface ExpensesTabProps {
  expenses: DashboardExpense[];
  onOpenNewExpense: () => void;
}

const FILTER_OPTIONS: {
  id: "all" | DashboardExpense["category"];
  label: string;
}[] = [
  { id: "all", label: "All Expenses" },
  { id: "Day-to-day", label: "Day-to-day" },
  { id: "Inventory purchase", label: "Inventory" },
  { id: "Salary", label: "Salary" },
  { id: "Rent", label: "Rent" },
  { id: "Refund", label: "Refunds" },
];

export function ExpensesTab({ expenses, onOpenNewExpense }: ExpensesTabProps) {
  const [filter, setFilter] = useState<"all" | DashboardExpense["category"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        // Category filter
        if (filter !== "all" && expense.category !== filter) {
          return false;
        }

        // Search filter (description, category, or amount)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const descMatch = expense.desc.toLowerCase().includes(q);
          const catMatch = expense.category.toLowerCase().includes(q);
          const amtMatch = String(expense.amount).includes(q);
          if (!descMatch && !catMatch && !amtMatch) {
            return false;
          }
        }

        // Date range filter
        if (startDate || endDate) {
          const itemDate = getLocalDateString(expense.createdAt);
          if (itemDate) {
            if (startDate && endDate) {
              const from = startDate <= endDate ? startDate : endDate;
              const to = startDate <= endDate ? endDate : startDate;
              if (itemDate < from || itemDate > to) return false;
            } else if (startDate) {
              if (itemDate < startDate) return false;
            } else if (endDate) {
              if (itemDate > endDate) return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
      });
  }, [expenses, filter, searchQuery, startDate, endDate, sortOrder]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Search, Date Picker & Sort Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-[5px] bg-galla-surface border border-galla-line w-full md:w-72 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-xs">
          <Search className="h-4 w-4 text-galla-ink-soft shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expense, vendor, note..."
            className="w-full bg-transparent font-sans text-[13px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Range & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink text-[12.5px] font-sans shadow-xs focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all">
            <Calendar className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
              title="Filter from date (e.g. 1st September)"
            />
            <span className="text-[10.5px] font-semibold text-galla-ink-soft/70">&ndash;</span>
            <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">To</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
              title="Filter to date (e.g. 15th September)"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5 ml-0.5"
                title="Clear date range"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const todayStr = getLocalDateString(new Date()) || "";
                if (startDate === todayStr && endDate === todayStr) {
                  setStartDate("");
                  setEndDate("");
                } else {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                }
              }}
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
                startDate === getLocalDateString(new Date()) && endDate === getLocalDateString(new Date())
                  ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
              }`}
              title="Filter expenses for today only"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                const firstDay = getFirstDayOfCurrentMonth();
                const todayStr = getLocalDateString(new Date()) || "";
                if (startDate === firstDay && endDate === todayStr) {
                  setStartDate("");
                  setEndDate("");
                } else {
                  setStartDate(firstDay);
                  setEndDate(todayStr);
                }
              }}
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
                startDate === getFirstDayOfCurrentMonth() && endDate === getLocalDateString(new Date())
                  ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
              }`}
              title="Filter expenses from the 1st of this month to today"
            >
              This Month
            </button>
          </div>

          {/* Sort By Date */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink shadow-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="bg-transparent font-sans text-[12px] text-galla-ink outline-none cursor-pointer"
              title="Sort expenses by date"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Pills & Reset Action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                  isActive
                    ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                    : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {(searchQuery || startDate || endDate || filter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStartDate("");
              setEndDate("");
              setFilter("all");
            }}
            className="text-[12px] font-sans text-galla-teal hover:underline font-medium cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Filter Summary Counter */}
      {(searchQuery || startDate || endDate || filter !== "all") && (
        <div className="flex items-center justify-between text-[12px] font-sans text-galla-ink-soft px-1">
          <span>
            Showing {filteredExpenses.length} of {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          </span>
          <span className="font-medium text-galla-ink">
            Filtered Outflow:{" "}
            <span className="font-heading font-semibold text-galla-brick tabular-nums">
              {formatRupee(filteredTotal)}
            </span>
          </span>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] divide-y divide-galla-line overflow-hidden">
        {filteredExpenses.map((expense) => (
          <div
            key={expense.id || expense.desc + expense.time + expense.amount}
            className="flex items-center justify-between px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
          >
            <div>
              <div className="font-sans font-semibold text-[15px] text-galla-ink">
                {expense.desc}
              </div>
              <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                <span
                  className={`inline-block px-2 py-0.5 rounded-[3px] border mr-2 text-[11.5px] font-medium ${
                    expense.category === "Refund"
                      ? "bg-red-50 text-red-800 border-red-200"
                      : "bg-galla-paper text-galla-ink-soft border-galla-line"
                  }`}
                >
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

        {filteredExpenses.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft space-y-2">
            <p>
              {startDate && endDate
                ? startDate === endDate
                  ? `No expenses recorded for ${formatDisplayDate(startDate)}.`
                  : `No expenses recorded between ${formatDisplayDate(startDate)} and ${formatDisplayDate(endDate)}.`
                : startDate
                ? `No expenses recorded from ${formatDisplayDate(startDate)} onwards.`
                : endDate
                ? `No expenses recorded up to ${formatDisplayDate(endDate)}.`
                : searchQuery
                ? `No expenses matching "${searchQuery}".`
                : filter !== "all"
                ? `No expenses found in "${filter}" category.`
                : "No expenses recorded yet."}
            </p>
            {(searchQuery || startDate || endDate || filter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStartDate("");
                  setEndDate("");
                  setFilter("all");
                }}
                className="text-galla-teal hover:underline text-[12.5px] font-medium cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
