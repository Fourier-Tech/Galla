"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { TopServiceItem, ServiceCategoryContribution } from "@/types/analytics";
import { Sparkles } from "lucide-react";

interface ServiceIntelligenceCardProps {
  topServices: TopServiceItem[];
  categoryContribution: ServiceCategoryContribution[];
}

export function ServiceIntelligenceCard({
  topServices,
  categoryContribution,
}: ServiceIntelligenceCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[21px]">
      {/* Top 5 Services */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-galla-teal" />
            <h3 className="text-[15px] font-bold text-galla-ink">
              Top 5 Performing Services
            </h3>
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
            Ranked by total turnover and client appointment frequency
          </p>

          {topServices.length === 0 ? (
            <div className="py-8 text-center font-sans text-[12px] text-galla-ink-soft">
              No service booking records for this period
            </div>
          ) : (
            <div className="space-y-3">
              {topServices.map((service, idx) => (
                <div
                  key={service.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-[5px] bg-galla-paper border border-galla-line/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-galla-surface border border-galla-line flex items-center justify-center font-sans text-[11px] font-semibold text-galla-ink tabular-nums">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-sans text-[13px] font-semibold text-galla-ink leading-tight">
                        {service.name}
                      </div>
                      <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
                        {service.bookingsCount} bookings &bull; Avg {formatRupee(service.avgPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-[13px] font-semibold text-galla-teal tabular-nums">
                      {formatRupee(service.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
          Prices and bookings exclude packaged discounts and membership adjustments
        </div>
      </div>

      {/* Category Contribution */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-galla-ink mb-1">
            Department Contribution
          </h3>
          <p className="font-sans text-[12px] text-galla-ink-soft mb-5">
            Turnover distribution across Hair, Skin, Nails, Spa &amp; Makeup
          </p>

          <div className="space-y-4">
            {categoryContribution.map((cat, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-[12px] font-sans mb-1.5">
                  <span className="font-medium text-galla-ink">{cat.category}</span>
                  <div className="text-right">
                    <span className="font-sans font-medium text-galla-ink tabular-nums">
                      {formatRupee(cat.revenue)}
                    </span>{" "}
                    <span className="text-galla-ink-soft text-[11px] tabular-nums">({cat.percent}%)</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-galla-paper rounded-full overflow-hidden">
                  <div
                    className="h-full bg-galla-brass transition-all duration-500"
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-galla-line text-[11px] font-sans text-galla-ink-soft flex items-center justify-between">
          <span>Primary Treatment Core</span>
          <span className="font-medium text-galla-ink">
            {categoryContribution[0]?.category || "General"}
          </span>
        </div>
      </div>
    </div>
  );
}
