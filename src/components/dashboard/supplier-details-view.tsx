"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Truck,
  Phone,
  Building2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Package,
  Search,
  Receipt,
  TrendingUp,
  CreditCard,
  Pencil,
  FileText,
  Loader2,
  X,
  Calendar,
  Clock,
} from "lucide-react";
import { DashboardSupplier, DashboardPurchaseOrder } from "@/types/dashboard";
import {
  getPurchaseOrdersAction,
  recordPurchaseOrderPaymentAction,
} from "@/app/dashboard/actions";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  formatOrderTime,
  getBookingUrgency,
  getSupplierWhatsAppReminderUrl,
  getBillStatus,
  getBillLastUpdatedTime,
  formatDisplayNumber,
} from "@/lib/utils";
import { PurchaseBillDetailsModal } from "@/components/dashboard/modals/purchase-bill-details-modal";
import { ReschedulePurchaseOrderModal } from "@/components/dashboard/modals/reschedule-purchase-order-modal";
import { SettlePurchaseBillModal } from "@/components/dashboard/modals/settle-purchase-bill-modal";
import { StatusPill } from "@/components/dashboard/status-pill";


interface SupplierDetailsViewProps {
  supplier: DashboardSupplier;
  onBack: () => void;
  onOpenEditSupplier?: (supplier: DashboardSupplier) => void;
  onSupplierUpdated?: (updatedSupplier: DashboardSupplier) => void;
  salonName?: string;
}

