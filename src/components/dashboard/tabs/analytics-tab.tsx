"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnalyticsRangePreset, MainAnalyticsData } from "@/types/analytics";
import { DashboardOrder, DashboardExpense } from "@/types/dashboard";
import { AnalyticsHeader } from "@/components/dashboard/analytics/analytics-header";
import { ExecutiveMetricsGrid } from "@/components/dashboard/analytics/executive-metrics-grid";
import { CashflowTrendsCard } from "@/components/dashboard/analytics/cashflow-trends-card";
import { RevenueMixCard } from "@/components/dashboard/analytics/revenue-mix-card";
import { TenderSplitCard } from "@/components/dashboard/analytics/tender-split-card";
import { InternalConsumptionCard } from "@/components/dashboard/analytics/internal-consumption-card";
import { PerformanceAnalyticsSection } from "@/components/dashboard/analytics/performance-analytics-section";
import { ParlourHeatmapCard } from "@/components/dashboard/analytics/parlour-heatmap-card";
import { ClientRetentionCard } from "@/components/dashboard/analytics/client-retention-card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface AnalyticsTabProps {
  orders?: DashboardOrder[];
  expenses?: DashboardExpense[];
  pendingAmount?: number;
}

export function AnalyticsTab({}: AnalyticsTabProps) {
  // Main Global Filter State (Controls Top Executive/Procurement metrics, Cashflow, Revenue Mix, Tender Split, Internal Consumption, and Retention)
  const [range, setRange] = useState<AnalyticsRangePreset>("today");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [data, setData] = useState<MainAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMainAnalytics = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        section: "main",
        range,
      });
      if (range === "custom" && customStart && customEnd) {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
        params.set("customStart", customStart);
        params.set("customEnd", customEnd);
      }

      const res = await fetch(`/api/analytics?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to fetch analytics`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Malformed analytics payload");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[AnalyticsTab Fetch Error]:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    fetchMainAnalytics();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMainAnalytics]);

  const rangeLabels: Record<AnalyticsRangePreset, string> = {
    today: "Today",
    "7d": "Last 7 Days",
    this_month: "This Month",
    "30d": "Last 30 Days",
    custom: "Custom Range",
  };

  const getActiveRangeLabel = () => {
    if (range === "custom" && customStart && customEnd) {
      const [sY, sM, sD] = customStart.split("-").map(Number);
      const [eY, eM, eD] = customEnd.split("-").map(Number);
      const sDate = new Date(sY, sM - 1, sD);
      const eDate = new Date(eY, eM - 1, eD);
      if (customStart === customEnd) {
        return sDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
      const sStr = sDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      const eStr = eDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${sStr} – ${eStr}`;
    }
    return rangeLabels[range] || "Custom Range";
  };

  const activeRangeLabel = getActiveRangeLabel();

  return (
    <div className="space-y-6 w-full pb-12">
      {/* 1. Main Filter Header (Controls Executive, Procurement Balances, Cashflow & Consumption) */}
      <AnalyticsHeader
        range={range}
        onRangeChange={(newRange) => {
          setRange(newRange);
          if (newRange === "custom" && !customStart) {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            setCustomStart(thirtyDaysAgo.toISOString().split("T")[0]);
            setCustomEnd(today.toISOString().split("T")[0]);
          }
        }}
        customStartDate={customStart}
        customEndDate={customEnd}
        onCustomDateChange={(start, end) => {
          setCustomStart(start);
          setCustomEnd(end);
        }}
        onRefresh={fetchMainAnalytics}
        isLoading={isLoading}
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-[5px] bg-red-50 border border-red-200 text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-sans text-[13px]">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchMainAnalytics}
            className="flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-white border border-red-200 text-red-800 text-[12px] font-sans font-medium hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-galla-line border border-galla-line rounded-[5px] overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-galla-surface p-4 space-y-2">
                <div className="h-3 w-16 bg-galla-paper rounded" />
                <div className="h-6 w-24 bg-galla-paper rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-[21px]">
            <div className="h-72 bg-galla-surface border border-galla-line rounded-[5px]" />
            <div className="h-72 bg-galla-surface border border-galla-line rounded-[5px]" />
          </div>
        </div>
      )}

      {/* Main Filter Controlled Content */}
      {data && (
        <div className="space-y-6">
          {/* Section 1: Top Summary Numbers (Operating Metrics + Procurement Cash Flow & Dealer Balances) */}
          <section>
            <ExecutiveMetricsGrid
              metrics={data.executive}
              procurement={data.procurement}
              rangeLabel={activeRangeLabel}
            />
          </section>

          {/* Section 2: Cashflow Trends & Revenue Mix */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-[21px]">
            <CashflowTrendsCard
              timeline={data.cashflow.timeline}
              rangeLabel={activeRangeLabel}
            />
            <RevenueMixCard mix={data.cashflow.revenueMix} />
          </section>

          {/* Section 3: Tender & Payment Mode Split */}
          <section>
            <TenderSplitCard split={data.cashflow.tenderSplit} />
          </section>

          {/* Section 4: Internal Salon Consumption Cost (with Drill-Down Modal) */}
          <section>
            <InternalConsumptionCard
              internalConsumption={data.internalConsumption}
              range={range}
              rangeLabel={activeRangeLabel}
              customStart={customStart}
              customEnd={customEnd}
            />
          </section>

          {/* Section 5: Monthly-Only Performance Group (Top Services, Department Contribution, Top Retail, Slow-Moving Stock) */}
          <section>
            <PerformanceAnalyticsSection />
          </section>

          {/* Section 6: Fixed-Scope Traffic & Capacity Curves (Hourly: Today/Yesterday | Weekday: This Week/Last Week) */}
          <section>
            <ParlourHeatmapCard />
          </section>

          {/* Section 7: Client Retention & Visit Intelligence */}
          {data.clients && (
            <section>
              <ClientRetentionCard
                retention={data.clients.retention}
                vipClients={data.clients.vipClients}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
