"use client";

import React from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { DashboardOrder, DashboardProduct, UserRole } from "@/types/dashboard";
import { StatBlock } from "@/components/dashboard/stat-block";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee } from "@/lib/utils";

interface OverviewTabProps {
  orders: DashboardOrder[];
  products: DashboardProduct[];
  expensesTotal: number;
  role: UserRole;
  onOpenNewOrder: () => void;
}

export function OverviewTab({
  orders,
  products,
  expensesTotal,
  role,
  onOpenNewOrder,
}: OverviewTabProps) {
  const todayIncome = orders.reduce((sum, o) => sum + o.paid, 0);
  const pendingAmount = orders.reduce((sum, o) => sum + (o.amount - o.paid), 0);
  const lowStockProducts = products.filter((p) => p.sell <= 2);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
            Today&apos;s Galla &amp; Counter
          </h2>
          <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
            Real-time shop collections, register balance &amp; daily flow
          </p>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* KPI Stat Cards (Divided Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
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
            label="Pending Balance"
            value={formatRupee(pendingAmount)}
            tone="ink"
          />
        </div>
      </div>

      {/* Low Stock Warning Banner (Decoupled Pure Red) */}
      {role === "owner" && lowStockProducts.length > 0 && (
        <div
          role="alert"
          className="p-[13px] rounded-[5px] bg-red-50 border border-red-300 text-red-900 text-[13px] font-sans flex items-center gap-2.5 shadow-xs"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
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

      {/* Recent Orders Section */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-[18px] text-galla-ink">
          Recent Counter Orders
        </h3>

        <div className="bg-galla-surface border border-galla-line rounded-[5px] divide-y divide-galla-line overflow-hidden">
          {orders.slice(0, 5).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between px-[21px] py-[14px] hover:bg-galla-paper/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-[13px] text-galla-ink-soft w-14 shrink-0">
                  {order.id}
                </span>
                <div>
                  <div className="font-sans font-semibold text-[15px] text-galla-ink leading-snug">
                    {order.customer}
                  </div>
                  <div className="font-sans text-[12px] text-galla-ink-soft">
                    {order.type} &bull; {order.time}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-heading font-semibold text-[16px] text-galla-ink tabular-nums">
                    {formatRupee(order.amount)}
                  </div>
                  {order.paid < order.amount && (
                    <div className="font-sans text-[12px] text-galla-brass font-medium tabular-nums">
                      {formatRupee(order.amount - order.paid)} due
                    </div>
                  )}
                </div>
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
  );
}
