"use client";

import React, { useMemo } from "react";
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
import { DashboardOrder, DashboardExpense } from "@/types/dashboard";

interface AnalyticsTabProps {
  orders?: DashboardOrder[];
  expenses?: DashboardExpense[];
  pendingAmount: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AnalyticsTab({
  orders = [],
  expenses = [],
  pendingAmount,
}: AnalyticsTabProps) {
  // ponytail: Client-side 7-day aggregation operates on loaded orders/expenses. Upgrade path: dedicated GET /api/analytics/weekly endpoint using MongoDB date aggregation if weekly volume exceeds 10,000 transactions.
  // Compute 7-day chronological stats based on live data
  const {
    weekData,
    weekRevenue,
    weekExpense,
    netMargin,
    marginPercent,
    serviceRevenue,
    productRevenue,
    servicePercent,
    productPercent,
    revenueDeltaText,
    expenseDeltaText,
  } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Last 7 days: [today - 6 days, today]
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(startOfToday.getDate() - 6);

    // Prior 7 days: [today - 13 days, today - 7 days] for delta comparison
    const fourteenDaysAgo = new Date(startOfToday);
    fourteenDaysAgo.setDate(startOfToday.getDate() - 13);

    // Filter current 7-day window
    const currentOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return !isNaN(d.getTime()) && d >= sevenDaysAgo;
    });

    const currentExpenses = expenses.filter((e) => {
      if (!e.createdAt) return false;
      const d = new Date(e.createdAt);
      return !isNaN(d.getTime()) && d >= sevenDaysAgo;
    });

    // Filter prior 7-day window
    const priorOrders = orders.filter((o) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return !isNaN(d.getTime()) && d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    const priorExpenses = expenses.filter((e) => {
      if (!e.createdAt) return false;
      const d = new Date(e.createdAt);
      return !isNaN(d.getTime()) && d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    const rev = currentOrders.reduce((sum, o) => sum + (o.paid || 0), 0);
    const exp = currentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const margin = rev - exp;
    const marginPct = rev > 0 ? Math.round((margin / rev) * 100) : 0;

    const priorRev = priorOrders.reduce((sum, o) => sum + (o.paid || 0), 0);
    const priorExp = priorExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const revDeltaText =
      priorRev > 0
        ? `${rev >= priorRev ? "+" : ""}${Math.round(((rev - priorRev) / priorRev) * 100)}% vs prev 7d`
        : undefined;

    const expDeltaText =
      priorExp > 0
        ? `${exp >= priorExp ? "+" : ""}${Math.round(((exp - priorExp) / priorExp) * 100)}% vs prev 7d`
        : undefined;

    const servRev = currentOrders
      .filter((o) => o.type === "Service booking" || o.type === "Package sale")
      .reduce((sum, o) => sum + (o.paid || 0), 0);

    const prodRev = currentOrders
      .filter((o) => o.type === "Product sale")
      .reduce((sum, o) => sum + (o.paid || 0), 0);

    const totalSplit = servRev + prodRev;
    const servPct = totalSplit > 0 ? Math.round((servRev / totalSplit) * 100) : 0;
    const prodPct = totalSplit > 0 ? 100 - servPct : 0;

    // Daily breakdown for the last 7 calendar days
    const dailyData: { day: string; Product: number; Service: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(startOfToday);
      targetDate.setDate(startOfToday.getDate() - i);
      const dayLabel = DAYS[targetDate.getDay()];
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth();
      const dt = targetDate.getDate();

      const dayOrders = orders.filter((o) => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        return d.getFullYear() === y && d.getMonth() === m && d.getDate() === dt;
      });

      const dayProd = dayOrders
        .filter((o) => o.type === "Product sale")
        .reduce((sum, o) => sum + (o.paid || 0), 0);

      const dayServ = dayOrders
        .filter((o) => o.type === "Service booking" || o.type === "Package sale")
        .reduce((sum, o) => sum + (o.paid || 0), 0);

      dailyData.push({
        day: dayLabel,
        Product: dayProd,
        Service: dayServ,
      });
    }

    return {
      weekData: dailyData,
      weekRevenue: rev,
      weekExpense: exp,
      netMargin: margin,
      marginPercent: marginPct,
      serviceRevenue: servRev,
      productRevenue: prodRev,
      servicePercent: servPct,
      productPercent: prodPct,
      revenueDeltaText: revDeltaText,
      expenseDeltaText: expDeltaText,
    };
  }, [orders, expenses]);

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
          Live 7-day revenue split, expense tracking &amp; operating yield
        </p>
      </div>

      {/* KPI Stat Cards (Divided Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
        <div className="bg-galla-surface">
          <StatBlock
            label="This Week's Revenue"
            value={formatRupee(weekRevenue)}
            delta={revenueDeltaText}
            tone="sage"
          />
        </div>
        <div className="bg-galla-surface">
          <StatBlock
            label="This Week's Expense"
            value={formatRupee(weekExpense)}
            delta={expenseDeltaText}
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
              <BarChart data={weekData} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              Gross collections minus all operational expenses
            </p>

            <div className="mt-4 pt-4 border-t border-galla-line">
              <div
                className={`font-heading font-semibold text-[26px] tracking-tight leading-none ${
                  netMargin >= 0 ? "text-galla-sage" : "text-galla-brick"
                }`}
              >
                {netMargin >= 0 ? `+${formatRupee(netMargin)}` : `-${formatRupee(Math.abs(netMargin))}`}
              </div>
              <div className="font-sans text-[12px] text-galla-ink-soft mt-1">
                {weekRevenue > 0
                  ? `${marginPercent}% weekly operating profit yield`
                  : "No revenue recorded for the current week"}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-galla-line">
            <div>
              <div className="flex justify-between text-[12px] font-sans mb-1">
                <span className="text-galla-ink-soft">Service Treatments</span>
                <span className="font-medium text-galla-ink">
                  {servicePercent}% &bull; {formatRupee(serviceRevenue)}
                </span>
              </div>
              <div className="w-full bg-galla-paper h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-galla-teal h-full transition-all"
                  style={{ width: `${servicePercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] font-sans mb-1">
                <span className="text-galla-ink-soft">Retail Product Sales</span>
                <span className="font-medium text-galla-ink">
                  {productPercent}% &bull; {formatRupee(productRevenue)}
                </span>
              </div>
              <div className="w-full bg-galla-paper h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-galla-brass h-full transition-all"
                  style={{ width: `${productPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
