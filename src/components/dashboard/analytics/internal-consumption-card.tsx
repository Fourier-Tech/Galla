"use client";

import React, { useState } from "react";
import { formatRupee } from "@/lib/utils";
import { InternalConsumptionData, AnalyticsRangePreset } from "@/types/analytics";
import { Repeat, ChevronRight, Eye } from "lucide-react";
import { ConsumptionDetailsModal } from "./consumption-details-modal";

interface InternalConsumptionCardProps {
  internalConsumption: InternalConsumptionData;
  range: AnalyticsRangePreset;
  rangeLabel: string;
  customStart?: string;
  customEnd?: string;
}

export function InternalConsumptionCard({
  internalConsumption,
  range,
  rangeLabel,
  customStart,
  customEnd,
}: InternalConsumptionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-galla-paper border border-galla-line rounded-[5px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-galla-teal/40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[5px] bg-galla-surface border border-galla-line text-galla-teal shrink-0">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-[13.5px] font-bold text-galla-ink">
                Internal Salon Consumption Cost
              </span>
              <span className="font-sans text-[10.5px] font-semibold text-galla-teal bg-galla-teal-soft/40 px-2 py-0.5 rounded-[3px] border border-galla-teal/20">
                {rangeLabel}
              </span>
            </div>
            <div className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              Wholesale value of products deducted from usable stock for salon services &amp; treatments
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-right group cursor-pointer hover:opacity-85 transition-opacity focus:outline-none"
            title="Click to view detailed itemized movements"
          >
            <div className="flex items-center gap-1 justify-end font-semibold text-[19px] text-galla-ink tabular-nums group-hover:text-galla-teal transition-colors">
              <span>{formatRupee(internalConsumption.totalCost)}</span>
              <ChevronRight className="w-4 h-4 text-galla-ink-soft group-hover:text-galla-teal transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="flex items-center justify-end gap-1.5 font-sans text-[11.5px] text-galla-teal font-medium tabular-nums mt-0.5">
              <Eye className="w-3 h-3" />
              <span>{internalConsumption.transfersCount} deduction{internalConsumption.transfersCount === 1 ? "" : "s"} &bull; View details</span>
            </div>
          </button>
        </div>
      </div>

      <ConsumptionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        range={range}
        customStart={customStart}
        customEnd={customEnd}
        rangeLabel={rangeLabel}
        expectedTotalCost={internalConsumption.totalCost}
      />
    </>
  );
}
