"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { RevenueMixData } from "@/types/analytics";

interface RevenueMixCardProps {
  mix: RevenueMixData;
}

export function RevenueMixCard({ mix }: RevenueMixCardProps) {
  const items = [
    {
      label: "Salon Treatments",
      data: mix.services,
      color: "bg-[#18635B]", // galla-teal
      textTone: "text-[#18635B]",
    },
    {
      label: "Retail Product Sales",
      data: mix.products,
      color: "bg-[#B86A28]", // galla-brass
      textTone: "text-[#B86A28]",
    },
    {
      label: "Packages / Bundles",
      data: mix.packages,
      color: "bg-[#B83A5D]", // galla-brick
      textTone: "text-[#B83A5D]",
    },
  ];

  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-galla-ink">
            Revenue Department Mix
          </h3>
          <span className="font-semibold text-[13px] text-galla-ink tabular-nums">
            {formatRupee(mix.total)}
          </span>
        </div>
        <p className="font-sans text-[12px] text-galla-ink-soft mb-5">
          Proportion of turnover from service appointments vs shelf merchandise vs packages
        </p>

        {/* Multi-segment Progress Bar */}
        <div className="h-3 w-full bg-galla-paper rounded-full overflow-hidden flex mb-6">
          {items.map((it, i) => (
            <div
              key={i}
              className={`${it.color} h-full transition-all duration-500`}
              style={{ width: `${it.data.percent}%` }}
              title={`${it.label}: ${it.data.percent}%`}
            />
          ))}
        </div>

        {/* Detailed Breakdown List */}
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-xs ${it.color} shrink-0`} />
                <div>
                  <div className="font-sans text-[13px] font-medium text-galla-ink leading-tight">
                    {it.label}
                  </div>
                  <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
                    {it.data.count} units / sessions booked
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-sans text-[13px] font-medium text-galla-ink tabular-nums">
                  {formatRupee(it.data.amount)}
                </div>
                <div className={`font-sans text-[11px] font-semibold tabular-nums ${it.textTone}`}>
                  {it.data.percent}% share
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-galla-line text-[11px] font-sans text-galla-ink-soft flex items-center justify-between">
        <span>Operational Yield</span>
        <span className="font-medium text-galla-ink">
          {mix.services.percent > mix.products.percent ? "Service-Dominant" : "Retail-Heavy"} Salon
        </span>
      </div>
    </div>
  );
}
