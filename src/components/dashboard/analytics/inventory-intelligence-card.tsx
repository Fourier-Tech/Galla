"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import {
  TopRetailProductItem,
  HighMarginProductItem,
  InternalConsumptionData,
  SlowMovingStockItem,
} from "@/types/analytics";
import { ShoppingBag, ArrowUpRight, AlertTriangle, Repeat } from "lucide-react";

interface InventoryIntelligenceCardProps {
  topRetail: TopRetailProductItem[];
  highMargin: HighMarginProductItem[];
  internalConsumption: InternalConsumptionData;
  slowMoving: SlowMovingStockItem[];
}

export function InventoryIntelligenceCard({
  topRetail,
  highMargin,
  internalConsumption,
  slowMoving,
}: InventoryIntelligenceCardProps) {
  return (
    <div className="space-y-6">
      {/* Internal Consumption Callout Banner */}
      <div className="bg-galla-paper border border-galla-line rounded-[5px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[4px] bg-galla-surface border border-galla-line text-galla-teal">
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <div className="font-sans text-[13px] font-semibold text-galla-ink">
              Internal Salon Consumption Cost
            </div>
            <div className="font-sans text-[12px] text-galla-ink-soft">
              Wholesale value of shelf products moved to in-use stock for treatments
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-[17px] text-galla-ink tabular-nums">
            {formatRupee(internalConsumption.totalCost)}
          </div>
          <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
            {internalConsumption.transfersCount} stock movements recorded
          </div>
        </div>
      </div>

      {/* Grid: Top Retail Sellers vs Highest Margin Products */}
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

        {/* Highest Margin Products */}
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-galla-sage" />
              <h3 className="text-[15px] font-bold text-galla-ink">
                Highest Margin Products
              </h3>
            </div>
            <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
              Products delivering the greatest profit markup (Sell Price &minus; Purchase Cost)
            </p>

            {highMargin.length === 0 ? (
              <div className="py-8 text-center font-sans text-[12px] text-galla-ink-soft">
                No products with margin spread configured
              </div>
            ) : (
              <div className="space-y-3">
                {highMargin.map((prod, idx) => (
                  <div
                    key={prod.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-[5px] bg-galla-paper border border-galla-line/60"
                  >
                    <div>
                      <div className="font-sans text-[13px] font-semibold text-galla-ink leading-tight">
                        {prod.name}
                      </div>
                      <div className="font-sans text-[11px] text-galla-ink-soft tabular-nums">
                        Cost {formatRupee(prod.purchaseCost)} &rarr; Sell {formatRupee(prod.sellPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-sans text-[13px] font-semibold text-galla-sage tabular-nums">
                        +{formatRupee(prod.marginRupees)}/pc
                      </div>
                      <div className="font-sans text-[11px] font-semibold text-galla-sage tabular-nums">
                        {prod.marginPercent}% margin
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-galla-line font-sans text-[11px] text-galla-ink-soft">
            Promoting high-margin products boosts net operating profitability
          </div>
        </div>
      </div>

      {/* Slow-Moving / Dead Stock */}
      {slowMoving.length > 0 && (
        <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-galla-brick" />
              <h3 className="text-[15px] font-bold text-galla-ink">
                Slow-Moving &amp; Dead Stock Warning
              </h3>
            </div>
            <span className="font-sans text-[11px] px-2 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-200">
              0 Sales in Period
            </span>
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft mb-4">
            Active products with positive shelf inventory but zero client sales, locking up working capital
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {slowMoving.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-[5px] bg-galla-paper border border-galla-line flex flex-col justify-between"
              >
                <div>
                  <div className="font-sans text-[12px] font-semibold text-galla-ink truncate">
                    {item.name}
                  </div>
                  <div className="font-sans text-[11px] text-galla-ink-soft mt-0.5 tabular-nums">
                    {item.sellStock} pcs on shelf
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-galla-line/60">
                  <span className="font-sans text-[11px] text-galla-ink-soft font-medium block">
                    Locked Capital
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-galla-brick tabular-nums">
                    {formatRupee(item.lockedCapital)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
