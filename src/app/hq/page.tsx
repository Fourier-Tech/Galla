import React from "react";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import Tenant from "@/lib/db/models/tenant.model";
import { Store, Activity, AlertTriangle, TrendingUp, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getHqSession } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

async function getStats() {
  await connectToDatabase();
  const now = new Date();
  const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const [total, active, trial, suspended, nearExpiry] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: "active" }),
    Tenant.countDocuments({ status: "trial" }),
    Tenant.countDocuments({ status: "suspended" }),
    Tenant.countDocuments({
      planType: { $ne: "lifetime" },
      planExpiresAt: { $gte: now, $lte: tenDaysFromNow },
      status: { $ne: "suspended" },
    }),
  ]);
  return { total, active, trial, suspended, nearExpiry };
}

export default async function HqDashboardPage() {
  const session = await getHqSession();
  if (!session) {
    redirect("/hq/login?evicted=1");
  }

  const stats = await getStats();

  const cards = [
    { label: "Total Salons", value: stats.total, icon: Store, color: "text-galla-ink-soft", bg: "bg-galla-paper" },
    { label: "Active", value: stats.active, icon: Activity, color: "text-galla-sage", bg: "bg-galla-sage-soft" },
    { label: "On Trial", value: stats.trial, icon: TrendingUp, color: "text-galla-brass", bg: "bg-galla-brass-soft" },
    { label: "Near Expiry (≤10d)", value: stats.nearExpiry, icon: Clock, color: "text-amber-700", bg: "bg-amber-100", href: "/hq/salons?filter=near_expiry" },
    { label: "Suspended", value: stats.suspended, icon: AlertTriangle, color: "text-galla-brick", bg: "bg-galla-brick-soft" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-galla-ink">Platform Overview</h1>
        <p className="text-[13px] text-galla-ink-soft mt-0.5">
          All active Galla salon tenants at a glance.
        </p>
      </div>

      {/* Near Expiry Alert Banner */}
      {stats.nearExpiry > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-[10px] p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-amber-950">
                {stats.nearExpiry} Salon Plan{stats.nearExpiry !== 1 ? "s" : ""} Near Expiry
              </h3>
              <p className="text-[12.5px] text-amber-800 mt-0.5">
                Automated email reminders are scheduled 10d, 3d, and 1d before expiration. Expired plans are auto-suspended at 12:00 AM midnight.
              </p>
            </div>
          </div>
          <Link
            href="/hq/salons?filter=near_expiry"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-[12px] font-bold rounded-[6px] transition-colors shrink-0 shadow-xs cursor-pointer ml-3"
          >
            <span>View Salons</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, bg, href }) => {
          const content = (
            <div
              className={`bg-white border rounded-[10px] p-5 flex flex-col gap-3 transition-colors ${
                href ? "hover:border-amber-400 cursor-pointer border-galla-line" : "border-galla-line"
              }`}
            >
              <div className={`h-9 w-9 rounded-[8px] flex items-center justify-center ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-[12px] text-galla-ink-soft font-medium">{label}</p>
                <p className="text-[28px] font-bold text-galla-ink leading-tight">{value}</p>
              </div>
            </div>
          );

          return href ? (
            <Link key={label} href={href}>
              {content}
            </Link>
          ) : (
            <div key={label}>{content}</div>
          );
        })}
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
