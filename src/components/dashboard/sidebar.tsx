"use client";

import React from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import {
  Home,
  Receipt,
  Package,
  Users,
  Wallet,
  BarChart3,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { TabId, UserRole } from "@/types/dashboard";

interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: Home, ownerOnly: false },
  { id: "orders", label: "Orders", icon: Receipt, ownerOnly: false },
  { id: "inventory", label: "Inventory", icon: Package, ownerOnly: false },
  { id: "customers", label: "Customers", icon: Users, ownerOnly: false },
  { id: "expenses", label: "Expenses", icon: Wallet, ownerOnly: false },
  { id: "analytics", label: "Analytics", icon: BarChart3, ownerOnly: true },
];

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  salonName?: string;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  role,
  onRoleChange,
  salonName = "Kiran Beauty Parlour",
}: SidebarProps) {
  // Gated navigation: Staff cannot see Analytics tab
  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <aside className="w-[233px] shrink-0 min-h-screen bg-galla-surface border-r border-galla-sidebar-border flex flex-col justify-between py-6">
      <div>
        {/* Brand Header */}
        <div className="px-6 mb-[34px]">
          <div className="relative h-9 w-28">
            <Image
              src="/logo.png"
              alt="Galla"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
          <div className="font-heading text-[11px] font-medium tracking-[0.03em] uppercase text-galla-ink-soft mt-1.5 truncate">
            {salonName}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 px-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2.5 px-[13px] py-[8px] rounded-[5px] text-[13.5px] font-sans text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-galla-teal-soft text-galla-teal font-medium border-l-[3px] border-galla-teal"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60 border-l-[3px] border-transparent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area: Role Switcher & Account */}
      <div className="px-4 space-y-4">
        <div>
          <div className="font-heading text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider px-1 mb-2">
            Counter Role
          </div>
          <div className="grid grid-cols-2 p-0.5 bg-galla-paper border border-galla-line rounded-[5px]">
            <button
              onClick={() => onRoleChange("owner")}
              className={`text-[12px] font-sans font-medium py-1.5 rounded-[4px] transition-all cursor-pointer ${
                role === "owner"
                  ? "bg-galla-teal text-white shadow-xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              Owner
            </button>
            <button
              onClick={() => {
                onRoleChange("staff");
                if (activeTab === "analytics") {
                  onSelectTab("overview");
                }
              }}
              className={`text-[12px] font-sans font-medium py-1.5 rounded-[4px] transition-all cursor-pointer ${
                role === "staff"
                  ? "bg-galla-teal text-white shadow-xs"
                  : "text-galla-ink-soft hover:text-galla-ink"
              }`}
            >
              Staff
            </button>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-[13px] py-[8px] rounded-[5px] text-[13px] font-sans text-galla-ink-soft hover:text-red-700 hover:bg-red-50/60 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
