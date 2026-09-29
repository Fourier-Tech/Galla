"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { ExecutiveMetricsData, MetricDelta } from "@/types/analytics";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ExecutiveMetricsGridProps {
  metrics: ExecutiveMetricsData;
  rangeLabel: string;
}

function DeltaBadge({ delta, suffix = "vs prev period" }: { delta: MetricDelta; suffix?: string }) {
  const isUp = delta.deltaPercent > 0;
  const isDown = delta.deltaPercent < 0;

  return (
    <div
      className={`inline-flex items-center gap-1 font-sans text-[11px] font-medium ${
        isUp ? "text-galla-sage" : isDown ? "text-galla-brick" : "text-galla-ink-soft"
      }`}
    >
      {isUp && <TrendingUp className="w-3 h-3 shrink-0" />}
      {isDown && <TrendingDown className="w-3 h-3 shrink-0" />}
      {!isUp && !isDown && <Minus className="w-3 h-3 shrink-0" />}
      <span>
        {isUp ? `+${delta.deltaPercent}%` : `${delta.deltaPercent}%`} {suffix}
      </span>
    </div>
  );
}

export function ExecutiveMetricsGrid({ metrics, rangeLabel }: ExecutiveMetricsGridProps) {
  const suffix = `vs prev ${rangeLabel.toLowerCase()}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden shadow-xs">
      {/* 1. Net Collections / Revenue */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
            Net Collections
          </span>
          <div className="mt-1 font-semibold text-[24px] tracking-tight text-galla-sage tabular-nums">
            {formatRupee(metrics.netRevenue.current)}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line">
          <DeltaBadge delta={metrics.netRevenue} suffix={suffix} />
        </div>
      </div>

      {/* 2. Total Expenses */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
            Operating Expenses
          </span>
          <div className="mt-1 font-semibold text-[24px] tracking-tight text-galla-brick tabular-nums">
            {formatRupee(metrics.totalExpenses.current)}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line">
          <DeltaBadge delta={metrics.totalExpenses} suffix={suffix} />
        </div>
      </div>

      {/* 3. Net Operating Profit & Margin % */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
              Net Profit
            </span>
            <span
              className={`font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] ${
                metrics.profitMarginPercent.current >= 0
                  ? "bg-galla-sage-soft text-galla-sage"
                  : "bg-galla-brick-soft text-galla-brick"
              }`}
            >
              {metrics.profitMarginPercent.current}% margin
            </span>
          </div>
          <div
            className={`mt-1 font-semibold text-[24px] tracking-tight tabular-nums ${
              metrics.netProfit.current >= 0 ? "text-galla-ink" : "text-galla-brick"
            }`}
          >
            {metrics.netProfit.current >= 0
              ? `+${formatRupee(metrics.netProfit.current)}`
              : `-${formatRupee(Math.abs(metrics.netProfit.current))}`}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line">
          <DeltaBadge delta={metrics.netProfit} suffix={suffix} />
        </div>
      </div>

      {/* 4. Average Ticket Value (ATV) */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
            Average Ticket (ATV)
          </span>
          <div className="mt-1 font-semibold text-[24px] tracking-tight text-galla-ink tabular-nums">
            {formatRupee(metrics.averageTicketValue.current)}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line">
          <DeltaBadge delta={metrics.averageTicketValue} suffix={suffix} />
        </div>
      </div>

      {/* 5. Total Footfall / Bookings */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
            Total Orders / Footfall
          </span>
          <div className="mt-1 font-semibold text-[24px] tracking-tight text-galla-ink tabular-nums">
            {metrics.totalFootfall.current}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line">
          <DeltaBadge delta={metrics.totalFootfall} suffix={suffix} />
        </div>
      </div>

      {/* 6. Uncollected Customer Dues */}
      <div className="bg-galla-surface p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
              Pending Dues
            </span>
            {metrics.uncollectedDues > 0 && (
              <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-red-50 text-red-700 border border-red-200">
                Action Req.
              </span>
            )}
          </div>
          <div
            className={`mt-1 font-semibold text-[24px] tracking-tight tabular-nums ${
              metrics.uncollectedDues > 0 ? "text-galla-brick" : "text-galla-ink"
            }`}
          >
            {formatRupee(metrics.uncollectedDues)}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
          Across all active customer accounts
        </div>
      </div>
    </div>
  );
}
