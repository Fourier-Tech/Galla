"use client";

import React, { useMemo } from "react";
import {
  X,
  ArrowLeft,
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
  RotateCcw,
} from "lucide-react";
import {
  DashboardPurchaseOrder,
  DashboardPurchaseOrderPayment,
  DashboardPurchaseOrderReturn,
} from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  formatRupee,
  formatPhoneNumber,
  formatBookingDate,
  formatAppointmentTime,
  getBookingUrgency,
  getSupplierWhatsAppReminderUrl,
  formatDisplayNumber,
  formatNoteDisplay,
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
  onOpenReschedule?: (bill: DashboardPurchaseOrder, mode: "delivery" | "due_date") => void;
  salonName?: string;
  zIndex?: string;
}

export function PurchaseBillDetailsModal({
  bill,
  isOpen,
  onClose,
  onOpenPayNow,
  onOpenReschedule,
  salonName,
  zIndex = "z-50",
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

  const returnEvents: DashboardPurchaseOrderReturn[] = useMemo(() => {
    if (!bill) return [];
    const directReturns = Array.isArray(bill.returns) ? [...bill.returns] : [];
    if (
      bill.notes &&
      /\[Defective Credit Settle\]|\[Return Due Deduction\]/i.test(bill.notes)
    ) {
      const regex1 =
        /\[Defective Credit Settle\]\s*Deducted\s*₹?([0-9,]+(?:\.[0-9]+)?)\s*(?:from due\s*)?for\s*(\d+)x\s*([^.\n]+)/gi;
      let match;
      while ((match = regex1.exec(bill.notes)) !== null) {
        const deducted = parseFloat(match[1].replace(/,/g, ""));
        const qty = parseInt(match[2], 10);
        const name = match[3].trim();
        if (
          !directReturns.some(
            (r) =>
              r.productName?.toLowerCase() === name.toLowerCase() &&
              r.quantity === qty,
          )
        ) {
          directReturns.push({
            returnNumber: `RET-${formatDisplayNumber(bill.purchaseOrderNumber)}`,
            productId: "",
            productName: name,
            quantity: qty,
            unitCost: Math.round(deducted / (qty || 1)),
            amountDeductedFromDue: deducted,
            totalRefundAmount: deducted,
            refundMode: "reduce_due",
            stockType: "defective",
            notes: "Recorded from stock in defective claim notes",
            returnedAt: bill.createdAt
              ? new Date(bill.createdAt).toISOString()
              : new Date().toISOString(),
          });
        }
      }
    }
    return directReturns;
  }, [bill]);

  const resolvedPayments: DashboardPurchaseOrderPayment[] = useMemo(() => {
    if (!bill) return [];
    const payments = Array.isArray(bill.payments) ? [...bill.payments] : [];
    const matchedPaymentIndices = new Set<number>();

    returnEvents.forEach((ret) => {
      const dueDed = ret.amountDeductedFromDue || 0;
      if (dueDed > 0) {
        const foundIdx = payments.findIndex(
          (p, idx) =>
            !matchedPaymentIndices.has(idx) &&
            (p.type === "return_due_deduction" ||
              p.paymentMode === "reduce_due") &&
            Math.abs(Math.abs(p.amount) - dueDed) < 0.01 &&
            (
              (ret.returnNumber && p.notes?.includes(ret.returnNumber)) ||
              (ret.returnedAt &&
                p.recordedAt &&
                Math.abs(new Date(p.recordedAt).getTime() - new Date(ret.returnedAt).getTime()) < 60000) ||
              p.notes?.includes(ret.productName) ||
              (p.notes?.includes("due") && p.notes?.includes("Return"))
            ),
        );
        if (foundIdx !== -1) {
          matchedPaymentIndices.add(foundIdx);
        } else {
          payments.push({
            amount: -dueDed,
            paymentMode: "reduce_due",
            notes:
              ret.notes ||
              `[Return Due Deduction] Deducted ${formatRupee(dueDed)} for ${ret.quantity}x ${ret.productName}`,
            type: "return_due_deduction",
            recordedAt: ret.returnedAt || bill.createdAt,
            recordedBy: (ret.recordedBy as "owner" | "staff") || "owner",
          });
        }
      }

      const totalVal =
        ret.totalRefundAmount || ret.quantity * (ret.unitCost || 0);
      const supplierCredit = Math.max(0, totalVal - dueDed);
      if (supplierCredit > 0 && ret.refundMode === "reduce_due") {
        const foundCreditIdx = payments.findIndex(
          (p, idx) =>
            !matchedPaymentIndices.has(idx) &&
            p.type === "supplier_credit" &&
            Math.abs(Math.abs(p.amount) - supplierCredit) < 0.01 &&
            (
              (ret.returnNumber && p.notes?.includes(ret.returnNumber)) ||
              (ret.returnedAt &&
                p.recordedAt &&
                Math.abs(new Date(p.recordedAt).getTime() - new Date(ret.returnedAt).getTime()) < 60000) ||
              p.notes?.includes(ret.productName)
            ),
        );
        if (foundCreditIdx !== -1) {
          matchedPaymentIndices.add(foundCreditIdx);
        } else {
          payments.push({
            amount: supplierCredit,
            paymentMode: "credit",
            notes: `[Supplier Balance Credit] Credited ${formatRupee(supplierCredit)} from return of ${ret.quantity}x ${ret.productName}`,
            type: "supplier_credit",
            recordedAt: ret.returnedAt || bill.createdAt,
            recordedBy: (ret.recordedBy as "owner" | "staff") || "owner",
          });
        }
      }
    });

    return payments;
  }, [bill, returnEvents]);

  const waUrl = useMemo(() => {
    if (!bill?.supplierPhone) return null;
    const itemsSummary = (bill.items || [])
      .map((item) => {
        const qty = (item.quantityForSell || 0) + (item.quantityForUse || 0);
        return `${item.productName} (${qty > 0 ? qty : 1} pcs @ ${formatRupee(item.purchaseCost)})`;
      })
      .join(", ");

    const billStatus = getBillStatus(bill);
    const isCompleted =
      billStatus.statusKey === "completed" ||
      bill.settlementMode === "completed" ||
      (bill.paymentStatus === "paid" && bill.stockAllocated !== false) ||
      (bill.amountPending <= 0 && bill.stockAllocated !== false);
    const hasPendingDelivery = !isCompleted && bill.stockAllocated === false;
    const isAdvance =
      !isCompleted &&
      (bill.settlementMode === "advance" ||
        bill.settlementMode === "paid_full" ||
        bill.stockAllocated === false ||
        Boolean(bill.expectedDeliveryDate) ||
        Boolean(bill.notes && /advance/i.test(bill.notes)));

    let reminderMode: "delivery" | "advance" | "payment_due" | undefined = undefined;
    if (hasPendingDelivery) {
      reminderMode = "delivery";
    } else if (bill.amountPending > 0) {
      reminderMode = isAdvance ? "advance" : "payment_due";
    }

    return getSupplierWhatsAppReminderUrl({
      phone: bill.supplierPhone,
      supplierName: bill.supplierName,
      salonName: salonName || "our salon",
      poNumber: bill.purchaseOrderNumber,
      dealerInvoiceNumber: bill.dealerInvoiceNumber,
      deliveryDate: bill.expectedDeliveryDate,
      deliveryTime: bill.deliveryTime,
      dueDate: bill.dueDate,
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

  const hasReturns = returnEvents.length > 0;

  const totalDueDeductions = returnEvents.reduce(
    (sum, r) => sum + (r.amountDeductedFromDue || 0),
    0,
  );

  const totalSupplierCredits = returnEvents.reduce((sum, r) => {
    if (r.refundMode !== "reduce_due") return sum;
    const due = r.amountDeductedFromDue || 0;
    const total = r.totalRefundAmount || (r.quantity * (r.unitCost || 0));
    return sum + Math.max(0, total - due);
  }, 0);

  const originalAmountPaid =
    resolvedPayments && resolvedPayments.length > 0
      ? resolvedPayments
          .filter(
            (p) =>
              p.type !== "refund" &&
              p.type !== "return_due_deduction" &&
              p.paymentMode !== "reduce_due" &&
              p.amount > 0,
          )
          .reduce((sum, p) => sum + p.amount, 0)
      : bill.amountPaid;

  const itemsTotalCost =
    bill.items && bill.items.length > 0
      ? bill.items.reduce((sum, item) => {
          const qty = (item.quantityForSell || 0) + (item.quantityForUse || 0);
          return sum + item.purchaseCost * (qty > 0 ? qty : 1);
        }, 0)
      : bill.totalAmount;

  const originalBillAmount = Math.max(bill.totalAmount, itemsTotalCost);

  const initials = bill.supplierName
    ? bill.supplierName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "S";

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
    ? bill.expectedDeliveryDate
    : undefined;
  const deliveryUrgency = deliveryTarget
    ? getBookingUrgency(deliveryTarget)
    : null;
  const isDeliveryToday =
    hasPendingDelivery && deliveryUrgency?.tone === "today";
  const isDeliveryOverdue =
    hasPendingDelivery && deliveryUrgency?.tone === "overdue";

  const hasPendingDue = !isCompleted && dueAmount > 0;
  const dueTarget = hasPendingDue ? bill.dueDate : undefined;
  const dueUrgency = dueTarget ? getBookingUrgency(dueTarget) : null;
  const isDueToday = hasPendingDue && dueUrgency?.tone === "today";
  const isDueOverdue = hasPendingDue && dueUrgency?.tone === "overdue";

  const getPaymentBadge = (
    p: DashboardPurchaseOrderPayment,
    idx: number,
    total: number,
  ) => {
    if (p.type === "supplier_credit") {
      return {
        label: "Return (Supplier Credit)",
        style: "bg-emerald-50 text-emerald-800 border-emerald-200/90",
      };
    }
    if (p.type === "return_due_deduction" || p.paymentMode === "reduce_due") {
      return {
        label: "Return (Due Deducted)",
        style: "bg-purple-50 text-purple-800 border-purple-200/90",
      };
    }
    if (p.type === "refund") {
      return {
        label: "Refund",
        style: "bg-rose-50 text-rose-800 border-rose-200/90",
      };
    }
    if (p.amount != null && p.amount < 0) {
      return {
        label: "Refund / Deduction",
        style: "bg-rose-50 text-rose-800 border-rose-200/90",
      };
    }
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

    if (idx === 0) {
      return {
        label: "Advance / Initial",
        style: "bg-amber-50 text-amber-800 border-amber-200/90",
      };
    }

    if (idx === total - 1 && isPaid) {
      return {
        label: "Full Settlement",
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

  const latestPayment =
    resolvedPayments.length > 0
      ? resolvedPayments[resolvedPayments.length - 1]
      : null;
  const latestPaymentDate = formatDateTime(
    latestPayment?.recordedAt || bill.createdAt,
  );

  const hasMultipleProducts = (bill.items?.length || 0) > 1;
  const totalUnits = (bill.items || []).reduce(
    (sum, item) =>
      sum + (item.quantityForSell || 0) + (item.quantityForUse || 0),
    0,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} bg-galla-paper flex flex-col overflow-y-auto font-sans text-galla-ink animate-in fade-in duration-200`}
    >
      {/* ======================================================== */}
      {/* TOP STICKY HEADER                                        */}
      {/* TOP HEADER (Sticky)                                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-20 bg-galla-surface/95 backdrop-blur-md border-b border-galla-line px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Back to purchase orders"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[17px] font-bold text-galla-ink tracking-tight">
                Bill #{formatDisplayNumber(bill.purchaseOrderNumber)}
              </h1>
              <StatusPill
                status={billStatus.pillStatus}
                customLabel={billStatus.label}
              />
            </div>
            <p className="text-[12px] text-galla-ink-soft truncate">
              Purchase Bill &bull; {formatDateTime(bill.createdAt || bill.invoiceDate) || "Recorded"} &bull;{" "}
              {bill.dealerInvoiceNumber ? `Vendor Inv: #${bill.dealerInvoiceNumber}` : "Direct Stock In"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* ======================================================== */}
      {/* MAIN TWO-COLUMN LAYOUT                                   */}
      {/* ======================================================== */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start flex-1">
        {/* ====================================================== */}
        {/* LEFT COLUMN: SUPPLIER, TIMELINE, ITEMS & RETURNS       */}
        {/* ====================================================== */}
        <main className="space-y-6 min-w-0 order-1">
          {/* Card 1: Supplier Details */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Supplier Details
                </h2>
              </div>
              <div className="text-[12px] text-galla-ink-soft">
                {bill.dealerInvoiceNumber
                  ? `Vendor Inv: #${bill.dealerInvoiceNumber}`
                  : "Direct Stock In"}
              </div>
            </div>

            <div className="p-4 bg-galla-paper/40 border border-galla-line/70 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-galla-teal-soft border border-galla-teal/30 flex items-center justify-center text-galla-teal font-bold text-[16px] shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[16px] text-galla-ink">
                      {bill.supplierName}
                    </span>
                    {bill.supplierCompany && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-[4px] bg-galla-surface border border-galla-line text-galla-ink-soft">
                        <Building2 className="h-3 w-3" />
                        <span>{bill.supplierCompany}</span>
                      </span>
                    )}
                  </div>
                  {bill.supplierPhone ? (
                    <div className="tabular-nums text-[13px] text-galla-ink-soft mt-0.5 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-galla-teal" />
                      <span>{formatPhoneNumber(bill.supplierPhone)}</span>
                    </div>
                  ) : (
                    <div className="text-[12px] text-galla-ink-soft/70 italic mt-0.5">
                      No phone number recorded
                    </div>
                  )}
                </div>
              </div>

              {bill.supplierPhone && (
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${bill.supplierPhone.replace(/\D/g, "")}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12.5px] font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-teal hover:text-galla-teal transition-all shadow-2xs"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12.5px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
                      title="Send inquiry to supplier via WhatsApp"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                      <span>WhatsApp Msg</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Timeline & Status Tracking */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Timeline &amp; Status Tracking
                </h2>
              </div>
              <div className="text-[12px] text-galla-ink-soft font-medium">
                {isCompleted
                  ? "Completed"
                  : bill.settlementMode === "pending"
                    ? "Pending / Payment Due"
                    : isAdvance
                      ? "Advance Order"
                      : bill.settlementMode === "paid_full"
                        ? "Paid in Full"
                        : "Completed"}
              </div>
            </div>

            {/* 3 Status/Timeline Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Block 1: Stock In Date */}
              <div className="p-3.5 bg-galla-paper/40 border border-galla-line/70 rounded-[6px] space-y-1">
                <span className="text-[11.5px] font-medium text-galla-ink-soft flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-galla-teal" />
                  <span>Stock In Date &amp; Time</span>
                </span>
                <div className="text-[13px] font-bold text-galla-ink">
                  {formatDateTime(bill.createdAt || bill.invoiceDate) || "Recorded"}
                </div>
                <div className="text-[11px] text-galla-ink-soft">
                  {bill.recordedBy ? `Recorded by ${bill.recordedBy}` : "Recorded in system"}
                </div>
              </div>

              {/* Block 2: Physical Inventory Status */}
              <div className="p-3.5 bg-galla-paper/40 border border-galla-line/70 rounded-[6px] space-y-1">
                <span className="text-[11.5px] font-medium text-galla-ink-soft flex items-center gap-1">
                  <PackageCheck className="h-3.5 w-3.5 text-galla-teal" />
                  <span>Inventory Stock</span>
                </span>
                <div>
                  {bill.stockAllocated ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>Stock In Inventory</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span>Awaiting Delivery</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-galla-ink-soft">
                  {bill.stockAllocated ? "Products added to inventory" : "Delivery pending from supplier"}
                </div>
              </div>

              {/* Block 3: Payment Status */}
              <div className={`p-3.5 rounded-[6px] border space-y-1 ${
                isPaid
                  ? "bg-emerald-50/50 border-emerald-200/80"
                  : isPartial
                    ? "bg-amber-50/50 border-amber-200/80"
                    : "bg-rose-50/50 border-rose-200/80"
              }`}>
                <span className="text-[11.5px] font-medium text-galla-ink-soft flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-galla-teal" />
                  <span>Payment Status</span>
                </span>
                <div className="text-[13px] font-bold">
                  {isPaid ? (
                    <span className="text-emerald-800">Fully Settled</span>
                  ) : isPartial ? (
                    <span className="text-amber-800">Partially Paid ({formatRupee(dueAmount)} due)</span>
                  ) : (
                    <span className="text-rose-800">Full Pending ({formatRupee(dueAmount)} due)</span>
                  )}
                </div>
                <div className="text-[11px] text-galla-ink-soft">
                  {latestPaymentDate ? `Last payment: ${latestPaymentDate}` : `Billed: ${formatDateTime(bill.createdAt || bill.invoiceDate)}`}
                </div>
              </div>
            </div>

            {/* Delivery / Due Date Alerts & Targets */}
            {(isDeliveryToday || isDeliveryOverdue || isDueToday || isDueOverdue || deliveryTarget || (hasPendingDue && bill.dueDate)) && (
              <div className="p-3.5 bg-galla-paper/40 border border-galla-line/80 rounded-[6px] space-y-2">
                {/* Urgent badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isDeliveryToday && (
                    <span className="px-2.5 py-1 rounded-[4px] text-[11.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                      🚨 Delivery Expected Today
                    </span>
                  )}
                  {isDeliveryOverdue && (
                    <span className="px-2.5 py-1 rounded-[4px] text-[11.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                      ⚠️ Delivery Overdue
                    </span>
                  )}
                  {isDueToday && (
                    <span className="px-2.5 py-1 rounded-[4px] text-[11.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                      🚨 Payment Due Today
                    </span>
                  )}
                  {isDueOverdue && (
                    <span className="px-2.5 py-1 rounded-[4px] text-[11.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                      ⚠️ Payment Overdue
                    </span>
                  )}
                </div>

                {/* Date tracking & edit actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px] pt-1">
                  {hasPendingDelivery && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-galla-teal shrink-0" />
                      <span>
                        Expected Arrival:{" "}
                        <strong className="text-galla-ink">
                          {deliveryTarget ? formatBookingDate(deliveryTarget) : "Not set"}
                        </strong>
                        {bill.deliveryTime ? ` at ${formatAppointmentTime(bill.deliveryTime)}` : ""}
                      </span>
                      {onOpenReschedule && (
                        <button
                          type="button"
                          onClick={() => onOpenReschedule(bill, "delivery")}
                          className="text-[11.5px] font-medium text-galla-teal hover:underline cursor-pointer ml-1"
                        >
                          {deliveryTarget ? "Edit" : "+ Set Date"}
                        </button>
                      )}
                    </div>
                  )}

                  {hasPendingDue && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>
                        Payment Due:{" "}
                        <strong className="text-galla-ink">
                          {bill.dueDate ? formatBookingDate(bill.dueDate) : "Not set"}
                        </strong>
                      </span>
                      {onOpenReschedule && (
                        <button
                          type="button"
                          onClick={() => onOpenReschedule(bill, "due_date")}
                          className="text-[11.5px] font-medium text-amber-800 hover:underline cursor-pointer ml-1"
                        >
                          {bill.dueDate ? "Edit" : "+ Set Due Date"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Card 3: Stock Items Purchased */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Stock Items Purchased
                </h2>
              </div>
              <div className="text-[12px] text-galla-ink-soft">
                {bill.items?.length || 0} {bill.items?.length === 1 ? "Product" : "Products"} &bull; {totalUnits} {totalUnits === 1 ? "Unit" : "Units"}
              </div>
            </div>

            <div className="space-y-2.5">
              {bill.items && bill.items.length > 0 ? (
                bill.items.map((item, idx) => {
                  const purchasedQty = (item.quantityForSell || 0) + (item.quantityForUse || 0) || 1;
                  const itemReturnRecords = returnEvents.filter(
                    (ret) =>
                      ret.productId === item.productId ||
                      (ret.productName && ret.productName.toLowerCase() === item.productName.toLowerCase()),
                  );
                  const isReplacementReturn = (ret: any) =>
                    ret.refundMode === "replacement_pending";

                  const replacedQty = itemReturnRecords.length > 0
                    ? itemReturnRecords
                        .filter((ret) => isReplacementReturn(ret))
                        .reduce((sum, r) => sum + (r.quantity || 0), 0)
                    : (item.replacedQuantity || 0);

                  const returnedQty = itemReturnRecords.length > 0
                    ? itemReturnRecords
                        .filter((ret) => !isReplacementReturn(ret))
                        .reduce((sum, r) => sum + (r.quantity || 0), 0)
                    : (item.returnedQuantity || 0);

                  const isFullyReturned = returnedQty >= purchasedQty;

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-galla-paper/30 border border-galla-line/80 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-galla-teal/40 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="h-7 w-7 rounded-[5px] bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <span
                            className={`font-semibold text-[14.5px] ${isFullyReturned ? "text-galla-ink-soft line-through" : "text-galla-ink"}`}
                          >
                            {item.productName}
                          </span>
                          {returnedQty > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-rose-50 text-rose-700 border border-rose-200">
                              {returnedQty} Returned
                            </span>
                          )}
                          {replacedQty > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-blue-50 text-blue-700 border border-blue-200">
                              {replacedQty} Replaced
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[12px] text-galla-ink-soft flex-wrap pl-9">
                          <span className="inline-flex items-center gap-1 bg-galla-paper px-2 py-0.5 rounded-[4px] border border-galla-line/70 text-galla-ink font-medium">
                            <span className="text-galla-ink-soft text-[11px]">Price:</span>
                            <strong className="tabular-nums text-galla-ink">{formatRupee(item.purchaseCost)}</strong>
                          </span>

                          <span className="inline-flex items-center gap-1 bg-galla-paper px-2 py-0.5 rounded-[4px] border border-galla-line/70 text-galla-ink font-medium">
                            <span className="text-galla-ink-soft text-[11px]">Qty:</span>
                            <strong className="tabular-nums text-galla-ink">{purchasedQty} pcs</strong>
                          </span>

                          {item.quantityForSell > 0 && item.quantityForUse > 0 && (
                            <span className="text-[11.5px] text-galla-ink-soft">
                              ({item.quantityForSell} retail + {item.quantityForUse} salon)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-9 sm:pl-0">
                        <div className="text-[11px] text-galla-ink-soft font-medium">Line Total</div>
                        <div className="text-[16px] font-bold text-galla-ink tabular-nums">
                          {formatRupee(purchasedQty * item.purchaseCost)}
                        </div>
                        <div className="text-[11.5px] text-galla-ink-soft tabular-nums">
                          {purchasedQty} &times; {formatRupee(item.purchaseCost)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-[13px] text-galla-ink-soft flex items-center justify-between">
                  <span>Stock In Products</span>
                  <span className="text-[15px] font-semibold text-galla-ink tabular-nums">
                    {formatRupee(itemsTotalCost)}
                  </span>
                </div>
              )}

              {/* Subtotal Row */}
              {hasMultipleProducts && (
                <div className="p-3.5 bg-galla-paper/60 border border-galla-line/80 rounded-[6px] flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-galla-ink">
                    Products Subtotal ({bill.items?.length} Products &bull; {totalUnits} Units)
                  </span>
                  <span className="text-[16px] font-bold text-galla-ink tabular-nums">
                    {formatRupee(itemsTotalCost || bill.totalAmount)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Card 4: Item Returns & Replacements History Log */}
          {hasReturns && (
            <section className="bg-galla-surface border border-rose-200 rounded-[8px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-rose-700" />
                  <h2 className="text-[14px] font-bold text-rose-950 uppercase tracking-wider">
                    Item Returns &amp; Replacements ({returnEvents.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {totalDueDeductions > 0 && (
                    <span className="text-[11.5px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-[4px]">
                      Due Adjusted: -{formatRupee(totalDueDeductions)}
                    </span>
                  )}
                  {totalSupplierCredits > 0 && (
                    <span className="text-[11.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[4px]">
                      Supplier Credit: +{formatRupee(totalSupplierCredits)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {returnEvents.map((ret, rIdx) => {
                  const stockTypeBadge = (() => {
                    if (ret.stockType === "sell") {
                      return {
                        label: "Retail Shelf",
                        style: "bg-blue-50 text-blue-700 border-blue-200",
                      };
                    }
                    if (ret.stockType === "use") {
                      return {
                        label: "Salon Use",
                        style: "bg-purple-50 text-purple-700 border-purple-200",
                      };
                    }
                    if (ret.stockType === "defective") {
                      return {
                        label: "Defective Stock",
                        style: "bg-rose-50 text-rose-700 border-rose-200",
                      };
                    }
                    return {
                      label: "Mixed Locations",
                      style: "bg-amber-50 text-amber-700 border-amber-200",
                    };
                  })();

                  const isReplacement = ret.refundMode === "replacement_pending";

                  return (
                    <div
                      key={rIdx}
                      className={`p-3.5 rounded-[6px] border text-[12.5px] space-y-2 ${
                        isReplacement
                          ? "bg-blue-50/20 border-blue-200/80"
                          : "bg-rose-50/30 border-rose-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-galla-ink text-[13.5px]">
                            {ret.quantity}x {ret.productName}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                              isReplacement
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {isReplacement ? "Replacement" : "Return"}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] border ${stockTypeBadge.style}`}>
                            {stockTypeBadge.label}
                          </span>
                        </div>
                        <span className="tabular-nums text-[11.5px] text-galla-ink-soft shrink-0">
                          {ret.returnedAt ? formatDateTime(ret.returnedAt) : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap text-[12px] text-galla-ink-soft">
                        <span>
                          Resolution:{" "}
                          <strong className="text-galla-ink font-medium">
                            {isReplacement
                              ? (() => {
                                  const isSalon = ret.notes?.toLowerCase().includes("salon use");
                                  const isRetail = ret.notes?.toLowerCase().includes("retail");
                                  if (isSalon) return "Replaced with New Stock (Salon Use)";
                                  if (isRetail) return "Replaced with New Stock (Retail Shelf)";
                                  return "Replaced with New Stock";
                                })()
                              : ret.refundMode === "reduce_due"
                                ? (() => {
                                    const due = ret.amountDeductedFromDue || 0;
                                    const total = ret.totalRefundAmount || (ret.quantity * (ret.unitCost || 0));
                                    const credit = Math.max(0, total - due);
                                    if (due > 0 && credit > 0) {
                                      return `Deducted ${formatRupee(due)} from due + ${formatRupee(credit)} credited to supplier balance`;
                                    }
                                    if (due > 0) {
                                      return `Deducted ${formatRupee(due)} from pending due`;
                                    }
                                    return `Credited ${formatRupee(total)} to supplier balance (Bill was fully paid)`;
                                  })()
                                : `Refunded ${formatRupee(ret.totalRefundAmount)} via ${(ret.refundMode || "cash").toUpperCase()}`}
                          </strong>
                        </span>
                        {ret.unitCost > 0 && (
                          <span>
                            &bull; Value:{" "}
                            <span className="tabular-nums font-semibold text-galla-ink">
                              {formatRupee(ret.totalRefundAmount || ret.quantity * ret.unitCost)}
                            </span>{" "}
                            <span className="text-[11px]">
                              ({ret.quantity} &times; {formatRupee(ret.unitCost)})
                            </span>
                          </span>
                        )}
                        {ret.recordedBy && (
                          <span className="capitalize">
                            &bull; By {ret.recordedBy}
                          </span>
                        )}
                      </div>

                      {(() => {
                        const displayNote = ret.notes
                          ? ret.notes
                              .replace(/₹\d+(?:\.\d+)?\s+received\s+via\s+[A-Za-z_-]+(?:\.|\s|$)/gi, "")
                              .replace(/₹\d+(?:\.\d+)?\s+deducted\s+from\s+bill\s+due(?:\.|\s|$)/gi, "")
                              .replace(/₹\d+(?:\.\d+)?\s+added\s+as\s+supplier\s+credit(?:\.|\s|$)/gi, "")
                              .replace(/\[Stock\s+Replaced\]\s*Received[^\n\r.]*(?:\.|$)/gi, "")
                              .replace(/^[\s.,-]+|[\s.,-]+$/g, "")
                              .trim()
                          : "";
                        if (!displayNote) return null;
                        return (
                          <div className="text-[12px] text-galla-ink-soft bg-galla-surface p-2 rounded-[4px] border border-galla-line/60 whitespace-pre-wrap break-words">
                            {formatNoteDisplay(displayNote)}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Card 5: Internal Remarks / Terms */}
          {bill.notes && (
            <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-700" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Notes &amp; Terms
                </h2>
              </div>
              <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-[6px] text-[12.5px] text-amber-950 leading-relaxed whitespace-pre-wrap break-words">
                {formatNoteDisplay(bill.notes)}
              </div>
            </section>
          )}
        </main>

        {/* ====================================================== */}
        {/* RIGHT COLUMN: FINANCIAL BREAKDOWN, PAYMENTS & ACTIONS   */}
        {/* ====================================================== */}
        <aside className="space-y-6 order-2 lg:sticky lg:top-[76px]">
          {/* Card 1: Bill & Settlement Summary */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Bill &amp; Settlement
                </h2>
              </div>
              <StatusPill
                status={billStatus.pillStatus}
                customLabel={billStatus.label}
              />
            </div>

            <div className="space-y-2.5 text-[13px] pt-1">
              <div className="flex justify-between text-galla-ink-soft">
                <span>Products Subtotal:</span>
                <span className="tabular-nums font-semibold text-galla-ink">
                  {formatRupee(itemsTotalCost)}
                </span>
              </div>

              {Boolean(bill.ledgerAdjustment) && bill.ledgerAdjustment !== 0 && (
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>
                    {bill.ledgerAdjustment! > 0 ? "Credit Applied:" : "Old Dues Paid:"}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {formatRupee(Math.abs(bill.ledgerAdjustment!))}
                  </span>
                </div>
              )}

              {totalDueDeductions > 0 && (
                <div className="flex justify-between text-purple-700 font-medium">
                  <span>Returns (Due Deductions):</span>
                  <span className="tabular-nums font-semibold">
                    -{formatRupee(totalDueDeductions)}
                  </span>
                </div>
              )}

              {totalSupplierCredits > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Returns (Supplier Credit):</span>
                  <span className="tabular-nums font-semibold">
                    +{formatRupee(totalSupplierCredits)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-galla-line flex justify-between items-baseline">
                <span className="font-bold text-[14px] text-galla-ink">Total Bill:</span>
                <span className="tabular-nums font-bold text-[18px] text-galla-ink">
                  {formatRupee(originalBillAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-emerald-700 font-medium pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Amount Paid:</span>
                  {bill.paymentMode && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-[4px] bg-galla-paper text-galla-ink-soft border border-galla-line/60 uppercase">
                      {bill.paymentMode}
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-bold text-[15px]">
                  {formatRupee(originalAmountPaid || bill.amountPaid)}
                </span>
              </div>

              {/* Balance Due / Fully Settled Box */}
              {isDue ? (
                <div className="p-3.5 rounded-[6px] bg-rose-50 border border-rose-200 space-y-1">
                  <div className="flex justify-between items-center text-rose-800">
                    <span className="font-bold text-[13px] flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      <span>Balance Due:</span>
                    </span>
                    <span className="tabular-nums font-bold text-[18px] text-rose-700">
                      {formatRupee(dueAmount)}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-rose-800/80">
                    Supplier payment pending
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-800">
                  <span className="font-bold text-[13px] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Payment Status:</span>
                  </span>
                  <span className="font-bold text-[13.5px]">
                    Fully Cleared (₹0 Due)
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Payment History Log */}
          {resolvedPayments.length > 0 && (
            <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-galla-teal" />
                  <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                    Payment History
                  </h2>
                </div>
                <span className="text-[12px] text-galla-ink-soft font-semibold">
                  {resolvedPayments.length} {resolvedPayments.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              <div className="space-y-2">
                {resolvedPayments.map((p, pIdx) => {
                  const badge = getPaymentBadge(p, pIdx, resolvedPayments.length);
                  const isSupplierCredit = p.type === "supplier_credit";
                  const isDueDeduction = p.type === "return_due_deduction" || (!isSupplierCredit && p.paymentMode === "reduce_due");
                  const isNegative = (p.amount != null && p.amount < 0) || p.type === "refund";

                  return (
                    <div
                      key={pIdx}
                      className="p-3 bg-galla-paper/30 border border-galla-line/70 rounded-[6px] space-y-1.5 text-[12.5px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] border ${badge.style}`}>
                            {badge.label}
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              isSupplierCredit
                                ? "text-emerald-700"
                                : isDueDeduction
                                ? "text-purple-700"
                                : isNegative
                                ? "text-rose-700"
                                : "text-galla-ink"
                            }`}
                          >
                            {isSupplierCredit
                              ? `+${formatRupee(Math.abs(p.amount))}`
                              : isDueDeduction
                              ? `-${formatRupee(Math.abs(p.amount))}`
                              : formatRupee(p.amount)}
                          </span>
                        </div>
                        <span className="text-[11px] text-galla-ink-soft tabular-nums">
                          {formatDateTime(p.recordedAt) || formatDateTime(bill.createdAt)}
                        </span>
                      </div>

                      <div className="text-[11.5px] text-galla-ink-soft flex items-center gap-2 flex-wrap">
                        {isSupplierCredit ? (
                          <span className="text-emerald-700 font-medium">credited to supplier balance</span>
                        ) : isDueDeduction ? (
                          <span className="text-purple-700 font-medium">adjusted in bill due</span>
                        ) : (
                          <span>
                            via <strong className="uppercase text-galla-ink">{p.paymentMode}</strong>
                          </span>
                        )}
                        {p.recordedBy && <span>&bull; Recorded by {p.recordedBy}</span>}
                      </div>

                      {p.notes && (
                        <div className="text-[11.5px] text-galla-ink-soft bg-galla-surface p-2 rounded-[4px] border border-galla-line/50 mt-1 whitespace-pre-wrap break-words">
                          {formatNoteDisplay(p.notes)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Card 3: Action Buttons */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-3">
            <div className="text-[12px] text-galla-ink-soft pb-1">
              {isDue ? (
                <span className="text-amber-800 font-medium">
                  Supplier has {formatRupee(dueAmount)} remaining due
                </span>
              ) : bill.stockAllocated === false ? (
                <span className="text-amber-800 font-medium">
                  Paid in full &bull; Delivery awaiting settlement
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">
                  Bill is fully settled &amp; paid
                </span>
              )}
            </div>

            {/* Primary Action Button */}
            {(isDue || bill.stockAllocated === false) && onOpenPayNow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPayNow(bill);
                }}
                className="w-full py-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[14px] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isDue ? `Settle Bill (${formatRupee(dueAmount)})` : "Settle Bill"}
                </span>
              </button>
            )}

            {/* Secondary Buttons Row */}
            {onOpenReschedule && (hasPendingDelivery || hasPendingDue) && (
              <div className="flex items-center gap-2">
                {hasPendingDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenReschedule(bill, "delivery");
                    }}
                    className="flex-1 py-2 rounded-[5px] text-[12.5px] font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-ink-soft hover:bg-galla-paper/50 transition-colors cursor-pointer text-center"
                  >
                    {deliveryTarget ? "Reschedule Delivery" : "Set Delivery Date"}
                  </button>
                )}

                {hasPendingDue && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenReschedule(bill, "due_date");
                    }}
                    className="flex-1 py-2 rounded-[5px] text-[12.5px] font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-ink-soft hover:bg-galla-paper/50 transition-colors cursor-pointer text-center"
                  >
                    {bill.dueDate ? "Change Due Date" : "Set Due Date"}
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-[5px] border border-galla-line hover:bg-galla-paper text-galla-ink font-semibold text-[13px] transition-colors cursor-pointer"
            >
              Close
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
