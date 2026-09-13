import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatBlockProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "sage" | "brick" | "ink" | "brass";
}

export function StatBlock({
  label,
  value,
  delta,
  tone = "ink",
}: StatBlockProps) {
  const toneClass =
    tone === "sage"
      ? "text-galla-sage"
      : tone === "brick"
      ? "text-galla-brick"
      : tone === "brass"
      ? "text-galla-brass"
      : "text-galla-ink";

  const isNegative = delta?.startsWith("-");

  return (
    <div className="px-[18px] py-[14px]">
      <div className="font-sans text-[12px] text-galla-ink-soft mb-1 font-medium">
        {label}
      </div>
      <div
        className={`font-heading font-semibold text-[30px] leading-none tracking-[-0.02em] tabular-nums ${toneClass}`}
      >
        {value}
      </div>
      {delta && (
        <div
          className={`mt-1.5 flex items-center gap-1 font-sans text-[11px] font-medium ${
            isNegative ? "text-galla-brick" : "text-galla-sage"
          }`}
        >
          {isNegative ? (
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
