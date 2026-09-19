"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Phone,
  MessageSquare,
} from "lucide-react";
import { DashboardOrder, OrderStatus } from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import { RescheduleOrderModal } from "@/components/dashboard/modals/reschedule-order-modal";
import { OrderDetailsModal } from "@/components/dashboard/modals/order-details-modal";
import {
  formatRupee,
  getLocalDateString,
  getFirstDayOfCurrentMonth,
  formatDisplayDate,
  formatBookingDate,
  formatAppointmentTime,
  getBookingUrgency,
  getWhatsAppReminderUrl,
  formatPhoneNumber,
  formatDisplayNumber,
} from "@/lib/utils";

interface OrdersTabProps {
  orders: DashboardOrder[];
  initialTotalCount?: number;
  initialStatusCounts?: Record<string, number>;
  initialFilter?: OrderStatus | "all";
  salonName?: string;
  onOpenNewOrder: () => void;
  onCompleteOrder?: (orderId: string) => Promise<void> | void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onRescheduleOrder?: (updatedOrder: DashboardOrder) => void;
  onOpenSettle?: (order: DashboardOrder) => void;
}

const FILTER_OPTIONS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "created", label: "Payment Due" },
  { id: "advance_paid", label: "Advance Bookings" },
  { id: "completed", label: "Completed" },
  { id: "cancelled_refunded", label: "Refunded" },
];


