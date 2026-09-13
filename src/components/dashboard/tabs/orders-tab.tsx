"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardOrder, OrderStatus } from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee } from "@/lib/utils";

interface OrdersTabProps {
  orders: DashboardOrder[];
  onOpenNewOrder: () => void;
}

const FILTER_OPTIONS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "advance_paid", label: "Advance Paid" },
  { id: "paid_full", label: "Paid in Full" },
  { id: "completed", label: "Completed" },
  { id: "cancelled_refunded", label: "Refunded" },
];

export function OrdersTab({ orders, onOpenNewOrder }: OrdersTabProps) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          className="inline-flex items-center gap-1.5 bg-galla-teal hover:opacity-95 text-white font-sans text-[14px] font-medium px-[13px] py-[8px] rounded-[5px] shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* Filter Pills */}
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

      {/* Order List */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] divide-y divide-galla-line overflow-hidden">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="font-mono text-[13px] text-galla-ink-soft w-14 shrink-0">
                {order.id}
              </span>
              <div>
                <div className="font-sans font-semibold text-[15px] text-galla-ink leading-snug">
                  {order.customer}
                </div>
                <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                  {order.type} &bull; {order.time}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5">
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

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No orders found in this status category.
          </div>
        )}
      </div>
    </div>
  );
}
