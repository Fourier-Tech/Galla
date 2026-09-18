"use client";

import React from "react";
import { Calendar, X } from "lucide-react";
import { getLocalDateString, getFirstDayOfCurrentMonth } from "@/lib/utils";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  itemLabel?: string;
  className?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
  itemLabel = "items",
  className = "",
}: DateRangeFilterProps) {
  const todayStr = getLocalDateString(new Date()) || "";
  const firstDayStr = getFirstDayOfCurrentMonth();

  const isTodayActive = Boolean(startDate === todayStr && endDate === todayStr);
  const isThisMonthActive = Boolean(startDate === firstDayStr && endDate === todayStr);

  const toggleToday = () => {
    if (isTodayActive) {
      onDateChange("", "");
    } else {
      onDateChange(todayStr, todayStr);
    }
  };

  const toggleThisMonth = () => {
    if (isThisMonthActive) {
      onDateChange("", "");
    } else {
      onDateChange(firstDayStr, todayStr);
    }
  };

  const handleClear = () => {
    onDateChange("", "");
  };

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {/* Date Range Inputs */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-ink text-[12.5px] font-sans shadow-xs focus-within:border-galla-teal focus-within:ring-1 focus-within:ring-galla-teal transition-all">
        <Calendar className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
        <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">From</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onDateChange(e.target.value, endDate)}
          className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
          title={`Filter ${itemLabel} from date`}
        />
        <span className="text-[10.5px] font-semibold text-galla-ink-soft/70">&ndash;</span>
        <span className="text-[10.5px] font-semibold uppercase text-galla-ink-soft tracking-wider">To</span>
        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => onDateChange(startDate, e.target.value)}
          className="bg-transparent text-galla-ink text-[12px] font-sans outline-none cursor-pointer"
          title={`Filter ${itemLabel} to date`}
        />
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-galla-ink-soft hover:text-galla-ink cursor-pointer p-0.5 ml-0.5"
            title="Clear date range"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleToday}
          className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
            isTodayActive
              ? "bg-galla-teal text-white border-galla-teal shadow-xs"
              : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
          }`}
          title={`Filter ${itemLabel} for today only`}
        >
          Today
        </button>

        <button
          type="button"
          onClick={toggleThisMonth}
          className={`px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans font-medium transition-all cursor-pointer border ${
            isThisMonthActive
              ? "bg-galla-teal text-white border-galla-teal shadow-xs"
              : "bg-galla-surface text-galla-ink-soft border-galla-line hover:text-galla-ink hover:border-galla-ink-soft/40"
          }`}
          title={`Filter ${itemLabel} from the 1st of this month to today`}
        >
          This Month
        </button>
      </div>
    </div>
  );
}
