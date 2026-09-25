"use client";

import React, { useState, useMemo } from "react";
import { Plus, AlertTriangle, Wallet, Check, Loader2, Search, X, ArrowRight, Calendar, Phone, MessageSquare, Truck, CheckCircle2 } from "lucide-react";
import { DashboardOrder, DashboardProduct, DashboardSupplier, DashboardPurchaseOrder, DashboardCustomerReplacement } from "@/types/dashboard";
import { StatBlock } from "@/components/dashboard/stat-block";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee, calculatePendingAmount, formatBookingDate, formatAppointmentTime, getBookingUrgency, getWhatsAppReminderUrl, formatPhoneNumber, formatDisplayNumber, getBillStatus } from "@/lib/utils";
import { RescheduleOrderModal } from "@/components/dashboard/modals/reschedule-order-modal";
import { OrderDetailsModal } from "@/components/dashboard/modals/order-details-modal";
import { ChangeReplacementDateModal } from "@/components/dashboard/modals/change-replacement-date-modal";
import { markCustomerReplacementCollectedAction } from "@/app/dashboard/actions";

interface OverviewTabProps {
  orders: DashboardOrder[];
  products: DashboardProduct[];
  suppliers?: DashboardSupplier[];
  purchaseOrders?: DashboardPurchaseOrder[];
  expensesTotal: number;
  salonName?: string;
  customerReplacements?: DashboardCustomerReplacement[];
  onOpenNewOrder: () => void;
  onOpenNewExpense: () => void;
  onNavigateToAdvanceOrders?: () => void;
  onNavigateToDueOrders?: () => void;
  onNavigateToStockDeliveries?: (filter?: "pending" | "advance") => void;
  onCompleteOrder?: (orderId: string) => Promise<void> | void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onNavigateToInventory?: () => void;
  onOpenSettle?: (order: DashboardOrder) => void;
  onRescheduleOrder?: (updatedOrder: DashboardOrder) => void;
  onUpdateReplacement?: (updated: DashboardCustomerReplacement) => void;
  onRemoveReplacement?: (id: string) => void;
}

