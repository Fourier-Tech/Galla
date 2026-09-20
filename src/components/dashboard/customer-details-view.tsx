"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Phone,
  Calendar,
  Wallet,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  ShoppingBag,
  Scissors,
  Package,
  Search,
  Receipt,
  TrendingUp,
  CreditCard,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { DashboardCustomer, DashboardOrder } from "@/types/dashboard";
import { getCustomerOrdersAction } from "@/app/dashboard/actions";
import { formatRupee, formatDisplayNumber, calculatePendingAmount } from "@/lib/utils";
import { StatusPill } from "@/components/dashboard/status-pill";
import { OrderDetailsModal } from "@/components/dashboard/modals/order-details-modal";
import { RescheduleOrderModal } from "@/components/dashboard/modals/reschedule-order-modal";

interface CustomerDetailsViewProps {
  customer: DashboardCustomer;
  onBack: () => void;
  salonName?: string;
  globalOrders?: DashboardOrder[];
  onOpenSettle?: (order: DashboardOrder) => void;
  onOpenRefund?: (order: DashboardOrder) => void;
  onOpenReschedule?: (order: DashboardOrder) => void;
  onOpenEditCustomer?: (customer: DashboardCustomer) => void;
}

export function CustomerDetailsView({
  customer,
  onBack,
  salonName,
  globalOrders,
  onOpenSettle,
  onOpenRefund,
  onOpenReschedule,
  onOpenEditCustomer,
}: CustomerDetailsViewProps) {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "service" | "product" | "package">("all");
  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(null);
  const [rescheduleOrder, setRescheduleOrder] = useState<DashboardOrder | null>(null);

  // Sync local customer orders when global orders update (settlement, refund, reschedule)
  useEffect(() => {
    if (!globalOrders || globalOrders.length === 0) return;
    const globalMap = new Map(globalOrders.map((o) => [o.id, o]));
    setOrders((prev) =>
      prev.map((o) => {
        const updated = globalMap.get(o.id);
        return updated ? { ...o, ...updated } : o;
      })
    );
  }, [globalOrders]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);

    getCustomerOrdersAction({
      phone: customer.phone,
      name: customer.name,
      customerId: customer.id,
    })
      .then((res) => {
        if (!ignore) {
          if (res.success && res.orders) {
            setOrders(res.orders);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [customer.phone, customer.id, customer.name]);

  // Financial & Visit Metrics
  const metrics = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== "cancelled_refunded" && o.status !== "cancelled_converted"
    );

    const totalOrders = validOrders.length;
    const totalSpendFromOrders = validOrders.reduce((sum, o) => sum + (o.paid || 0), 0);
    const pendingDuesFromOrders = calculatePendingAmount(orders);

    const totalSpend = !isLoading
      ? totalSpendFromOrders
      : customer.totalSpent && customer.totalSpent > 0
      ? customer.totalSpent
      : 0;

    const outstandingDue = !isLoading
      ? pendingDuesFromOrders
      : typeof customer.outstandingDue === "number" && customer.outstandingDue > 0
      ? customer.outstandingDue
      : 0;

    const totalVisits = !isLoading
      ? totalOrders > 0
        ? totalOrders
        : orders.length > 0
        ? 1
        : customer.visits || 0
      : customer.visits || 0;

    const avgTicket = totalVisits > 0 ? Math.round(totalSpend / totalVisits) : totalSpend;

    // Recency status
    let recencyStatus: { label: string; tone: "active" | "due" | "dormant" } = {
      label: "Active Client",
      tone: "active",
    };

    if (customer.lastVisitRaw) {
      const lastDate = new Date(customer.lastVisitRaw);
      if (!isNaN(lastDate.getTime())) {
        const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          recencyStatus = { label: "Active (< 30 days)", tone: "active" };
        } else if (diffDays <= 60) {
          recencyStatus = { label: "Due for Visit", tone: "due" };
        } else {
          recencyStatus = { label: "Dormant (> 60 days)", tone: "dormant" };
        }
      }
    }

    return { totalSpend, totalVisits, avgTicket, outstandingDue, recencyStatus };
  }, [orders, customer, isLoading]);

  // Customer Analysis: Why they use us (Services vs Products vs Packages)
  const analysis = useMemo(() => {
    let serviceSpend = 0;
    let productSpend = 0;
    let packageSpend = 0;
    let serviceCount = 0;
    let productCount = 0;
    let packageCount = 0;

    const itemFrequency: Record<string, { name: string; count: number; type: string }> = {};
    const paymentModeFrequency: Record<string, number> = {};

    orders.forEach((o) => {
      if (o.status === "cancelled_refunded") return;

      if (o.type === "Service booking") {
        serviceSpend += o.amount;
        serviceCount += 1;
      } else if (o.type === "Product sale") {
        productSpend += o.amount;
        productCount += 1;
      } else if (o.type === "Package sale") {
        packageSpend += o.amount;
        packageCount += 1;
      }

      // Track line items
      if (o.lineItems && Array.isArray(o.lineItems)) {
        o.lineItems.forEach((li) => {
          if (!li.name) return;
          const key = li.name.toLowerCase();
          if (!itemFrequency[key]) {
            itemFrequency[key] = { name: li.name, count: 0, type: li.itemType };
          }
          itemFrequency[key].count += li.quantity || 1;
        });
      }

      // Track payments
      if (o.paymentMode) {
        paymentModeFrequency[o.paymentMode] = (paymentModeFrequency[o.paymentMode] || 0) + 1;
      }
    });

    const totalCalculatedSpend = serviceSpend + productSpend + packageSpend;
    const servicePct = totalCalculatedSpend > 0 ? Math.round((serviceSpend / totalCalculatedSpend) * 100) : 0;
    const productPct = totalCalculatedSpend > 0 ? Math.round((productSpend / totalCalculatedSpend) * 100) : 0;
    const packagePct = totalCalculatedSpend > 0 ? 100 - servicePct - productPct : 0;

    // Top items
    const topItems = Object.values(itemFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // Preferred payment mode
    const preferredPaymentMode = Object.entries(paymentModeFrequency).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      serviceSpend,
      productSpend,
      packageSpend,
      serviceCount,
      productCount,
      packageCount,
      servicePct,
      productPct,
      packagePct,
      topItems,
      preferredPaymentMode,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Type filter
      if (typeFilter === "service" && o.type !== "Service booking") return false;
      if (typeFilter === "product" && o.type !== "Product sale") return false;
      if (typeFilter === "package" && o.type !== "Package sale") return false;

      // Search filter
      const q = search.trim().toLowerCase();
      const idMatch =
        o.id.toLowerCase().includes(q) ||
        formatDisplayNumber(o.id).toLowerCase().includes(q);
      const itemsMatch = o.itemsSummary?.toLowerCase().includes(q);
      const timeMatch = o.time?.toLowerCase().includes(q);
      return idMatch || itemsMatch || timeMatch;
    });
  }, [orders, typeFilter, search]);

  // Direct WhatsApp Link (Blank chat)
  const directWaUrl = useMemo(() => {
    const cleaned = customer.phone.replace(/\D/g, "");
    if (!cleaned) return null;
    // ponytail: Assumes Indian 10-digit mobile numbers (+91). Upgrade path: Add country code support to tenant profile if expanding internationally.
    const standardNumber =
      cleaned.length === 10
        ? `91${cleaned}`
        : cleaned.startsWith("0") && cleaned.length === 11
        ? `91${cleaned.slice(1)}`
        : cleaned;
    return `https://api.whatsapp.com/send/?phone=${standardNumber}`;
  }, [customer.phone]);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Bar: Back & Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-galla-line">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Back to Customer Directory"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-semibold text-[22px] text-galla-ink tracking-[-0.015em]">
                {customer.name}
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink-soft">
                {customer.phone}
              </span>
            </div>
            <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
              Client profile{salonName ? ` at ${salonName}` : ""} &bull; Last visit: <span className="text-galla-ink font-medium">{customer.lastVisit}</span>
              {customer.createdAt && (
                <> &bull; Registered {new Date(customer.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</>
              )}
            </p>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-sans text-[12.5px] font-medium shadow-2xs transition-all cursor-pointer"
              title={`Call ${customer.name}`}
            >
              <Phone className="h-3.5 w-3.5 text-galla-teal" />
              <span>Call</span>
            </a>
          )}
          {directWaUrl && (
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-sans text-[12.5px] font-medium shadow-2xs transition-all cursor-pointer"
              title="Open WhatsApp chat"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
              <span>WhatsApp</span>
            </a>
          )}
          {onOpenEditCustomer && (
            <button
              type="button"
              onClick={() => onOpenEditCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-sans text-[12.5px] font-medium shadow-2xs transition-all cursor-pointer"
              title={`Edit ${customer.name}'s details`}
            >
              <Pencil className="h-3.5 w-3.5 text-galla-teal" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Client Notes / Preferences Banner */}
      {customer.notes && (
        <div className="p-3.5 rounded-[8px] bg-amber-50/70 border border-amber-200/80 text-amber-950 flex items-start gap-2.5 shadow-2xs">
          <MessageSquare className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-amber-900 block">
              Client Preferences &amp; Notes
            </span>
            <p className="text-[12.5px] text-amber-900/90 mt-0.5 whitespace-pre-wrap font-sans">
              {customer.notes}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Spent */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Total Spent
            </span>
            <div className="h-7 w-7 rounded-[5px] bg-galla-teal/10 border border-galla-teal/20 flex items-center justify-center text-galla-teal">
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold font-heading text-galla-ink mt-2">
            {formatRupee(metrics.totalSpend)}
          </div>
          <span className="text-[11.5px] text-galla-ink-soft mt-1 block">
            Avg: <span className="font-semibold text-galla-ink">{formatRupee(metrics.avgTicket)}</span> / visit
          </span>
        </div>

        {/* Total Visits */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Total Visits
            </span>
            <div className="h-7 w-7 rounded-[5px] bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold font-heading text-galla-ink mt-2">
            {metrics.totalVisits} <span className="text-[14px] font-medium text-galla-ink-soft">visits</span>
          </div>
          <span
            className={`text-[11px] font-medium mt-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded border ${
              metrics.recencyStatus.tone === "active"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : metrics.recencyStatus.tone === "due"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {metrics.recencyStatus.label}
          </span>
        </div>

        {/* Outstanding Dues */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Outstanding Dues
            </span>
            <div
              className={`h-7 w-7 rounded-[5px] flex items-center justify-center border ${
                metrics.outstandingDue > 0
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {metrics.outstandingDue > 0 ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
          <div
            className={`text-[22px] font-bold font-heading mt-2 ${
              metrics.outstandingDue > 0 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {formatRupee(metrics.outstandingDue)}
          </div>
          <span className="text-[11.5px] text-galla-ink-soft mt-1 block">
            {metrics.outstandingDue > 0 ? "Pending payment on orders" : "Fully settled (₹0 balance)"}
          </span>
        </div>
      </div>

      {/* Customer Purchase Analysis: "Why Customer Uses Us" */}
      <div className="p-5 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-galla-line">
          <div>
            <h3 className="font-heading font-semibold text-[15px] text-galla-ink flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-galla-teal" />
              <span>Purchase Preference Analysis &bull; Why They Visit Us</span>
            </h3>
            <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
              Breakdown of treatments taken versus retail supplies purchased over lifetime visits
            </p>
          </div>
          {analysis.preferredPaymentMode && (
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] font-sans text-galla-ink-soft bg-galla-paper/60 px-2.5 py-1 rounded-[4px] border border-galla-line">
              <CreditCard className="h-3.5 w-3.5 text-galla-ink-soft" />
              <span>Preferred: <strong className="text-galla-ink uppercase">{analysis.preferredPaymentMode}</strong></span>
            </div>
          )}
        </div>

        {/* Visual Preference Meter */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[12px] font-sans font-medium text-galla-ink">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
              Services ({analysis.servicePct}%) &bull; {formatRupee(analysis.serviceSpend)}
            </span>
            <span className="flex items-center gap-1.5 text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
              Retail Products ({analysis.productPct}%) &bull; {formatRupee(analysis.productSpend)}
            </span>
            {analysis.packageSpend > 0 && (
              <span className="flex items-center gap-1.5 text-purple-800">
                <span className="h-2 w-2 rounded-full bg-purple-600 inline-block" />
                Packages ({analysis.packagePct}%) &bull; {formatRupee(analysis.packageSpend)}
              </span>
            )}
          </div>

          {/* Meter Bar */}
          <div className="h-2.5 w-full bg-galla-paper rounded-full overflow-hidden flex border border-galla-line/60">
            <div
              style={{ width: `${analysis.servicePct}%` }}
              className="bg-emerald-600 h-full transition-all duration-500"
              title={`Services: ${analysis.servicePct}%`}
            />
            <div
              style={{ width: `${analysis.productPct}%` }}
              className="bg-blue-600 h-full transition-all duration-500"
              title={`Retail Products: ${analysis.productPct}%`}
            />
            {analysis.packageSpend > 0 && (
              <div
                style={{ width: `${analysis.packagePct}%` }}
                className="bg-purple-600 h-full transition-all duration-500"
                title={`Packages: ${analysis.packagePct}%`}
              />
            )}
          </div>
        </div>

        {/* Top Items List */}
        {analysis.topItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-galla-line/60 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold mr-1">
              Top Treatments &amp; Items:
            </span>
            {analysis.topItems.map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 text-[12px] font-sans px-2.5 py-1 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink"
              >
                {item.type === "product" ? (
                  <ShoppingBag className="h-3 w-3 text-blue-600" />
                ) : item.type === "package" ? (
                  <Package className="h-3 w-3 text-purple-600" />
                ) : (
                  <Scissors className="h-3 w-3 text-emerald-600" />
                )}
                <span>{item.name}</span>
                <span className="font-bold text-galla-teal">({item.count}x)</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Orders List Section: "All the order till date" */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-semibold text-[17px] text-galla-ink flex items-center gap-2">
              <Receipt className="h-4 w-4 text-galla-teal" />
              <span>All Orders Till Date ({filteredOrders.length})</span>
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              Click any order row to inspect purchased items, bills, and payment receipts at {salonName || "this salon"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Type Filters */}
            <div className="flex items-center bg-galla-paper/70 p-0.5 rounded-[5px] border border-galla-line text-[12px] font-sans">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "service", label: "Services" },
                  { key: "product", label: "Products" },
                  { key: "package", label: "Packages" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-[4px] transition-all cursor-pointer ${
                    typeFilter === tab.key
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line w-44 focus-within:border-galla-teal transition-all">
              <Search className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders..."
                className="w-full bg-transparent font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-galla-surface border border-galla-line rounded-[8px] overflow-hidden shadow-2xs">
          {isLoading ? (
            <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
              Loading order history...
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="divide-y divide-galla-line">
              {filteredOrders.map((order) => {
                const isPaidFull = order.paid >= order.amount;
                const pendingBalance = Math.max(0, order.amount - order.paid);

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="p-3.5 sm:p-4 hover:bg-galla-paper/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-[6px] bg-galla-paper border border-galla-line flex items-center justify-center shrink-0 mt-0.5 group-hover:border-galla-teal/40 transition-colors">
                        {order.type === "Product sale" ? (
                          <ShoppingBag className="h-4 w-4 text-blue-600" />
                        ) : order.type === "Package sale" ? (
                          <Package className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Scissors className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[13px] font-bold text-galla-ink">
                            {formatDisplayNumber(order.id)}
                          </span>
                          <span className="text-[11px] font-sans px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line">
                            {order.type}
                          </span>
                          <span className="text-[11.5px] font-sans text-galla-ink-soft">
                            {order.time}
                          </span>
                        </div>
                        {order.notes && (
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                            title={`Note: ${order.notes}`}
                          >
                            <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                              Note
                            </span>
                            <span className="truncate font-medium">{order.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                      <div className="text-right">
                        <div className="font-mono text-[13.5px] font-bold text-galla-ink">
                          {formatRupee(order.amount)}
                        </div>
                        <div className="text-[11px] font-sans">
                          {order.status === "cancelled_refunded" ? (
                            <span className="text-red-700 font-medium">
                              {order.refundAmount
                                ? `${formatRupee(order.refundAmount)} refunded`
                                : "Refunded"}
                            </span>
                          ) : order.status === "cancelled_converted" ? (
                            <span className="text-purple-700 font-medium">Converted</span>
                          ) : isPaidFull ? (
                            <span className="text-emerald-700 font-medium">Paid in full</span>
                          ) : (
                            <span className="text-rose-700 font-medium">
                              Due: {formatRupee(pendingBalance)}
                            </span>
                          )}
                        </div>
                      </div>

                      <StatusPill status={order.status} />

                      {/* Relative Action Buttons based on order status */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1. Settle & Done: for orders with pending due balance / advance */}
                        {!isPaidFull &&
                          order.status !== "cancelled_refunded" &&
                          order.status !== "cancelled_converted" &&
                          onOpenSettle && (
                            <button
                              type="button"
                              onClick={() => onOpenSettle(order)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                              title={`Settle ${formatRupee(pendingBalance)} remaining balance and complete order`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Settle &amp; Done</span>
                            </button>
                          )}

                        {/* 2. Reschedule: for upcoming scheduled appointments or pending due orders */}
                        {(Boolean(order.scheduledFor) || !isPaidFull) &&
                          order.status !== "completed" &&
                          order.status !== "cancelled_refunded" &&
                          order.status !== "cancelled_converted" && (
                            <button
                              type="button"
                              onClick={() => setRescheduleOrder(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[5px] bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-teal hover:text-galla-teal transition-all cursor-pointer shadow-2xs"
                              title="Reschedule appointment or payment due date"
                            >
                              <Calendar className="h-3.5 w-3.5 text-galla-teal" />
                              <span>Reschedule</span>
                            </button>
                          )}

                        {/* 3. Refund: for completed orders with payment */}
                        {order.status === "completed" && order.paid > 0 && onOpenRefund && (
                          <button
                            type="button"
                            onClick={() => onOpenRefund(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-sans font-medium rounded-[5px] bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
                            title="Process refund for this order"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                            <span>Refund</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
              {search || typeFilter !== "all"
                ? "No customer orders match your search criteria."
                : "No orders found for this customer."}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal (Reuse newly built modal on order click) */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        salonName={salonName}
        onOpenSettle={onOpenSettle}
        onOpenRefund={onOpenRefund}
        onOpenReschedule={(ord) => {
          setSelectedOrder(null);
          setRescheduleOrder(ord);
        }}
      />

      {/* Reschedule Order Modal */}
      <RescheduleOrderModal
        order={rescheduleOrder}
        isOpen={Boolean(rescheduleOrder)}
        onClose={() => setRescheduleOrder(null)}
        onRescheduleSuccess={(updated) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
          if (selectedOrder?.id === updated.id) {
            setSelectedOrder((prev) => (prev ? { ...prev, ...updated } : null));
          }
          onOpenReschedule?.(updated);
          setRescheduleOrder(null);
        }}
      />
    </div>
  );
}
