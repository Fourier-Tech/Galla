import React from "react";
import { connectToDatabase } from "@/lib/db/mongodb";
import Tenant from "@/lib/db/models/tenant.model";
import { Store, Activity, AlertTriangle, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats() {
  await connectToDatabase();
  const [total, active, trial, suspended] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: "active" }),
    Tenant.countDocuments({ status: "trial" }),
    Tenant.countDocuments({ status: "suspended" }),
  ]);
  return { total, active, trial, suspended };
}

export default async function HqDashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Total Salons", value: stats.total, icon: Store, color: "text-galla-ink-soft", bg: "bg-galla-paper" },
    { label: "Active", value: stats.active, icon: Activity, color: "text-galla-sage", bg: "bg-galla-sage-soft" },
    { label: "On Trial", value: stats.trial, icon: TrendingUp, color: "text-galla-brass", bg: "bg-galla-brass-soft" },
    { label: "Suspended", value: stats.suspended, icon: AlertTriangle, color: "text-galla-brick", bg: "bg-galla-brick-soft" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-galla-ink">Platform Overview</h1>
        <p className="text-[13px] text-galla-ink-soft mt-0.5">
          All active Galla salon tenants at a glance.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white border border-galla-line rounded-[10px] p-5 flex flex-col gap-3"
          >
            <div className={`h-9 w-9 rounded-[8px] flex items-center justify-center ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-[12px] text-galla-ink-soft font-medium">{label}</p>
              <p className="text-[28px] font-bold text-galla-ink leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick note */}
      <div className="bg-white border border-galla-line rounded-[10px] p-5">
        <p className="text-[13px] text-galla-ink-soft leading-relaxed">
          Go to <span className="font-semibold text-galla-ink">Salons</span> to provision new
          tenants, manage subscriptions, or suspend accounts. Use{" "}
          <span className="font-semibold text-galla-ink">Settings</span> to update your admin
          credentials.
        </p>
      </div>
    </div>
  );
}
