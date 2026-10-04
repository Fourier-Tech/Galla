"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { hqLogoutAction, checkHqSessionAction } from "./actions";

const NAV = [
  { label: "Dashboard", href: "/hq", icon: LayoutDashboard, exact: true },
  { label: "Salons", href: "/hq/salons", icon: Store, exact: false },
  { label: "Settings", href: "/hq/settings", icon: Settings, exact: false },
];

export default function HqLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Monitor single-device active session concurrency
  React.useEffect(() => {
    if (pathname === "/hq/login") return;

    let isMounted = true;

    const checkSession = async () => {
      try {
        const res = await checkHqSessionAction();
        if (isMounted && !res.valid) {
          window.location.href = "/hq/login?evicted=1";
        }
      } catch {
        // Do not evict on transient network issues
      }
    };

    const interval = setInterval(checkSession, 15000);
    window.addEventListener("focus", checkSession);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", checkSession);
    };
  }, [pathname]);

  // Login page gets a bare layout — no sidebar
  if (pathname === "/hq/login") {
    return <>{children}</>;
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-galla-paper flex font-sans">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-white border-r border-galla-line flex flex-col fixed inset-y-0 z-30">
        {/* Brand */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-galla-line">
          <div className="h-7 w-7 rounded-[6px] bg-white border border-galla-line flex items-center justify-center shrink-0 overflow-hidden p-0.5">
            <Image
              src="/logo.png"
              alt="Galla"
              width={28}
              height={28}
              className="object-contain w-full h-full"
            />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-galla-ink tracking-tight">Galla HQ</p>
            <p className="text-[10px] text-galla-ink-soft">Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, href, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[13px] font-medium transition-colors group",
                  active
                    ? "bg-galla-teal/10 text-galla-teal"
                    : "text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-galla-line">
          <button
            onClick={() => hqLogoutAction()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[13px] font-medium text-galla-ink-soft hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 ml-56 min-h-screen">{children}</main>
    </div>
  );
}
