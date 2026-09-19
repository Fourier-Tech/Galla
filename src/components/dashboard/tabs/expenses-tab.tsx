"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  X,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { DashboardExpense } from "@/types/dashboard";
import {
  formatRupee,
  getLocalDateString,
  getFirstDayOfCurrentMonth,
  formatDisplayDate,
  formatDisplayNumber,
} from "@/lib/utils";

interface ExpensesTabProps {
  expenses: DashboardExpense[];
  initialTotalCount?: number;
  initialCategoryCounts?: Record<string, number>;
  initialTotalAmount?: number;
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

export function ExpensesTab({
  expenses,
  initialTotalCount,
  initialCategoryCounts,
  initialTotalAmount,
  onOpenNewExpense,
}: ExpensesTabProps) {
  const [filter, setFilter] = useState<"all" | DashboardExpense["category"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Pagination state (20 per page standard)
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [displayedExpenses, setDisplayedExpenses] = useState<DashboardExpense[]>(expenses);
  const [totalCount, setTotalCount] = useState<number>(
    initialTotalCount !== undefined ? initialTotalCount : expenses.length
  );
  const [filteredTotal, setFilteredTotal] = useState<number>(
    initialTotalAmount !== undefined
      ? initialTotalAmount
      : expenses.reduce((sum, e) => sum + e.amount, 0)
  );
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    initialCategoryCounts || {
      all: initialTotalCount !== undefined ? initialTotalCount : expenses.length,
      "Day-to-day": expenses.filter((e) => e.category === "Day-to-day").length,
      "Inventory purchase": expenses.filter((e) => e.category === "Inventory purchase").length,
      Salary: expenses.filter((e) => e.category === "Salary").length,
      Rent: expenses.filter((e) => e.category === "Rent").length,
      Refund: expenses.filter((e) => e.category === "Refund").length,
    }
  );
  const [isFetching, setIsFetching] = useState(false);
  const isInitialMount = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state during render when props change (avoid cascading renders)
  const [prevExpenses, setPrevExpenses] = useState(expenses);
  const [prevInitialTotalCount, setPrevInitialTotalCount] = useState(initialTotalCount);
  const [prevInitialCategoryCounts, setPrevInitialCategoryCounts] = useState(initialCategoryCounts);
  const [prevInitialTotalAmount, setPrevInitialTotalAmount] = useState(initialTotalAmount);

  const isDefaultView =
    page === 1 && !searchQuery && !startDate && !endDate && filter === "all" && sortOrder === "newest";

  if (expenses !== prevExpenses) {
    const prevIds = new Set(prevExpenses.map((e) => e.id));
    const newExpenses = expenses.filter((e) => !prevIds.has(e.id));
    setPrevExpenses(expenses);

    if (newExpenses.length > 0) {
      const matchingNew = newExpenses.filter((ne) => {
        if (filter === "all") return true;
        return ne.category === filter;
      });

      if (matchingNew.length > 0) {
        setTotalCount((prev) => prev + matchingNew.length);
      }

      if (isDefaultView) {
        setDisplayedExpenses(expenses);
      } else {
        setDisplayedExpenses((prev) => {
          const updatedExisting = prev.map((disp) => expenses.find((e) => e.id === disp.id) || disp);
          if (page === 1 && !searchQuery && !startDate && !endDate && matchingNew.length > 0) {
            return [...matchingNew, ...updatedExisting];
          }
          return updatedExisting;
        });
      }
    } else {
      if (isDefaultView) {
        setDisplayedExpenses(expenses);
      } else {
        setDisplayedExpenses((prev) =>
          prev.map((disp) => expenses.find((e) => e.id === disp.id) || disp)
        );
      }
    }
  }

  if (initialTotalCount !== undefined && initialTotalCount !== prevInitialTotalCount) {
    setPrevInitialTotalCount(initialTotalCount);
    setTotalCount(initialTotalCount);
  }

  if (initialCategoryCounts !== undefined && initialCategoryCounts !== prevInitialCategoryCounts) {
    setPrevInitialCategoryCounts(initialCategoryCounts);
    setCategoryCounts(initialCategoryCounts);
  }

  if (initialTotalAmount !== undefined && initialTotalAmount !== prevInitialTotalAmount) {
    setPrevInitialTotalAmount(initialTotalAmount);
    setFilteredTotal(initialTotalAmount);
  }

  // Fast GET fetch for expenses pagination & filters (auto-abort stale queries)
  const fetchPage = useCallback(
    async (
      targetPage: number,
      currentFilter: "all" | DashboardExpense["category"],
      currentSearch: string,
      currentStart: string,
      currentEnd: string,
      currentSort: "newest" | "oldest"
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsFetching(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("pageSize", String(pageSize));
        if (currentFilter !== "all") params.set("category", currentFilter);
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        if (currentStart) params.set("startDate", currentStart);
        if (currentEnd) params.set("endDate", currentEnd);
        params.set("sortOrder", currentSort);

        const res = await fetch(`/api/expenses?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
        if (data.success) {
          setDisplayedExpenses(data.expenses);
          setTotalCount(data.totalCount);
          setPage(data.page);
          if (data.categoryCounts) {
            setCategoryCounts(data.categoryCounts);
          }
          if (data.totalFilteredAmount !== undefined) {
            setFilteredTotal(data.totalFilteredAmount);
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load page of expenses:", err);
      } finally {
        setIsFetching(false);
      }
    },
    [pageSize]
  );

  // Debounce ONLY text-based search (300ms) to prevent excessive requests while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute immediately (0ms delay) on button clicks (category, dates, sort), or when debounced search resolves
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    fetchPage(1, filter, debouncedSearch, startDate, endDate, sortOrder);
  }, [filter, debouncedSearch, startDate, endDate, sortOrder, fetchPage]);

  // Instant in-memory filter on button click (0ms visual feedback)
  const handleCategoryClick = (newCategory: "all" | DashboardExpense["category"]) => {
    setFilter(newCategory);
    if (!searchQuery && !startDate && !endDate) {
      if (newCategory === "all") {
        setDisplayedExpenses(expenses);
        setFilteredTotal(expenses.reduce((sum, e) => sum + e.amount, 0));
      } else {
        const inMemory = expenses.filter((e) => e.category === newCategory);
        setDisplayedExpenses(inMemory);
        setFilteredTotal(inMemory.reduce((sum, e) => sum + e.amount, 0));
      }
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
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
            const count = categoryCounts[opt.id] ?? 0;
            return (
              <button
                key={opt.id}
                onClick={() => handleCategoryClick(opt.id)}
                className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                  isActive
                    ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                    : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>

        {(searchQuery || startDate || endDate || filter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setDebouncedSearch("");
              setStartDate("");
              setEndDate("");
              setFilter("all");
              setDisplayedExpenses(expenses);
              setFilteredTotal(expenses.reduce((sum, e) => sum + e.amount, 0));
            }}
            className="ml-auto text-[12.5px] font-sans text-galla-teal hover:underline font-medium cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Filter Summary Counter */}
      {(searchQuery || startDate || endDate || filter !== "all") && (
        <div className="flex items-center justify-between text-[12px] font-sans text-galla-ink-soft px-1">
          <span>
            Showing {totalCount > 0 ? Math.min(displayedExpenses.length, totalCount) : 0} of {totalCount} matching expense{totalCount !== 1 ? "s" : ""}
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
      <div className="bg-galla-surface border border-galla-line rounded-[5px] overflow-hidden">
        <div className={`divide-y divide-galla-line ${isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
          {displayedExpenses.map((expense) => (
            <div
              key={expense.id || expense.desc + expense.time + expense.amount}
              className="flex items-center justify-between px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
            >
              <div>
                <div className="font-sans font-semibold text-[15px] text-galla-ink">
                  {expense.desc}
                </div>
                <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {expense.expenseNumber && (
                    <span className="font-mono text-[11.5px] font-semibold text-galla-brick mr-1">
                      {formatDisplayNumber(expense.expenseNumber)}
                    </span>
                  )}
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
                {expense.notes && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                    title={`Note: ${expense.notes}`}
                  >
                    <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                      Note
                    </span>
                    <span className="truncate font-medium">{expense.notes}</span>
                  </div>
                )}
              </div>

              <div className="font-heading font-semibold text-[16px] text-galla-brick tabular-nums">
                &minus;{formatRupee(expense.amount)}
              </div>
            </div>
          ))}

          {displayedExpenses.length === 0 && (
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
                    setDebouncedSearch("");
                    setStartDate("");
                    setEndDate("");
                    setFilter("all");
                    setDisplayedExpenses(expenses);
                  }}
                  className="text-galla-teal hover:underline text-[12.5px] font-medium cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Standard Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-[21px] py-3 bg-galla-paper/30 border-t border-galla-line">
          <div className="text-[12px] font-sans text-galla-ink-soft">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-medium text-galla-ink">{Math.min((page - 1) * pageSize + 1, totalCount)}</span> to{" "}
                <span className="font-medium text-galla-ink">{Math.min(page * pageSize, totalCount)}</span> of{" "}
                <span className="font-medium text-galla-ink">{totalCount}</span> expenses
              </>
            ) : (
              "0 expenses to display"
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => fetchPage(page - 1, filter, debouncedSearch, startDate, endDate, sortOrder)}
              disabled={page <= 1 || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load previous 20 expenses"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
              Page {page} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => fetchPage(page + 1, filter, debouncedSearch, startDate, endDate, sortOrder)}
              disabled={page >= totalPages || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load next 20 expenses"
            >
              <span>Next</span>
              {isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-galla-teal" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