export function OverviewTab({
  orders,
  products,
  suppliers = [],
  purchaseOrders = [],
  expensesTotal,
  salonName,
  onOpenNewOrder,
  onOpenNewExpense,
  onNavigateToAdvanceOrders,
  onNavigateToDueOrders,
  onNavigateToStockDeliveries,
  onCompleteOrder,
  onOpenRefund,
  onNavigateToInventory,
  onOpenSettle,
  onRescheduleOrder,
  customerReplacements = [],
  onUpdateReplacement,
  onRemoveReplacement,
}: OverviewTabProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reschedulingOrder, setReschedulingOrder] = useState<DashboardOrder | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<DashboardOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [replacementsList, setReplacementsList] = useState<DashboardCustomerReplacement[]>(customerReplacements || []);
  const [prevReplacements, setPrevReplacements] = useState(customerReplacements);
  if (customerReplacements !== prevReplacements) {
    setPrevReplacements(customerReplacements);
    setReplacementsList(customerReplacements || []);
  }

  const [selectedReplacementToChangeDate, setSelectedReplacementToChangeDate] = useState<DashboardCustomerReplacement | null>(null);
  const [collectingReplacementId, setCollectingReplacementId] = useState<string | null>(null);

  const arrivedReplacements = useMemo(
    () => (replacementsList || []).filter((r) => r.status === "arrived_call_client"),
    [replacementsList]
  );
  const pendingDealerReplacements = useMemo(
    () => (replacementsList || []).filter((r) => r.status === "pending_dealer"),
    [replacementsList]
  );

  const handleMarkCollected = async (r: DashboardCustomerReplacement) => {
    setCollectingReplacementId(r.id);
    try {
      const res = await markCustomerReplacementCollectedAction(r.id);
      if (res.success) {
        setReplacementsList((prev) => prev.filter((item) => item.id !== r.id));
        onRemoveReplacement?.(r.id);
      }
    } catch (err) {
      console.error("Failed to mark replacement collected:", err);
    } finally {
      setCollectingReplacementId(null);
    }
  };

  const handleComplete = async (id: string) => {
    if (!onCompleteOrder) return;
    setLoadingId(id);
    try {
      await onCompleteOrder(id);
    } finally {
      setLoadingId(null);
    }
  };
  // Today's Total Income: sum of all revenue actually collected today across all orders (new orders, advance payments, and settlements)
  // Excludes fully refunded orders (whose net retained amount is 0) so refunds do not inflate income
  const todayIncome = useMemo(() => {
    return orders.reduce((sum, o) => {
      if (o.status === "cancelled_refunded" && !o.refundAmount) return sum;
      return sum + (o.todayPaid ?? (o.isToday ? o.paid : 0));
    }, 0);
  }, [orders]);

  // Overall Customer Outstanding Dues
  const pendingAmount = useMemo(() => calculatePendingAmount(orders), [orders]);

  // Overall Dealer / Supplier Dues (sum of all pending amounts owed to active suppliers)
  const dealerDues = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.totalPending || 0), 0);
  }, [suppliers]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      const threshold = p.lowStockThreshold ?? 5;
      return p.sell <= threshold;
    });
  }, [products]);

  // Total Advance Bookings deposit received today
  const advancePayment = useMemo(() => {
    return orders
      .filter((o) => (o.status === "advance_paid" || o.status === "paid_full") && o.isToday)
      .reduce((sum, o) => sum + (o.advanceAmount ?? o.paid), 0);
  }, [orders]);

  // Recent 24h Orders
  const recent24hOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!(o.isToday || o.isLast24Hours)) return false;
      
      if (!searchQuery.trim()) return true;
      
      const q = searchQuery.toLowerCase();
      const idMatch = o.id.toLowerCase().includes(q);
      const customerMatch = o.customer.toLowerCase().includes(q);
      const typeMatch = o.type.toLowerCase().includes(q);
      const statusMatch = o.status.toLowerCase().includes(q);
      const refundReasonMatch = o.refundReason?.toLowerCase().includes(q);
      return Boolean(idMatch || customerMatch || typeMatch || statusMatch || refundReasonMatch);
    });
  }, [orders, searchQuery]);

  // Advance bookings due near (Today, Tomorrow, or Day after tomorrow)
  const upcomingAdvanceOrders = useMemo(() => {
    return orders.filter((o) => {
      if ((o.status !== "advance_paid" && o.status !== "paid_full") || !o.scheduledFor) return false;
      const urgency = getBookingUrgency(o.scheduledFor);
      if (!urgency) return false;
      return urgency.daysAway >= 0 && urgency.daysAway <= 2;
    });
  }, [orders]);

  // Customer payments due to clear: Due orders scheduled for Today or Overdue
  const dueOrdersToClear = useMemo(() => {
    return orders.filter((o) => {
      const isDue =
        o.status === "created" ||
        (o.paid < o.amount &&
          o.status !== "advance_paid" &&
          o.status !== "paid_full" &&
          o.status !== "cancelled_refunded" &&
          o.status !== "cancelled_converted");
      if (!isDue || !o.scheduledFor) return false;
      const urgency = getBookingUrgency(o.scheduledFor);
      if (!urgency) return false;
      return urgency.tone === "today" || urgency.tone === "overdue";
    });
  }, [orders]);

  // Supplier Deliveries & Dues: Urgency triggers strictly on the selected date (Today) or if Overdue
  const urgentSupplierDeliveries = useMemo(() => {
    return (purchaseOrders || []).filter((po) => {
      // Must be an active advance bill awaiting delivery
      if (getBillStatus(po).statusKey !== "advance") return false;
      const targetDate = po.expectedDeliveryDate || po.dueDate || po.invoiceDate;
      if (!targetDate) return false;
      const urgency = getBookingUrgency(targetDate);
      return urgency && (urgency.tone === "today" || urgency.tone === "overdue");
    });
  }, [purchaseOrders]);

  const urgentSupplierDues = useMemo(() => {
    return (purchaseOrders || []).filter((po) => {
      // Must be a pending bill (NOT an advance order and NOT completed)
      if (getBillStatus(po).statusKey !== "pending") return false;
      if (po.amountPending <= 0) return false;
      const dueTarget = po.dueDate || (po.paymentMode === "credit" ? po.invoiceDate : undefined);
      if (!dueTarget) return false;
      const urgency = getBookingUrgency(dueTarget);
      return urgency && (urgency.tone === "today" || urgency.tone === "overdue");
    });
  }, [purchaseOrders]);

  const urgentSupplierItems = useMemo(() => {
    const map = new Map<string, DashboardPurchaseOrder>();
    urgentSupplierDeliveries.forEach((p) => map.set(p.id, p));
    urgentSupplierDues.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [urgentSupplierDeliveries, urgentSupplierDues]);

  const supplierItemsToday = useMemo(() => {
    return urgentSupplierItems.filter((po) => {
      const statusKey = getBillStatus(po).statusKey;
      const target = statusKey === "advance"
        ? (po.expectedDeliveryDate || po.dueDate || po.invoiceDate)
        : (po.dueDate || (po.paymentMode === "credit" ? po.invoiceDate : undefined));
      if (!target) return false;
      const u = getBookingUrgency(target);
      return u?.tone === "today";
    });
  }, [urgentSupplierItems]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3.5 w-full">
      {/* Section Header (Fixed) */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-[20px] tracking-[-0.015em] text-galla-ink">
            Today&apos;s Counter
          </h2>
          <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
            Real-time shop collections, register balance &amp; daily flow
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateToAdvanceOrders && (
            <button
              onClick={onNavigateToAdvanceOrders}
              className={`relative inline-flex items-center gap-1.5 font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-xs transition-all cursor-pointer border ${upcomingAdvanceOrders.length > 0
                  ? "bg-amber-50/90 hover:bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400/40"
                  : "bg-galla-surface hover:bg-galla-paper border-galla-line text-galla-ink"
                }`}
              title={
                upcomingAdvanceOrders.length > 0
                  ? `${upcomingAdvanceOrders.length} advance booking(s) near (Today - 2 days)`
                  : "View Advance Bookings"
              }
            >
              <div className="relative flex items-center justify-center">
                <Calendar className={`h-4 w-4 ${upcomingAdvanceOrders.length > 0 ? "text-amber-700" : "text-galla-ink-soft"}`} />
                {upcomingAdvanceOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                  </span>
                )}
              </div>
              <span>Advance Bookings</span>
              {upcomingAdvanceOrders.length > 0 && (
                <span
                  className={`ml-1 inline-flex items-center justify-center h-5 rounded-full text-[11px] font-bold bg-amber-600 text-white leading-none shadow-2xs shrink-0 tabular-nums ${upcomingAdvanceOrders.length > 9 ? "min-w-5 px-1.5" : "w-5"
                    }`}
                >
                  {upcomingAdvanceOrders.length}
                </span>
              )}
            </button>
          )}
          {onNavigateToDueOrders && (
            <button
              onClick={onNavigateToDueOrders}
              className={`relative inline-flex items-center gap-1.5 font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-xs transition-all cursor-pointer border ${dueOrdersToClear.length > 0
                  ? "bg-rose-50/90 hover:bg-rose-100 border-rose-300 text-rose-900 ring-2 ring-rose-400/40"
                  : "bg-galla-surface hover:bg-galla-paper border-galla-line text-galla-ink"
                }`}
              title={
                dueOrdersToClear.length > 0
                  ? `${dueOrdersToClear.length} customer payment(s) due today or overdue`
                  : "View Payment Due Orders"
              }
            >
              <div className="relative flex items-center justify-center">
                <AlertTriangle className={`h-4 w-4 ${dueOrdersToClear.length > 0 ? "text-rose-700" : "text-galla-ink-soft"}`} />
                {dueOrdersToClear.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                )}
              </div>
              <span>Dues to Clear</span>
              {dueOrdersToClear.length > 0 && (
                <span
                  className={`ml-1 inline-flex items-center justify-center h-5 rounded-full text-[11px] font-bold bg-rose-600 text-white leading-none shadow-2xs shrink-0 tabular-nums ${dueOrdersToClear.length > 9 ? "min-w-5 px-1.5" : "w-5"
                    }`}
                >
                  {dueOrdersToClear.length}
                </span>
              )}
            </button>
          )}
          {onNavigateToStockDeliveries && (
            <button
              onClick={() => {
                const hasUrgentPending = urgentSupplierDues.length > 0;
                const hasUrgentAdvance = urgentSupplierDeliveries.length > 0;

                let targetFilter: "pending" | "advance" = "pending";

                if (hasUrgentPending && hasUrgentAdvance) {
                  // Both pending and advance are urgent for today/overdue -> redirect to pending, Advance tab shows red dot
                  targetFilter = "pending";
                } else if (hasUrgentAdvance && !hasUrgentPending) {
                  // Only advance order date matches today -> redirect directly to advance tab
                  targetFilter = "advance";
                } else if (hasUrgentPending && !hasUrgentAdvance) {
                  // Only pending order date matches today -> redirect to pending tab
                  targetFilter = "pending";
                } else {
                  // Neither is urgent today: fallback based on available bills
                  const hasAdvanceBills = (purchaseOrders || []).some((po) => getBillStatus(po).statusKey === "advance");
                  const hasPendingBills = (purchaseOrders || []).some((po) => getBillStatus(po).statusKey === "pending");

                  if (!hasPendingBills && hasAdvanceBills) {
                    targetFilter = "advance";
                  } else {
                    targetFilter = "pending";
                  }
                }

                onNavigateToStockDeliveries(targetFilter);
              }}
              className={`relative inline-flex items-center gap-1.5 font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-xs transition-all cursor-pointer border ${supplierItemsToday.length > 0
                  ? "bg-rose-50/90 hover:bg-rose-100 border-rose-300 text-rose-900 ring-2 ring-rose-400/40"
                  : urgentSupplierItems.length > 0
                    ? "bg-amber-50/90 hover:bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400/40"
                    : "bg-galla-surface hover:bg-galla-paper border-galla-line text-galla-ink"
                }`}
              title={
                supplierItemsToday.length > 0
                  ? `${supplierItemsToday.length} supplier delivery / payment due TODAY`
                  : urgentSupplierItems.length > 0
                    ? `${urgentSupplierItems.length} supplier delivery / payment overdue`
                    : "View Supplier Bills & Deliveries"
              }
            >
              <div className="relative flex items-center justify-center">
                <Truck
                  className={`h-4 w-4 ${supplierItemsToday.length > 0
                      ? "text-rose-700"
                      : urgentSupplierItems.length > 0
                        ? "text-amber-700"
                        : "text-galla-ink-soft"
                    }`}
                />
                {urgentSupplierItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${supplierItemsToday.length > 0 ? "bg-rose-400" : "bg-amber-400"
                        }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${supplierItemsToday.length > 0 ? "bg-rose-600" : "bg-amber-600"
                        }`}
                    ></span>
                  </span>
                )}
              </div>
              <span>Stock Deliveries &amp; Dues</span>
              {urgentSupplierItems.length > 0 && (
                <span
                  className={`ml-1 inline-flex items-center justify-center h-5 rounded-full text-[11px] font-bold text-white leading-none shadow-2xs shrink-0 tabular-nums ${supplierItemsToday.length > 0 ? "bg-rose-600" : "bg-amber-600"
                    } ${urgentSupplierItems.length > 9 ? "min-w-5 px-1.5" : "w-5"}`}
                >
                  {urgentSupplierItems.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onOpenNewExpense}
            className="inline-flex items-center gap-1.5 bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-xs transition-colors cursor-pointer"
          >
            <Wallet className="h-4 w-4 text-galla-ink-soft" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={onOpenNewOrder}
            className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* 5 Major KPI Numbers Grid (Fixed) */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-5 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
        <div className="bg-galla-surface">
          <StatBlock
            label="Income"
            badge="Today"
            value={formatRupee(todayIncome)}
            subtext="Collected today"
            tone="sage"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Expense"
            badge="Today"
            value={formatRupee(expensesTotal)}
            subtext="Spent today"
            tone="brick"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Advance"
            badge="Today"
            value={formatRupee(advancePayment)}
            subtext="Booking deposits today"
            tone="brass"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Customer Dues"
            badge="Overall"
            value={formatRupee(pendingAmount)}
            subtext="Unpaid across orders"
            tone="ink"
          />
        </div>
        <div className="bg-galla-surface col-span-2 lg:col-span-1">
          <StatBlock
            label="Dealer Dues"
            badge="Overall"
            value={formatRupee(dealerDues)}
            subtext="Owed to suppliers"
            tone={dealerDues > 0 ? "brick" : "ink"}
          />
        </div>
      </div>

      {/* Low Stock Warning Banner (Fixed & Compact with Inventory redirect link) */}
      {lowStockProducts.length > 0 && (
        <div
          role="alert"
          className="shrink-0 px-3.5 py-2 rounded-[5px] bg-red-50 border border-red-300 text-red-900 text-[12px] font-sans flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <span className="truncate">
              <strong className="font-semibold">
                {lowStockProducts.length} product
                {lowStockProducts.length > 1 ? "s" : ""}
              </strong>{" "}
              {lowStockProducts.some((p) => p.sell === 0)
                ? "out of stock or low on sell stock"
                : "running low on sell stock"}{" "}
              &mdash; {lowStockProducts.map((p) => p.name).join(", ")}.
            </span>
          </div>

          {onNavigateToInventory && (
            <button
              type="button"
              onClick={onNavigateToInventory}
              className="inline-flex items-center gap-1 shrink-0 font-semibold text-[12px] text-red-800 hover:text-red-950 underline underline-offset-2 hover:underline-offset-4 transition-all cursor-pointer group"
              title="Go to Inventory tab to view stock and transfer items"
            >
              <span>Go to Inventory</span>
              <ArrowRight className="h-3.5 w-3.5 text-red-800 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Customer Replacements Arrived Banner (Green) */}
      {arrivedReplacements.length > 0 && (
        <div
          role="alert"
          className="shrink-0 p-3 rounded-[5px] bg-emerald-50/90 border border-emerald-300 text-emerald-950 text-[12px] font-sans shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-heading font-semibold text-[13px] text-emerald-900">
                {arrivedReplacements.length} Replacement{arrivedReplacements.length > 1 ? "s" : ""} Arrived from Dealer &mdash; Ready for Client Handover
              </span>
            </div>
            <span className="text-[11px] font-sans text-emerald-800 hidden sm:inline">
              Stock received. Call client to collect from salon.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {arrivedReplacements.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-[4px] bg-white border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <strong className="font-heading font-semibold text-[12.5px] text-galla-ink truncate">
                      {r.customerName}
                    </strong>
                    <span className="font-mono text-[10.5px] text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line/60">
                      #{r.orderNumber}
                    </span>
                  </div>
                  <div className="font-sans text-[11px] text-emerald-900 font-medium truncate mt-0.5">
                    {r.pendingQuantity}x {r.productName}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {r.customerPhone && (
                    <a
                      href={`tel:${r.customerPhone}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] bg-emerald-100/70 hover:bg-emerald-200 text-emerald-900 text-[11px] font-medium border border-emerald-300 transition-colors"
                      title={`Call ${r.customerName} at ${r.customerPhone}`}
                    >
                      <Phone className="h-3 w-3 text-emerald-700" />
                      <span>Call</span>
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={collectingReplacementId === r.id}
                    onClick={() => handleMarkCollected(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {collectingReplacementId === r.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    <span>Mark Handed Over</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Replacements Awaiting Dealer Banner (Amber) */}
      {pendingDealerReplacements.length > 0 && (
        <div
          role="alert"
          className="shrink-0 p-3 rounded-[5px] bg-amber-50/90 border border-amber-300 text-amber-950 text-[12px] font-sans shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-heading font-semibold text-[13px] text-amber-900">
                {pendingDealerReplacements.length} Client Replacement{pendingDealerReplacements.length > 1 ? "s" : ""} Pending from Dealer
              </span>
            </div>
            <span className="text-[11px] font-sans text-amber-800 hidden sm:inline">
              Stock awaiting dealer replacement delivery.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pendingDealerReplacements.map((r) => {
              const urgency = getBookingUrgency(r.expectedDate);
              const isUrgent = urgency && (urgency.tone === "today" || urgency.tone === "overdue");

              return (
                <div
                  key={r.id}
                  className={`p-2.5 rounded-[4px] bg-white border flex items-center justify-between gap-3 shadow-2xs ${
                    isUrgent ? "border-amber-400 ring-1 ring-amber-400/40" : "border-amber-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <strong className="font-heading font-semibold text-[12.5px] text-galla-ink truncate">
                        {r.customerName}
                      </strong>
                      <span className="font-mono text-[10.5px] text-galla-ink-soft bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line/60">
                        #{r.orderNumber}
                      </span>
                      {isUrgent && (
                        <span className="text-[9.5px] font-heading font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          {urgency?.label || "Due"}
                        </span>
                      )}
                    </div>
                    <div className="font-sans text-[11px] text-galla-ink truncate mt-0.5">
                      {r.pendingQuantity}x {r.productName} &bull; Expected:{" "}
                      <strong className="font-mono text-amber-950 font-medium">
                        {formatBookingDate(r.expectedDate)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.customerPhone && (
                      <a
                        href={`tel:${r.customerPhone}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] bg-amber-100/70 hover:bg-amber-200 text-amber-900 text-[11px] font-medium border border-amber-300 transition-colors"
                        title={`Call ${r.customerName} at ${r.customerPhone}`}
                      >
                        <Phone className="h-3 w-3 text-amber-700" />
                        <span>Call</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedReplacementToChangeDate(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-galla-surface hover:bg-galla-paper text-galla-ink text-[11px] font-medium border border-galla-line transition-colors shadow-2xs cursor-pointer"
                    >
                      <Calendar className="h-3 w-3 text-galla-ink-soft" />
                      <span>Change Date</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Recent Orders Section (Flex-1 scrollable table) */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-semibold text-[17px] text-galla-ink">
              Recent Counter Orders
            </h3>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-sans font-medium text-galla-ink-soft bg-galla-paper border border-galla-line rounded-[4px] tabular-nums">
              {recent24hOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[5px] bg-galla-surface border border-galla-line w-full sm:w-64 focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all shadow-2xs">
            <Search className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order, customer, service..."
              className="w-full bg-transparent font-sans text-[12.5px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
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
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-galla-surface border border-galla-line rounded-[6px] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto flex-1 flex flex-col min-h-0">
            <div className="min-w-[900px] flex-1 flex flex-col">
              {/* Sticky Table Header */}
              <div className="shrink-0 grid grid-cols-[115px_minmax(180px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[11px] bg-galla-paper/70 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.06em] z-10">
                <span>Order</span>
                <span>Customer &amp; Service</span>
                <span className="text-right">Settlement</span>
                <span className="text-center">Status</span>
                <span className="text-right">Action</span>
              </div>

              {/* Scrollable Table Rows */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-galla-line">
                {recent24hOrders.map((order) => {
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
                      className="grid grid-cols-[115px_minmax(180px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[14px] hover:bg-galla-paper/50 transition-colors cursor-pointer"
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
                        <div className="font-sans text-[12px] text-galla-ink-soft truncate">
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
                              <div className="space-y-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReschedulingOrder(order);
                                  }}
                                  className={`inline-flex items-center gap-1 font-sans text-[11px] border px-1.5 py-0.2 rounded-[4px] font-medium shadow-2xs hover:opacity-85 transition-all cursor-pointer group ${badgeStyle}`}
                                  title="Click to reschedule payment due date"
                                >
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <span>{badgeLabel}</span>
                                  <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                    Reschedule
                                  </span>
                                </button>

                                {showContactOptions && (
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    {order.customerPhone ? (
                                      <a
                                        href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-0.5 text-[10.5px] font-sans font-medium px-1.5 py-0.2 rounded bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs"
                                        title={`Call client: ${order.customerPhone}`}
                                      >
                                        <Phone className="h-2.5 w-2.5 text-amber-800 shrink-0" />
                                        <span>Call</span>
                                      </a>
                                    ) : null}

                                    {waUrl ? (
                                      <a
                                        href={waUrl}
                                        onClick={(e) => e.stopPropagation()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[10.5px] font-sans font-medium px-1.5 py-0.2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs"
                                        title="Send pending balance reminder via WhatsApp"
                                      >
                                        <MessageSquare className="h-2.5 w-2.5 text-emerald-700 shrink-0" />
                                        <span>WhatsApp Msg</span>
                                      </a>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          const isProductSale = order.type === "Product sale";
                          const isToday = urgency?.tone === "today";
                          const isTomorrow = urgency?.tone === "tomorrow";
                          const isIn2Days = urgency?.tone === "in_2_days";

                          const badgeStyle = (isProductSale && isTomorrow)
                            ? "text-rose-800 bg-rose-50/90 border-rose-300 font-semibold"
                            : isToday
                              ? "text-rose-800 bg-rose-50/90 border-rose-200"
                              : isTomorrow
                                ? "text-amber-800 bg-amber-50/90 border-amber-200"
                                : isIn2Days
                                  ? "text-blue-800 bg-blue-50/90 border-blue-200"
                                  : "text-amber-800 bg-amber-50/90 border-amber-200/80";

                          const dateStr = formatBookingDate(order.scheduledFor);
                          const timeStr = order.scheduledTime ? formatAppointmentTime(order.scheduledTime) : null;
                          const suffix = timeStr ? ` • ${timeStr}` : "";

                          const showContactOptions = isProductSale
                            ? (isToday || urgency?.tone === "overdue")
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
                            <div className="space-y-1 mt-0.5">
                              <div className={`inline-flex items-center gap-1 font-sans text-[11px] border px-1.5 py-0.2 rounded-[4px] font-medium ${badgeStyle}`}>
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>
                                  {isProductSale && isTomorrow
                                    ? `🚨 Urgent (Tomorrow${suffix})`
                                    : isProductSale && isToday
                                      ? `🛍️ Pickup Today${suffix}`
                                      : isToday
                                        ? `🚨 Today${suffix}`
                                        : isTomorrow
                                          ? `⏰ Tomorrow${suffix}`
                                          : isIn2Days
                                            ? `📅 In 2 Days${suffix}`
                                            : `Booked: ${dateStr}${suffix}`}
                                </span>
                              </div>

                              {showContactOptions && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  {order.customerPhone ? (
                                    <a
                                      href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 text-[10.5px] font-sans font-medium px-1.5 py-0.2 rounded bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs"
                                      title={`Call client: ${order.customerPhone}`}
                                    >
                                      <Phone className="h-2.5 w-2.5 text-amber-800 shrink-0" />
                                      <span>Call</span>
                                    </a>
                                  ) : null}

                                  {waUrl ? (
                                    <a
                                      href={waUrl}
                                      onClick={(e) => e.stopPropagation()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[10.5px] font-sans font-medium px-1.5 py-0.2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs"
                                      title={isProductSale ? "Send pickup ready notification via WhatsApp" : "Send reminder via WhatsApp"}
                                    >
                                      <MessageSquare className="h-2.5 w-2.5 text-emerald-700 shrink-0" />
                                      <span>{isProductSale ? "WhatsApp Msg" : "Reminder"}</span>
                                    </a>
                                  ) : null}
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
                                  const hasDeliverable = order.type === "Product sale" || Boolean(order.lineItems?.some((li) => !li.fulfilled));
                                  if (hasDeliverable && onOpenSettle) {
                                    onOpenSettle(order);
                                  } else {
                                    handleComplete(order.id);
                                  }
                                }}
                                disabled={loadingId === order.id}
                                className="inline-flex items-center gap-1 text-[12px] font-sans font-medium px-2.5 py-1 rounded-[4px] bg-green-50 text-green-800 border border-green-300 hover:bg-green-100 hover:border-green-400 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                title={order.type === "Product sale" || order.lineItems?.some((li) => !li.fulfilled) ? "Deliver products and complete order" : "Mark service as completed"}
                              >
                                {loadingId === order.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-green-700" />
                                ) : (
                                  <>
                                    <span>{order.type === "Product sale" || order.lineItems?.some((li) => !li.fulfilled) ? "Deliver & Done" : "Mark Done"}</span>
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
                                  if (onOpenSettle) {
                                    onOpenSettle(order);
                                  } else {
                                    handleComplete(order.id);
                                  }
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

                {recent24hOrders.length === 0 && (
                  <div className="p-8 text-center font-sans text-[13px] text-galla-ink-soft space-y-1.5">
                    {searchQuery ? (
                      <>
                        <p>No counter orders matching &ldquo;{searchQuery}&rdquo;</p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="text-galla-teal hover:underline text-[12px] font-medium cursor-pointer"
                        >
                          Clear search filter
                        </button>
                      </>
                    ) : (
                      <p>No orders recorded in the last 24 hours.</p>
                    )}
                  </div>

                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <RescheduleOrderModal
        order={reschedulingOrder}
        isOpen={Boolean(reschedulingOrder)}
        onClose={() => setReschedulingOrder(null)}
        onRescheduleSuccess={(updated) => {
          if (onRescheduleOrder) {
            onRescheduleOrder(updated);
          }
        }}
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

      {/* Change Replacement Date Modal */}
      <ChangeReplacementDateModal
        replacement={selectedReplacementToChangeDate}
        isOpen={Boolean(selectedReplacementToChangeDate)}
        onClose={() => setSelectedReplacementToChangeDate(null)}
        onSuccess={(updated) => {
          setReplacementsList((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          onUpdateReplacement?.(updated);
          setSelectedReplacementToChangeDate(null);
        }}
      />
    </div>
  );
}
