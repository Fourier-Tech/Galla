"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { StatBlock } from "@/components/dashboard/stat-block";
import { formatRupee } from "@/lib/utils";

interface AnalyticsTabProps {
  pendingAmount: number;
}

const WEEK_DATA = [
  { day: "Mon", Product: 3200, Service: 4100 },
  { day: "Tue", Product: 2800, Service: 3600 },
  { day: "Wed", Product: 4100, Service: 3900 },
  { day: "Thu", Product: 3600, Service: 4700 },
  { day: "Fri", Product: 5200, Service: 6100 },
  { day: "Sat", Product: 7400, Service: 8300 },
  { day: "Sun", Product: 6100, Service: 7000 },
];

export function AnalyticsTab({ pendingAmount }: AnalyticsTabProps) {
  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-[10px] py-[3px] rounded-[3px] bg-galla-teal-soft text-galla-teal text-[11px] font-heading font-semibold uppercase tracking-wider mb-2">
          Owner-Gated Intelligence
        </div>
        <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
          Weekly Financial Performance &amp; Margins
        </h2>
        <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
          Comprehensive 7-day revenue split, expense tracking &amp; operating yield
        </p>
      </div>

      {/* KPI Stat Cards (Divided Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
        <div className="bg-galla-surface">
          <StatBlock
            label="This Week's Revenue"
            value={formatRupee(38400)}
            delta="+12% vs last week"
            tone="sage"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="This Week's Expense"
            value={formatRupee(9600)}
            delta="-4% vs last week"
            tone="brick"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="Pending Across All Orders"
            value={formatRupee(pendingAmount)}
            tone="ink"
          />
        </div>
      </div>

      {/* Golden Section Split: Chart (1.618fr) vs Margin Summary (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-[21px]">
        {/* Recharts BarChart Card */}
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink">
              Product vs Service Revenue &mdash; Last 7 Days
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-sans">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B86A28]" />
                <span className="text-galla-ink-soft">Product</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#B83A5D]" />
                <span className="text-galla-ink-soft">Service</span>
              </span>
            </div>
          </div>

          <div className="h-[233px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK_DATA} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE5E9" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#7A666E" }}
                  axisLine={{ stroke: "#EFE5E9" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#7A666E" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatRupee(Number(value) || 0), ""]}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#EFE5E9",
                    borderRadius: 5,
                    fontFamily: "var(--font-inter)",
                    fontSize: 13,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                />
                <Bar dataKey="Product" fill="#B86A28" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Service" fill="#B83A5D" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operating Margin Summary Card */}
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
          <div>
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink mb-1">
              Net Operating Margin
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft">
              Gross collections minus all verified operational expenses
            </p>

            <div className="mt-4 pt-4 border-t border-galla-line">
              <div className="font-heading font-semibold text-[26px] text-galla-sage tracking-tight leading-none">
                +{formatRupee(28800)}
              </div>
              <div className="font-sans text-[12px] text-galla-ink-soft mt-1">
                75% weekly operating profit yield
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-galla-line">
            <div>
              <div className="flex justify-between text-[12px] font-sans mb-1">
                <span className="text-galla-ink-soft">Service Treatments</span>
                <span className="font-medium text-galla-ink">62% &bull; {formatRupee(23800)}</span>
              </div>
              <div className="w-full bg-galla-paper h-1.5 rounded-full overflow-hidden">
                <div className="bg-galla-teal h-full w-[62%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] font-sans mb-1">
                <span className="text-galla-ink-soft">Retail Product Sales</span>
                <span className="font-medium text-galla-ink">38% &bull; {formatRupee(14600)}</span>
              </div>
              <div className="w-full bg-galla-paper h-1.5 rounded-full overflow-hidden">
                <div className="bg-galla-brass h-full w-[38%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
