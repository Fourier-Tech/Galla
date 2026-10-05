"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Repeat,
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatRupee } from "@/lib/utils";
import {
  AnalyticsRangePreset,
  ConsumptionDetailsData,
  InternalConsumptionMovementItem,
} from "@/types/analytics";

interface ConsumptionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  range: AnalyticsRangePreset;
  customStart?: string;
  customEnd?: string;
  rangeLabel: string;
  expectedTotalCost?: number;
}

export function ConsumptionDetailsModal({
  isOpen,
  onClose,
  range,
  customStart,
  customEnd,
  rangeLabel,
  expectedTotalCost,
}: ConsumptionDetailsModalProps) {
  const [data, setData] = useState<ConsumptionDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        section: "consumption_details",
        range,
      });
      if (range === "custom" && customStart && customEnd) {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
      }

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to load details`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Failed to load consumption movements");
      }
    } catch (err: any) {
      console.error("[ConsumptionDetailsModal] Fetch error:", err);
      setError(err.message || "Failed to load movements");
    } finally {
      setIsLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen, fetchDetails]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-galla-surface border border-galla-line rounded-[6px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-galla-line bg-galla-paper/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[5px] bg-galla-surface border border-galla-line text-galla-teal">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-galla-ink">
                Internal Salon Consumption Movements
              </h3>
              <p className="font-sans text-[12px] text-galla-ink-soft">
                Usable retail stock deducted for in-salon services &amp; treatments ({rangeLabel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reconciled Summary Bar */}
        <div className="px-5 py-2.5 bg-galla-surface border-b border-galla-line flex items-center justify-between text-[12.5px] font-sans">
          <div className="flex items-center gap-2 text-galla-ink-soft">
            <Calendar className="w-3.5 h-3.5 text-galla-teal" />
            <span>Active Period: <strong className="font-medium text-galla-ink">{rangeLabel}</strong></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-galla-ink-soft">
              Total Deductions:{" "}
              <strong className="font-semibold text-galla-ink tabular-nums">
                {data ? data.totalItems : "..."}
              </strong>
            </span>
            <span className="text-galla-ink-soft">
              Total Cost:{" "}
              <strong className="font-semibold text-galla-teal tabular-nums text-[13.5px]">
                {data ? formatRupee(data.totalCost) : expectedTotalCost !== undefined ? formatRupee(expectedTotalCost) : "..."}
              </strong>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-galla-ink-soft">
              <Loader2 className="w-6 h-6 animate-spin text-galla-teal" />
              <span className="text-[12.5px] font-sans">Loading consumption entries...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-[5px] bg-red-50 border border-red-200 text-red-900 flex items-center gap-2 text-[13px] font-sans">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && data && data.items.length === 0 && (
            <div className="py-16 text-center">
              <Repeat className="w-8 h-8 text-galla-line mx-auto mb-2" />
              <div className="font-semibold text-galla-ink text-[14px]">
                No internal stock deductions recorded
              </div>
              <p className="font-sans text-[12px] text-galla-ink-soft mt-1">
                No products were deducted from usable stock for salon services during {rangeLabel}.
              </p>
            </div>
          )}

          {!isLoading && !error && data && data.items.length > 0 && (
            <div className="overflow-x-auto border border-galla-line rounded-[5px]">
              <table className="w-full text-left border-collapse text-[12px] font-sans">
                <thead>
                  <tr className="bg-galla-paper/70 border-b border-galla-line text-galla-ink-soft uppercase text-[10.5px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Date &amp; Time (IST)</th>
                    <th className="py-2.5 px-3">Reason / Context</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-galla-line/60">
                  {data.items.map((item: InternalConsumptionMovementItem) => {
                    const dateObj = new Date(item.dateTime);
                    const formattedDate = dateObj.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    });
                    const formattedTime = dateObj.toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "Asia/Kolkata",
                    });

                    return (
                      <tr key={item.id} className="hover:bg-galla-paper/40 transition-colors">
                        <td className="py-2.5 px-3 align-middle font-medium text-galla-ink">
                          <div>{item.productName}</div>
                          {item.notes && (
                            <div className="text-[11px] text-galla-ink-soft truncate max-w-xs mt-0.5" title={item.notes}>
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-middle whitespace-nowrap text-galla-ink-soft">
                          <div>{formattedDate}</div>
                          <div className="text-[11px] text-galla-ink-soft/80">{formattedTime}</div>
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-galla-paper border border-galla-line text-[11px] text-galla-ink font-medium">
                            <FileText className="w-3 h-3 text-galla-ink-soft shrink-0" />
                            <span>{item.reason || "Salon Treatment"}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-middle text-center tabular-nums font-semibold text-galla-ink">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-right tabular-nums text-galla-ink-soft">
                          {formatRupee(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-right tabular-nums font-semibold text-galla-ink">
                          {formatRupee(item.totalCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-galla-line bg-galla-paper/50 flex items-center justify-between text-[11.5px] font-sans text-galla-ink-soft">
          <span>* Cost is calculated from wholesale purchase cost at time of deduction</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[4px] bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
