"use client";

import React from "react";
import { MoveRight } from "lucide-react";
import { DashboardProduct } from "@/types/dashboard";
import { formatRupee } from "@/lib/utils";

interface InventoryTabProps {
  products: DashboardProduct[];
  onMoveStock: (id: number | string) => void;
}

export function InventoryTab({ products, onMoveStock }: InventoryTabProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="font-heading font-semibold text-[21px] tracking-[-0.015em] text-galla-ink">
          Retail &amp; Salon Inventory
        </h2>
        <p className="font-sans text-[13px] text-galla-ink-soft mt-0.5">
          Dual split stock: Retail for customer sale &bull; Internal consumption for treatments
        </p>
      </div>

      {/* Inventory Table */}
      <div className="bg-galla-surface border border-galla-line rounded-[5px] overflow-hidden">
        <div className="grid grid-cols-[1.5fr_100px_110px_100px_130px] px-[21px] py-[12px] bg-galla-paper/50 border-b border-galla-line font-heading text-[12px] font-semibold text-galla-ink-soft uppercase tracking-[0.05em]">
          <span>Product</span>
          <span>Sell Price</span>
          <span>Sell Stock</span>
          <span>Use Stock</span>
          <span className="text-right">Transfer</span>
        </div>

        <div className="divide-y divide-galla-line">
          {products.map((product) => {
            const isLowStock = product.sell <= 2;
            return (
              <div
                key={product.id}
                className="grid grid-cols-[1.5fr_100px_110px_100px_130px] items-center px-[21px] py-[16px] hover:bg-galla-paper/30 transition-colors"
              >
                <div>
                  <div className="font-sans font-semibold text-[15px] text-galla-ink">
                    {product.name}
                  </div>
                </div>

                <div className="font-heading font-semibold text-[15px] text-galla-ink-soft tabular-nums">
                  {formatRupee(product.price)}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-sans text-[14px] font-medium tabular-nums ${
                      isLowStock ? "text-red-700" : "text-galla-ink"
                    }`}
                  >
                    {product.sell} pcs
                  </span>
                  {isLowStock && (
                    <span className="bg-red-50 text-red-800 border border-red-200 text-[10px] font-heading font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px]">
                      Low
                    </span>
                  )}
                </div>

                <div className="font-sans text-[14px] text-galla-ink-soft tabular-nums">
                  {product.use} pcs
                </div>

                <div className="text-right">
                  <button
                    onClick={() => onMoveStock(product.id)}
                    disabled={product.sell <= 0}
                    className="inline-flex items-center gap-1.5 text-[12px] font-sans font-medium text-galla-teal hover:opacity-85 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
                    title="Move 1 unit from Retail to Salon internal consumption"
                  >
                    <span>Move to use</span>
                    <MoveRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
