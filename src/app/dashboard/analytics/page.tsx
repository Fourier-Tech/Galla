"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/context/dashboard-context";
import { AnalyticsTab } from "@/components/dashboard/tabs/analytics-tab";

export default function AnalyticsPage() {
  const router = useRouter();
  const { role, isRoleLocked, orders, expenses, pendingAmount } = useDashboard();

  useEffect(() => {
    if (!isRoleLocked && role === "staff") {
      router.replace("/dashboard/orders");
    }
  }, [role, isRoleLocked, router]);

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64 text-galla-ink-soft">
        <p className="text-sm font-medium">Restricted access. Owner role required.</p>
      </div>
    );
  }

  return (
    <AnalyticsTab
      orders={orders}
      expenses={expenses}
      pendingAmount={pendingAmount}
    />
  );
}
