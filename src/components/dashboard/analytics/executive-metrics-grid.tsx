import React from "react";
import { formatRupee } from "@/lib/utils";
import {
  ExecutiveMetricsData,
  ProcurementHealthData,
  MetricDelta,
} from "@/types/analytics";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Truck,
  CreditCard,
  Receipt,
  Scale,
} from "lucide-react";

interface ExecutiveMetricsGridProps {
  metrics: ExecutiveMetricsData;
  procurement?: ProcurementHealthData;
  rangeLabel: string;
}

function DeltaBadge({
  delta,
  suffix = "vs prev period",
}: {
  delta: MetricDelta;
  suffix?: string;
}) {
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

export function ExecutiveMetricsGrid({
  metrics,
  procurement,
  rangeLabel,
}: ExecutiveMetricsGridProps) {
  const suffix = `vs prev ${rangeLabel.toLowerCase()}`;

  return (
    <div className="space-y-4">
      {/* 1. Core Operating Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden shadow-xs">
        {/* Net Collections / Revenue */}
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

        {/* Total Expenses */}
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

        {/* Net Operating Profit & Margin % */}
        <div className="bg-galla-surface p-4 flex flex-col justify-between">
          <div>
            <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
              Net Profit
            </span>
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

        {/* Average Ticket Value (ATV) */}
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

        {/* Total Footfall / Bookings */}
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

        {/* Uncollected Customer Dues */}
        <div className="bg-galla-surface p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] text-galla-ink-soft font-medium">
                Pending Client Dues
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
            Across active customer accounts
          </div>
        </div>
      </div>

      {/* 2. Procurement & Dealer Balances Grid (Moved to Top Summary) */}
      {procurement && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden shadow-xs">
          {/* Restock Outflow */}
          <div className="bg-galla-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-galla-ink-soft mb-1">
                <span className="font-sans text-[12px] font-medium text-galla-ink-soft">
                  Restock Outflow
                </span>
                <Truck className="w-3.5 h-3.5 text-galla-brick" />
              </div>
              <div className="mt-1 font-semibold text-[22px] tracking-tight text-galla-ink tabular-nums">
                {formatRupee(procurement.totalPOSpend)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft tabular-nums">
              {procurement.purchaseOrdersCount} purchase bills in {rangeLabel.toLowerCase()}
            </div>
          </div>

          {/* Pending Dealer Dues */}
          <div className="bg-galla-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-galla-ink-soft mb-1">
                <span className="font-sans text-[12px] font-medium text-galla-ink-soft">
                  Pending Dealer Dues
                </span>
                <CreditCard className="w-3.5 h-3.5 text-galla-brick" />
              </div>
              <div className="mt-1 font-semibold text-[22px] tracking-tight text-galla-brick tabular-nums">
                {formatRupee(procurement.totalPendingDealerDues)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
              Payables across all supplier accounts
            </div>
          </div>

          {/* Dealer Return Credits */}
          <div className="bg-galla-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-galla-ink-soft mb-1">
                <span className="font-sans text-[12px] font-medium text-galla-ink-soft">
                  Dealer Return Credits
                </span>
                <Receipt className="w-3.5 h-3.5 text-galla-sage" />
              </div>
              <div className="mt-1 font-semibold text-[22px] tracking-tight text-galla-sage tabular-nums">
                {formatRupee(procurement.totalSupplierCredits)}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
              Credit notes from damaged &amp; returned stock
            </div>
          </div>

          {/* Net Dealer Position */}
          <div className="bg-galla-surface p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-galla-ink-soft mb-1">
                <span className="font-sans text-[12px] font-medium text-galla-ink-soft">
                  Net Dealer Position
                </span>
                <Scale className="w-3.5 h-3.5 text-galla-teal" />
              </div>
              <div
                className={`mt-1 font-semibold text-[22px] tracking-tight tabular-nums ${
                  procurement.netDealerBalance > 0
                    ? "text-galla-brick"
                    : procurement.netDealerBalance < 0
                    ? "text-galla-sage"
                    : "text-galla-ink"
                }`}
              >
                {procurement.netDealerBalance > 0
                  ? formatRupee(procurement.netDealerBalance)
                  : procurement.netDealerBalance < 0
                  ? `+${formatRupee(Math.abs(procurement.netDealerBalance))}`
                  : "₹0"}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
              {procurement.netDealerBalance > 0
                ? "Net payable to suppliers"
                : procurement.netDealerBalance < 0
                ? "Net credit with suppliers"
                : "Balances settled"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
