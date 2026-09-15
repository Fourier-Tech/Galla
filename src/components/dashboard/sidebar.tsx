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
  Store,
  Sparkles,
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
  { id: "services", label: "Services & Packages", icon: Sparkles, ownerOnly: true },
  { id: "inventory", label: "Inventory", icon: Package, ownerOnly: false },
  { id: "customers", label: "Customers", icon: Users, ownerOnly: false },
  { id: "expenses", label: "Expenses", icon: Wallet, ownerOnly: false },
  { id: "analytics", label: "Analytics", icon: BarChart3, ownerOnly: true },
  { id: "profile", label: "Salon Profile", icon: Store, ownerOnly: true },
];

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  role: UserRole;
  onRoleChange?: (role: UserRole) => void;
  salonName?: string;
  profileImageUrl?: string;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  role,
  salonName = "Salon",
  profileImageUrl,
}: SidebarProps) {
  // Gated navigation: Staff cannot see Analytics tab
  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <aside className="w-[233px] shrink-0 h-screen sticky top-0 bg-galla-surface border-r border-galla-sidebar-border flex flex-col justify-between py-6">
      <div>
        {/* Brand Header */}
        <div className="px-5 mb-6">
          {/* Galla Platform Logo */}
          <div className="relative h-8 w-24 mb-3.5">
            <Image
              src="/logo.png"
              alt="Galla"
              fill
              className="object-contain object-left"
              priority
              sizes="96px"
            />
          </div>

          {/* Shop Identity: Salon Image + Shop Name (No outlines, enlarged image) */}
          <div className="flex items-center gap-3 py-1 border border-galla-line rounded-[5px] px-3 mt-8">
            {profileImageUrl ? (
              <div className="h-11 w-11 rounded-[8px] overflow-hidden shrink-0 bg-galla-paper shadow-xs flex items-center justify-center">
                <Image
                  src={profileImageUrl}
                  alt={salonName}
                  width={5} 
                  height={5}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-[8px] shrink-0 bg-galla-paper flex items-center justify-center text-galla-ink-soft">
                <Store className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-heading text-[20px] font-semibold text-galla-ink tracking-tight truncate">
                {salonName}
              </div>
            </div>
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
                className={`flex items-center gap-2.5 px-[13px] py-[8px] rounded-[5px] text-[13.5px] font-sans font-medium text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-galla-teal-soft text-galla-teal font-semibold border-l-[3px] border-galla-teal"
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

      {/* Footer Area: Account Role & Sign Out */}
      <div className="px-4 space-y-3">
        <div className="bg-galla-paper/80 border border-galla-line rounded-[5px] px-3 py-2 flex items-center justify-between shadow-2xs">
          <span className="font-heading text-[11px] font-medium text-galla-ink-soft uppercase tracking-wider">
            Logged In As
          </span>
          <span
            className={`text-[11px] font-sans font-semibold px-2 py-0.5 rounded-[3px] uppercase tracking-wide ${
              role === "owner"
                ? "bg-galla-teal-soft text-galla-teal border border-galla-teal/20"
                : "bg-galla-brass-soft text-galla-brass border border-galla-brass/20"
            }`}
          >
            {role === "owner" ? "Owner" : "Staff"}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-[13px] py-[8px] rounded-[5px] text-[13px] font-sans font-medium text-galla-ink-soft hover:text-red-700 hover:bg-red-50/60 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
