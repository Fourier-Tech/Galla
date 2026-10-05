"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MonthlyRangePreset,
  PerformanceAnalyticsData,
} from "@/types/analytics";
import { ServiceIntelligenceCard } from "./service-intelligence-card";
import { InventoryIntelligenceCard } from "./inventory-intelligence-card";
import {
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

export function PerformanceAnalyticsSection() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const [monthlyRange, setMonthlyRange] = useState<MonthlyRangePreset>("this_month");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const [data, setData] = useState<PerformanceAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        section: "performance",
        monthlyRange,
      });

      if (monthlyRange === "custom_month") {
        params.set("year", String(selectedYear));
        params.set("month", String(selectedMonth));
      } else if (monthlyRange === "yearly") {
        params.set("year", String(selectedYear));
      }

      const res = await fetch(`/api/analytics?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to fetch performance`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Malformed performance data");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[PerformanceAnalytics] Fetch error:", err);
      setError(err.message || "Failed to load performance metrics");
    } finally {
      setIsLoading(false);
    }
  }, [monthlyRange, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchPerformance();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchPerformance]);

  const months = [
    { value: 1, name: "January" },
    { value: 2, name: "February" },
    { value: 3, name: "March" },
    { value: 4, name: "April" },
    { value: 5, name: "May" },
    { value: 6, name: "June" },
    { value: 7, name: "July" },
    { value: 8, name: "August" },
    { value: 9, name: "September" },
    { value: 10, name: "October" },
    { value: 11, name: "November" },
    { value: 12, name: "December" },
  ];

  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-4">
      {/* Section Header & Monthly Controls Bar */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-galla-teal" />
            <h3 className="text-[15px] font-bold text-galla-ink">
              Products &amp; Services Performance
            </h3>
            {data?.label && (
              <span className="font-sans text-[11px] font-semibold text-galla-teal bg-galla-teal-soft/40 px-2 py-0.5 rounded-[3px] border border-galla-teal/20">
                {data.label}
              </span>
            )}
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
            Turnover ranking, retail movement, and department contribution on monthly &amp; yearly cycles
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-[4px] bg-galla-paper p-0.5 border border-galla-line">
            <button
              type="button"
              onClick={() => setMonthlyRange("this_month")}
              className={`px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                monthlyRange === "this_month"
                  ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setMonthlyRange("30d")}
              className={`px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                monthlyRange === "30d"
                  ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setMonthlyRange("custom_month")}
              className={`px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                monthlyRange === "custom_month"
                  ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              Select Month
            </button>
            <button
              type="button"
              onClick={() => setMonthlyRange("yearly")}
              className={`px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                monthlyRange === "yearly"
                  ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setMonthlyRange("all_time")}
              className={`px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                monthlyRange === "all_time"
                  ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Month & Year Selectors for custom_month */}
          {monthlyRange === "custom_month" && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-[12px] font-sans bg-galla-surface border border-galla-line rounded-[4px] px-2 py-1 text-galla-ink focus:outline-none focus:border-galla-teal"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-[12px] font-sans bg-galla-surface border border-galla-line rounded-[4px] px-2 py-1 text-galla-ink focus:outline-none focus:border-galla-teal"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year selector for yearly */}
          {monthlyRange === "yearly" && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-[12px] font-sans bg-galla-surface border border-galla-line rounded-[4px] px-2 py-1 text-galla-ink focus:outline-none focus:border-galla-teal"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Inline Loading / Refresh indicator */}
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-galla-teal ml-1" />
          )}
        </div>
      </div>

      {/* Error View */}
      {error && !isLoading && (
        <div className="p-4 rounded-[5px] bg-red-50 border border-red-200 text-red-900 flex items-center justify-between text-[12.5px] font-sans">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchPerformance}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-white border border-red-200 text-red-800 text-[11.5px] hover:bg-red-50"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[21px]">
            <div className="h-64 bg-galla-surface border border-galla-line rounded-[5px]" />
            <div className="h-64 bg-galla-surface border border-galla-line rounded-[5px]" />
          </div>
        </div>
      )}

      {/* Render Cards with Monthly-Scoped Data */}
      {data && (
        <div className="space-y-6">
          <ServiceIntelligenceCard
            topServices={data.services.topServices}
            categoryContribution={data.services.categoryContribution}
          />
          <InventoryIntelligenceCard
            topRetail={data.inventory.topRetailProducts}
            slowMoving={data.inventory.slowMovingStock}
          />
        </div>
      )}
    </div>
  );
}