export function OrdersTab({
  orders,
  initialTotalCount,
  initialStatusCounts,
  initialFilter,
  salonName,
  onOpenNewOrder,
  onCompleteOrder,
  onOpenRefund,
  onRescheduleOrder,
  onOpenSettle,
}: OrdersTabProps) {
  const [filter, setFilter] = useState<"all" | OrderStatus>(initialFilter || "all");
  const [prevInitialFilter, setPrevInitialFilter] = useState(initialFilter);
  const [reschedulingOrder, setReschedulingOrder] = useState<DashboardOrder | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<DashboardOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
      created: orders.filter((o) => o.status === "created").length,
      advance_paid: orders.filter((o) => o.status === "advance_paid" || o.status === "paid_full").length,
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

  // Sync with initialFilter prop when navigated from Dashboard
  if (initialFilter !== undefined && initialFilter !== prevInitialFilter) {
    setPrevInitialFilter(initialFilter);
    setFilter(initialFilter);
    if (!searchQuery && !startDate && !endDate) {
      if (initialFilter === "all") {
        setDisplayedOrders(orders);
      } else if (initialFilter === "advance_paid") {
        const inMemory = orders.filter((o) => o.status === "advance_paid" || o.status === "paid_full");
        setDisplayedOrders(inMemory);
      } else {
        const inMemory = orders.filter((o) => o.status === initialFilter);
        setDisplayedOrders(inMemory);
      }
    }
  }

  const isDefaultView =
    page === 1 && !searchQuery && !startDate && !endDate && filter === "all" && sortOrder === "newest";

  if (orders !== prevOrders) {
    const prevMap = new Map(prevOrders.map((o) => [o.id, o]));
    const newOrders = orders.filter((o) => !prevMap.has(o.id));
    setPrevOrders(orders);

    if (newOrders.length > 0) {
      // Find new orders that match current view filter
      const matchingNew = newOrders.filter((no) => {
        if (filter === "all") return true;
        if (filter === "advance_paid") return no.status === "advance_paid" || no.status === "paid_full";
        return no.status === filter;
      });

      if (matchingNew.length > 0) {
        setTotalCount((prev) => prev + matchingNew.length);
      }

      // Increment status counts instead of wiping them out with orders.length
      setStatusCounts((prevCounts) => {
        const next = { ...prevCounts };
        for (const no of newOrders) {
          next.all = (next.all || 0) + 1;
          if (no.status === "advance_paid" || no.status === "paid_full") {
            next.advance_paid = (next.advance_paid || 0) + 1;
          } else if (no.status in next) {
            next[no.status] = (next[no.status] || 0) + 1;
          }
        }
        return next;
      });

      if (isDefaultView) {
        setDisplayedOrders(orders);
      } else {
        setDisplayedOrders((prev) => {
          const updatedExisting = prev.map((disp) => orders.find((o) => o.id === disp.id) || disp);
          if (page === 1 && !searchQuery && !startDate && !endDate && matchingNew.length > 0) {
            return [...matchingNew, ...updatedExisting];
          }
          return updatedExisting;
        });
      }
    } else {
      // Existing orders were updated (e.g. status change, settlement, refund)
      if (isDefaultView) {
        setDisplayedOrders(orders);
      } else {
        setDisplayedOrders((prev) =>
          prev.map((disp) => orders.find((o) => o.id === disp.id) || disp)
        );
      }
    }
  }

  if (initialTotalCount !== undefined && initialTotalCount !== prevInitialTotalCount) {
    setPrevInitialTotalCount(initialTotalCount);
    setTotalCount(initialTotalCount);
  }

  if (initialStatusCounts !== undefined && initialStatusCounts !== prevInitialStatusCounts) {
    setPrevInitialStatusCounts(initialStatusCounts);
    setStatusCounts(initialStatusCounts);
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
        const isAdvance = prevStatus === "advance_paid" || prevStatus === "paid_full";
        return {
          ...prev,
          ...(isAdvance
            ? { advance_paid: Math.max(0, (prev.advance_paid || 1) - 1) }
            : prevStatus && prev[prevStatus] !== undefined
              ? { [prevStatus]: Math.max(0, prev[prevStatus] - 1) }
              : {}),
          completed: (prev.completed || 0) + 1,
        };
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleRescheduleSuccess = (updatedOrder: DashboardOrder) => {
    setDisplayedOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    onRescheduleOrder?.(updatedOrder);
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

  // Debounce ONLY text-based search input (300ms) to prevent excessive requests while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute immediately (0ms delay) on button clicks (status, dates, sort), or when debounced search resolves
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    fetchPage(1, filter, debouncedSearch, startDate, endDate, sortOrder);
  }, [filter, debouncedSearch, startDate, endDate, sortOrder, fetchPage]);

  // Instant in-memory filter on button click (0ms visual feedback)
  const handleFilterClick = (newFilter: "all" | OrderStatus) => {
    setFilter(newFilter);
    if (!searchQuery && !startDate && !endDate) {
      if (newFilter === "all") {
        setDisplayedOrders(orders);
      } else if (newFilter === "advance_paid") {
        const inMemory = orders.filter((o) => o.status === "advance_paid" || o.status === "paid_full");
        setDisplayedOrders(inMemory);
      } else {
        const inMemory = orders.filter((o) => o.status === newFilter);
        setDisplayedOrders(inMemory);
      }
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Priority urgency sorting for Advance Booking & Payment Due: nearest date to today first
  const sortedOrders = useMemo(() => {
    if ((filter !== "advance_paid" && filter !== "created") || searchQuery || startDate || endDate) {
      return displayedOrders;
    }

    return [...displayedOrders].sort((a, b) => {
      const isDueA = a.status === "created" || (a.paid < a.amount && a.status !== "advance_paid" && a.status !== "paid_full" && a.status !== "cancelled_refunded" && a.status !== "cancelled_converted");
      const isDueB = b.status === "created" || (b.paid < b.amount && b.status !== "advance_paid" && b.status !== "paid_full" && b.status !== "cancelled_refunded" && b.status !== "cancelled_converted");
      const isPendingA = a.status === "advance_paid" || a.status === "paid_full" || isDueA;
      const isPendingB = b.status === "advance_paid" || b.status === "paid_full" || isDueB;
      const urgencyA = isPendingA && a.scheduledFor ? getBookingUrgency(a.scheduledFor) : null;
      const urgencyB = isPendingB && b.scheduledFor ? getBookingUrgency(b.scheduledFor) : null;

      // 1. Orders with scheduled dates appear before unscheduled orders
      if (!urgencyA && urgencyB) return 1;
      if (urgencyA && !urgencyB) return -1;
      if (!urgencyA && !urgencyB) {
        const dateA = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      }

      // 2. Sort by nearest distance to today (distance = 0 is Today, then 1 day away, 2 days away, etc.)
      const distA = Math.abs(urgencyA!.daysAway);
      const distB = Math.abs(urgencyB!.daysAway);

      if (distA !== distB) {
        return distA - distB;
      }

      // 3. Tie-breaking when distances are equal (e.g. -1 day overdue vs +1 day upcoming)
      if (urgencyA!.daysAway !== urgencyB!.daysAway) {
        if (filter === "created") {
          // For Payment Due: Overdue (daysAway < 0) has higher urgency than future
          return urgencyA!.daysAway - urgencyB!.daysAway;
        } else {
          // For Advance Booking: Tomorrow's appointment (daysAway > 0) has preparation priority
          return urgencyB!.daysAway - urgencyA!.daysAway;
        }
      }

      // 4. Secondary sort for identical dates: newest activity/creation first
      const dateA = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA;
    });
  }, [displayedOrders, filter, searchQuery, startDate, endDate]);

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
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${startDate === getLocalDateString(new Date()) && endDate === getLocalDateString(new Date())
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
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${startDate === getFirstDayOfCurrentMonth() && endDate === getLocalDateString(new Date())
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
                onClick={() => handleFilterClick(opt.id)}
                className={`px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${isActive
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
              setDisplayedOrders(orders);
            }}
            className="ml-auto text-[12.5px] font-sans text-galla-teal hover:underline font-medium cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Order List */}
      <div className="bg-galla-surface border border-galla-line rounded-[6px] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Table Header */}
            <div className="grid grid-cols-[115px_minmax(200px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[12px] bg-galla-paper/60 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.06em]">
              <span>Order</span>
              <span>Customer &amp; Service</span>
              <span className="text-right">Settlement</span>
              <span className="text-center">Status</span>
              <span className="text-right">Action</span>
            </div>

            <div className={`divide-y divide-galla-line ${isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
              {sortedOrders.map((order) => {
                const isPartialRefund =
                  order.status === "cancelled_refunded" &&
                  Boolean(order.refundAmount && order.paid > 0);
                const isPendingOrder = order.status === "advance_paid" || order.status === "created" || order.status === "paid_full";
                const isDueOrder =
                  order.status === "created" ||
                  (order.paid < order.amount &&
                    order.status !== "advance_paid" &&
                    order.status !== "paid_full" &&
                    order.status !== "cancelled_refunded" &&
                    order.status !== "cancelled_converted");
                const urgency = (isPendingOrder || isDueOrder) && order.scheduledFor ? getBookingUrgency(order.scheduledFor) : null;
                // ponytail: Settle/Done actions only show once appointment date has arrived (today or overdue). Upgrade path: tenant config for strictly today if past-date locks are requested.
                const isAppointmentDue = !isPendingOrder || !order.scheduledFor || (urgency !== null && urgency.daysAway <= 0);

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderDetails(order)}
                    className="grid grid-cols-[115px_minmax(200px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[16px] hover:bg-galla-paper/50 transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-[13px] text-galla-ink-soft">
                      {formatDisplayNumber(order.id)}
                    </span>

                    <div className="min-w-0 pr-4">
                      <div className="font-sans font-semibold text-[15px] text-galla-ink leading-snug truncate">
                        {order.customer}
                      </div>
                      {order.customerPhone && (
                        <div className="font-mono text-[12px] text-galla-ink-soft/90 mt-0.5 truncate">
                          <a
                            href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-galla-teal hover:underline transition-colors"
                            title={`Call ${order.customer}: ${order.customerPhone}`}
                          >
                            {formatPhoneNumber(order.customerPhone)}
                          </a>
                        </div>
                      )}
                      <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5 truncate">
                        {order.type} &bull; {order.time}
                      </div>
                      {order.lastUpdatedTime && (
                        <div className="font-sans text-[11px] text-galla-ink-soft/75 mt-0.5 flex items-center gap-1 truncate">
                          <span className="text-galla-ink-soft/60">Last update:</span>
                          <span className="font-medium text-galla-ink-soft">{order.lastUpdatedTime}</span>
                        </div>
                      )}
                      {order.notes && (
                        <div
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                          title={`Note: ${order.notes}`}
                        >
                          <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                            Note
                          </span>
                          <span className="truncate font-medium">{order.notes}</span>
                        </div>
                      )}
                      {isDueOrder && !order.scheduledFor && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReschedulingOrder(order);
                            }}
                            className="inline-flex items-center gap-1 font-sans text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-[4px] font-medium hover:bg-amber-100 transition-all cursor-pointer group"
                            title="Click to set payment due date"
                          >
                            <Calendar className="h-3 w-3 text-amber-700 shrink-0" />
                            <span>Set Due Date</span>
                            <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                              + Add
                            </span>
                          </button>
                        </div>
                      )}
                      {(isPendingOrder || isDueOrder) && order.scheduledFor && (() => {
                        if (isDueOrder) {
                          const isToday = urgency?.tone === "today";
                          const isOverdue = urgency?.tone === "overdue";
                          const isUrgent = Boolean(isToday || isOverdue);

                          const dateStr = formatBookingDate(order.scheduledFor);
                          const timeStr = order.scheduledTime ? formatAppointmentTime(order.scheduledTime) : null;
                          const fullSlotStr = timeStr ? `${dateStr}, ${timeStr}` : dateStr;

                          const badgeStyle = isOverdue
                            ? "text-red-900 bg-red-100 border-red-300 font-semibold"
                            : isToday
                            ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold"
                            : "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";

                          const badgeLabel = isOverdue
                            ? `⚠️ Overdue Due Date (${fullSlotStr})`
                            : isToday
                            ? `🚨 Due Today (${fullSlotStr})`
                            : `Due: ${fullSlotStr}`;

                          const showContactOptions = isUrgent;

                          const waUrl = showContactOptions
                            ? getWhatsAppReminderUrl({
                                phone: order.customerPhone,
                                customerName: order.customer,
                                salonName: salonName || "our salon",
                                bookingDate: order.scheduledFor,
                                bookingTime: order.scheduledTime,
                                orderType: order.type,
                                productName: order.itemsSummary,
                                orderId: order.id,
                                pendingAmount: Math.max(0, order.amount - order.paid),
                                isPaymentDue: true,
                              })
                            : null;

                          return (
                            <div className="mt-1.5 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReschedulingOrder(order);
                                  }}
                                  className={`inline-flex items-center gap-1 font-sans text-[11.5px] border px-2 py-0.5 rounded-[4px] shadow-2xs hover:opacity-85 hover:shadow-xs transition-all cursor-pointer group ${badgeStyle}`}
                                  title="Click to reschedule payment due date"
                                >
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <span>{badgeLabel}</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    Reschedule
                                  </span>
                                </button>
                              </div>

                              {showContactOptions && (
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {order.customerPhone ? (
                                    <a
                                      href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                                      title={`Call client: ${order.customerPhone}`}
                                    >
                                      <Phone className="h-3 w-3 text-amber-800 shrink-0" />
                                      <span>Call</span>
                                    </a>
                                  ) : null}

                                  {waUrl ? (
                                    <a
                                      href={waUrl}
                                      onClick={(e) => e.stopPropagation()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                                      title="Send pending balance reminder via WhatsApp"
                                    >
                                      <MessageSquare className="h-3 w-3 text-emerald-700 shrink-0" />
                                      <span>WhatsApp Msg</span>
                                    </a>
                                  ) : null}

                                  {!order.customerPhone && (
                                    <span className="text-[11px] text-galla-ink-soft/70 italic">
                                      No phone recorded
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (!urgency) {
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReschedulingOrder(order);
                              }}
                              className="inline-flex items-center gap-1 font-sans text-[11.5px] text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-[4px] mt-1 font-medium hover:opacity-85 transition-all cursor-pointer group"
                              title="Click to reschedule appointment date and time"
                            >
                              <Calendar className="h-3 w-3 text-amber-700 shrink-0" />
                              <span>
                                Booked for: {formatBookingDate(order.scheduledFor)}
                                {order.scheduledTime ? ` at ${formatAppointmentTime(order.scheduledTime)}` : ""}
                              </span>
                              <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                Reschedule
                              </span>
                            </button>
                          );
                        }

                        const isProductSale = order.type === "Product sale";
                        const isToday = urgency.tone === "today";
                        const isTomorrow = urgency.tone === "tomorrow";
                        const isIn2Days = urgency.tone === "in_2_days";

                        const badgeStyle = (isProductSale && isTomorrow)
                          ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold"
                          : isToday
                            ? "text-rose-800 bg-rose-50 border-rose-200"
                            : isTomorrow
                              ? "text-amber-900 bg-amber-50 border-amber-300"
                              : isIn2Days
                                ? "text-blue-800 bg-blue-50 border-blue-200"
                                : urgency.tone === "overdue"
                                  ? "text-gray-700 bg-gray-100 border-gray-300"
                                  : "text-amber-800 bg-amber-50/90 border-amber-200/80";

                        const dateStr = formatBookingDate(order.scheduledFor);
                        const timeStr = order.scheduledTime ? formatAppointmentTime(order.scheduledTime) : null;
                        const fullSlotStr = timeStr ? `${dateStr}, ${timeStr}` : dateStr;

                        const badgeLabel = isProductSale
                          ? isTomorrow
                            ? `🚨 Urgent: Expected Tomorrow (${fullSlotStr})`
                            : isToday
                              ? `🛍️ Ready for Pickup Today (${fullSlotStr})`
                              : isIn2Days
                                ? `📦 Expected in 2 Days (${fullSlotStr})`
                                : urgency.tone === "overdue"
                                  ? `⚠️ Pickup Overdue (${fullSlotStr})`
                                  : `Expected Pickup: ${fullSlotStr}`
                          : isToday
                            ? `🚨 Today (${fullSlotStr})`
                            : isTomorrow
                              ? `⏰ Tomorrow (${fullSlotStr})`
                              : isIn2Days
                                ? `📅 In 2 Days (${fullSlotStr})`
                                : urgency.tone === "overdue"
                                  ? `⚠️ Overdue (${fullSlotStr})`
                                  : `Booked for: ${fullSlotStr}`;

                        // Show Call & Msg on:
                        // - Product sale: on the selected date that day (isToday) or overdue
                        // - Service booking: 1 day before (isTomorrow)
                        const showContactOptions = isProductSale
                          ? (isToday || urgency.tone === "overdue")
                          : isTomorrow;

                        const waUrl = showContactOptions
                          ? getWhatsAppReminderUrl({
                            phone: order.customerPhone,
                            customerName: order.customer,
                            salonName: salonName || "our salon",
                            bookingDate: order.scheduledFor,
                            bookingTime: order.scheduledTime,
                            orderType: order.type,
                            productName: order.itemsSummary,
                            orderId: order.id,
                            pendingAmount: Math.max(0, order.amount - order.paid),
                          })
                          : null;

                        return (
                          <div className="mt-1.5 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReschedulingOrder(order);
                                }}
                                className={`inline-flex items-center gap-1 font-sans text-[11.5px] border px-2 py-0.5 rounded-[4px] font-medium shadow-2xs hover:opacity-85 hover:shadow-xs transition-all cursor-pointer group ${badgeStyle}`}
                                title="Click to reschedule appointment date"
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>{badgeLabel}</span>
                                <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                  Reschedule
                                </span>
                              </button>

                              {/* 2 Days Before: Internal Notice for Staff & Salon Owner */}
                              {isIn2Days && (
                                <span className="inline-flex items-center text-[11px] font-sans font-medium text-blue-700 bg-blue-50/80 border border-blue-200 px-1.5 py-0.5 rounded">
                                  Staff &amp; Owner Prep
                                </span>
                              )}
                            </div>

                            {/* Direct Call & WhatsApp Action Buttons */}
                            {showContactOptions && (
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {order.customerPhone ? (
                                  <a
                                    href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                                    title={`Call client: ${order.customerPhone}`}
                                  >
                                    <Phone className="h-3 w-3 text-amber-800 shrink-0" />
                                    <span>Call</span>
                                  </a>
                                ) : null}

                                {waUrl ? (
                                  <a
                                    href={waUrl}
                                    onClick={(e) => e.stopPropagation()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                                    title={isProductSale ? "Send pickup ready notification via WhatsApp" : "Send reminder via WhatsApp"}
                                  >
                                    <MessageSquare className="h-3 w-3 text-emerald-700 shrink-0" />
                                    <span>{isProductSale ? "WhatsApp (Msg)" : "WhatsApp Reminder"}</span>
                                  </a>
                                ) : null}

                                {!order.customerPhone && (
                                  <span className="text-[11px] text-galla-ink-soft/70 italic">
                                    No phone recorded
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {order.status === "cancelled_refunded" &&
                        order.refundReason &&
                        order.refundReason !== "Customer requested refund" &&
                        order.refundReason !== "Customer refund at counter" && (
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
                          {order.advanceAmount && order.advanceAmount > 0 && (
                            <div className="font-sans text-[12px] text-galla-ink-soft font-medium flex items-center justify-end gap-1 tabular-nums">
                              <span>{formatRupee(order.advanceAmount)} adv. paid</span>
                              {(order.advancePaymentMode || order.paymentMode) && (
                                <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                  {order.advancePaymentMode || order.paymentMode}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="font-sans text-[12px] text-red-700 font-medium flex items-center justify-end gap-1 tabular-nums">
                            <span>
                              {order.refundAmount
                                ? `${formatRupee(order.refundAmount)} refunded`
                                : "Refunded"}
                            </span>
                            {order.refundMode && (
                              <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                {order.refundMode}
                              </span>
                            )}
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
                            <div className="font-sans text-[12px] text-galla-teal font-medium flex items-center justify-end gap-1 tabular-nums">
                              <span>{formatRupee(order.paid)} adv.</span>
                              {order.paymentMode && (
                                <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                  {order.paymentMode}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                            {formatRupee(order.amount - order.paid)} due
                          </div>
                        </div>
                      ) : order.advanceAmount && order.advanceAmount > 0 && order.advanceAmount < order.amount ? (
                        <div className="space-y-0.5 mt-0.5">
                          <div className="font-sans text-[12px] text-galla-ink-soft font-medium flex items-center justify-end gap-1 tabular-nums">
                            <span>{formatRupee(order.advanceAmount)} adv.</span>
                            {order.advancePaymentMode && (
                              <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                {order.advancePaymentMode}
                              </span>
                            )}
                          </div>
                          <div className="font-sans text-[12px] text-galla-teal font-medium flex items-center justify-end gap-1 tabular-nums">
                            <span>{formatRupee(order.amount - order.advanceAmount)} settled</span>
                            {order.paymentMode && (
                              <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                {order.paymentMode}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="font-sans text-[12px] text-galla-ink-soft/80 mt-0.5 flex items-center justify-end gap-1">
                          <span>Settled</span>
                          {order.paymentMode && (
                            <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                              {order.paymentMode}
                            </span>
                          )}
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
                        onOpenRefund && order.paid > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRefund(order);
                            }}
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
                          {isAppointmentDue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const hasPending = order.lineItems?.some((li) => !li.fulfilled);
                                if (hasPending && onOpenSettle) {
                                  onOpenSettle(order);
                                } else {
                                  handleComplete(order.id);
                                }
                              }}
                              disabled={loadingId === order.id}
                              className="inline-flex items-center gap-1 text-[12px] font-sans font-medium px-2.5 py-1 rounded-[4px] bg-green-50 text-green-800 border border-green-300 hover:bg-green-100 hover:border-green-400 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                              title={order.lineItems?.some((li) => !li.fulfilled) ? "Deliver products and complete order" : "Mark service as completed"}
                            >
                              {loadingId === order.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-green-700" />
                              ) : (
                                <>
                                  <span>{order.lineItems?.some((li) => !li.fulfilled) ? "Deliver & Done" : "Mark Done"}</span>
                                  <Check className="h-3.5 w-3.5 text-green-700" />
                                </>
                              )}
                            </button>
                          )}
                          {onOpenRefund && order.paid > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRefund(order);
                              }}
                              className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                              title="Process refund"
                            >
                              Refund
                            </button>
                          ) : !isAppointmentDue ? (
                            <span className="text-[12px] font-sans text-galla-ink-soft/40">—</span>
                          ) : null}
                        </>
                      ) : order.status === "advance_paid" || order.status === "created" ? (
                        <>
                          {isAppointmentDue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSettle ? onOpenSettle(order) : handleComplete(order.id);
                              }}
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
                          )}
                          {onOpenRefund && order.paid > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRefund(order);
                              }}
                              className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                              title="Process refund"
                            >
                              Refund
                            </button>
                          ) : !isAppointmentDue ? (
                            <span className="text-[12px] font-sans text-galla-ink-soft/40">—</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[12px] font-sans text-galla-ink-soft/40">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Reschedule Booking Modal */}
      <RescheduleOrderModal
        order={reschedulingOrder}
        isOpen={Boolean(reschedulingOrder)}
        onClose={() => setReschedulingOrder(null)}
        onRescheduleSuccess={handleRescheduleSuccess}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrderDetails}
        isOpen={Boolean(selectedOrderDetails)}
        onClose={() => setSelectedOrderDetails(null)}
        salonName={salonName}
        onOpenSettle={onOpenSettle}
        onOpenReschedule={(ord) => {
          setSelectedOrderDetails(null);
          setReschedulingOrder(ord);
        }}
        onOpenRefund={onOpenRefund}
      />
    </div>
  );
}
