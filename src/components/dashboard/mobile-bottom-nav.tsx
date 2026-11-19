"use client";

import React from "react";
import { Home, Receipt, Package, Grid2X2 } from "lucide-react";
import { TabId } from "@/types/dashboard";

interface MobileBottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenMore: () => void;
  urgentOrdersCount?: number;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenMore,
  urgentOrdersCount = 0,
}: MobileBottomNavProps) {
  // Tabs that are treated as "More" secondary tabs
  const isMoreActive =
    activeTab !== "overview" &&
    activeTab !== "orders" &&
    activeTab !== "inventory";

  const navItems = [
    {
      id: "overview" as TabId,
      label: "Overview",
      icon: Home,
      isActive: activeTab === "overview",
      badge: 0,
      onClick: () => onSelectTab("overview"),
    },
    {
      id: "orders" as TabId,
      label: "Orders",
      icon: Receipt,
      isActive: activeTab === "orders",
      badge: urgentOrdersCount,
      onClick: () => onSelectTab("orders"),
    },
    {
      id: "inventory" as TabId,
      label: "Inventory",
      icon: Package,
      isActive: activeTab === "inventory",
      badge: 0,
      onClick: () => onSelectTab("inventory"),
    },
    {
      id: "more" as const,
      label: "More",
      icon: Grid2X2,
      isActive: isMoreActive,
      badge: 0,
      onClick: onOpenMore,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-galla-surface/95 backdrop-blur-md border-t border-galla-line shadow-[0_-4px_16px_rgba(30,18,23,0.04)] px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
    >
      <div className="grid grid-cols-4 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center py-1 rounded-[6px] transition-all cursor-pointer group active:scale-95 ${
                item.isActive
                  ? "text-galla-teal font-semibold"
                  : "text-galla-ink-soft hover:text-galla-ink font-medium"
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-[6px] transition-colors ${
                    item.isActive ? "bg-galla-teal-soft" : "group-hover:bg-galla-paper"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform ${
                      item.isActive ? "stroke-[2.2px] scale-105" : "stroke-[1.8px]"
                    }`}
                  />
                </div>

                {/* Urgent indicator badge */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none shadow-xs tabular-nums">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] tracking-tight mt-0.5 ${
                  item.isActive ? "font-semibold text-galla-teal" : "text-galla-ink-soft"
                }`}
              >
                {item.label}
              </span>

              {/* Active bottom indicator line */}
              {item.isActive && (
                <span className="absolute -bottom-1.5 w-6 h-[2.5px] rounded-full bg-galla-teal" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
