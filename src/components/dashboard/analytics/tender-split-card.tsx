"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { TenderSplitItem } from "@/types/analytics";
import { QrCode, Banknote, CreditCard, Shuffle } from "lucide-react";

interface TenderSplitCardProps {
  split: TenderSplitItem[];
}

export function TenderSplitCard({ split }: TenderSplitCardProps) {
  const getIcon = (mode: string) => {
    switch (mode) {
      case "upi":
        return <QrCode className="w-3.5 h-3.5 text-galla-teal" />;
      case "cash":
        return <Banknote className="w-3.5 h-3.5 text-galla-sage" />;
      case "card":
        return <CreditCard className="w-3.5 h-3.5 text-galla-brass" />;
      default:
        return <Shuffle className="w-3.5 h-3.5 text-galla-ink-soft" />;
    }
  };

  const totalCollected = split.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-galla-ink">
            Tender &amp; Payment Mode Split
          </h3>
          <span className="font-semibold text-[13px] text-galla-ink tabular-nums">
            {formatRupee(totalCollected)}
          </span>
        </div>
        <p className="font-sans text-[12px] text-galla-ink-soft mb-5">
          Settlement channels used by clients for collections and booking advances
        </p>

        <div className="space-y-4">
          {split.map((t, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between text-[12px] font-sans mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-[3px] bg-galla-paper border border-galla-line">
                    {getIcon(t.mode)}
                  </span>
                  <span className="font-medium text-galla-ink">{t.label}</span>
                  <span className="text-[11px] text-galla-ink-soft tabular-nums">
                    ({t.count} {t.count === 1 ? "payment" : "payments"})
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-sans font-medium text-galla-ink tabular-nums">
                    {formatRupee(t.amount)}
                  </span>{" "}
                  <span className="text-galla-ink-soft text-[11px] tabular-nums">({t.percent}%)</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-galla-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-galla-teal transition-all duration-500"
                  style={{ width: `${t.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-galla-line text-[11px] font-sans text-galla-ink-soft flex items-center justify-between">
        <span>Digital vs Cash Proportion</span>
        <span className="font-medium text-galla-ink">
          {split.find((s) => s.mode === "upi")?.percent || 0}% UPI Adoption
        </span>
      </div>
    </div>
  );
}
