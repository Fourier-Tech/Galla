"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { TopRetailProductItem, SlowMovingStockItem } from "@/types/analytics";
import { ShoppingBag, AlertTriangle } from "lucide-react";

interface InventoryIntelligenceCardProps {
  topRetail: TopRetailProductItem[];
  slowMoving: SlowMovingStockItem[];
}

export function InventoryIntelligenceCard({
  topRetail,
  slowMoving,
}: InventoryIntelligenceCardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[21px]">
        {/* Top Retail Sellers */}
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-galla-brass" />
              <h3 className="text-[15px] font-bold text-galla-ink">
                Top Retail Merchandise Sellers
              </h3>
            </div>
            <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
              Best-performing shelf products by sales volume &amp; retail collections
            </p>

            {topRetail.length === 0 ? (
              <div className="py-8 text-center font-sans text-[12px] text-galla-ink-soft">
                No retail merchandise sales in this period
              </div>
            ) : (
              <div className="space-y-3">
                {topRetail.map((prod, idx) => (
                  <div
                    key={prod.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-[5px] bg-galla-paper border border-galla-line/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-galla-surface border border-galla-line flex items-center justify-center font-sans text-[11px] font-semibold text-galla-ink tabular-nums">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-sans text-[13px] font-semibold text-galla-ink leading-tight">
                          {prod.name}
                        </div>
                        <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
                          {prod.unitsSold} units sold &bull; {prod.currentStock} in stock
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-sans text-[13px] font-semibold text-galla-brass tabular-nums">
                        {formatRupee(prod.grossRevenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
            Direct shelf product purchases taken by clients
          </div>
        </div>

        {/* Slow-Moving / Dead Stock Warning */}
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-galla-brick" />
                <h3 className="text-[15px] font-bold text-galla-ink">
                  Slow-Moving &amp; Dead Stock Warning
                </h3>
              </div>
              {slowMoving.length > 0 && (
                <span className="font-sans text-[10.5px] px-1.5 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-200">
                  0 Sales in Period
                </span>
              )}
            </div>
            <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
              Active products with positive shelf inventory but zero client sales
            </p>

            {slowMoving.length === 0 ? (
              <div className="py-8 text-center font-sans text-[12px] text-galla-ink-soft">
                No slow-moving products detected
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {slowMoving.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-[5px] bg-galla-paper border border-galla-line flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <div className="font-sans text-[12.5px] font-semibold text-galla-ink truncate">
                        {item.name}
                      </div>
                      <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
                        {item.sellStock} pcs on shelf &bull; {item.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-sans text-[10.5px] text-galla-ink-soft block">Locked</span>
                      <span className="font-sans text-[13px] font-semibold text-galla-brick tabular-nums">
                        {formatRupee(item.lockedCapital)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
            Reallocate to service usage or run promotions to unlock tied-up working capital
          </div>
        </div>
      </div>
    </div>
  );
}
