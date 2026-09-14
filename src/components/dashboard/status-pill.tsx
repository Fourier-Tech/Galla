import React from "react";
import { OrderStatus } from "@/types/dashboard";

interface StatusPillProps {
  status: OrderStatus;
  className?: string;
  customLabel?: string;
  title?: string;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-800 border border-green-300",
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-green-50 text-green-800 border border-green-300",
  },
  paid_full: {
    label: "Paid in full",
    className: "bg-galla-teal-soft text-galla-teal border border-galla-teal/20",
  },
  advance_paid: {
    label: "Advance paid",
    className: "bg-galla-brass-soft text-galla-brass border border-galla-brass/20",
  },
  cancelled_refunded: {
    label: "Refunded",
    className: "bg-red-50 text-red-900 border border-red-300",
  },
  cancelled_converted: {
    label: "Converted",
    className: "bg-galla-brick-soft text-galla-brick border border-galla-brick/20",
  },
  created: {
    label: "Created",
    className: "bg-galla-paper text-galla-ink-soft border border-galla-line",
  },
};

export function StatusPill({ status, className = "", customLabel, title }: StatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  const label = customLabel || config.label;

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center text-center min-w-[105px] px-2.5 shrink-0 rounded-[3px] py-0.5 font-heading text-[12px] font-semibold uppercase tracking-[0.05em] ${config.className} ${className}`}
    >
      {label}
    </span>
  );
}
