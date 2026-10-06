"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  Edit,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Building,
  ExternalLink,
  AlertTriangle,
  Send,
} from "lucide-react";
import {
  getSalonsAction,
  toggleTenantStatusAction,
  createSalonImpersonationUrlAction,
  runPlanExpiryCheckAction,
} from "@/app/hq/actions";
import { ProvisionSalonModal } from "@/components/hq/modals/provision-salon-modal";
import { ManagePlanModal } from "@/components/hq/modals/manage-plan-modal";

type Salon = {
  _id: string;
  name: string;
  slug: string;
  tenantCode?: string;
  phone?: string;
  address?: string;
  ownerEmail?: string;
  status: "active" | "trial" | "suspended";
  suspendedReason?: string | null;
  planType: "trial" | "active" | "lifetime";
  planExpiresAt?: string | null;
  currency?: string;
  createdAt: string;
};

function StatusBadge({
  status,
  suspendedReason,
}: {
  status: Salon["status"];
  suspendedReason?: string | null;
}) {
  const map = {
    active: { label: "Active", icon: CheckCircle, cls: "bg-galla-sage-soft text-galla-sage" },
    trial: { label: "Trial", icon: Clock, cls: "bg-galla-brass-soft text-galla-brass" },
    suspended: {
      label: suspendedReason === "plan_expired" ? "Suspended (Expired)" : "Suspended",
      icon: XCircle,
      cls: "bg-galla-brick-soft text-galla-brick",
    },
  };
  const badge = map[status] || map.active;
  const Icon = badge.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badge.cls}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {badge.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: Salon["planType"] }) {
  const map = {
    trial: "bg-galla-paper text-galla-ink-soft border border-galla-line",
    active: "bg-galla-teal/10 text-galla-teal font-semibold",
    lifetime: "bg-galla-ink text-white font-semibold",
  };
  const label = plan === "active" ? "Yearly" : plan === "trial" ? "Trial" : "Lifetime";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] capitalize ${map[plan] || map.trial}`}>
      {label}
    </span>
  );
}

function HqSalonsContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as any) || "all";

  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [manageSalon, setManageSalon] = useState<Salon | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "near_expiry" | "active" | "trial" | "suspended">(
    initialFilter === "near_expiry" ? "near_expiry" : "all"
  );
  const [checkingExpirations, setCheckingExpirations] = useState(false);
  const [checkResultToast, setCheckResultToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalonsAction();
      if (!res.success && res.error?.includes("Unauthorized")) {
        window.location.href = "/hq/login?evicted=1";
        return;
      }
      if (res.success && res.salons) {
        setSalons(res.salons as Salon[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleImpersonate = async (salon: Salon) => {
    setImpersonatingId(salon._id);
    try {
      const res = await createSalonImpersonationUrlAction(salon._id);
      if (res.success && res.url) {
        window.open(res.url, "_blank");
      } else {
        alert(res.error || "Failed to launch salon impersonation session.");
      }
    } catch {
      alert("Network error launching salon session.");
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleToggleStatus = async (salon: Salon) => {
    setActionLoading(salon._id);
    setOpenMenu(null);
    try {
      const res = await toggleTenantStatusAction(salon._id, salon.status !== "suspended");
      if (!res.success && res.error?.includes("Unauthorized")) {
        window.location.href = "/hq/login?evicted=1";
        return;
      }
      await refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunExpiryCheck = async () => {
    setCheckingExpirations(true);
    setCheckResultToast(null);
    try {
      const res = await runPlanExpiryCheckAction();
      if (res.success && res.result) {
        setCheckResultToast(
          `Expiry check completed: ${res.result.emailsSent} email(s) sent, ${res.result.autoSuspended} auto-suspended.`
        );
        await refresh();
      } else {
        alert(res.error || "Failed to run expiry check.");
      }
    } catch {
      alert("Network error executing expiry check.");
    } finally {
      setCheckingExpirations(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getExpiryInfo = useCallback((salon: Salon) => {
    if (salon.planType === "lifetime") {
      return {
        type: "lifetime",
        label: "Lifetime Access",
        isNearExpiry: false,
        isGracePeriod: false,
        isExpired: false,
        badgeCls: "bg-galla-paper text-galla-ink-soft",
      };
    }

    if (!salon.planExpiresAt) {
      return {
        type: "none",
        label: "No Expiry",
        isNearExpiry: false,
        isGracePeriod: false,
        isExpired: false,
        badgeCls: "bg-galla-paper text-galla-ink-soft",
      };
    }

    const msUntilExpiry = new Date(salon.planExpiresAt).getTime() - Date.now();
    const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);
    const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
    // Expired (passed 12:00 AM midnight)
    if (msUntilExpiry <= 0) {
      const isSuspended = salon.status === "suspended";
      return {
        type: "expired",
        label: isSuspended ? (salon.suspendedReason === "plan_expired" ? "Suspended (Plan Expired)" : "Suspended") : "Expired",
        isNearExpiry: false,
        isGracePeriod: false,
        isExpired: true,
        badgeCls: "bg-galla-brick-soft text-galla-brick font-bold",
      };
    }

    // Today (<= 24 hours)
    if (daysUntilExpiry <= 1) {
      return {
        type: "today",
        label: `⚠️ Expires Today (${Math.max(1, Math.round(hoursUntilExpiry))}h)`,
        isNearExpiry: true,
        isGracePeriod: false,
        isExpired: false,
        badgeCls: "bg-red-100 text-red-800 border border-red-300 font-bold",
      };
    }

    // <= 3 days
    if (daysUntilExpiry <= 3) {
      return {
        type: "3_days",
        label: `Expires in ${daysUntilExpiry} days`,
        isNearExpiry: true,
        isGracePeriod: false,
        isExpired: false,
        badgeCls: "bg-orange-100 text-orange-800 border border-orange-300 font-semibold",
      };
    }

    // <= 10 days
    if (daysUntilExpiry <= 10) {
      return {
        type: "10_days",
        label: `Expires in ${daysUntilExpiry} days`,
        isNearExpiry: true,
        isGracePeriod: false,
        isExpired: false,
        badgeCls: "bg-amber-100 text-amber-800 border border-amber-300 font-medium",
      };
    }

    return {
      type: "normal",
      label: `${daysUntilExpiry} days left`,
      isNearExpiry: false,
      isGracePeriod: false,
      isExpired: false,
      badgeCls: "bg-galla-paper text-galla-ink-soft",
    };
  }, []);

  const nearExpirySalons = useMemo(() => salons.filter((s) => getExpiryInfo(s).isNearExpiry), [salons, getExpiryInfo]);
  const activeSalons = useMemo(() => salons.filter((s) => s.status === "active"), [salons]);
  const trialSalons = useMemo(() => salons.filter((s) => s.status === "trial"), [salons]);
  const suspendedSalons = useMemo(() => salons.filter((s) => s.status === "suspended"), [salons]);

  const visibleSalons = useMemo(() => {
    switch (filterStatus) {
      case "near_expiry":
        return nearExpirySalons;
      case "active":
        return activeSalons;
      case "trial":
        return trialSalons;
      case "suspended":
        return suspendedSalons;
      default:
        return salons;
    }
  }, [filterStatus, salons, nearExpirySalons, activeSalons, trialSalons, suspendedSalons]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-galla-ink">Manage Salons</h1>
          <p className="text-[13px] text-galla-ink-soft mt-0.5">
            {salons.length} salon{salons.length !== 1 ? "s" : ""} registered on Galla
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunExpiryCheck}
            disabled={checkingExpirations}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-[6px] text-[12px] font-semibold text-amber-900 transition-colors cursor-pointer disabled:opacity-40 shadow-2xs"
            title="Check all salon expirations, dispatch automated emails (10d, 3d, 1d), and auto-suspend expired plans"
          >
            <Send className={`h-3.5 w-3.5 ${checkingExpirations ? "animate-spin" : ""}`} />
            <span>{checkingExpirations ? "Running Check…" : "Run Expiry Automation"}</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-galla-line rounded-[6px] text-[12px] font-medium text-galla-ink-soft hover:bg-galla-paper transition-colors cursor-pointer disabled:opacity-40 bg-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setProvisionOpen(true)}
            className="flex items-center gap-1.5 bg-galla-teal hover:bg-galla-teal/90 text-white px-4 py-2 rounded-[6px] text-[13px] font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Provision Salon
          </button>
        </div>
      </div>

      {/* Expiry Automation Toast Notice */}
      {checkResultToast && (
        <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-[8px] text-[13px] flex items-center justify-between shadow-2xs animate-fadeIn">
          <span>{checkResultToast}</span>
          <button
            onClick={() => setCheckResultToast(null)}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Near Expiry Alert Banner */}
      {nearExpirySalons.length > 0 && filterStatus !== "near_expiry" && (
        <div className="mb-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-[10px] p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-amber-950">
                Action Needed: {nearExpirySalons.length} Salon Plan{nearExpirySalons.length !== 1 ? "s" : ""} Near Expiration
              </h3>
              <p className="text-[12.5px] text-amber-800 mt-0.5">
                Automated email reminders are running for 10-day, 3-day, and 1-day intervals. Expired plans are auto-suspended at 12:00 AM midnight.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterStatus("near_expiry")}
            className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-[12px] font-bold rounded-[6px] transition-colors shrink-0 shadow-xs cursor-pointer ml-3"
          >
            Filter Near Expiry ({nearExpirySalons.length})
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer ${
            filterStatus === "all"
              ? "bg-galla-ink text-white font-semibold shadow-xs"
              : "bg-white text-galla-ink-soft hover:bg-galla-paper border border-galla-line"
          }`}
        >
          All ({salons.length})
        </button>
        <button
          onClick={() => setFilterStatus("near_expiry")}
          className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filterStatus === "near_expiry"
              ? "bg-amber-700 text-white font-bold shadow-xs"
              : nearExpirySalons.length > 0
              ? "bg-amber-50 text-amber-900 border border-amber-300 font-semibold"
              : "bg-white text-galla-ink-soft hover:bg-galla-paper border border-galla-line"
          }`}
        >
          <span>Near Expiry</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
              filterStatus === "near_expiry"
                ? "bg-white/20 text-white"
                : nearExpirySalons.length > 0
                ? "bg-amber-200 text-amber-900"
                : "bg-galla-paper text-galla-ink-soft"
            }`}
          >
            {nearExpirySalons.length}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus("active")}
          className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer ${
            filterStatus === "active"
              ? "bg-galla-ink text-white font-semibold shadow-xs"
              : "bg-white text-galla-ink-soft hover:bg-galla-paper border border-galla-line"
          }`}
        >
          Active ({activeSalons.length})
        </button>
        <button
          onClick={() => setFilterStatus("trial")}
          className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer ${
            filterStatus === "trial"
              ? "bg-galla-ink text-white font-semibold shadow-xs"
              : "bg-white text-galla-ink-soft hover:bg-galla-paper border border-galla-line"
          }`}
        >
          Trial ({trialSalons.length})
        </button>
        <button
          onClick={() => setFilterStatus("suspended")}
          className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer ${
            filterStatus === "suspended"
              ? "bg-galla-ink text-white font-semibold shadow-xs"
              : "bg-white text-galla-ink-soft hover:bg-galla-paper border border-galla-line"
          }`}
        >
          Suspended ({suspendedSalons.length})
        </button>
      </div>

      {/* Salons Table Container */}
      <div className="bg-white border border-galla-line rounded-[10px] min-h-[300px] shadow-sm relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-galla-paper/70 border-b border-galla-line text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wider rounded-t-[10px]">
              <th className="px-5 py-3.5">Salon Profile</th>
              <th className="px-5 py-3.5">Owner / Contact</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Plan</th>
              <th className="px-5 py-3.5">Expiry / Grace</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-galla-line text-[13px] text-galla-ink">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-galla-ink-soft text-[13px]">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-galla-teal" />
                    <span>Loading salons…</span>
                  </div>
                </td>
              </tr>
            ) : visibleSalons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-galla-ink-soft text-[13px]">
                  {filterStatus === "near_expiry"
                    ? "No salons currently near expiry."
                    : filterStatus === "suspended"
                    ? "No suspended salons."
                    : "No salons provisioned yet. Click \"Provision Salon\" above to create your first tenant."}
                </td>
              </tr>
            ) : (
              visibleSalons.map((salon, index) => {
                const expiryInfo = getExpiryInfo(salon);
                const isNearBottom = index >= visibleSalons.length - 2 || visibleSalons.length <= 2;

                return (
                  <tr
                    key={salon._id}
                    className={`transition-colors ${
                      expiryInfo.isGracePeriod
                        ? "bg-red-50/50 hover:bg-red-50/80"
                        : expiryInfo.isNearExpiry
                        ? "bg-amber-50/30 hover:bg-amber-50/60"
                        : "hover:bg-galla-paper/40"
                    }`}
                  >
                    {/* Salon Profile */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-[6px] bg-galla-paper border border-galla-line flex items-center justify-center text-galla-teal shrink-0 mt-0.5">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-galla-ink text-[14px]">{salon.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {salon.tenantCode && (
                              <span className="text-[11px] font-mono bg-galla-paper px-1.5 py-0.2 rounded border border-galla-line text-galla-ink-soft">
                                {salon.tenantCode}
                              </span>
                            )}
                            <span className="text-[11px] text-galla-ink-soft">{salon.slug}</span>
                          </div>
                          {salon.address && (
                            <p className="text-[11px] text-galla-ink-soft/80 mt-0.5 truncate max-w-xs">
                              {salon.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Owner / Contact */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {salon.ownerEmail && (
                          <div className="flex items-center gap-1.5 text-[12px] text-galla-ink">
                            <Mail className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                            <span className="font-mono">{salon.ownerEmail}</span>
                          </div>
                        )}
                        {salon.phone && (
                          <div className="flex items-center gap-1.5 text-[12px] text-galla-ink-soft">
                            <Phone className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
                            <span>{salon.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={salon.status} suspendedReason={salon.suspendedReason} />
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-4">
                      <PlanBadge plan={salon.planType} />
                    </td>

                    {/* Expiry / Grace */}
                    <td className="px-5 py-4">
                      {salon.planType === "lifetime" ? (
                        <span className="text-galla-ink-soft text-[12px] font-medium">Lifetime Access</span>
                      ) : (
                        <div>
                          <p
                            className={`font-medium ${
                              expiryInfo.isExpired
                                ? "text-galla-brick font-semibold"
                                : expiryInfo.isNearExpiry
                                ? "text-amber-800 font-semibold"
                                : "text-galla-ink"
                            }`}
                          >
                            {formatDate(salon.planExpiresAt)}
                          </p>
                          <div className="mt-1">
                            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-[4px] ${expiryInfo.badgeCls}`}>
                              {expiryInfo.label}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 relative">
                        <button
                          onClick={() => handleImpersonate(salon)}
                          disabled={impersonatingId === salon._id}
                          className="px-2.5 py-1.5 text-[12px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-[5px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          title="Open Salon Counter as Admin in a new tab"
                        >
                          {impersonatingId === salon._id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                          <span>Open Salon</span>
                        </button>

                        <button
                          onClick={() => setManageSalon(salon)}
                          className="px-3 py-1.5 text-[12px] font-semibold text-galla-teal border border-galla-teal/30 hover:bg-galla-teal-soft rounded-[5px] transition-colors cursor-pointer"
                        >
                          Manage Plan
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === salon._id ? null : salon._id)}
                            className="p-1.5 text-galla-ink-soft hover:text-galla-ink hover:bg-galla-paper rounded-[5px] transition-colors cursor-pointer border border-transparent hover:border-galla-line"
                            disabled={actionLoading === salon._id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenu === salon._id && (
                            <div
                              className={`absolute right-0 z-50 w-56 bg-white border border-galla-line rounded-[8px] shadow-xl py-1.5 text-[13px] font-medium animate-in fade-in duration-100 ${
                                isNearBottom ? "bottom-9" : "top-9"
                              }`}
                            >
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleImpersonate(salon);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-purple-50 text-purple-700 transition-colors flex items-center gap-2 cursor-pointer border-b border-galla-line/60"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-purple-600" />
                                <span>Login as Shop (Admin Tab)</span>
                              </button>

                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setManageSalon(salon);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-galla-paper transition-colors flex items-center gap-2 text-galla-ink cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5 text-galla-teal" />
                                <span>Edit Salon Profile</span>
                              </button>

                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  setManageSalon(salon);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-galla-paper transition-colors flex items-center gap-2 text-galla-ink cursor-pointer border-b border-galla-line/60"
                              >
                                <CreditCard className="h-3.5 w-3.5 text-galla-brass" />
                                <span>Extend / Change Plan</span>
                              </button>

                              <button
                                onClick={() => handleToggleStatus(salon)}
                                className={`w-full text-left px-4 py-2 hover:bg-galla-paper transition-colors flex items-center gap-2 cursor-pointer ${
                                  salon.status === "suspended"
                                    ? "text-galla-sage hover:bg-galla-sage-soft"
                                    : "text-galla-brick hover:bg-galla-brick-soft"
                                }`}
                              >
                                {salon.status === "suspended" ? (
                                  <>
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span>Reactivate Salon</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    <span>Suspend Salon</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Outside click listener backdrop to close active 3-dot dropdown */}
      {openMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenu(null)}
          onKeyDown={(e) => e.key === "Escape" && setOpenMenu(null)}
        />
      )}

      {/* Modals */}
      <ProvisionSalonModal
        isOpen={provisionOpen}
        onClose={() => {
          setProvisionOpen(false);
          refresh();
        }}
      />

      {manageSalon && (
        <ManagePlanModal
          salon={manageSalon}
          onClose={() => {
            setManageSalon(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export default function HqSalonsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[300px]">
          <RefreshCw className="h-6 w-6 animate-spin text-galla-teal" />
        </div>
      }
    >
      <HqSalonsContent />
    </React.Suspense>
  );
}
