"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  HourlyDistributionItem,
  WeekdayDistributionItem,
  TrafficRangePreset,
  WeekdayRangePreset,
  TrafficAnalyticsData,
  WeekdayAnalyticsData,
} from "@/types/analytics";
import { formatRupee } from "@/lib/utils";
import { Clock, CalendarDays, Loader2, AlertCircle } from "lucide-react";

interface ParlourHeatmapCardProps {
  initialHourly?: HourlyDistributionItem[];
  initialWeekday?: WeekdayDistributionItem[];
}

export function ParlourHeatmapCard({}: ParlourHeatmapCardProps) {
  // 1. Independent Traffic (Hourly Density) State
  const [trafficPreset, setTrafficPreset] = useState<TrafficRangePreset>("today");
  const [trafficData, setTrafficData] = useState<TrafficAnalyticsData | null>(null);
  const [isTrafficLoading, setIsTrafficLoading] = useState<boolean>(true);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const trafficAbortRef = useRef<AbortController | null>(null);

  const fetchTraffic = useCallback(async (preset: TrafficRangePreset) => {
    if (trafficAbortRef.current) trafficAbortRef.current.abort();
    const controller = new AbortController();
    trafficAbortRef.current = controller;

    setIsTrafficLoading(true);
    setTrafficError(null);

    try {
      const res = await fetch(`/api/analytics?section=traffic&preset=${preset}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load hourly density");
      const json = await res.json();
      if (json.success && json.data) {
        setTrafficData(json.data);
      } else {
        throw new Error(json.error || "Failed to load hourly data");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setTrafficError(err.message || "Failed to load traffic");
    } finally {
      setIsTrafficLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraffic(trafficPreset);
    return () => {
      if (trafficAbortRef.current) trafficAbortRef.current.abort();
    };
  }, [trafficPreset, fetchTraffic]);

  // 2. Independent Weekday State
  const [weekdayPreset, setWeekdayPreset] = useState<WeekdayRangePreset>("this_week");
  const [weekdayData, setWeekdayData] = useState<WeekdayAnalyticsData | null>(null);
  const [isWeekdayLoading, setIsWeekdayLoading] = useState<boolean>(true);
  const [weekdayError, setWeekdayError] = useState<string | null>(null);
  const weekdayAbortRef = useRef<AbortController | null>(null);

  const fetchWeekday = useCallback(async (preset: WeekdayRangePreset) => {
    if (weekdayAbortRef.current) weekdayAbortRef.current.abort();
    const controller = new AbortController();
    weekdayAbortRef.current = controller;

    setIsWeekdayLoading(true);
    setWeekdayError(null);

    try {
      const res = await fetch(`/api/analytics?section=weekday&preset=${preset}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load weekday pattern");
      const json = await res.json();
      if (json.success && json.data) {
        setWeekdayData(json.data);
      } else {
        throw new Error(json.error || "Failed to load weekday data");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setWeekdayError(err.message || "Failed to load weekday data");
    } finally {
      setIsWeekdayLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeekday(weekdayPreset);
    return () => {
      if (weekdayAbortRef.current) weekdayAbortRef.current.abort();
    };
  }, [weekdayPreset, fetchWeekday]);

  const hourly = trafficData?.hourly || [];
  const maxHourlyCount = Math.max(1, ...hourly.map((h) => h.count));

  const weekday = weekdayData?.weekday || [];
  const maxWeekdayCount = Math.max(1, ...weekday.map((w) => w.count));

  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] shadow-xs">
      <div className="mb-5">
        <h3 className="text-[15px] font-bold text-galla-ink">
          Parlour Peak Traffic &amp; Capacity Curves
        </h3>
        <p className="font-sans text-[12px] text-galla-ink-soft">
          Hourly booking density and day-of-week demand patterns to optimize chair allocation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hourly Distribution (Today vs Yesterday) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-galla-teal" />
              <h4 className="font-sans text-[13px] font-semibold text-galla-ink">
                Hourly Booking Density (10 AM &ndash; 9 PM)
              </h4>
            </div>

            {/* Toggle: Today / Yesterday */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-[4px] bg-galla-paper p-0.5 border border-galla-line">
                <button
                  type="button"
                  onClick={() => setTrafficPreset("today")}
                  className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                    trafficPreset === "today"
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setTrafficPreset("yesterday")}
                  className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                    trafficPreset === "yesterday"
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  Yesterday
                </button>
              </div>
              {isTrafficLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-galla-teal" />
              )}
            </div>
          </div>

          {trafficError && !isTrafficLoading && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-[11.5px] font-sans flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>{trafficError}</span>
            </div>
          )}

          <div className="space-y-2">
            {hourly.map((item) => {
              const intensity = Math.round((item.count / maxHourlyCount) * 100);
              return (
                <div key={item.hour} className="flex items-center gap-2 text-[11px] font-sans">
                  <span className="w-12 text-galla-ink-soft tabular-nums shrink-0">
                    {item.label}
                  </span>
                  <div className="h-5 flex-1 bg-galla-paper rounded-[3px] overflow-hidden p-0.5 flex items-center">
                    <div
                      className="h-full bg-galla-teal rounded-[2px] transition-all duration-300 flex items-center px-1.5"
                      style={{
                        width: `${Math.max(item.count > 0 ? 8 : 0, intensity)}%`,
                        opacity: item.count > 0 ? 0.35 + (intensity / 100) * 0.65 : 0,
                      }}
                    >
                      {item.count > 0 && (
                        <span className="text-[10px] font-sans tabular-nums text-white font-medium">
                          {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="w-16 text-right font-sans tabular-nums text-galla-ink-soft shrink-0">
                    {item.revenue > 0 ? formatRupee(item.revenue) : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekday Distribution (This Week vs Last Week) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-galla-brass" />
              <h4 className="font-sans text-[13px] font-semibold text-galla-ink">
                Busiest Days of the Week
              </h4>
            </div>

            {/* Toggle: This week / Last week */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-[4px] bg-galla-paper p-0.5 border border-galla-line">
                <button
                  type="button"
                  onClick={() => setWeekdayPreset("this_week")}
                  className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                    weekdayPreset === "this_week"
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdayPreset("last_week")}
                  className={`px-2 py-0.5 text-[11px] font-sans font-medium rounded-[3px] transition-all cursor-pointer ${
                    weekdayPreset === "last_week"
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  Last Week
                </button>
              </div>
              {isWeekdayLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-galla-brass" />
              )}
            </div>
          </div>

          {weekdayError && !isWeekdayLoading && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-[11.5px] font-sans flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>{weekdayError}</span>
            </div>
          )}

          <div className="space-y-3">
            {weekday.map((item) => {
              const intensity = Math.round((item.count / maxWeekdayCount) * 100);
              const isWeekend = item.day === "Sat" || item.day === "Sun";
              return (
                <div key={item.day}>
                  <div className="flex items-center justify-between text-[12px] font-sans mb-1">
                    <span className={`font-medium ${isWeekend ? "text-galla-brick" : "text-galla-ink"}`}>
                      {item.day} {isWeekend && "• Weekend"}
                    </span>
                    <span className="font-sans tabular-nums text-galla-ink-soft">
                      {item.count} orders &bull; {formatRupee(item.revenue)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-galla-paper rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isWeekend ? "bg-galla-brick" : "bg-galla-brass"
                      }`}
                      style={{ width: `${Math.max(item.count > 0 ? 5 : 0, intensity)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
