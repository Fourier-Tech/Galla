"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnalyticsRangePreset, AnalyticsResponseData } from "@/types/analytics";
import { DashboardOrder, DashboardExpense } from "@/types/dashboard";
import { AnalyticsHeader } from "@/components/dashboard/analytics/analytics-header";
import { ExecutiveMetricsGrid } from "@/components/dashboard/analytics/executive-metrics-grid";
import { CashflowTrendsCard } from "@/components/dashboard/analytics/cashflow-trends-card";
import { RevenueMixCard } from "@/components/dashboard/analytics/revenue-mix-card";
import { TenderSplitCard } from "@/components/dashboard/analytics/tender-split-card";
import { ServiceIntelligenceCard } from "@/components/dashboard/analytics/service-intelligence-card";
import { ParlourHeatmapCard } from "@/components/dashboard/analytics/parlour-heatmap-card";
import { InventoryIntelligenceCard } from "@/components/dashboard/analytics/inventory-intelligence-card";
import { ClientRetentionCard } from "@/components/dashboard/analytics/client-retention-card";
import { ProcurementHealthCard } from "@/components/dashboard/analytics/procurement-health-card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface AnalyticsTabProps {
  orders?: DashboardOrder[];
  expenses?: DashboardExpense[];
  pendingAmount?: number;
}

export function AnalyticsTab({}: AnalyticsTabProps) {
  const [range, setRange] = useState<AnalyticsRangePreset>("today");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [data, setData] = useState<AnalyticsResponseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
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
    fetchAnalytics();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAnalytics]);

  const rangeLabels: Record<AnalyticsRangePreset, string> = {
    today: "Today",
    "7d": "Last 7 Days",
    this_month: "This Month",
    "30d": "Last 30 Days",
    custom: "Custom Range",
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* 1. Header & Range Controls */}
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
        onRefresh={fetchAnalytics}
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
            onClick={fetchAnalytics}
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

      {/* Content View */}
      {data && (
        <div className="space-y-6">
          {/* Section 1: Executive Metric Cards */}
          <section>
            <ExecutiveMetricsGrid
              metrics={data.executive}
              rangeLabel={rangeLabels[range]}
            />
          </section>

          {/* Section 2: Cashflow Trends & Revenue Mix (Golden Ratio Split: 1.618fr vs 1fr) */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-[21px]">
            <CashflowTrendsCard
              timeline={data.cashflow.timeline}
              rangeLabel={rangeLabels[range]}
            />
            <RevenueMixCard mix={data.cashflow.revenueMix} />
          </section>

          {/* Tender / Payment Mode Split */}
          <section>
            <TenderSplitCard split={data.cashflow.tenderSplit} />
          </section>

          {/* Section 3: Service & Treatment Intelligence */}
          <section>
            <ServiceIntelligenceCard
              topServices={data.services.topServices}
              categoryContribution={data.services.categoryContribution}
            />
          </section>

          {/* Parlour Traffic & Peak Hours Heatmap */}
          <section>
            <ParlourHeatmapCard
              hourly={data.services.hourlyDistribution}
              weekday={data.services.weekdayDistribution}
            />
          </section>

          {/* Section 4: Inventory & Retail Product Intelligence */}
          <section>
            <InventoryIntelligenceCard
              topRetail={data.inventory.topRetailProducts}
              highMargin={data.inventory.highestMarginProducts}
              internalConsumption={data.inventory.internalConsumption}
              slowMoving={data.inventory.slowMovingStock}
            />
          </section>

          {/* Section 5: Client Retention & Visit Intelligence */}
          <section>
            <ClientRetentionCard
              retention={data.clients.retention}
              vipClients={data.clients.vipClients}
            />
          </section>

          {/* Section 6: Procurement & Supplier Health */}
          <section>
            <ProcurementHealthCard
              procurement={data.procurement}
              rangeLabel={rangeLabels[range]}
            />
          </section>
        </div>
      )}
    </div>
  );
}
