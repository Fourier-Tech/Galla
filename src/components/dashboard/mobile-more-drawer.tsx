"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import {
  Users,
  Wallet,
  Sparkles,
  Truck,
  BarChart3,
  Store,
  Lock,
  KeyRound,
  LogOut,
  X,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { TabId, UserRole } from "@/types/dashboard";

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  role: UserRole;
  salonName?: string;
  profileImageUrl?: string | null;
  onLockCounter?: () => void;
  onOpenChangePins?: () => void;
  onSignOut: () => void;
}

interface MoreItem {
  id: TabId;
  label: string;
  subtext: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

const SECONDARY_ITEMS: MoreItem[] = [
  {
    id: "customers",
    label: "Customers",
    subtext: "Client profiles, visits & dues",
    icon: Users,
    ownerOnly: false,
  },
  {
    id: "expenses",
    label: "Expenses",
    subtext: "Petty cash, rent & salon supplies",
    icon: Wallet,
    ownerOnly: false,
  },
  {
    id: "services",
    label: "Services & Packages",
    subtext: "Menu rates & bundled packages",
    icon: Sparkles,
    ownerOnly: false,
  },
  {
    id: "suppliers",
    label: "Suppliers & Bills",
    subtext: "Vendor ledgers & purchase orders",
    icon: Truck,
    ownerOnly: false,
  },
  {
    id: "analytics",
    label: "Analytics",
    subtext: "Cashflow, peak hours & retention",
    icon: BarChart3,
    ownerOnly: true,
  },
  {
    id: "profile",
    label: "Salon Profile",
    subtext: "Shop identity, address & settings",
    icon: Store,
    ownerOnly: true,
  },
];

export function MobileMoreDrawer({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  role,
  salonName = "Salon",
  profileImageUrl,
  onLockCounter,
  onOpenChangePins,
  onSignOut,
}: MobileMoreDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const visibleItems = SECONDARY_ITEMS.filter(
    (item) => !item.ownerOnly || role === "owner" || role === "admin"
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Up Bottom Sheet */}
      <div
        role="dialog"
        aria-label="More Navigation Menu"
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[88vh] bg-galla-surface rounded-t-[18px] border-t border-galla-line shadow-2xl flex flex-col transition-transform duration-250 ease-out md:hidden ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle Bar */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-galla-line" />
        </div>

        {/* Header: Shop Card + Close */}
        <div className="px-5 py-3 border-b border-galla-line/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {profileImageUrl ? (
              <div className="h-10 w-10 rounded-[8px] overflow-hidden bg-galla-paper border border-galla-line shrink-0 flex items-center justify-center shadow-2xs">
                <Image
                  src={profileImageUrl}
                  alt={salonName}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-[8px] bg-galla-paper border border-galla-line shrink-0 flex items-center justify-center text-galla-ink-soft">
                <Store className="h-5 w-5 text-galla-teal" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-galla-ink tracking-tight truncate">
                {salonName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-galla-ink-soft">Role:</span>
                <span
                  className={`text-[10.5px] font-semibold px-1.5 py-0.2 rounded-[3px] ${
                    role === "admin"
                      ? "bg-purple-100 text-purple-800"
                      : role === "owner"
                      ? "bg-galla-teal-soft text-galla-teal"
                      : "bg-galla-brass-soft text-galla-brass"
                  }`}
                >
                  {role === "admin" ? "Admin (HQ)" : role === "owner" ? "Owner" : "Staff"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 -mr-1.5 text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper rounded-[6px] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Nav Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-galla-line/50">
          <div className="grid grid-cols-1 gap-1 pb-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-[8px] text-left transition-colors cursor-pointer active:scale-[0.99] ${
                    isActive
                      ? "bg-galla-teal-soft/90 text-galla-teal border border-galla-teal/30"
                      : "hover:bg-galla-paper/70 text-galla-ink"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-galla-teal text-white"
                          : "bg-galla-paper border border-galla-line text-galla-ink-soft"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold tracking-tight truncate">
                        {item.label}
                      </div>
                      <div className="text-[11.5px] text-galla-ink-soft truncate">
                        {item.subtext}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isActive ? "text-galla-teal translate-x-0.5" : "text-galla-ink-soft/40"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Quick Counter Management Buttons */}
          <div className="pt-3 pb-2 space-y-1.5">
            {onLockCounter && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockCounter();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
              >
                <Lock className="h-4 w-4 text-galla-ink-soft" />
                <span>Lock Counter (PIN Protect)</span>
              </button>
            )}

            {(role === "owner" || role === "admin") && onOpenChangePins && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangePins();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[13px] font-medium text-galla-ink hover:bg-galla-paper transition-colors cursor-pointer"
              >
                <KeyRound className="h-4 w-4 text-galla-ink-soft" />
                <span>Manage Password &amp; Role PINs</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[13px] font-medium text-red-600 hover:bg-red-50/70 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-500" />
              <span>Sign Out of Salon Account</span>
            </button>
          </div>
        </div>

        {/* Safe Area Spacer */}
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </div>
    </>
  );
}