export function SupplierDetailsView({
  supplier,
  onBack,
  onOpenEditSupplier,
  onSupplierUpdated,
  salonName,
}: SupplierDetailsViewProps) {
  const [bills, setBills] = useState<DashboardPurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "settled" | "pending">("all");

  // Selected bill for detailed modal
  const [selectedBill, setSelectedBill] = useState<DashboardPurchaseOrder | null>(null);

  // Pay Now dialog state
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<DashboardPurchaseOrder | null>(null);

  // Reschedule modal state
  const [reschedulingState, setReschedulingState] = useState<{
    po: DashboardPurchaseOrder;
    mode: "delivery" | "due_date";
  } | null>(null);

  const handleOpenReschedule = (po: DashboardPurchaseOrder, mode: "delivery" | "due_date") => {
    setReschedulingState({ po, mode });
  };

  const handleRescheduleSuccess = (updatedPO: DashboardPurchaseOrder) => {
    const enrichedPO = {
      ...updatedPO,
      lastUpdatedTime: "Today, Just now",
      updatedAt: new Date().toISOString(),
    };
    setBills((prev) =>
      prev.map((b) => (b.id === enrichedPO.id ? enrichedPO : b))
    );
    if (selectedBill?.id === enrichedPO.id) {
      setSelectedBill(enrichedPO);
    }
  };

  // Fetch supplier purchase bills
  useEffect(() => {
    let ignore = false;
    setIsLoading(true);

    getPurchaseOrdersAction({ supplierId: supplier.id })
      .then((res) => {
        if (!ignore) {
          if (res.success && res.purchaseOrders) {
            setBills(res.purchaseOrders);
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
  }, [supplier.id, supplier.phone, supplier.name]);

  // Keep bills synchronized whenever supplier contact info (phone, name, company) updates
  useEffect(() => {
    if (!supplier) return;
    setBills((prev) =>
      prev.map((b) => ({
        ...b,
        supplierName: supplier.name || b.supplierName,
        supplierPhone: supplier.phone ? formatPhoneNumber(supplier.phone) : b.supplierPhone,
        supplierCompany: supplier.companyName !== undefined ? supplier.companyName : b.supplierCompany,
      }))
    );
  }, [supplier.phone, supplier.name, supplier.companyName]);

  // Financial & Bill Metrics
  const metrics = useMemo(() => {
    const totalBills = bills.length;
    const totalPurchasesFromBills = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalPaidFromBills = bills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const totalPendingFromBills = bills.reduce((sum, b) => sum + (b.amountPending || 0), 0);
    const pendingCount = bills.filter((b) => b.paymentStatus !== "paid").length;

    const totalPurchases =
      totalPurchasesFromBills > 0 ? totalPurchasesFromBills : supplier.totalPurchases || 0;
    const totalPaid = totalPaidFromBills > 0 ? totalPaidFromBills : supplier.totalPaid || 0;
    const totalPending =
      totalPendingFromBills > 0 ? totalPendingFromBills : supplier.totalPending || 0;

    const avgTicket = totalBills > 0 ? Math.round(totalPurchases / totalBills) : totalPurchases;

    return {
      totalBills,
      totalPurchases,
      totalPaid,
      totalPending,
      avgTicket,
      pendingCount,
    };
  }, [bills, supplier]);

  // Supply Analysis: "What We Buy From Them" (Retail vs Salon Use)
  const analysis = useMemo(() => {
    let retailSpend = 0;
    let salonSpend = 0;
    let retailQty = 0;
    let salonQty = 0;

    const productFrequency: Record<string, { name: string; count: number; spend: number }> = {};
    const paymentModeFrequency: Record<string, number> = {};

    bills.forEach((b) => {
      if (b.items && Array.isArray(b.items)) {
        b.items.forEach((it) => {
          const rQty = it.quantityForSell || 0;
          const uQty = it.quantityForUse || 0;
          const cost = it.purchaseCost || 0;

          retailSpend += cost * rQty;
          salonSpend += cost * uQty;
          retailQty += rQty;
          salonQty += uQty;

          if (it.productName) {
            const key = it.productName.toLowerCase();
            if (!productFrequency[key]) {
              productFrequency[key] = { name: it.productName, count: 0, spend: 0 };
            }
            productFrequency[key].count += rQty + uQty;
            productFrequency[key].spend += it.itemTotalCost || cost * (rQty + uQty);
          }
        });
      } else {
        // Fallback if items not breakdown
        retailSpend += b.totalAmount || 0;
      }

      if (b.paymentMode && b.paymentMode !== "credit") {
        paymentModeFrequency[b.paymentMode] = (paymentModeFrequency[b.paymentMode] || 0) + 1;
      }
    });

    const totalCalculated = retailSpend + salonSpend;
    const retailPct = totalCalculated > 0 ? Math.round((retailSpend / totalCalculated) * 100) : 100;
    const salonPct = totalCalculated > 0 ? 100 - retailPct : 0;

    const topItems = Object.values(productFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const preferredPaymentMode = Object.entries(paymentModeFrequency).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return {
      retailSpend,
      salonSpend,
      retailQty,
      salonQty,
      retailPct,
      salonPct,
      topItems,
      preferredPaymentMode,
    };
  }, [bills, metrics.totalPurchases]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Status filter
      if (statusFilter === "settled" && b.paymentStatus !== "paid") return false;
      if (statusFilter === "pending" && b.paymentStatus === "paid") return false;

      // Search filter
      const q = search.trim().toLowerCase();
      const poMatch =
        b.purchaseOrderNumber.toLowerCase().includes(q) ||
        formatDisplayNumber(b.purchaseOrderNumber).toLowerCase().includes(q);
      const invMatch = b.dealerInvoiceNumber && b.dealerInvoiceNumber.toLowerCase().includes(q);
      const notesMatch = b.notes && b.notes.toLowerCase().includes(q);
      const itemMatch = b.items?.some((it) => it.productName.toLowerCase().includes(q));

      return poMatch || invMatch || notesMatch || itemMatch;
    });
  }, [bills, statusFilter, search]);

  // Direct WhatsApp Link (Blank Chat)
  const directWaUrl = useMemo(() => {
    const cleaned = (supplier.phone || "").replace(/\D/g, "");
    if (!cleaned) return null;
    const standardNumber =
      cleaned.length === 10
        ? `91${cleaned}`
        : cleaned.startsWith("0") && cleaned.length === 11
          ? `91${cleaned.slice(1)}`
          : cleaned;
    return `https://api.whatsapp.com/send/?phone=${standardNumber}`;
  }, [supplier.phone]);

  const handleOpenPayNow = (bill: DashboardPurchaseOrder) => {
    setSelectedPOForPayment(bill);
  };

  const handlePaymentSuccess = (updatedPO: DashboardPurchaseOrder) => {
    setBills((prev) =>
      prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
    );
    if (selectedBill && selectedBill.id === updatedPO.id) {
      setSelectedBill(updatedPO);
    }
    if (onSupplierUpdated) {
      const remainingDues = bills
        .map((b) => (b.id === updatedPO.id ? updatedPO : b))
        .reduce((sum, b) => sum + (b.amountPending || 0), 0);
      onSupplierUpdated({
        ...supplier,
        totalPending: remainingDues,
      });
    }
    setSelectedPOForPayment(null);
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Bar: Back & Profile Header (Exact Layout as Customer Details View) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-galla-line">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Back to Suppliers"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-semibold text-[22px] text-galla-ink tracking-[-0.015em]">
                {supplier.name}
              </h2>
              {supplier.phone && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink-soft">
                  {formatPhoneNumber(supplier.phone)}
                </span>
              )}
              {supplier.companyName && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-sans px-2 py-0.5 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink-soft">
                  <Building2 className="h-3 w-3" />
                  <span>{supplier.companyName}</span>
                </span>
              )}
              {metrics.totalPending > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-sans px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  <span>Due: {formatRupee(metrics.totalPending)}</span>
                </span>
              )}
            </div>
            <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
              Supplier profile &bull; Bills on record:{" "}
              <span className="text-galla-ink font-medium">{bills.length}</span>
              {supplier.gstin && (
                <>
                  {" "}
                  &bull; GSTIN:{" "}
                  <span className="font-mono text-galla-ink font-medium">{supplier.gstin}</span>
                </>
              )}
              {supplier.address && (
                <>
                  {" "}
                  &bull; <span className="text-galla-ink-soft/90">{supplier.address}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Shortcuts (Call, WhatsApp, Edit - Exact Match with Customer Details View) */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {supplier.phone && (
            <a
              href={`tel:${supplier.phone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-sans text-[12.5px] font-medium shadow-2xs transition-all cursor-pointer"
              title={`Call ${supplier.name}`}
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
          {onOpenEditSupplier && (
            <button
              type="button"
              onClick={() => onOpenEditSupplier(supplier)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line hover:bg-galla-paper text-galla-ink font-sans text-[12.5px] font-medium shadow-2xs transition-all cursor-pointer"
              title="Edit supplier details"
            >
              <Pencil className="h-3.5 w-3.5 text-galla-ink-soft" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Supplier Notes & Terms Banner */}
      {supplier.notes && (
        <div className="p-3.5 rounded-[8px] bg-amber-50/70 border border-amber-200/80 text-amber-950 flex items-start gap-2.5 shadow-2xs">
          <MessageSquare className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-amber-900 block">
              Supplier Notes &amp; Terms
            </span>
            <p className="text-[12.5px] text-amber-900/90 mt-0.5 whitespace-pre-wrap font-sans">
              {supplier.notes}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid (3 Columns - Matching Customer Details View) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Purchases */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Total Purchases
            </span>
            <div className="h-7 w-7 rounded-[5px] bg-galla-teal/10 border border-galla-teal/20 flex items-center justify-center text-galla-teal">
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold font-heading text-galla-ink mt-2">
            {formatRupee(metrics.totalPurchases)}
          </div>
          <span className="text-[11.5px] text-galla-ink-soft mt-1 block">
            Avg: <span className="font-semibold text-galla-ink">{formatRupee(metrics.avgTicket)}</span> / bill
          </span>
        </div>

        {/* Total Settled */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Total Settled
            </span>
            <div className="h-7 w-7 rounded-[5px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold font-heading text-emerald-700 mt-2">
            {formatRupee(metrics.totalPaid)}
          </div>
          <span className="text-[11px] font-medium mt-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
            Settled to Date
          </span>
        </div>

        {/* Outstanding Dues */}
        <div className="p-4 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
              Outstanding Dues
            </span>
            <div
              className={`h-7 w-7 rounded-[5px] flex items-center justify-center border ${metrics.totalPending > 0
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
            >
              {metrics.totalPending > 0 ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
          <div
            className={`text-[22px] font-bold font-heading mt-2 ${metrics.totalPending > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
          >
            {formatRupee(metrics.totalPending)}
          </div>
          <span className="text-[11.5px] text-galla-ink-soft mt-1 block">
            {metrics.totalPending > 0
              ? `${metrics.pendingCount} unpaid / partial bill(s)`
              : "Fully settled (₹0 balance)"}
          </span>
        </div>
      </div>

      {/* Supplier Supply Analysis: "What We Buy From Them" (Mirroring Customer Analysis) */}
      <div className="p-5 rounded-[8px] bg-galla-surface border border-galla-line shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-galla-line">
          <div>
            <h3 className="font-heading font-semibold text-[15px] text-galla-ink flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-galla-teal" />
              <span>Supply Preference Analysis &bull; What We Buy From Them</span>
            </h3>
            <p className="font-sans text-[12.5px] text-galla-ink-soft mt-0.5">
              Breakdown of retail resale merchandise versus in-salon consumable supplies ordered over lifetime bills
            </p>
          </div>
          {analysis.preferredPaymentMode && (
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] font-sans text-galla-ink-soft bg-galla-paper/60 px-2.5 py-1 rounded-[4px] border border-galla-line">
              <CreditCard className="h-3.5 w-3.5 text-galla-ink-soft" />
              <span>
                Preferred:{" "}
                <strong className="text-galla-ink uppercase">
                  {analysis.preferredPaymentMode}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Visual Preference Meter */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[12px] font-sans font-medium text-galla-ink">
            <span className="flex items-center gap-1.5 text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
              Retail Stock ({analysis.retailPct}%) &bull; {formatRupee(analysis.retailSpend)}
            </span>
            <span className="flex items-center gap-1.5 text-purple-800">
              <span className="h-2 w-2 rounded-full bg-purple-600 inline-block" />
              Salon Consumables ({analysis.salonPct}%) &bull; {formatRupee(analysis.salonSpend)}
            </span>
          </div>

          {/* Meter Bar */}
          <div className="h-2.5 w-full bg-galla-paper rounded-full overflow-hidden flex border border-galla-line/60">
            <div
              style={{ width: `${analysis.retailPct}%` }}
              className="bg-blue-600 h-full transition-all duration-500"
              title={`Retail: ${analysis.retailPct}%`}
            />
            <div
              style={{ width: `${analysis.salonPct}%` }}
              className="bg-purple-600 h-full transition-all duration-500"
              title={`Salon Use: ${analysis.salonPct}%`}
            />
          </div>
        </div>

        {/* Top Items Supplied */}
        {analysis.topItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-galla-line/60 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold mr-1">
              Top Products Supplied:
            </span>
            {analysis.topItems.map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 text-[12px] font-sans px-2.5 py-1 rounded-[4px] bg-galla-paper border border-galla-line text-galla-ink"
              >
                <Package className="h-3 w-3 text-blue-600" />
                <span>{item.name}</span>
                <span className="font-bold text-galla-teal">({item.count}x)</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Bills List Section: "All Purchase Bills Till Date" (Mirroring All Orders Till Date) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-semibold text-[17px] text-galla-ink flex items-center gap-2">
              <Receipt className="h-4 w-4 text-galla-teal" />
              <span>All Purchase Bills Till Date ({filteredBills.length})</span>
            </h3>
            <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
              Click any bill row to inspect full purchased items, bills, and payment receipts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filters */}
            <div className="flex items-center bg-galla-paper/70 p-0.5 rounded-[5px] border border-galla-line text-[12px] font-sans">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "settled", label: "Settled" },
                  { key: "pending", label: "Pending Due" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-[4px] transition-all cursor-pointer ${statusFilter === tab.key
                      ? "bg-galla-surface text-galla-ink font-semibold shadow-2xs"
                      : "text-galla-ink-soft hover:text-galla-ink"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-galla-surface border border-galla-line w-48 focus-within:border-galla-teal transition-all">
              <Search className="h-3.5 w-3.5 text-galla-ink-soft shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bills..."
                className="w-full bg-transparent font-sans text-[12px] text-galla-ink placeholder:text-galla-ink-soft/50 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bills Table / List */}
        <div className="bg-galla-surface border border-galla-line rounded-[8px] overflow-hidden shadow-2xs">
          {isLoading ? (
            <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-galla-teal" />
              <span>Loading purchase bills...</span>
            </div>
          ) : filteredBills.length > 0 ? (
            <div className="divide-y divide-galla-line">
              {filteredBills.map((bill) => {
                const isPaidFull = bill.paymentStatus === "paid" || bill.amountPending <= 0;
                const pendingBalance = Math.max(0, bill.amountPending);

                // Summary of items
                const itemsSummary =
                  bill.items && bill.items.length > 0
                    ? bill.items.map((it) => it.productName).join(", ")
                    : `Stock In (${bill.itemsCount || 1} item)`;

                const isAdvance =
                  bill.settlementMode === "advance" ||
                  Boolean(bill.expectedDeliveryDate) ||
                  Boolean(bill.notes && /advance/i.test(bill.notes));
                const targetDelivery =
                  bill.expectedDeliveryDate || (isAdvance ? bill.dueDate || bill.invoiceDate : undefined);
                const dUrgency = targetDelivery ? getBookingUrgency(targetDelivery) : null;
                const isDelivToday = dUrgency?.tone === "today";
                const isDelivOverdue = dUrgency?.tone === "overdue";

                const dDateStr = targetDelivery ? formatBookingDate(targetDelivery) : "";
                const dTimeStr = bill.deliveryTime ? formatAppointmentTime(bill.deliveryTime) : "";
                const dFullSlot = dTimeStr ? `${dDateStr}, ${dTimeStr}` : dDateStr;

                const dBadgeStyle = isDelivToday
                  ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold shadow-xs"
                  : isDelivOverdue
                    ? "text-red-900 bg-red-100 border-red-300 font-semibold"
                    : "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";

                const dBadgeLabel = isDelivToday
                  ? `🚨 Delivery Today (${dFullSlot})`
                  : isDelivOverdue
                    ? `⚠️ Delivery Overdue (${dFullSlot})`
                    : `Expected: ${dFullSlot}`;

                // Payment Due Date & Urgency
                const targetDueDate = bill.dueDate || (bill.paymentMode === "credit" ? bill.invoiceDate : undefined);
                const dueUrgency = (pendingBalance > 0 && targetDueDate) ? getBookingUrgency(targetDueDate) : null;
                const isDueToday = dueUrgency?.tone === "today";
                const isDueOverdue = dueUrgency?.tone === "overdue";

                const dueDateStr = targetDueDate ? formatBookingDate(targetDueDate) : "";
                const dueBadgeStyle = isDueToday
                  ? "text-rose-800 bg-rose-50 border-rose-300 font-semibold shadow-xs"
                  : isDueOverdue
                    ? "text-red-900 bg-red-100 border-red-300 font-semibold"
                    : "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";

                const dueBadgeLabel = isDueToday
                  ? `🚨 Payment Due Today (${dueDateStr})`
                  : isDueOverdue
                    ? `⚠️ Payment Overdue (${dueDateStr})`
                    : `Due: ${dueDateStr}`;

                const billWaUrl = getSupplierWhatsAppReminderUrl({
                  phone: supplier.phone,
                  supplierName: supplier.name,
                  salonName: salonName,
                  poNumber: bill.purchaseOrderNumber,
                  dealerInvoiceNumber: bill.dealerInvoiceNumber,
                  deliveryDate: targetDelivery,
                  deliveryTime: bill.deliveryTime,
                  dueDate: bill.dueDate,
                  totalAmount: bill.totalAmount,
                  amountPaid: bill.amountPaid,
                  amountPending: pendingBalance,
                  itemsSummary,
                  items: bill.items,
                  mode: isAdvance ? "advance" : pendingBalance > 0 ? "payment_due" : "delivery",
                  isAdvance,
                });

                const billStatus = getBillStatus(bill);
                const isBillCompleted = billStatus.statusKey === "completed" || bill.amountPending <= 0;

                return (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="p-3.5 sm:p-4 hover:bg-galla-paper/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-[6px] bg-galla-paper border border-galla-line flex items-center justify-center shrink-0 mt-0.5 group-hover:border-galla-teal/40 transition-colors">
                        <Package className="h-4 w-4 text-galla-teal" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[13px] font-bold text-galla-ink group-hover:text-galla-teal transition-colors">
                            {formatDisplayNumber(bill.purchaseOrderNumber)}
                          </span>
                          {bill.dealerInvoiceNumber && (
                            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line">
                              Inv: #{bill.dealerInvoiceNumber}
                            </span>
                          )}
                          <span className="text-[11.5px] font-sans text-galla-ink-soft">
                            Stock Order &bull; {formatOrderTime(bill.createdAt || bill.invoiceDate)}
                          </span>
                        </div>
                        {getBillLastUpdatedTime(bill) && (
                          <div className="font-sans text-[11px] text-galla-ink-soft/75 mt-0.5 flex items-center gap-1 truncate">
                            <span className="text-galla-ink-soft/60">Last update:</span>
                            <span className="font-medium text-galla-ink-soft">{getBillLastUpdatedTime(bill)}</span>
                          </div>
                        )}
                        {bill.notes && (
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-amber-50/90 border border-amber-200 text-amber-950 font-sans text-[11.5px] mt-1 max-w-full shadow-2xs"
                            title={`Note: ${bill.notes}`}
                          >
                            <span className="font-bold not-italic text-[9.5px] uppercase tracking-wider bg-amber-200 text-amber-950 px-1 py-0.2 rounded shrink-0">
                              Note
                            </span>
                            <span className="truncate font-medium">{bill.notes}</span>
                          </div>
                        )}

                        {/* Delivery Schedule & Due Urgency */}
                        {!isBillCompleted && (targetDelivery || (pendingBalance > 0 && targetDueDate)) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {targetDelivery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReschedule(bill, "delivery");
                                }}
                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border shadow-2xs hover:opacity-85 transition-all cursor-pointer group ${dBadgeStyle}`}
                                title="Click to reschedule delivery date & time"
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>{dBadgeLabel}</span>
                                <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                  Reschedule
                                </span>
                              </button>
                            )}
                            {pendingBalance > 0 && targetDueDate && targetDueDate !== targetDelivery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReschedule(bill, "due_date");
                                }}
                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border shadow-2xs hover:opacity-85 transition-all cursor-pointer group ${dueBadgeStyle}`}
                                title="Click to reschedule payment due date"
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{dueBadgeLabel}</span>
                                <span className="text-[10px] opacity-75 underline ml-0.5 group-hover:opacity-100 font-normal">
                                  Reschedule
                                </span>
                              </button>
                            )}
                            {billWaUrl && (
                              <a
                                href={billWaUrl}
                                onClick={(e) => e.stopPropagation()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                                title="Send WhatsApp message regarding this bill"
                              >
                                <MessageSquare className="h-3 w-3 text-emerald-700" />
                                <span>WhatsApp Msg</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-[13.5px] font-bold text-galla-ink">
                          {formatRupee(bill.totalAmount)}
                        </div>
                        <div className="text-[11px] font-sans text-galla-ink-soft">
                          {isPaidFull ? (
                            <span className="text-galla-ink-soft/80 font-medium">
                              Settled
                              {bill.paymentMode && ` • ${bill.paymentMode.toUpperCase()}`}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-medium">
                              Due: {formatRupee(pendingBalance)}
                            </span>
                          )}
                        </div>
                      </div>

                      <StatusPill
                        status={getBillStatus(bill).pillStatus}
                        customLabel={getBillStatus(bill).label}
                      />

                      {!isPaidFull && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayNow(bill);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-sans font-medium rounded-[4px] bg-galla-teal hover:opacity-95 text-white transition-all cursor-pointer shadow-2xs"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center font-sans text-[13px] text-galla-ink-soft">
              {search || statusFilter !== "all"
                ? "No purchase bills match your search criteria."
                : "No purchase bills found for this supplier."}
            </div>
          )}
        </div>
      </div>

      {/* Purchase Bill Details Modal (Reuse enhanced modal on bill click) */}
      <PurchaseBillDetailsModal
        bill={
          selectedBill
            ? {
              ...selectedBill,
              supplierName: supplier.name || selectedBill.supplierName,
              supplierPhone: supplier.phone ? formatPhoneNumber(supplier.phone) : selectedBill.supplierPhone,
              supplierCompany: supplier.companyName !== undefined ? supplier.companyName : selectedBill.supplierCompany,
            }
            : null
        }
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        salonName={salonName}
        onOpenPayNow={(bill) => {
          setSelectedBill(null);
          handleOpenPayNow(bill);
        }}
      />

      {/* Pay Now Settlement Dialog (Enriched to mirror SettleOrderModal) */}
      <SettlePurchaseBillModal
        bill={
          selectedPOForPayment
            ? {
              ...selectedPOForPayment,
              supplierName: supplier.name || selectedPOForPayment.supplierName,
              supplierPhone: supplier.phone ? formatPhoneNumber(supplier.phone) : selectedPOForPayment.supplierPhone,
              supplierCompany: supplier.companyName !== undefined ? supplier.companyName : selectedPOForPayment.supplierCompany,
            }
            : null
        }
        isOpen={Boolean(selectedPOForPayment)}
        onClose={() => setSelectedPOForPayment(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Reschedule PO Delivery / Due Date Modal */}
      <ReschedulePurchaseOrderModal
        po={reschedulingState?.po || null}
        mode={reschedulingState?.mode}
        isOpen={Boolean(reschedulingState)}
        onClose={() => setReschedulingState(null)}
        onRescheduleSuccess={handleRescheduleSuccess}
      />
    </div>
  );
}
