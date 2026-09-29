"use client";

import React from "react";
import { RefreshCw, Calendar } from "lucide-react";
import { AnalyticsRangePreset } from "@/types/analytics";

interface AnalyticsHeaderProps {
  range: AnalyticsRangePreset;
  onRangeChange: (range: AnalyticsRangePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomDateChange: (start: string, end: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const PRESETS: { key: AnalyticsRangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "this_month", label: "This Month" },
  { key: "30d", label: "Last 30 Days" },
  { key: "custom", label: "Custom Range" },
];

export function AnalyticsHeader({
  range,
  onRangeChange,
  customStartDate,
  customEndDate,
  onRefresh,
  isLoading,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-galla-line">
      {/* Title & Badge */}
      <div>
        <div className="inline-flex items-center gap-2 px-[10px] py-[3px] rounded-[3px] bg-galla-teal-soft text-galla-teal text-[12px] font-semibold mb-1.5">
          Owner business intelligence
        </div>
        <h2 className="text-[24px] font-bold tracking-[-0.01em] text-galla-ink">
          Executive Financials &amp; Operational Analytics
        </h2>
        <p className="font-sans text-[13px] text-galla-ink-soft">
          Server-aggregated revenue yields, service demand, client retention &amp; procurement cash flow
        </p>
      </div>

      {/* Date Range Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center p-0.5 rounded-[5px] bg-galla-paper border border-galla-line">
          {PRESETS.map((p) => {
            const isActive = range === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onRangeChange(p.key)}
                className={`px-3 py-1.5 rounded-[4px] font-sans text-[12px] transition-all ${
                  isActive
                    ? "bg-galla-surface text-galla-ink shadow-xs border border-galla-line font-semibold"
                    : "text-galla-ink-soft hover:text-galla-ink font-normal"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Inputs if custom is active */}
        {range === "custom" && (
          <div className="flex items-center gap-1.5 bg-galla-paper border border-galla-line rounded-[5px] px-2.5 py-1 text-[12px] font-sans">
            <Calendar className="w-3.5 h-3.5 text-galla-ink-soft" />
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onRangeChange("custom")}
              className="bg-transparent text-galla-ink text-[12px] outline-none tabular-nums"
            />
            <span className="text-galla-ink-soft text-[11px]">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onRangeChange("custom")}
              className="bg-transparent text-galla-ink text-[12px] outline-none tabular-nums"
            />
          </div>
        )}

        {/* Refresh Action */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh analytics data"
          className="p-2 rounded-[5px] bg-galla-surface hover:bg-galla-paper border border-galla-line text-galla-ink-soft hover:text-galla-ink transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-galla-teal" : ""}`} />
        </button>
      </div>
    </div>
  );
}
