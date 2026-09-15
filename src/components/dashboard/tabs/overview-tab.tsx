"use client";

import React, { useState, useMemo } from "react";
import { Plus, AlertTriangle, Wallet, Check, Loader2, Search, X, ArrowRight, Calendar } from "lucide-react";
import { DashboardOrder, DashboardProduct } from "@/types/dashboard";
import { StatBlock } from "@/components/dashboard/stat-block";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee, calculatePendingAmount, formatBookingDate, formatAppointmentTime, getBookingUrgency } from "@/lib/utils";

interface OverviewTabProps {
  orders: DashboardOrder[];
  products: DashboardProduct[];
  expensesTotal: number;
  onOpenNewOrder: () => void;
  onOpenNewExpense: () => void;
  onNavigateToAdvanceOrders?: () => void;
  onCompleteOrder?: (orderId: string) => Promise<void> | void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onNavigateToInventory?: () => void;
  onOpenSettle?: (order: DashboardOrder) => void;
}

export function OverviewTab({
  orders,
  products,
  expensesTotal,
  onOpenNewOrder,
  onOpenNewExpense,
  onNavigateToAdvanceOrders,
  onCompleteOrder,
  onOpenRefund,
  onNavigateToInventory,
  onOpenSettle,
}: OverviewTabProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleComplete = async (id: string) => {
    if (!onCompleteOrder) return;
    setLoadingId(id);
    try {
      await onCompleteOrder(id);
    } finally {
      setLoadingId(null);
    }
  };
  const todayOrders = orders.filter((o) => o.isToday !== false);
  const todayIncome = todayOrders.reduce((sum, o) => sum + (Number(o.paid) || 0), 0);
  const advancePayment = todayOrders
    .filter(
      (o) =>
        (o.status === "advance_paid" || o.status === "paid_full") &&
        Number(o.paid) > 0
    )
    .reduce((sum, o) => sum + (Number(o.paid) || 0), 0);
  const pendingAmount = calculatePendingAmount(orders);
  const lowStockProducts = products.filter((p) => p.sell <= 2);

  // Recent Counter Orders table shows orders from the last 24 hours, filtered by search query
  const recent24hOrders = useMemo(() => {
    const base = orders.filter((o) => o.isLast24Hours !== false);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;

    return base.filter((o) => {
      const idMatch = o.id?.toLowerCase().includes(q);
      const customerMatch = o.customer?.toLowerCase().includes(q);
      const typeMatch = o.type?.toLowerCase().includes(q);
      const statusMatch = o.status?.toLowerCase().replace(/_/g, " ").includes(q);
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
              className={`relative inline-flex items-center gap-1.5 font-sans text-[13px] font-medium px-[13px] py-[7px] rounded-[5px] shadow-xs transition-all cursor-pointer border ${
                upcomingAdvanceOrders.length > 0
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
                  className={`ml-1 inline-flex items-center justify-center h-5 rounded-full text-[11px] font-bold bg-amber-600 text-white leading-none shadow-2xs shrink-0 tabular-nums ${
                    upcomingAdvanceOrders.length > 9 ? "min-w-5 px-1.5" : "w-5"
                  }`}
                >
                  {upcomingAdvanceOrders.length}
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

      {/* 4 Major KPI Numbers Grid (Fixed) */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
        <div className="bg-galla-surface">
          <StatBlock
            label="Income Today"
            value={formatRupee(todayIncome)}
            tone="sage"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Expense Today"
            value={formatRupee(expensesTotal)}
            tone="brick"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Advance Payment"
            value={formatRupee(advancePayment)}
            tone="brass"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Pending Amount"
            value={formatRupee(pendingAmount)}
            tone="ink"
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
              <div className="shrink-0 grid grid-cols-[85px_minmax(200px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[11px] bg-galla-paper/70 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.06em] z-10">
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
                  const urgency = isPendingOrder && order.scheduledFor ? getBookingUrgency(order.scheduledFor) : null;
                  // ponytail: Settle/Done actions only show once appointment date has arrived (today or overdue). Upgrade path: tenant config for strictly today if past-date locks are requested.
                  const isAppointmentDue = !isPendingOrder || !order.scheduledFor || (urgency !== null && urgency.daysAway <= 0);

                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-[85px_minmax(200px,1.5fr)_165px_140px_185px] gap-x-6 items-center px-[21px] py-[14px] hover:bg-galla-paper/30 transition-colors"
                    >
                  <span className="font-mono text-[13px] text-galla-ink-soft">
                    {order.id}
                  </span>

                  <div className="min-w-0 pr-4">
                    <div className="font-sans font-semibold text-[15px] text-galla-ink leading-snug truncate">
                      {order.customer}
                    </div>
                    <div className="font-sans text-[12px] text-galla-ink-soft truncate">
                      {order.type} &bull; {order.time}
                    </div>
                    {isPendingOrder && order.scheduledFor && (() => {
                      const isToday = urgency?.tone === "today";
                      const isTomorrow = urgency?.tone === "tomorrow";
                      const isIn2Days = urgency?.tone === "in_2_days";

                      const badgeStyle = isToday
                        ? "text-rose-800 bg-rose-50/90 border-rose-200"
                        : isTomorrow
                        ? "text-amber-800 bg-amber-50/90 border-amber-200"
                        : isIn2Days
                        ? "text-blue-800 bg-blue-50/90 border-blue-200"
                        : "text-amber-800 bg-amber-50/90 border-amber-200/80";

                      const dateStr = formatBookingDate(order.scheduledFor);
                      const timeStr = order.scheduledTime ? formatAppointmentTime(order.scheduledTime) : null;
                      const suffix = timeStr ? ` • ${timeStr}` : "";

                      return (
                        <div className={`inline-flex items-center gap-1 font-sans text-[11px] border px-1.5 py-0.2 rounded-[4px] mt-0.5 font-medium ${badgeStyle}`}>
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {urgency?.tone === "today"
                              ? `🚨 Today${suffix}`
                              : urgency?.tone === "tomorrow"
                              ? `⏰ Tomorrow${suffix}`
                              : urgency?.tone === "in_2_days"
                              ? `📅 In 2 Days${suffix}`
                              : `Booked: ${dateStr}${suffix}`}
                          </span>
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
                          <div className="font-sans text-[12px] text-galla-ink-soft font-medium tabular-nums">
                            {formatRupee(order.advanceAmount)} adv. paid
                            {order.paymentMode && (
                              <span className="font-medium text-[12px] text-galla-ink-soft/80 ml-1">
                                ({order.paymentMode})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="font-sans text-[12px] text-red-700 font-medium tabular-nums">
                          {order.refundAmount
                            ? `${formatRupee(order.refundAmount)} refunded`
                            : "Refunded"}
                          {order.refundMode && (
                            <span className="font-medium text-[12px] text-red-600/90 ml-1">
                              ({order.refundMode})
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
                          <div className="font-sans text-[12px] text-galla-teal font-medium tabular-nums">
                            {formatRupee(order.paid)} adv.
                            {order.paymentMode && (
                              <span className="uppercase text-[10px] font-semibold tracking-wider text-galla-teal/90 ml-1">
                                ({order.paymentMode})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                          {formatRupee(order.amount - order.paid)} due
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
                      {isAppointmentDue && (
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
                      )}
                      {onOpenRefund && order.paid > 0 ? (
                        <button
                          onClick={() => onOpenRefund(order)}
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
                          onClick={() => (onOpenSettle ? onOpenSettle(order) : handleComplete(order.id))}
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
                          onClick={() => onOpenRefund(order)}
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
</div>
  );
}
