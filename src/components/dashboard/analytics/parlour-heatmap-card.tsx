"use client";

import React from "react";
import { HourlyDistributionItem, WeekdayDistributionItem } from "@/types/analytics";
import { formatRupee } from "@/lib/utils";
import { Clock, CalendarDays } from "lucide-react";

interface ParlourHeatmapCardProps {
  hourly: HourlyDistributionItem[];
  weekday: WeekdayDistributionItem[];
}

export function ParlourHeatmapCard({ hourly, weekday }: ParlourHeatmapCardProps) {
  const maxHourlyCount = Math.max(1, ...hourly.map((h) => h.count));
  const maxWeekdayCount = Math.max(1, ...weekday.map((w) => w.count));

  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px]">
      <div className="mb-5">
        <h3 className="text-[15px] font-bold text-galla-ink">
          Parlour Peak Traffic &amp; Capacity Curves
        </h3>
        <p className="font-sans text-[12px] text-galla-ink-soft">
          Hourly booking density and day-of-week demand patterns to optimize chair allocation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hourly Distribution (10 AM to 9 PM) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-galla-teal" />
            <h4 className="font-sans text-[13px] font-semibold text-galla-ink">
              Hourly Booking Density (10 AM &ndash; 9 PM)
            </h4>
          </div>
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

        {/* Weekday Distribution (Mon - Sun) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-3.5 h-3.5 text-galla-brass" />
            <h4 className="font-sans text-[13px] font-semibold text-galla-ink">
              Busiest Days of the Week
            </h4>
          </div>
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
