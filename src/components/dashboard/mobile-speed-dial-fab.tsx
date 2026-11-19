"use client";

import React, { useState } from "react";
import { Plus, X, Receipt, Wallet, PackagePlus } from "lucide-react";

interface MobileSpeedDialFabProps {
  onOpenNewOrder: () => void;
  onOpenNewExpense: () => void;
  onOpenStockIn?: () => void;
}

export function MobileSpeedDialFab({
  onOpenNewOrder,
  onOpenNewExpense,
  onOpenStockIn,
}: MobileSpeedDialFabProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <>
      {/* Backdrop when speed dial is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-35 bg-black/35 backdrop-blur-[1px] md:hidden transition-opacity duration-150"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Speed Dial Container */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 md:hidden z-40 flex flex-col items-end gap-2.5 select-none">
        {/* Expanded Speed-Dial Action Bubbles */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2 mb-1 animate-in slide-in-from-bottom-2 fade-in duration-150">
            {/* 1. Stock In (PO) */}
            {onOpenStockIn && (
              <button
                type="button"
                onClick={() => handleAction(onOpenStockIn)}
                className="flex items-center gap-2.5 py-1.5 px-3 rounded-full bg-galla-surface border border-galla-line shadow-md text-galla-ink active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-[12.5px] font-semibold tracking-tight">
                  Stock In (PO)
                </span>
                <div className="h-8 w-8 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-galla-teal shrink-0">
                  <PackagePlus className="h-4 w-4" />
                </div>
              </button>
            )}

            {/* 2. Add Expense */}
            <button
              type="button"
              onClick={() => handleAction(onOpenNewExpense)}
              className="flex items-center gap-2.5 py-1.5 px-3 rounded-full bg-galla-surface border border-galla-line shadow-md text-galla-ink active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-[12.5px] font-semibold tracking-tight">
                Add Expense
              </span>
              <div className="h-8 w-8 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-galla-brass shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
            </button>

            {/* 3. New Order (Primary Highlight) */}
            <button
              type="button"
              onClick={() => handleAction(onOpenNewOrder)}
              className="flex items-center gap-2.5 py-1.5 px-3 rounded-full bg-galla-teal text-white shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-[12.5px] font-bold tracking-tight">
                New Order
              </span>
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <Receipt className="h-4 w-4" />
              </div>
            </button>
          </div>
        )}

        {/* Primary FAB Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close actions menu" : "Open quick actions"}
          aria-expanded={isOpen}
          className={`h-13 w-13 rounded-full flex items-center justify-center shadow-[0_6px_20px_rgba(184,58,93,0.35)] transition-all cursor-pointer active:scale-90 ${
            isOpen
              ? "bg-galla-ink text-white rotate-90"
              : "bg-galla-teal hover:opacity-95 text-white"
          }`}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-6 w-6 stroke-[2.4px]" />
          )}
        </button>
      </div>
    </>
  );
}
