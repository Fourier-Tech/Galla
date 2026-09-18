"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Search,
  Loader2,
  PackagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { DashboardPurchaseOrder, DashboardSupplier } from "@/types/dashboard";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  formatOrderTime,
  getBookingUrgency,
  getSupplierWhatsAppReminderUrl,
  getBillStatus,
  getLocalDateString,
  getFirstDayOfCurrentMonth,
  formatDisplayNumber,
  type BillStatusKey,
} from "@/lib/utils";
import {
  getPurchaseOrdersAction,
  recordPurchaseOrderPaymentAction,
} from "@/app/dashboard/actions";
import { PurchaseBillDetailsModal } from "./modals/purchase-bill-details-modal";
import { SettlePurchaseBillModal } from "./modals/settle-purchase-bill-modal";
import { ReschedulePurchaseOrderModal } from "./modals/reschedule-purchase-order-modal";
import { StatusPill } from "@/components/dashboard/status-pill";

function formatInvoiceDate(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const dateFormatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timeFormatted = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dateFormatted}, ${timeFormatted}`;
}

function getBillLastUpdatedTime(po: DashboardPurchaseOrder): string | undefined {
  if (po.lastUpdatedTime) return po.lastUpdatedTime;

  const candidateTimestamps: number[] = [
    po.updatedAt ? new Date(po.updatedAt).getTime() : 0,
    ...(po.payments || []).map((p) => (p.recordedAt ? new Date(p.recordedAt).getTime() : 0)),
  ].filter((t): t is number => Boolean(t) && !isNaN(t));

  if (candidateTimestamps.length === 0) return undefined;

  const latestTime = Math.max(...candidateTimestamps);
  const createdTime = po.createdAt
    ? new Date(po.createdAt).getTime()
    : po.invoiceDate
    ? new Date(po.invoiceDate).getTime()
    : 0;

  if (createdTime && latestTime - createdTime > 60 * 1000) {
    return formatOrderTime(new Date(latestTime));
  }

  return undefined;
}

const BILL_FILTER_OPTIONS: { id: "all" | BillStatusKey; label: string }[] = [
  { id: "all", label: "All Bills" },
  { id: "pending", label: "Pending" },
  { id: "advance", label: "Advance" },
  { id: "completed", label: "Completed" },
];

interface PurchaseOrdersViewProps {
  onBack?: () => void;
  onOpenStockIn?: () => void;
  onPaymentRecorded?: (updatedPO: DashboardPurchaseOrder) => void;
  showHeader?: boolean;
  searchQuery?: string;
  suppliers?: DashboardSupplier[];
  salonName?: string;
  initialFilter?: "all" | BillStatusKey;
}

export function PurchaseOrdersView({
  onBack,
  onOpenStockIn,
  onPaymentRecorded,
  showHeader = true,
  searchQuery: externalSearchQuery,
  suppliers,
  salonName,
  initialFilter,
}: PurchaseOrdersViewProps) {
  const [orders, setOrders] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | BillStatusKey>(initialFilter || "all");

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
      setPage(1);
    }
  }, [initialFilter]);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const activeSearchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected bill for view modal
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<DashboardPurchaseOrder | null>(null);

  // "Pay Now" settlement dialog state
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<DashboardPurchaseOrder | null>(null);

  // Reschedule delivery / payment due date modal state
  const [reschedulingState, setReschedulingState] = useState<{
    po: DashboardPurchaseOrder;
    mode: "delivery" | "due_date";
  } | null>(null);

  const handleOpenReschedule = (po: DashboardPurchaseOrder, mode: "delivery" | "due_date") => {
    setReschedulingState({ po, mode });
  };

  // Sync orders whenever suppliers prop is updated
  useEffect(() => {
    if (!suppliers || suppliers.length === 0) return;
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    setOrders((prev) =>
      prev.map((o) => {
        const s = supMap.get(o.supplierId);
        if (!s) return o;
        if (
          s.name !== o.supplierName ||
          s.phone !== o.supplierPhone ||
          s.companyName !== o.supplierCompany
        ) {
          return {
            ...o,
            supplierName: s.name || o.supplierName,
            supplierPhone: s.phone ? formatPhoneNumber(s.phone) : o.supplierPhone,
            supplierCompany: s.companyName !== undefined ? s.companyName : o.supplierCompany,
          };
        }
        return o;
      })
    );
  }, [suppliers]);

  // Load orders on initial mount
  useEffect(() => {
    let ignore = false;
    setIsLoading(true);

    getPurchaseOrdersAction()
      .then((res) => {
        if (!ignore) {
          if (res.success && res.purchaseOrders) {
            setOrders(res.purchaseOrders);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Live status counts (matching Orders Tab)
  const statusCounts = useMemo<Record<"all" | BillStatusKey, number>>(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => getBillStatus(o).statusKey === "pending").length,
      advance: orders.filter((o) => getBillStatus(o).statusKey === "advance").length,
      completed: orders.filter((o) => getBillStatus(o).statusKey === "completed").length,
    };
  }, [orders]);

  const stats = useMemo(() => {
    const totalPending = orders.reduce((sum, o) => sum + (o.amountPending || 0), 0);
    return { totalPending, pendingCount: statusCounts.pending };
  }, [orders, statusCounts]);

  // Filtered and sorted orders (matching Orders Tab logic)
  const filteredOrders = useMemo(() => {
    const result = orders.filter((o) => {
      if (activeFilter !== "all") {
        const { statusKey } = getBillStatus(o);
        if (statusKey !== activeFilter) return false;
      }

      if (startDate || endDate) {
        const candidateDates: string[] = [
          o.invoiceDate ? getLocalDateString(new Date(o.invoiceDate)) : "",
          o.createdAt ? getLocalDateString(new Date(o.createdAt)) : "",
          o.updatedAt ? getLocalDateString(new Date(o.updatedAt)) : "",
          ...(o.payments || []).map((p) => (p.recordedAt ? getLocalDateString(new Date(p.recordedAt)) : "")),
        ].filter((d): d is string => Boolean(d));

        const matchesDateRange = candidateDates.some((d) => {
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });

        if (!matchesDateRange) return false;
      }

      const q = activeSearchQuery.trim().toLowerCase();
      if (!q) return true;

      const poNumMatch =
        o.purchaseOrderNumber?.toLowerCase().includes(q) ||
        formatDisplayNumber(o.purchaseOrderNumber)?.toLowerCase().includes(q);
      const supMatch = o.supplierName?.toLowerCase().includes(q);
      const invMatch = o.dealerInvoiceNumber?.toLowerCase().includes(q);
      const noteMatch = o.notes?.toLowerCase().includes(q);
      const itemMatch = o.items?.some((it) => it.productName.toLowerCase().includes(q));
      return Boolean(poNumMatch || supMatch || invMatch || noteMatch || itemMatch);
    });

    return result.sort((a, b) => {
      const getEffectiveTime = (item: DashboardPurchaseOrder) => {
        const tCreated = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        const tInv = item.invoiceDate ? new Date(item.invoiceDate).getTime() : 0;
        const tUpdated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        const tPayments = (item.payments || []).map((p) => (p.recordedAt ? new Date(p.recordedAt).getTime() : 0));
        return Math.max(tCreated, tInv, tUpdated, ...tPayments);
      };
      const timeA = getEffectiveTime(a);
      const timeB = getEffectiveTime(b);
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [orders, activeFilter, startDate, endDate, sortOrder, activeSearchQuery]);

  const totalCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleOpenPayNow = (po: DashboardPurchaseOrder) => {
    setSelectedPOForPayment(po);
  };

  const handlePaymentSuccess = (updatedPO: DashboardPurchaseOrder) => {
    const enrichedPO = {
      ...updatedPO,
      lastUpdatedTime: "Today, Just now",
      updatedAt: new Date().toISOString(),
    };
    setOrders((prev) =>
      prev.map((o) => (o.id === enrichedPO.id ? enrichedPO : o))
    );
    if (selectedBillForDetails?.id === enrichedPO.id) {
      setSelectedBillForDetails(enrichedPO);
    }
    onPaymentRecorded?.(enrichedPO);
  };

  const handleRescheduleSuccess = (updatedPO: DashboardPurchaseOrder) => {
    const enrichedPO = {
      ...updatedPO,
      lastUpdatedTime: "Today, Just now",
      updatedAt: new Date().toISOString(),
    };
    setOrders((prev) =>
      prev.map((o) => (o.id === enrichedPO.id ? enrichedPO : o))
    );
    if (selectedBillForDetails?.id === enrichedPO.id) {
      setSelectedBillForDetails(enrichedPO);
    }
    onPaymentRecorded?.(enrichedPO);
  };

  const handleResetFilters = () => {
    setActiveFilter("all");
    setLocalSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSortOrder("newest");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    activeFilter !== "all" ||
    activeSearchQuery ||
    startDate ||
    endDate ||
    sortOrder !== "newest"
  );

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-150">
      {/* Top Header with Back Button */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
              Purchase Orders &amp; Bills
            </h2>
            <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
              Track dealer stock-in orders, credit balances &bull; record later settlements
            </p>
            {onBack && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center mt-3 gap-1 text-[12px] font-sans font-medium text-galla-teal hover:text-galla-teal/80 hover:underline cursor-pointer transition-colors group bg-transparent border-0 p-0"
                  title="Return to products and stock list"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to Inventory</span>
                </button>
              </div>
            )}
          </div>

          {onOpenStockIn && (
            <button
              type="button"
              onClick={onOpenStockIn}
              className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <PackagePlus className="h-4 w-4" />
              <span>Stock In (PO)</span>
            </button>
          )}
        </div>
      )}

      {/* Top Search & Filter Bar (Matching Orders Tab) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input (Shown when not controlled externally) */}
        {externalSearchQuery === undefined ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line w-full md:w-72 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-2xs">
            <Search className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => {
                setLocalSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search PO#, supplier, invoice, product..."
              className="w-full bg-transparent font-sans text-[12.5px] text-galla-ink placeholder:text-galla-ink-soft/60 outline-none"
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearchQuery("");
                  setPage(1);
                }}
                className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-[13px] font-sans text-galla-ink-soft flex items-center gap-2">
            <FileText className="h-4 w-4 text-galla-teal shrink-0" />
            <span>Dealer Bills &amp; Deliveries Ledger</span>
          </div>
        )}

        {/* Date Range & Sort Controls (Matching Orders Tab) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink text-[12.5px] font-sans shadow-xs focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all">
            <Calendar className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
              title="Filter from bill invoice date"
            />
            <span className="text-[10.5px] font-semibold text-galla-ink-soft/70">&ndash;</span>
            <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">To</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
              title="Filter to bill invoice date"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
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
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
                startDate === getLocalDateString(new Date()) && endDate === getLocalDateString(new Date())
                  ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
              }`}
              title="Filter bills for today only"
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
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
                startDate === getFirstDayOfCurrentMonth() && endDate === getLocalDateString(new Date())
                  ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                  : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
              }`}
              title="Filter bills from the 1st of this month to today"
            >
              This Month
            </button>
          </div>

          {/* Sort By Date */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink shadow-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as "newest" | "oldest");
                setPage(1);
              }}
              className="bg-transparent font-sans text-[12px] text-galla-ink outline-none cursor-pointer"
              title="Sort bills by date"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Pills & Reset Action (Matching Orders Tab) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {BILL_FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.id;
            const count = statusCounts[opt.id] ?? 0;
            const isAdvanceTab = opt.id === "advance";
            const showAdvanceNotification = isAdvanceTab && count > 0;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setActiveFilter(opt.id);
                  setPage(1);
                }}
                className={`relative inline-flex items-center gap-1.5 px-[13px] py-[6px] rounded-[5px] text-[13px] font-sans font-medium transition-all cursor-pointer border ${
                  isActive
                    ? "bg-galla-teal text-white border-galla-teal shadow-xs"
                    : showAdvanceNotification
                    ? "bg-rose-50/90 hover:bg-rose-100 text-rose-900 border-rose-300 ring-2 ring-rose-400/40 shadow-xs"
                    : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
                }`}
                title={
                  showAdvanceNotification && !isActive
                    ? `${count} advance orders awaiting delivery / dispatch`
                    : undefined
                }
              >
                <span>{opt.label} ({count})</span>
                {showAdvanceNotification && !isActive && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                )}
              </button>
            );
          })}

          {/* Small Pending Balance Badge */}
          {stats.totalPending > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-900 font-sans text-[12px] font-medium shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>
                Pending: <strong className="tabular-nums font-semibold text-amber-950">{formatRupee(stats.totalPending)}</strong>
              </span>
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="ml-auto text-[12.5px] font-sans text-galla-teal hover:underline font-medium cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Bills Table Container (Matching Orders Tab Pixel-for-Pixel) */}
      <div className="bg-galla-surface border border-galla-line rounded-[6px] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Desktop Table Header - Matching Orders Tab Layout */}
            <div className="grid grid-cols-[115px_minmax(240px,1.5fr)_175px_140px_140px] gap-x-6 items-center px-[21px] py-[12px] bg-galla-paper/60 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.06em]">
              <span>Order / Bill</span>
              <span>Supplier</span>
              <span className="text-right">Settlement</span>
              <span className="text-center">Status</span>
              <span className="text-right">Action</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-galla-line">
              {isLoading ? (
                <div className="py-20 text-center text-galla-ink-soft font-sans text-[13px] flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-galla-teal" />
                  <span>Loading purchase bills...</span>
                </div>
              ) : paginatedOrders.length === 0 ? (
                <div className="py-20 text-center text-galla-ink-soft font-sans text-[13px]">
                  No purchase orders found matching your filter.
                </div>
              ) : (
                paginatedOrders.map((po) => {
                  const isPendingPayment = po.amountPending > 0;

                  const isAdvancePurchase =
                    po.settlementMode === "advance" ||
                    Boolean(po.expectedDeliveryDate) ||
                    Boolean(po.notes && /advance/i.test(po.notes));

                  // Delivery Date & Urgency
                  const targetDeliveryDate =
                    po.expectedDeliveryDate ||
                    (isAdvancePurchase ? po.dueDate || po.invoiceDate : undefined);

                  const deliveryUrgency = targetDeliveryDate ? getBookingUrgency(targetDeliveryDate) : null;
                  const isDeliveryToday = deliveryUrgency?.tone === "today";
                  const isDeliveryOverdue = deliveryUrgency?.tone === "overdue";

                  const deliveryDateStr = targetDeliveryDate ? formatBookingDate(targetDeliveryDate) : "";
                  const deliveryTimeStr = po.deliveryTime ? formatAppointmentTime(po.deliveryTime) : null;
                  const fullDeliverySlot = deliveryTimeStr ? `${deliveryDateStr}, ${deliveryTimeStr}` : deliveryDateStr;

                  // Urgency only on the selected date (Today) or Overdue
                  const deliveryBadgeStyle = isDeliveryToday
                    ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold shadow-xs"
                    : isDeliveryOverdue
                    ? "text-red-900 bg-red-100 border-red-300 font-semibold"
                    : "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";

                  const deliveryBadgeLabel = isDeliveryToday
                    ? `🚨 Delivery Today (${fullDeliverySlot})`
                    : isDeliveryOverdue
                    ? `⚠️ Delivery Overdue (${fullDeliverySlot})`
                    : `Expected: ${fullDeliverySlot}`;

                  // Payment Due Date & Urgency
                  const targetDueDate = po.dueDate || (po.paymentMode === "credit" ? po.invoiceDate : undefined);
                  const dueUrgency = (isPendingPayment && targetDueDate) ? getBookingUrgency(targetDueDate) : null;
                  const isPaymentDueToday = dueUrgency?.tone === "today";
                  const isPaymentOverdue = dueUrgency?.tone === "overdue";

                  const dueDateStr = targetDueDate ? formatBookingDate(targetDueDate) : "";
                  const dueBadgeStyle = isPaymentDueToday
                    ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold"
                    : isPaymentOverdue
                    ? "text-red-900 bg-red-100 border-red-300 font-semibold"
                    : "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";

                  const dueBadgeLabel = isPaymentDueToday
                    ? `🚨 Payment Due Today (${dueDateStr})`
                    : isPaymentOverdue
                    ? `⚠️ Payment Overdue (${dueDateStr})`
                    : `Due: ${dueDateStr}`;

                  const itemsSummary =
                    po.items && po.items.length > 0
                      ? po.items
                          .map(
                            (it) =>
                              `${it.productName} (${(it.quantityForSell || 0) + (it.quantityForUse || 0)} pcs)`
                          )
                          .join(", ")
                      : undefined;

                  const waUrl = getSupplierWhatsAppReminderUrl({
                    phone: po.supplierPhone,
                    supplierName: po.supplierName,
                    salonName: salonName,
                    poNumber: po.purchaseOrderNumber,
                    dealerInvoiceNumber: po.dealerInvoiceNumber,
                    deliveryDate: targetDeliveryDate,
                    deliveryTime: po.deliveryTime,
                    dueDate: targetDueDate,
                    totalAmount: po.totalAmount,
                    amountPaid: po.amountPaid,
                    amountPending: po.amountPending,
                    itemsSummary,
                    items: po.items,
                    mode: isAdvancePurchase ? "advance" : isPendingPayment ? "payment_due" : "delivery",
                    isAdvance: isAdvancePurchase,
                  });

                  const billStatus = getBillStatus(po);
                  const isCompleted = billStatus.statusKey === "completed" || po.amountPending <= 0;
                  const lastUpdatedTime = getBillLastUpdatedTime(po);

                  return (
                    <div
                      key={po.id}
                      onClick={() => setSelectedBillForDetails(po)}
                      className="grid grid-cols-[115px_minmax(240px,1.5fr)_175px_140px_140px] gap-x-6 items-center px-[21px] py-[16px] hover:bg-galla-paper/50 transition-colors cursor-pointer group"
                    >
                      {/* Column 1: Order / Bill */}
                      <div className="space-y-0.5">
                        <span className="font-mono text-[13px] font-bold text-galla-ink group-hover:text-galla-teal transition-colors block">
                          {formatDisplayNumber(po.purchaseOrderNumber)}
                        </span>
                        {po.dealerInvoiceNumber && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center text-[10.5px] font-mono px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line font-medium truncate max-w-full"
                              title={`Dealer Invoice Number: ${po.dealerInvoiceNumber}`}
                            >
                              Inv: #{po.dealerInvoiceNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Column 2: Supplier */}
                      <div className="min-w-0 pr-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-sans font-semibold text-[15px] text-galla-ink leading-snug">
                            {po.supplierName}
                          </span>
                          {po.supplierCompany && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-sans px-1.5 py-0.2 rounded bg-galla-paper border border-galla-line text-galla-ink-soft">
                              <Building2 className="h-3 w-3" />
                              <span>{po.supplierCompany}</span>
                            </span>
                          )}
                        </div>

                        {po.supplierPhone && (
                          <div className="font-mono text-[12px] text-galla-ink-soft/90 mt-0.5 truncate">
                            <a
                              href={`tel:${po.supplierPhone.replace(/\D/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-galla-teal hover:underline transition-colors inline-flex items-center gap-1"
                              title={`Call ${po.supplierName}: ${po.supplierPhone}`}
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{formatPhoneNumber(po.supplierPhone)}</span>
                            </a>
                          </div>
                        )}

                        {/* Order and Date & Time (Matching Orders Tab) */}
                        <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5 truncate">
                          Stock Purchase &bull; {formatOrderTime(po.createdAt || po.invoiceDate)}
                        </div>

                        {/* Last Update */}
                        {lastUpdatedTime && (
                          <div className="font-sans text-[11px] text-galla-ink-soft/75 mt-0.5 flex items-center gap-1 truncate">
                            <span className="text-galla-ink-soft/60">Last update:</span>
                            <span className="font-medium text-galla-ink-soft">{lastUpdatedTime}</span>
                          </div>
                        )}

                        {po.notes && (
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                            title={`Note: ${po.notes}`}
                          >
                            <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                              Note
                            </span>
                            <span className="truncate font-medium">{po.notes}</span>
                          </div>
                        )}

                        {/* Advance / Delivery Schedule & Due Urgency */}
                        {!isCompleted && (isAdvancePurchase || targetDeliveryDate || isPendingPayment || targetDueDate) && (
                          <div className="mt-1.5 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {targetDeliveryDate ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReschedule(po, "delivery");
                                  }}
                                  className={`inline-flex items-center gap-1 font-sans text-[11.5px] border px-2 py-0.5 rounded-[4px] shadow-2xs hover:opacity-85 hover:shadow-xs transition-all cursor-pointer group ${deliveryBadgeStyle}`}
                                  title="Click to reschedule delivery date & time"
                                >
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <span>{deliveryBadgeLabel}</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    Reschedule
                                  </span>
                                </button>
                              ) : isAdvancePurchase ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReschedule(po, "delivery");
                                  }}
                                  className="inline-flex items-center gap-1 font-sans text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-[4px] font-medium hover:bg-amber-100 transition-all cursor-pointer group"
                                  title="Click to set expected delivery date"
                                >
                                  <Calendar className="h-3 w-3 text-amber-700 shrink-0" />
                                  <span>Set Delivery Date</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    + Add
                                  </span>
                                </button>
                              ) : null}

                              {/* Payment Due Date badge if pending amount or target due date */}
                              {isPendingPayment && targetDueDate && targetDueDate !== targetDeliveryDate ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReschedule(po, "due_date");
                                  }}
                                  className={`inline-flex items-center gap-1 font-sans text-[11.5px] border px-2 py-0.5 rounded-[4px] shadow-2xs hover:opacity-85 hover:shadow-xs transition-all cursor-pointer group ${dueBadgeStyle}`}
                                  title="Click to reschedule payment due date"
                                >
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>{dueBadgeLabel}</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    Reschedule
                                  </span>
                                </button>
                              ) : isPendingPayment && !targetDueDate ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReschedule(po, "due_date");
                                  }}
                                  className="inline-flex items-center gap-1 font-sans text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-[4px] font-medium hover:bg-amber-100 transition-all cursor-pointer group"
                                  title="Click to set payment due date"
                                >
                                  <Clock className="h-3 w-3 text-amber-700 shrink-0" />
                                  <span>Set Due Date</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    + Add
                                  </span>
                                </button>
                              ) : null}
                            </div>

                            {/* Call & WhatsApp & Reschedule Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {po.supplierPhone ? (
                                <a
                                  href={`tel:${po.supplierPhone.replace(/\D/g, "")}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[11.5px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                                  title={`Call supplier: ${po.supplierPhone}`}
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
                                  title="Send inquiry to supplier via WhatsApp"
                                >
                                  <MessageSquare className="h-3 w-3 text-emerald-700 shrink-0" />
                                  <span>WhatsApp Msg</span>
                                </a>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Column 3: Settlement (Matching Orders Tab Pixel-for-Pixel) */}
                      <div className="text-right">
                        <div className="font-heading font-semibold text-[15.5px] text-galla-ink tabular-nums">
                          {formatRupee(po.totalAmount)}
                        </div>
                        {po.amountPending > 0 ? (
                          <div className="space-y-0.5 mt-0.5">
                            {po.amountPaid > 0 && (
                              <div className="font-sans text-[12px] text-galla-teal font-medium flex items-center justify-end gap-1 tabular-nums">
                                <span>{formatRupee(po.amountPaid)} adv.</span>
                                {po.paymentMode && (
                                  <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                    {po.paymentMode}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                              {formatRupee(po.amountPending)} due
                            </div>
                          </div>
                        ) : (
                          <div className="font-sans text-[12px] text-galla-ink-soft/80 mt-0.5 flex items-center justify-end gap-1">
                            <span>Settled</span>
                            {po.paymentMode && (
                              <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                                {po.paymentMode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Column 4: Status (StatusPill: Advance, Paid in full, Completed, Pending) */}
                      <div className="flex justify-center">
                        <StatusPill
                          status={billStatus.pillStatus}
                          customLabel={billStatus.label}
                        />
                      </div>

                      {/* Column 5: Action (Matching Orders Tab) */}
                      <div className="text-right flex items-center justify-end">
                        {po.amountPending > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPayNow(po);
                            }}
                            className="px-3.5 py-1.5 rounded-[4px] bg-galla-teal hover:opacity-95 text-white font-sans text-[12px] font-medium shadow-xs transition-all cursor-pointer text-center"
                          >
                            Pay Now
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-sans text-[12px] text-emerald-700 font-medium px-2 py-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Settled</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pagination Footer (Matching Orders Tab) */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-galla-paper/50 border-t border-galla-line">
            <div className="font-sans text-[12.5px] text-galla-ink-soft">
              Showing <span className="font-medium text-galla-ink">{(currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-medium text-galla-ink">{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
              <span className="font-medium text-galla-ink">{totalCount}</span> purchase orders
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                title="Load previous purchase orders"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center px-2 font-sans text-[12px] text-galla-ink font-medium">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-sans font-medium rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink hover:bg-galla-paper transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                title="Load next purchase orders"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settle Purchase Bill Modal */}
      <SettlePurchaseBillModal
        bill={
          selectedPOForPayment
            ? (() => {
                const livePO = orders.find((o) => o.id === selectedPOForPayment.id);
                const base = livePO || selectedPOForPayment;
                const sup = suppliers?.find((s) => s.id === base.supplierId);
                return sup
                  ? {
                      ...base,
                      supplierName: sup.name || base.supplierName,
                      supplierPhone: sup.phone ? formatPhoneNumber(sup.phone) : base.supplierPhone,
                      supplierCompany: sup.companyName !== undefined ? sup.companyName : base.supplierCompany,
                    }
                  : base;
              })()
            : null
        }
        isOpen={Boolean(selectedPOForPayment)}
        onClose={() => setSelectedPOForPayment(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Purchase Bill Details Modal */}
      <PurchaseBillDetailsModal
        bill={
          selectedBillForDetails
            ? (() => {
                const livePO = orders.find((o) => o.id === selectedBillForDetails.id);
                const base = livePO || selectedBillForDetails;
                const sup = suppliers?.find((s) => s.id === base.supplierId);
                return sup
                  ? {
                      ...base,
                      supplierName: sup.name || base.supplierName,
                      supplierPhone: sup.phone ? formatPhoneNumber(sup.phone) : base.supplierPhone,
                      supplierCompany: sup.companyName !== undefined ? sup.companyName : base.supplierCompany,
                    }
                  : base;
              })()
            : null
        }
        isOpen={Boolean(selectedBillForDetails)}
        onClose={() => setSelectedBillForDetails(null)}
        salonName={salonName}
        onOpenPayNow={(bill) => {
          setSelectedBillForDetails(null);
          handleOpenPayNow(bill);
        }}
      />

      {/* Reschedule PO Delivery / Due Date Modal */}
      <ReschedulePurchaseOrderModal
        po={reschedulingState?.po || null}
        mode={reschedulingState?.mode}
        isOpen={Boolean(reschedulingState)}
        onClose={() => setReschedulingState(null)}
        onRescheduleSuccess={handleRescheduleSuccess}
      />
    </div>
  );
}
