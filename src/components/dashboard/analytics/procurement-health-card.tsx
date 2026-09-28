"use client";

import React from "react";
import { formatRupee } from "@/lib/utils";
import { ProcurementHealthData } from "@/types/analytics";
import { Truck, Receipt, CreditCard, Scale } from "lucide-react";

interface ProcurementHealthCardProps {
  procurement: ProcurementHealthData;
  rangeLabel: string;
}

export function ProcurementHealthCard({
  procurement,
  rangeLabel,
}: ProcurementHealthCardProps) {
  return (
    <div className="bg-galla-surface border border-galla-line rounded-[5px] p-[21px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-galla-teal" />
            <h3 className="font-heading font-semibold text-[16px] text-galla-ink tracking-tight">
              Procurement Cash Flow &amp; Dealer Balances
            </h3>
          </div>
          <p className="font-sans text-[12px] text-galla-ink-soft">
            Inventory restocking outflow during {rangeLabel} versus aggregate supplier credit balances
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Wholesale Restock Spend */}
        <div className="p-4 rounded-[5px] bg-galla-paper border border-galla-line flex flex-col justify-between">
          <div className="flex items-center justify-between text-galla-ink-soft mb-2">
            <span className="font-sans text-[11px] uppercase tracking-wider font-semibold">
              Restock Outflow
            </span>
            <Receipt className="w-4 h-4 text-galla-brick" />
          </div>
          <div>
            <div className="font-heading font-semibold text-[22px] text-galla-ink tabular-nums">
              {formatRupee(procurement.totalPOSpend)}
            </div>
            <div className="font-sans text-[11px] text-galla-ink-soft mt-1">
              {procurement.purchaseOrdersCount} purchase bills in {rangeLabel}
            </div>
          </div>
        </div>

        {/* Outstanding Dues Owed to Suppliers */}
        <div className="p-4 rounded-[5px] bg-galla-paper border border-galla-line flex flex-col justify-between">
          <div className="flex items-center justify-between text-galla-ink-soft mb-2">
            <span className="font-sans text-[11px] uppercase tracking-wider font-semibold">
              Pending Dealer Dues
            </span>
            <CreditCard className="w-4 h-4 text-galla-brick" />
          </div>
          <div>
            <div className="font-heading font-semibold text-[22px] text-galla-brick tabular-nums">
              {formatRupee(procurement.totalPendingDealerDues)}
            </div>
            <div className="font-sans text-[11px] text-galla-ink-soft mt-1">
              Payables across all supplier accounts
            </div>
          </div>
        </div>

        {/* Return Credit Balances with Suppliers */}
        <div className="p-4 rounded-[5px] bg-galla-paper border border-galla-line flex flex-col justify-between">
          <div className="flex items-center justify-between text-galla-ink-soft mb-2">
            <span className="font-sans text-[11px] uppercase tracking-wider font-semibold">
              Dealer Return Credits
            </span>
            <Receipt className="w-4 h-4 text-galla-sage" />
          </div>
          <div>
            <div className="font-heading font-semibold text-[22px] text-galla-sage tabular-nums">
              {formatRupee(procurement.totalSupplierCredits)}
            </div>
            <div className="font-sans text-[11px] text-galla-ink-soft mt-1">
              Credit notes from damaged &amp; returned stock
            </div>
          </div>
        </div>

        {/* Net Dealer Position */}
        <div className="p-4 rounded-[5px] bg-galla-paper border border-galla-line flex flex-col justify-between">
          <div className="flex items-center justify-between text-galla-ink-soft mb-2">
            <span className="font-sans text-[11px] uppercase tracking-wider font-semibold">
              Net Dealer Position
            </span>
            <Scale className="w-4 h-4 text-galla-teal" />
          </div>
          <div>
            <div
              className={`font-heading font-semibold text-[22px] tabular-nums ${
                procurement.netDealerBalance > 0
                  ? "text-galla-brick"
                  : procurement.netDealerBalance < 0
                  ? "text-galla-sage"
                  : "text-galla-ink"
              }`}
            >
              {procurement.netDealerBalance > 0
                ? `Payable ${formatRupee(procurement.netDealerBalance)}`
                : procurement.netDealerBalance < 0
                ? `In Credit ${formatRupee(Math.abs(procurement.netDealerBalance))}`
                : "Balanced"}
            </div>
            <div className="font-sans text-[11px] text-galla-ink-soft mt-1">
              Total payables minus return credits
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
