import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatBlockProps {
  label: string;
  value: string;
  badge?: string;
  subtext?: string;
  delta?: string;
  tone?: "sage" | "brick" | "ink" | "brass";
}

export function StatBlock({
  label,
  value,
  badge,
  subtext,
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
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-sans text-[12px] text-galla-ink-soft font-medium truncate">
          {label}
        </span>
        {badge && (
          <span className="shrink-0 font-sans text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-galla-paper text-galla-ink-soft border border-galla-line leading-none">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`font-heading font-semibold text-[26px] xl:text-[30px] leading-none tracking-[-0.02em] tabular-nums ${toneClass}`}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1.5 font-sans text-[11px] text-galla-ink-soft/75 leading-tight truncate">
          {subtext}
        </div>
      )}
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
