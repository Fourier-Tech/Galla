"use client";

import React from "react";
import { Plus, AlertTriangle, Wallet } from "lucide-react";
import { DashboardOrder, DashboardProduct } from "@/types/dashboard";
import { StatBlock } from "@/components/dashboard/stat-block";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee } from "@/lib/utils";

interface OverviewTabProps {
  orders: DashboardOrder[];
  products: DashboardProduct[];
  expensesTotal: number;
  onOpenNewOrder: () => void;
  onOpenNewExpense: () => void;
}

export function OverviewTab({
  orders,
  products,
  expensesTotal,
  onOpenNewOrder,
  onOpenNewExpense,
}: OverviewTabProps) {
  const todayOrders = orders.filter((o) => o.isToday !== false);
  const todayIncome = todayOrders.reduce((sum, o) => sum + o.paid, 0);
  const advancePayment = todayOrders
    .filter((o) => o.status === "advance_paid" || (o.paid > 0 && o.paid < o.amount))
    .reduce((sum, o) => sum + o.paid, 0);
  const pendingAmount = orders.reduce(
    (sum, o) => sum + Math.max(0, o.amount - o.paid),
    0
  );
  const lowStockProducts = products.filter((p) => p.sell <= 2);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3.5 w-full">
      {/* Section Header (Fixed) */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-[20px] tracking-[-0.015em] text-galla-ink">
            Today&apos;s Galla &amp; Counter
          </h2>
          <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
            Real-time shop collections, register balance &amp; daily flow
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {/* Low Stock Warning Banner (Fixed & Compact) */}
      {lowStockProducts.length > 0 && (
        <div
          role="alert"
          className="shrink-0 px-3.5 py-2 rounded-[5px] bg-red-50 border border-red-300 text-red-900 text-[12px] font-sans flex items-center gap-2 shadow-xs"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span>
            <strong className="font-semibold">
              {lowStockProducts.length} product
              {lowStockProducts.length > 1 ? "s" : ""}
            </strong>{" "}
            running low on sell stock &mdash;{" "}
            {lowStockProducts.map((p) => p.name).join(", ")}.
          </span>
        </div>
      )}

      {/* Recent Orders Section (Flex-1 scrollable table) */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <h3 className="shrink-0 font-heading font-semibold text-[17px] text-galla-ink">
          Recent Counter Orders
        </h3>

        <div className="flex-1 flex flex-col min-h-0 bg-galla-surface border border-galla-line rounded-[5px] overflow-hidden shadow-xs">
          {/* Sticky Table Header */}
          <div className="shrink-0 grid grid-cols-[80px_1fr_120px_120px] gap-x-8 items-center px-[21px] py-[9px] bg-galla-paper/70 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.05em] z-10">
            <span>Order</span>
            <span>Customer &amp; Service</span>
            <span className="text-right">Settlement</span>
            <span className="text-right">Status</span>
          </div>

          {/* Scrollable Table Rows */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-galla-line">
            {orders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[80px_1fr_120px_120px] gap-x-8 items-center px-[21px] py-[14px] hover:bg-galla-paper/30 transition-colors"
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
                </div>

                <div className="text-right">
                  <div className="font-heading font-semibold text-[16px] text-galla-ink tabular-nums">
                    {formatRupee(order.amount)}
                  </div>
                  {order.paid < order.amount ? (
                    <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                      {formatRupee(order.amount - order.paid)} due
                    </div>
                  ) : (
                    <div className="font-sans text-[11px] text-galla-ink-soft/70">
                      Settled
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <StatusPill status={order.status} />
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="p-8 text-center font-sans text-[13px] text-galla-ink-soft">
                No orders recorded today yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
