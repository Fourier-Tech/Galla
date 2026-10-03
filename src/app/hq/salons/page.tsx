"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import {
  getSalonsAction,
  toggleTenantStatusAction,
  createSalonImpersonationUrlAction,
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
  planType: "trial" | "active" | "lifetime";
  planExpiresAt?: string | null;
  currency?: string;
  createdAt: string;
};

function StatusBadge({ status }: { status: Salon["status"] }) {
  const map = {
    active: { label: "Active", icon: CheckCircle, cls: "bg-galla-sage-soft text-galla-sage" },
    trial: { label: "Trial", icon: Clock, cls: "bg-galla-brass-soft text-galla-brass" },
    suspended: { label: "Suspended", icon: XCircle, cls: "bg-galla-brick-soft text-galla-brick" },
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

export default function HqSalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [manageSalon, setManageSalon] = useState<Salon | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalonsAction();
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
      await toggleTenantStatusAction(salon._id, salon.status !== "suspended");
      await refresh();
    } finally {
      setActionLoading(null);
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

  const daysLeft = (d?: string | null) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-galla-ink">Manage Salons</h1>
          <p className="text-[13px] text-galla-ink-soft mt-0.5">
            {salons.length} salon{salons.length !== 1 ? "s" : ""} registered on Galla
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Salons Table Container - Overflow visible to prevent clipping dropdown menus */}
      <div className="bg-white border border-galla-line rounded-[10px] min-h-[300px] shadow-sm relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-galla-paper/70 border-b border-galla-line text-[11px] font-semibold text-galla-ink-soft uppercase tracking-wider rounded-t-[10px]">
              <th className="px-5 py-3.5">Salon Profile</th>
              <th className="px-5 py-3.5">Owner / Contact</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Plan</th>
              <th className="px-5 py-3.5">Expiry</th>
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
            ) : salons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-galla-ink-soft text-[13px]">
                  No salons provisioned yet. Click &quot;Provision Salon&quot; above to create your first tenant.
                </td>
              </tr>
            ) : (
              salons.map((salon, index) => {
                const days = daysLeft(salon.planExpiresAt);
                const isExpiringSoon = days !== null && days <= 7 && days >= 0;
                const isExpired = days !== null && days < 0;
                const isNearBottom = index >= salons.length - 2 || salons.length <= 2;

                return (
                  <tr key={salon._id} className="hover:bg-galla-paper/40 transition-colors">
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
                      <StatusBadge status={salon.status} />
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-4">
                      <PlanBadge plan={salon.planType} />
                    </td>

                    {/* Expiry */}
                    <td className="px-5 py-4">
                      {salon.planType === "lifetime" ? (
                        <span className="text-galla-ink-soft text-[12px] font-medium">Lifetime Access</span>
                      ) : (
                        <div>
                          <p
                            className={`font-medium ${
                              isExpired
                                ? "text-galla-brick font-semibold"
                                : isExpiringSoon
                                ? "text-galla-brick"
                                : "text-galla-ink"
                            }`}
                          >
                            {formatDate(salon.planExpiresAt)}
                          </p>
                          {days !== null && (
                            <span
                              className={`inline-block mt-0.5 text-[11px] px-1.5 py-0.2 rounded font-medium ${
                                isExpired
                                  ? "bg-galla-brick-soft text-galla-brick font-bold"
                                  : isExpiringSoon
                                  ? "bg-galla-brick-soft text-galla-brick font-semibold"
                                  : "bg-galla-paper text-galla-ink-soft"
                              }`}
                            >
                              {isExpired ? "Expired" : `${days} days left`}
                            </span>
                          )}
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
