"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Check,
  Loader2,
  Search,
  X,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DashboardOrder, OrderStatus } from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  formatRupee,
  getLocalDateString,
  getFirstDayOfCurrentMonth,
  formatDisplayDate,
} from "@/lib/utils";

interface OrdersTabProps {
  orders: DashboardOrder[];
  initialTotalCount?: number;
  initialStatusCounts?: Record<string, number>;
  onOpenNewOrder: () => void;
  onCompleteOrder?: (orderId: string) => Promise<void> | void;
  onOpenRefund?: (order: DashboardOrder) => void;
}

const FILTER_OPTIONS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "advance_paid", label: "Advance Paid" },
  { id: "paid_full", label: "Paid in Full" },
  { id: "completed", label: "Completed" },
  { id: "cancelled_refunded", label: "Refunded" },
];


export function OrdersTab({
  orders,
  initialTotalCount,
  initialStatusCounts,
  onOpenNewOrder,
  onCompleteOrder,
  onOpenRefund,
}: OrdersTabProps) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Pagination state (20 per page)
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [displayedOrders, setDisplayedOrders] = useState<DashboardOrder[]>(orders);
  const [totalCount, setTotalCount] = useState<number>(
    initialTotalCount !== undefined ? initialTotalCount : orders.length
  );
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(
    initialStatusCounts || {
      all: initialTotalCount !== undefined ? initialTotalCount : orders.length,
      advance_paid: orders.filter((o) => o.status === "advance_paid").length,
      paid_full: orders.filter((o) => o.status === "paid_full").length,
      completed: orders.filter((o) => o.status === "completed").length,
      cancelled_refunded: orders.filter((o) => o.status === "cancelled_refunded").length,
    }
  );
  const [isFetching, setIsFetching] = useState(false);
  const isInitialMount = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync with initial orders during render when props change (avoid cascading renders)
  const [prevOrders, setPrevOrders] = useState(orders);
  const [prevInitialTotalCount, setPrevInitialTotalCount] = useState(initialTotalCount);
  const [prevInitialStatusCounts, setPrevInitialStatusCounts] = useState(initialStatusCounts);

  const isDefaultView =
    page === 1 && !searchQuery && !startDate && !endDate && filter === "all" && sortOrder === "newest";

  if (orders !== prevOrders) {
    setPrevOrders(orders);
    if (isDefaultView) {
      setDisplayedOrders(orders);
    } else {
      setDisplayedOrders((prev) =>
        prev.map((disp) => orders.find((o) => o.id === disp.id) || disp)
      );
    }
  }

  if (initialTotalCount !== undefined && initialTotalCount !== prevInitialTotalCount) {
    setPrevInitialTotalCount(initialTotalCount);
    if (isDefaultView) {
      setTotalCount(initialTotalCount);
    }
  }

  if (initialStatusCounts !== undefined && initialStatusCounts !== prevInitialStatusCounts) {
    setPrevInitialStatusCounts(initialStatusCounts);
    if (isDefaultView) {
      setStatusCounts(initialStatusCounts);
    }
  }

  const handleComplete = async (id: string) => {
    if (!onCompleteOrder) return;
    setLoadingId(id);
    try {
      await onCompleteOrder(id);
      setDisplayedOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: "completed", paid: o.amount } : o
        )
      );
      setStatusCounts((prev) => {
        const order = displayedOrders.find((o) => o.id === id);
        const prevStatus = order?.status;
        return {
          ...prev,
          ...(prevStatus && prev[prevStatus] !== undefined
            ? { [prevStatus]: Math.max(0, prev[prevStatus] - 1) }
            : {}),
          completed: (prev.completed || 0) + 1,
        };
      });
    } finally {
      setLoadingId(null);
    }
  };

  // On-demand fast GET fetch for pagination and filters (with auto-abort of previous in-flight queries)
  const fetchPage = useCallback(
    async (
      targetPage: number,
      currentFilter: "all" | OrderStatus,
      currentSearch: string,
      currentStart: string,
      currentEnd: string,
      currentSort: "newest" | "oldest"
    ) => {
      // Abort any previous pending request to eliminate queue lag and race conditions
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
        if (currentFilter !== "all") params.set("status", currentFilter);
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        if (currentStart) params.set("startDate", currentStart);
        if (currentEnd) params.set("endDate", currentEnd);
        params.set("sortOrder", currentSort);

        const res = await fetch(`/api/orders?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
        if (data.success) {
          setDisplayedOrders(data.orders);
          setTotalCount(data.totalCount);
          setPage(data.page);
          if (data.statusCounts) {
            setStatusCounts(data.statusCounts);
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load page of orders:", err);
      } finally {
        setIsFetching(false);
      }
    },
    [pageSize]
  );

  // Debounced search / filter fetcher
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchPage(1, filter, searchQuery, startDate, endDate, sortOrder);
    }, 300);

    return () => clearTimeout(timer);
  }, [filter, searchQuery, startDate, endDate, sortOrder, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Orders &amp; Service Transactions
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Full ledger of counter sales, advance deposits &amp; settlements
          </p>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Order</span>
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
            placeholder="Search order, customer, service..."
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
              title="Filter orders for today only"
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
              title="Filter orders from the 1st of this month to today"
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
              title="Sort orders by date"
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
            const count =
              opt.id === "all"
                ? (statusCounts.all ?? totalCount)
                : (statusCounts[opt.id] ?? 0);

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

      {/* Order List */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[70px_1fr_140px_150px_175px] gap-x-6 items-center px-[21px] py-[10px] bg-galla-paper/50 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.05em]">
          <span>Order</span>
          <span>Customer &amp; Service</span>
          <span className="text-right">Settlement</span>
          <span className="text-center">Status</span>
          <span className="text-right">Action</span>
        </div>

        <div className={`divide-y divide-galla-line ${isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
          {displayedOrders.map((order) => {
            const isPartialRefund =
              order.status === "cancelled_refunded" &&
              Boolean(order.refundAmount && order.paid > 0);

            return (
              <div
                key={order.id}
                className="grid grid-cols-[70px_1fr_140px_150px_175px] gap-x-6 items-center px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
              >
                <span className="font-mono text-[13px] text-galla-ink-soft">
                  {order.id}
                </span>

                <div className="min-w-0 pr-4">
                  <div className="font-sans font-semibold text-[15px] text-galla-ink leading-snug truncate">
                    {order.customer}
                  </div>
                  <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5 truncate">
                    {order.type} &bull; {order.time}
                  </div>
                  {order.status === "cancelled_refunded" && order.refundReason && (
                    <div
                      className="inline-flex items-center gap-1 font-sans text-[11.5px] text-red-700/90 mt-1 bg-red-50/80 border border-red-200/80 px-1.5 py-0.5 rounded-[4px] max-w-full truncate"
                      title={`Refund Reason: ${order.refundReason}`}
                    >
                      <span className="font-semibold text-red-800 shrink-0">Reason:</span>
                      <span className="truncate">{order.refundReason}</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-heading font-semibold text-[15.5px] text-galla-ink tabular-nums">
                    {formatRupee(order.amount)}
                  </div>
                  {order.status === "cancelled_refunded" ? (
                    <div className="space-y-0.5 mt-0.5">
                      <div className="font-sans text-[12px] text-red-700 font-medium tabular-nums">
                        {isPartialRefund && order.refundAmount
                          ? `${formatRupee(order.refundAmount)} refunded`
                          : "Refunded"}
                      </div>
                      {isPartialRefund && (
                        <div className="font-sans text-[12px] text-galla-teal font-medium tabular-nums">
                          {formatRupee(order.paid)} kept
                        </div>
                      )}
                    </div>
                  ) : order.status === "cancelled_converted" ? (
                    <div className="font-sans text-[12px] text-purple-700 font-medium mt-0.5">
                      Converted
                    </div>
                  ) : order.paid < order.amount ? (
                    <div className="space-y-0.5 mt-0.5">
                      {order.paid > 0 && (
                        <div className="font-sans text-[12px] text-galla-teal font-medium tabular-nums">
                          {formatRupee(order.paid)} adv. paid
                        </div>
                      )}
                      <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                        {formatRupee(order.amount - order.paid)} due
                      </div>
                    </div>
                  ) : (
                    <div className="font-sans text-[12px] text-galla-ink-soft/70 mt-0.5">
                      Settled
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <StatusPill
                    status={order.status}
                    customLabel={
                      isPartialRefund && order.refundAmount
                        ? `${formatRupee(order.refundAmount)} Refunded`
                        : undefined
                    }
                    title={order.refundReason ? `Reason: ${order.refundReason}` : undefined}
                  />
                </div>

              <div className="flex items-center justify-end gap-2">
                {order.status === "completed" ? (
                  onOpenRefund ? (
                    <button
                      onClick={() => onOpenRefund(order)}
                      className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                      title="Process refund for this order"
                    >
                      Refund
                    </button>
                  ) : (
                    <span className="text-[12px] font-sans text-galla-ink-soft/40">—</span>
                  )
                ) : order.status === "paid_full" ? (
                  <>
                    <button
                      onClick={() => handleComplete(order.id)}
                      disabled={loadingId === order.id}
                      className="inline-flex items-center gap-1 text-[12px] font-sans font-medium px-2.5 py-1 rounded-[4px] bg-green-50 text-green-800 border border-green-300 hover:bg-green-100 hover:border-green-400 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                      title="Mark service as completed"
                    >
                      {loadingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-green-700" />
                      ) : (
                        <>
                          <span>Mark Done</span>
                          <Check className="h-3.5 w-3.5 text-green-700" />
                        </>
                      )}
                    </button>
                    {onOpenRefund && (
                      <button
                        onClick={() => onOpenRefund(order)}
                        className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                        title="Process refund"
                      >
                        Refund
                      </button>
                    )}
                  </>
                ) : order.status === "advance_paid" ? (
                  <>
                    <button
                      onClick={() => handleComplete(order.id)}
                      disabled={loadingId === order.id}
                      className="inline-flex items-center gap-1 text-[12px] font-sans font-medium px-2.5 py-1 rounded-[4px] bg-green-50 text-green-800 border border-green-300 hover:bg-green-100 hover:border-green-400 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                      title={`Settle ${formatRupee(order.amount - order.paid)} remaining balance and complete order`}
                    >
                      {loadingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-green-700" />
                      ) : (
                        <>
                          <span>Settle &amp; Done</span>
                          <Check className="h-3.5 w-3.5 text-green-700" />
                        </>
                      )}
                    </button>
                    {onOpenRefund && (
                      <button
                        onClick={() => onOpenRefund(order)}
                        className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                        title="Process refund"
                      >
                        Refund
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] font-sans text-galla-ink-soft/40">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

        {displayedOrders.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft space-y-2">
            <p>
              {startDate && endDate
                ? startDate === endDate
                  ? `No orders found for ${formatDisplayDate(startDate)}.`
                  : `No orders found between ${formatDisplayDate(startDate)} and ${formatDisplayDate(endDate)}.`
                : startDate
                ? `No orders found from ${formatDisplayDate(startDate)} onwards.`
                : endDate
                ? `No orders found up to ${formatDisplayDate(endDate)}.`
                : searchQuery
                ? `No orders matching "${searchQuery}".`
                : filter !== "all"
                ? "No orders found in this status category."
                : "No orders recorded yet."}
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

        {/* Pagination Footer (20 per page on-demand) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
          <div className="font-sans text-[12.5px] text-galla-ink-soft">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-medium text-galla-ink">{(page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium text-galla-ink">{Math.min(page * pageSize, totalCount)}</span> of{" "}
                <span className="font-medium text-galla-ink">{totalCount}</span> orders
              </>
            ) : (
              "0 orders to display"
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => fetchPage(page - 1, filter, searchQuery, startDate, endDate, sortOrder)}
              disabled={page <= 1 || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load previous 20 orders"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
              Page {page} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() => fetchPage(page + 1, filter, searchQuery, startDate, endDate, sortOrder)}
              disabled={page >= totalPages || isFetching}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Load next 20 orders"
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
