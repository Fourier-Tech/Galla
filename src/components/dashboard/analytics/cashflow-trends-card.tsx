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
import { formatRupee } from "@/lib/utils";
import { CashflowTimelinePoint } from "@/types/analytics";

interface CashflowTrendsCardProps {
  timeline: CashflowTimelinePoint[];
  rangeLabel: string;
}

export function CashflowTrendsCard({ timeline, rangeLabel }: CashflowTrendsCardProps) {
  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-galla-ink">
            Cash Flow &mdash; Collections vs Expenses
          </h3>
          <p className="font-sans text-[12px] text-galla-ink-soft">
            Daily operational cash-in versus outflow trends ({rangeLabel})
          </p>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-sans">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#2F6F52]" />
            <span className="text-galla-ink-soft">Collections (Cash In)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#B83A5D]" />
            <span className="text-galla-ink-soft">Expenses (Cash Out)</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[250px] w-full">
        {timeline.length === 0 ? (
          <div className="h-full flex items-center justify-center font-sans text-[13px] text-galla-ink-soft">
            No transaction records found for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={timeline}
              barGap={3}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#EFE5E9" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#7A666E" }}
                axisLine={{ stroke: "#EFE5E9" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#7A666E" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                formatter={(value: unknown, name: any) => [
                  formatRupee(Number(value) || 0),
                  name === "revenue" ? "Collections" : "Operating Expenses",
                ]}
                labelFormatter={(label) => `Timeline: ${label}`}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#EFE5E9",
                  borderRadius: 5,
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
              <Bar dataKey="revenue" fill="#2F6F52" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="expense" fill="#B83A5D" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
