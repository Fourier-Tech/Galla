"use client";

import React, { useMemo } from "react";
import {
  X,
  Receipt,
  Truck,
  Building2,
  Phone,
  Package,
  Wallet,
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquare,
  Calendar,
  Clock,
  PackageCheck,
} from "lucide-react";
import {
  DashboardPurchaseOrder,
  DashboardPurchaseOrderPayment,
} from "@/types/dashboard";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  getBookingUrgency,
  getSupplierWhatsAppReminderUrl,
  formatDisplayNumber,
  getBillStatus,
} from "@/lib/utils";

function formatDateTime(dateStr?: string | Date | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return typeof dateStr === "string" ? dateStr : null;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return typeof dateStr === "string" ? dateStr : null;
  }
}

interface PurchaseBillDetailsModalProps {
  bill: DashboardPurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayNow?: (bill: DashboardPurchaseOrder) => void;
  salonName?: string;
}

export function PurchaseBillDetailsModal({
  bill,
  isOpen,
  onClose,
  onOpenPayNow,
  salonName,
}: PurchaseBillDetailsModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const resolvedPayments: DashboardPurchaseOrderPayment[] = useMemo(() => {
    if (!bill) return [];
    if (bill.payments && bill.payments.length > 0) {
      return bill.payments;
    }
    if (bill.amountPaid > 0) {
      return [
        {
          amount: bill.amountPaid,
          paymentMode: bill.paymentMode !== "credit" ? (bill.paymentMode as any) : "cash",
          notes: bill.notes,
          recordedBy: "owner",
          type: bill.amountPending <= 0 ? "full_payment" : "initial",
        },
      ];
    }
    return [];
  }, [bill]);

  const waUrl = useMemo(() => {
    if (!bill?.supplierPhone) return null;
    const billStatus = getBillStatus(bill);
    const isCompleted =
      billStatus.statusKey === "completed" ||
      bill.settlementMode === "completed" ||
      (bill.paymentStatus === "paid" && bill.stockAllocated !== false) ||
      (bill.amountPending <= 0 && bill.stockAllocated !== false);

    const hasPendingDelivery = !isCompleted && bill.stockAllocated === false;
    const isAdvance =
      hasPendingDelivery &&
      (bill.settlementMode === "advance" ||
        bill.settlementMode === "paid_full" ||
        Boolean(bill.expectedDeliveryDate) ||
        Boolean(bill.notes && /advance/i.test(bill.notes)));

    const deliveryDate = hasPendingDelivery
      ? bill.expectedDeliveryDate || (isAdvance ? bill.dueDate || bill.invoiceDate : undefined)
      : undefined;

    const itemsSummary =
      bill.items && bill.items.length > 0
        ? bill.items
            .map(
              (it) =>
                `${it.productName} (${(it.quantityForSell || 0) + (it.quantityForUse || 0)} pcs)`
            )
            .join(", ")
        : undefined;

    const reminderMode: "advance" | "payment_due" | "delivery" = isAdvance
      ? "advance"
      : bill.amountPending > 0
      ? "payment_due"
      : "delivery";

    return getSupplierWhatsAppReminderUrl({
      phone: bill.supplierPhone,
      supplierName: bill.supplierName,
      salonName: salonName,
      poNumber: bill.purchaseOrderNumber,
      dealerInvoiceNumber: bill.dealerInvoiceNumber,
      deliveryDate,
      deliveryTime: hasPendingDelivery ? bill.deliveryTime : undefined,
      dueDate: bill.amountPending > 0 ? bill.dueDate : undefined,
      totalAmount: bill.totalAmount,
      amountPaid: bill.amountPaid,
      amountPending: bill.amountPending,
      itemsSummary,
      items: bill.items,
      mode: reminderMode,
      isAdvance,
    });
  }, [bill, salonName]);

  if (!isOpen || !bill) return null;

  const dueAmount = Math.max(0, bill.amountPending);
  const isDue = dueAmount > 0;
  const isPaid = bill.paymentStatus === "paid" || dueAmount <= 0;
  const isPartial = !isPaid && bill.amountPaid > 0;

  const initials = bill.supplierName
    ? bill.supplierName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "S";

  const getPaymentBadge = (
    p: DashboardPurchaseOrderPayment,
    idx: number,
    total: number
  ) => {
    if (p.type === "initial") {
      return {
        label: "Initial / Stock In",
        style: "bg-amber-50 text-amber-800 border-amber-200/90",
      };
    }
    if (p.type === "settlement") {
      return {
        label: "Settlement",
        style: "bg-emerald-50 text-emerald-800 border-emerald-200/90",
      };
    }
    if (p.type === "full_payment") {
      return {
        label: "Full Payment",
        style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20",
      };
    }

    if (total > 1) {
      if (idx === 0) {
        return {
          label: "Initial / Stock In",
          style: "bg-amber-50 text-amber-800 border-amber-200/90",
        };
      }
      return {
        label: total > 2 ? `Settlement #${idx}` : "Settlement",
        style: "bg-emerald-50 text-emerald-800 border-emerald-200/90",
      };
    }

    if (isDue) {
      return {
        label: "Partial",
        style: "bg-amber-50 text-amber-800 border-amber-200/90",
      };
    }

    return {
      label: "Full Payment",
      style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20",
    };
  };

  const latestPayment = resolvedPayments.length > 0 ? resolvedPayments[resolvedPayments.length - 1] : null;
  const latestPaymentDate = formatDateTime(latestPayment?.recordedAt || bill.createdAt);

  const hasMultipleProducts = (bill.items?.length || 0) > 1;
  const totalUnits = (bill.items || []).reduce(
    (sum, item) => sum + (item.quantityForSell || 0) + (item.quantityForUse || 0),
    0
  );

  const itemsTotalCost =
    bill.items && bill.items.length > 0
      ? bill.items.reduce((sum, item) => {
          const qty = (item.quantityForSell || 0) + (item.quantityForUse || 0);
          const total = item.itemTotalCost || item.purchaseCost * (qty > 0 ? qty : 1);
          return sum + total;
        }, 0)
      : bill.totalAmount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div className="w-full max-w-[620px] bg-galla-surface border border-galla-line rounded-[10px] shadow-2xl transition-all max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header with Date & Time */}
        <div className="px-5 py-4 border-b border-galla-line/80 flex items-center justify-between bg-galla-paper/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-[6px] bg-galla-teal/10 border border-galla-teal/20 flex items-center justify-center text-galla-teal">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-[18px] text-galla-ink tracking-tight">
                  Bill {formatDisplayNumber(bill.purchaseOrderNumber)}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-sans px-2 py-0.5 rounded-[4px] border font-medium uppercase tracking-wider ${
                    isPaid
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : isPartial
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {isPaid ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span>{isPaid ? "Fully Settled" : isPartial ? "Partially Paid" : "Unpaid"}</span>
                </span>
              </div>
              <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                Purchase Bill &bull; {formatDateTime(bill.createdAt || bill.invoiceDate) || "Recorded"} &bull; {bill.dealerInvoiceNumber ? `Dealer Inv: #${bill.dealerInvoiceNumber}` : "Direct Stock In"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-galla-ink-soft hover:text-galla-ink p-1.5 rounded-[5px] hover:bg-galla-paper border border-transparent hover:border-galla-line transition-all cursor-pointer"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 font-sans text-galla-ink">
          {/* Supplier Card */}
          <div className="p-3.5 bg-galla-paper/50 border border-galla-line rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-galla-ink font-heading font-semibold text-[15px] shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Truck className="h-3.5 w-3.5 text-galla-ink-soft" />
                  <span className="font-sans font-semibold text-[15px] text-galla-ink">
                    {bill.supplierName}
                  </span>
                  {bill.supplierCompany && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-sans px-2 py-0.5 rounded bg-galla-surface border border-galla-line text-galla-ink-soft">
                      <Building2 className="h-3 w-3" />
                      <span>{bill.supplierCompany}</span>
                    </span>
                  )}
                </div>
                {bill.supplierPhone ? (
                  <div className="font-mono text-[12.5px] text-galla-ink-soft mt-0.5">
                    {formatPhoneNumber(bill.supplierPhone)}
                  </div>
                ) : (
                  <div className="text-[12px] text-galla-ink-soft/70 italic mt-0.5">
                    No phone recorded
                  </div>
                )}
              </div>
            </div>

            {bill.supplierPhone && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${bill.supplierPhone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-sans font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-teal hover:text-galla-teal transition-all shadow-2xs"
                  title={`Call ${bill.supplierName}`}
                >
                  <Phone className="h-3.5 w-3.5 text-galla-teal" />
                  <span>Call</span>
                </a>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-sans font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
                    title="Send inquiry to supplier via WhatsApp"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                    <span>WhatsApp Msg</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Date & Time Tracking Grid (Mirrors Order Modal structure with Date & Time) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Stock In / Bill Date */}
            <div className="p-3 bg-galla-paper/30 border border-galla-line rounded-[6px] flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-galla-teal shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
                  Stock In Date &amp; Time
                </span>
                <span className="text-[12.5px] font-medium text-galla-ink mt-0.5 block">
                  {formatDateTime(bill.createdAt || bill.invoiceDate) || "Recorded"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-galla-ink-soft/80 flex-wrap">
                  {bill.dealerInvoiceNumber ? (
                    <span>Vendor Inv #{bill.dealerInvoiceNumber}</span>
                  ) : (
                    <span>Direct Stock In</span>
                  )}
                  {bill.recordedBy && (
                    <span className="capitalize">&bull; Recorded by {bill.recordedBy}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bill Settlement Status Card with Date & Time */}
            {isPaid ? (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/90 rounded-[6px] flex items-start gap-2.5 text-emerald-950">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-emerald-900">
                      Payment Status
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                      Done
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-emerald-950">
                    Fully cleared &bull; ₹0 balance due
                  </span>
                  {latestPaymentDate && (
                    <span className="text-[11px] text-emerald-800/80 mt-0.5 block">
                      Settled: {latestPaymentDate}
                    </span>
                  )}
                </div>
              </div>
            ) : isPartial ? (
              <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-[6px] flex items-start gap-2.5 text-amber-950">
                <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-amber-900">
                      Payment Status
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300/80">
                      Pending
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-amber-950">
                    Remaining due: {formatRupee(dueAmount)}
                  </span>
                  {latestPaymentDate && (
                    <span className="text-[11px] text-amber-800/80 mt-0.5 block">
                      Last payment: {latestPaymentDate}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-[6px] flex items-start gap-2.5 text-rose-950">
                <AlertCircle className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-rose-900">
                      Payment Status
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300/80">
                      Credit
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-rose-950">
                    Full balance pending: {formatRupee(dueAmount)}
                  </span>
                  <span className="text-[11px] text-rose-800/80 mt-0.5 block">
                    Billed: {formatDateTime(bill.createdAt || bill.invoiceDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Settlement Mode & Dates Banner (If present) */}
          {(bill.dueDate || bill.expectedDeliveryDate || (bill.notes && /advance/i.test(bill.notes)) || bill.settlementMode) && (() => {
            const billStatus = getBillStatus(bill);
            const isCompleted =
              billStatus.statusKey === "completed" ||
              bill.settlementMode === "completed" ||
              (bill.paymentStatus === "paid" && bill.stockAllocated !== false) ||
              (dueAmount <= 0 && bill.stockAllocated !== false);

            const hasPendingDelivery = !isCompleted && bill.stockAllocated === false;
            const isAdvance =
              !isCompleted &&
              (bill.settlementMode === "advance" ||
                bill.settlementMode === "paid_full" ||
                bill.stockAllocated === false ||
                Boolean(bill.expectedDeliveryDate) ||
                Boolean(bill.notes && /advance/i.test(bill.notes)));

            const deliveryTarget = hasPendingDelivery
              ? bill.expectedDeliveryDate || (isAdvance ? bill.dueDate || bill.invoiceDate : undefined)
              : undefined;
            const deliveryUrgency = deliveryTarget ? getBookingUrgency(deliveryTarget) : null;
            const isDeliveryToday = hasPendingDelivery && deliveryUrgency?.tone === "today";
            const isDeliveryOverdue = hasPendingDelivery && deliveryUrgency?.tone === "overdue";

            const hasPendingDue = !isCompleted && dueAmount > 0;
            const dueTarget = hasPendingDue ? bill.dueDate : undefined;
            const dueUrgency = dueTarget ? getBookingUrgency(dueTarget) : null;
            const isDueToday = hasPendingDue && dueUrgency?.tone === "today";
            const isDueOverdue = hasPendingDue && dueUrgency?.tone === "overdue";

            return (
              <div className="p-3 bg-galla-paper/40 border border-galla-line rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-heading uppercase tracking-wider text-[11px] font-semibold text-galla-ink-soft">
                    Settlement Mode:
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-galla-surface border border-galla-line text-galla-ink">
                    {isCompleted
                      ? "Completed"
                      : bill.settlementMode === "pending"
                      ? "Pending / Payment Due"
                      : isAdvance
                      ? "Advance Order"
                      : bill.settlementMode === "paid_full"
                      ? "Paid in Full"
                      : "Completed"}
                  </span>
                  {bill.stockAllocated && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 inline-flex items-center gap-1">
                      <PackageCheck className="h-3 w-3 text-emerald-700" />
                      <span>Stock In Inventory</span>
                    </span>
                  )}
                  {isDeliveryToday && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                      🚨 Delivery Expected Today
                    </span>
                  )}
                  {isDeliveryOverdue && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                      ⚠️ Delivery Overdue
                    </span>
                  )}
                  {isDueToday && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                      🚨 Payment Due Today
                    </span>
                  )}
                  {isDueOverdue && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                      ⚠️ Payment Overdue
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {hasPendingDue && bill.dueDate && (
                    <div className="text-rose-700 font-medium font-sans">
                      Payment Due: <strong>{formatBookingDate(bill.dueDate)}</strong>
                    </div>
                  )}
                  {hasPendingDelivery && deliveryTarget && (
                    <div className="text-galla-teal font-medium font-sans">
                      Expected Arrival: <strong>{formatBookingDate(deliveryTarget)}</strong>
                      {bill.deliveryTime ? ` at ${formatAppointmentTime(bill.deliveryTime)}` : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Stock In Items Breakdown ("What we buy from supplier with Price, Qty, Total and Final Total") */}
          <div className="border border-galla-line rounded-[8px] overflow-hidden bg-galla-surface shadow-2xs">
            <div className="px-4 py-2.5 bg-galla-paper/60 border-b border-galla-line flex items-center justify-between">
              <span className="font-heading font-bold text-[12px] uppercase tracking-wider text-galla-ink-soft">
                Products Purchased ({bill.items?.length || bill.itemsCount || 1})
              </span>
              <span className="text-[11.5px] text-galla-ink-soft font-sans">
                Unit Price &bull; Qty &bull; Total
              </span>
            </div>

            {bill.items && bill.items.length > 0 ? (
              <div className="divide-y divide-galla-line/70">
                {bill.items.map((item, idx) => {
                  const totalQty = (item.quantityForSell || 0) + (item.quantityForUse || 0);
                  const lineTotal =
                    item.itemTotalCost || item.purchaseCost * (totalQty > 0 ? totalQty : 1);

                  return (
                    <div key={idx} className="p-3.5 hover:bg-galla-paper/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="h-4 w-4 text-blue-600 shrink-0" />
                            <span className="font-sans font-semibold text-[14px] text-galla-ink">
                              {item.productName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[12px] text-galla-ink-soft flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-galla-paper px-2 py-0.5 rounded border border-galla-line/70 text-galla-ink font-medium">
                              <span className="text-galla-ink-soft text-[11px]">Price:</span>
                              <strong className="font-mono text-galla-ink">{formatRupee(item.purchaseCost)}</strong>
                            </span>

                            <span className="inline-flex items-center gap-1 bg-galla-paper px-2 py-0.5 rounded border border-galla-line/70 text-galla-ink font-medium">
                              <span className="text-galla-ink-soft text-[11px]">Qty:</span>
                              <strong className="font-mono text-galla-ink">{totalQty} pcs</strong>
                            </span>

                            {item.quantityForSell > 0 && item.quantityForUse > 0 && (
                              <span className="text-[11px] text-galla-ink-soft">
                                ({item.quantityForSell} retail + {item.quantityForUse} salon)
                              </span>
                            )}
                            {item.quantityForSell > 0 && item.quantityForUse === 0 && (
                              <span className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                Retail Stock
                              </span>
                            )}
                            {item.quantityForUse > 0 && item.quantityForSell === 0 && (
                              <span className="text-[11px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                Salon Use
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-galla-ink-soft uppercase font-heading font-semibold tracking-wider">
                            Total
                          </div>
                          <div className="font-heading font-bold text-[14.5px] text-galla-ink tabular-nums">
                            {formatRupee(lineTotal)}
                          </div>
                          <div className="text-[11.5px] text-galla-ink-soft font-mono">
                            {totalQty} &times; {formatRupee(item.purchaseCost)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Final Total row if there are more than 1 product */}
                {hasMultipleProducts && (
                  <div className="px-4 py-3 bg-galla-paper/80 border-t border-galla-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-[12.5px] uppercase tracking-wider text-galla-ink">
                        Final Total ({bill.items.length} Products &bull; {totalUnits} Units)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-heading font-bold text-[15px] text-galla-ink tabular-nums">
                        {formatRupee(itemsTotalCost || bill.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-[13px] text-galla-ink-soft flex items-center justify-between">
                <span>Stock In Products</span>
                <span className="font-heading font-semibold text-galla-ink tabular-nums">
                  {formatRupee(bill.totalAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Payment & Financial Summary (With Detailed Payment Breakdown) */}
          <div className="p-4 bg-galla-paper/40 border border-galla-line rounded-[8px] space-y-2">
            <span className="block font-heading font-bold text-[12px] uppercase tracking-wider text-galla-ink-soft border-b border-galla-line/60 pb-1.5">
              Payment &amp; Financial Summary
            </span>

            {hasMultipleProducts && (
              <div className="flex justify-between text-[13px] text-galla-ink-soft">
                <span>Products Subtotal ({bill.items!.length} items):</span>
                <span className="tabular-nums font-mono">{formatRupee(itemsTotalCost)}</span>
              </div>
            )}

            <div className="flex justify-between text-[14px] font-heading font-semibold text-galla-ink pt-1">
              <span>{hasMultipleProducts ? "Final Total Bill Amount:" : "Total Bill Amount:"}</span>
              <span className="tabular-nums text-[16px]">{formatRupee(bill.totalAmount)}</span>
            </div>

            <div className="flex justify-between text-[13.5px] text-emerald-700 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                <span>Amount Paid:</span>
                {bill.paymentMode && (
                  <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.2 rounded bg-galla-paper text-galla-ink-soft border border-galla-line/60">
                    {bill.paymentMode}
                  </span>
                )}
              </span>
              <span className="tabular-nums font-mono">{formatRupee(bill.amountPaid)}</span>
            </div>

            {isDue ? (
              <div className="flex justify-between text-[13.5px] text-rose-700 font-semibold pt-1 border-t border-galla-line/40">
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Pending Due Balance:</span>
                </span>
                <span className="tabular-nums font-mono text-[15px]">{formatRupee(dueAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-[12.5px] text-emerald-800 font-medium pt-1 border-t border-galla-line/40">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Balance:</span>
                </span>
                <span>Fully Settled (₹0 Due)</span>
              </div>
            )}

            {/* Payment History Log (e.g. half payment done by cash and due done by UPI, with date & time) */}
            {resolvedPayments.length > 0 && (
              <div className="pt-2 border-t border-galla-line/60 space-y-1.5">
                <span className="text-[11px] font-heading uppercase tracking-wider text-galla-ink-soft block font-semibold">
                  Payment History ({resolvedPayments.length})
                </span>
                <div className="space-y-1">
                  {resolvedPayments.map((p, pIdx) => {
                    const badge = getPaymentBadge(p, pIdx, resolvedPayments.length);
                    return (
                      <div
                        key={pIdx}
                        className="flex items-center justify-between text-[11.5px] bg-galla-surface px-2.5 py-1.5 rounded border border-galla-line/60 text-galla-ink-soft"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0 ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                          <span>
                            <strong className="text-galla-ink font-semibold">
                              {formatRupee(p.amount)}
                            </strong>{" "}
                            via{" "}
                            <span className="uppercase font-medium text-galla-ink">
                              {p.paymentMode}
                            </span>
                            {p.recordedBy ? ` (${p.recordedBy})` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.notes && (
                            <span className="text-[11px] text-galla-ink-soft italic truncate max-w-[150px]">
                              {p.notes}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-galla-ink-soft/75">
                            {formatDateTime(p.recordedAt) || formatDateTime(bill.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Internal Remarks / Terms */}
          {bill.notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-[6px] flex items-start gap-2 text-[12px] text-amber-950">
              <FileText className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Notes &amp; Terms:</span>
                <p className="mt-0.5 leading-relaxed">{bill.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-galla-line bg-galla-paper/30 flex items-center justify-between shrink-0">
          <div className="text-[12px] text-galla-ink-soft">
            {isDue ? (
              <span className="text-amber-800 font-medium">
                Supplier has {formatRupee(dueAmount)} remaining due
              </span>
            ) : bill.stockAllocated === false ? (
              <span className="text-amber-800 font-medium">Paid in full &bull; Delivery awaiting settlement</span>
            ) : (
              <span className="text-emerald-700 font-medium">Bill is fully settled &amp; paid</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(isDue || bill.stockAllocated === false) && onOpenPayNow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPayNow(bill);
                }}
                className="px-3.5 py-1.5 rounded-[5px] text-[12.5px] font-sans font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
              >
                {isDue ? `Settle Bill (${formatRupee(dueAmount)})` : "Settle Bill"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-[5px] text-[13px] font-sans font-medium bg-galla-teal hover:opacity-95 text-white transition-opacity cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
