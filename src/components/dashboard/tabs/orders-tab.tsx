"use client";

import React, { useState } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { DashboardOrder, OrderStatus } from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatRupee } from "@/lib/utils";

interface OrdersTabProps {
  orders: DashboardOrder[];
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
  onOpenNewOrder,
  onCompleteOrder,
  onOpenRefund,
}: OrdersTabProps) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    if (!onCompleteOrder) return;
    setLoadingId(id);
    try {
      await onCompleteOrder(id);
    } finally {
      setLoadingId(null);
    }
  };

  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6 w-full">
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
      <div className="bg-galla-surface border border-galla-line rounded-[5px] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[70px_1fr_140px_150px_175px] gap-x-6 items-center px-[21px] py-[10px] bg-galla-paper/50 border-b border-galla-line font-heading text-[11px] font-semibold text-galla-ink-soft uppercase tracking-[0.05em]">
          <span>Order</span>
          <span>Customer &amp; Service</span>
          <span className="text-right">Settlement</span>
          <span className="text-center">Status</span>
          <span className="text-right">Action</span>
        </div>

        <div className="divide-y divide-galla-line">
          {filteredOrders.map((order) => {
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
                  />
                </div>

              <div className="flex items-center justify-end gap-2">
                {order.status === "completed" ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[12px] font-sans text-green-700 font-medium">
                      <Check className="h-3.5 w-3.5 text-green-600" /> Done
                    </span>
                    {onOpenRefund && (
                      <button
                        onClick={() => onOpenRefund(order)}
                        className="inline-flex items-center text-[12px] font-sans font-medium px-2 py-1 rounded-[4px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 hover:border-red-400 transition-all cursor-pointer shadow-2xs"
                        title="Process refund for this order"
                      >
                        Refund
                      </button>
                    )}
                  </>
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

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
            No orders found in this status category.
          </div>
        )}
      </div>
    </div>
  );
}
