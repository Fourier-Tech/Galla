"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Truck,
  Lock,
  KeyRound,
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
  { id: "services", label: "Services & Packages", icon: Sparkles, ownerOnly: false },
  { id: "inventory", label: "Inventory", icon: Package, ownerOnly: false },
  { id: "suppliers", label: "Suppliers & Bills", icon: Truck, ownerOnly: false },
  { id: "customers", label: "Customers", icon: Users, ownerOnly: false },
  { id: "expenses", label: "Expenses", icon: Wallet, ownerOnly: false },
  { id: "analytics", label: "Analytics", icon: BarChart3, ownerOnly: true },
  { id: "profile", label: "Salon Profile", icon: Store, ownerOnly: true },
];

interface SidebarProps {
  activeTab?: TabId;
  onSelectTab?: (tab: TabId) => void;
  role: UserRole;
  onRoleChange?: (role: UserRole) => void;
  salonName?: string;
  profileImageUrl?: string;
  onLockCounter?: () => void;
  onOpenChangePins?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  role,
  salonName = "Salon",
  profileImageUrl,
  onLockCounter,
  onOpenChangePins,
}: SidebarProps) {
  const pathname = usePathname();

  // Gated navigation: Staff cannot see Analytics tab or Profile tab
  const visibleNav = NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner");

  const getHref = (id: TabId) => {
    if (id === "overview") return "/dashboard";
    return `/dashboard/${id}`;
  };

  const getIsActive = (id: TabId) => {
    if (activeTab) {
      return activeTab === id;
    }
    if (id === "overview") {
      return pathname === "/dashboard" || pathname === "/dashboard/overview";
    }
    return pathname.startsWith(`/dashboard/${id}`);
  };

  return (
    <aside className="w-[233px] shrink-0 h-screen sticky top-0 bg-galla-surface border-r border-galla-sidebar-border flex flex-col justify-between py-6">
      <div>
        {/* Brand Header */}
        <div className="px-5 mb-6">
          {/* Galla Platform Logo */}
          <div className="relative h-8 w-full mb-3.5 flex justify-center">
            <div className="relative h-8 w-24">
              <Image
                src="/logo.png"
                alt="Galla"
                fill
                className="object-contain"
                priority
                sizes="96px"
              />
            </div>
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
              <div className="text-[17px] font-semibold text-galla-ink tracking-tight truncate">
                {salonName}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 px-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = getIsActive(item.id);
            const href = getHref(item.id);

            return (
              <a
                key={item.id}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (onSelectTab) onSelectTab(item.id);
                }}
                className={`flex items-center gap-2.5 px-[13px] py-[8px] rounded-[5px] text-[14px] text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-galla-teal-soft text-galla-teal font-semibold border-l-[3px] border-galla-teal"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60 font-normal border-l-[3px] border-transparent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer Area: Account Role, Screen Lock & Sign Out */}
      <div className="px-3.5 space-y-2">
        <div className="bg-galla-paper/80 border border-galla-line rounded-[5px] px-3 py-1.5 flex items-center justify-between shadow-2xs">
          <span className="text-[12px] font-normal text-galla-ink-soft">
            Counter Role
          </span>
          <span
            className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-[3px] ${
              role === "owner"
                ? "bg-galla-teal-soft text-galla-teal border border-galla-teal/20"
                : "bg-galla-brass-soft text-galla-brass border border-galla-brass/20"
            }`}
          >
            {role === "owner" ? "Owner" : "Staff"}
          </span>
        </div>

        {/* Lock Counter */}
        {onLockCounter && (
          <button
            type="button"
            onClick={onLockCounter}
            className="w-full flex items-center gap-2 px-[11px] py-[6px] rounded-[5px] text-[12.5px] font-sans font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60 transition-colors cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Lock Counter</span>
          </button>
        )}

        {/* Manage PINs (Owner Only) */}
        {role === "owner" && onOpenChangePins && (
          <button
            type="button"
            onClick={onOpenChangePins}
            className="w-full flex items-center gap-2 px-[11px] py-[6px] rounded-[5px] text-[12.5px] font-sans font-medium text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper/60 transition-colors cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Manage Role PINs</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-[11px] py-[6px] rounded-[5px] text-[12.5px] font-sans font-medium text-galla-ink-soft hover:text-red-700 hover:bg-red-50/60 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
