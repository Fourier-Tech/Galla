"use client";

import React from "react";
import {
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Scissors,
  Package,
  FileText,
  RotateCcw,
  Receipt,
  Wallet,
  Undo2,
  ArrowLeft,
  X,
} from "lucide-react";
import { DashboardOrder } from "@/types/dashboard";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  formatRupee,
  formatBookingDate,
  formatAppointmentTime,
  formatPhoneNumber,
  getWhatsAppReminderUrl,
  getBookingUrgency,
  formatDisplayNumber,
  canOrderBeRefunded,
} from "@/lib/utils";
import { ReturnCustomerOrderItemModal } from "@/components/dashboard/modals/return-customer-order-item-modal";
import { useState } from "react";

interface OrderDetailsModalProps {
  order: DashboardOrder | null;
  isOpen: boolean;
  onClose: () => void;
  salonName?: string;
  onOpenSettle?: (order: DashboardOrder) => void;
  onOpenReschedule?: (order: DashboardOrder) => void;
  onOpenRefund?: (order: DashboardOrder) => void;
  zIndex?: string;
}

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  salonName,
  onOpenSettle,
  onOpenReschedule,
  onOpenRefund,
  zIndex = "z-50",
}: OrderDetailsModalProps) {
  const [returningItemIndex, setReturningItemIndex] = useState<number | null>(null);

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

  if (!isOpen || !order) return null;

  // Event-wise Returns Aggregation
  const returnEvents = Array.isArray(order.returns) ? order.returns : [];
  const hasReturns = returnEvents.length > 0;

  const totalReturnRefundAmount = returnEvents
    .filter((r) => r.customerResolution === "refund")
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  const totalCashRefund = returnEvents.reduce((sum, r) => {
    const explicit = r.cashRefund;
    if (typeof explicit === "number") return sum + explicit;
    return sum + (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? r.refundAmount || 0 : 0);
  }, 0);

  // Original Checkout Values (untouched permanent record)
  const originalSubtotal =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems.reduce(
          (sum, item) => sum + item.unitPrice * (item.quantity || 1),
          0
        )
      : typeof order.subtotal === "number"
      ? order.subtotal
      : order.amount;

  const totalUnits = (order.lineItems || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );

  const originalDiscountAmount = order.discountAmount || 0;

  const originalBillAmount =
    order.lineItems && order.lineItems.length > 0
      ? Math.max(
          order.lineItems.reduce(
            (sum, item) =>
              sum +
              (typeof item.finalPrice === "number"
                ? item.finalPrice
                : item.unitPrice * (item.quantity || 1)),
            0
          ),
          order.amount
        )
      : order.amount;

  const positivePayments = (order.payments || [])
    .filter((p) => p.amount > 0 && p.type !== "refund")
    .reduce((sum, p) => sum + p.amount, 0);

  const originalAmountPaid =
    positivePayments > 0 ? positivePayments : (order.paid || 0) + totalCashRefund;

  // Net Computed Values after Return Events
  const netBillAmount = Math.max(0, originalBillAmount - totalReturnRefundAmount);
  const netAmountPaid = Math.max(0, originalAmountPaid - totalCashRefund);
  const balanceDue = Math.max(0, netBillAmount - netAmountPaid);

  const dueAmount = balanceDue;
  const isDue = dueAmount > 0 && order.status !== "cancelled_refunded" && order.status !== "cancelled_converted";
  const isAdvance = order.status === "advance_paid";
  const isPaidFull = order.status === "paid_full";
  const isCompleted = order.status === "completed" || order.status === "replacement_completed";
  const isReplacement = order.status === "replacement_pending" || order.status === "replacement";
  const isRefunded = order.status === "cancelled_refunded";
  const hasPendingDelivery = Boolean(
    (order.lineItems && order.lineItems.some((li) => !li.fulfilled)) || isReplacement
  );

  const urgency = order.scheduledFor ? getBookingUrgency(order.scheduledFor) : null;
  const isTomorrow = urgency?.tone === "tomorrow";
  const isToday = urgency?.tone === "today";
  const isScheduledDateArrived = !order.scheduledFor || (urgency !== null && urgency.daysAway <= 0);

  // Prefill reminder text for advance booking, paid in full pre-order, payment due, or replacement orders
  const shouldPrefillMsg = isAdvance || isPaidFull || isDue || isReplacement;

  const waUrl = order.customerPhone
    ? shouldPrefillMsg
      ? getWhatsAppReminderUrl({
          phone: order.customerPhone,
          customerName: order.customer,
          salonName: salonName || "our salon",
          bookingDate: order.scheduledFor,
          bookingTime: order.scheduledTime,
          orderType: order.type,
          productName: order.itemsSummary,
          orderId: order.id,
          pendingAmount: dueAmount,
          isPaymentDue: isDue,
          isReplacement: isReplacement,
          isTomorrow: isTomorrow,
          isToday: isToday,
        })
      : (() => {
          // ponytail: Assumes Indian 10-digit mobile numbers (+91). Upgrade path: Add country code support to tenant profile if expanding internationally.
          const cleaned = order.customerPhone.replace(/\D/g, "");
          const standardNumber =
            cleaned.length === 10
              ? `91${cleaned}`
              : cleaned.startsWith("0") && cleaned.length === 11
              ? `91${cleaned.slice(1)}`
              : cleaned;
          return `https://api.whatsapp.com/send/?phone=${standardNumber}`;
        })()
    : null;

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const expectedNet = Math.max(0, originalSubtotal - originalDiscountAmount);
  const extraOnBill = originalBillAmount > expectedNet ? originalBillAmount - expectedNet : 0;

  const combinedPayments = (() => {
    const list = [...(order.payments || [])];
    // If order is not cancelled_refunded, synthesize missing refund payments for item returns if any
    if (!isRefunded && returnEvents.length > 0) {
      for (const ret of returnEvents) {
        if (ret.customerResolution === "refund" && (ret.cashRefund || ret.refundAmount) > 0) {
          const cashAmt = typeof ret.cashRefund === "number" ? ret.cashRefund : (ret.refundMode !== "reduce_due" ? ret.refundAmount : 0);
          if (cashAmt <= 0) continue;
          const alreadyInPayments = list.some(
            (p) =>
              (p.type === "refund" || p.amount < 0) &&
              Math.abs(Math.abs(p.amount) - cashAmt) < 0.01 &&
              (p.notes?.includes(ret.productName) ||
                (ret.returnedAt &&
                  p.recordedAt &&
                  Math.abs(new Date(p.recordedAt).getTime() - new Date(ret.returnedAt).getTime()) < 60000))
          );
          if (!alreadyInPayments) {
            list.push({
              amount: -cashAmt,
              mode: (ret.refundMode === "reduce_due" ? "cash" : ret.refundMode || "cash") as any,
              recordedAt: ret.returnedAt || new Date().toISOString(),
              recordedBy: ret.recordedBy,
              type: "refund",
              notes: `Return refund: ${ret.quantity}x ${ret.productName}${ret.notes ? ` - ${ret.notes}` : ""}`,
            });
          }
        }
      }
    }
    return list;
  })();

  const totalCollected = originalAmountPaid;

  const totalRefunded = isRefunded
    ? (order.refundAmount ?? Math.abs(order.payments?.filter((p) => p.amount < 0).reduce((sum, p) => sum + p.amount, 0) || 0) ?? order.paid)
    : totalReturnRefundAmount;

  const retainedByShop = Math.max(0, totalCollected - totalRefunded);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${formatDisplayNumber(order.id)}`}
      className={`fixed inset-0 ${zIndex} bg-galla-paper flex flex-col overflow-y-auto`}
    >
      {/* ======================================================== */}
      {/* TOP HEADER (Sticky)                                      */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 bg-galla-surface border-b border-galla-line px-5 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-[6px] bg-galla-surface border border-galla-line hover:bg-galla-paper flex items-center justify-center text-galla-ink shadow-2xs transition-all cursor-pointer shrink-0"
            title="Back to orders"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-[5px] bg-galla-teal-soft text-galla-teal">
              <Receipt className="h-4 w-4" />
            </div>
            <h1 className="text-[16px] font-bold text-galla-ink">
              Order {formatDisplayNumber(order.id)}
            </h1>
            <StatusPill status={order.status} />
            <span className="text-[12px] text-galla-ink-soft hidden md:inline">
              &bull; {order.type} &bull; {order.time}
            </span>
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
        {/* LEFT COLUMN: CUSTOMER, TIMELINE, ITEMS & RETURNS       */}
        {/* ====================================================== */}
        <main className="space-y-6 min-w-0 order-1">
          {/* Card 1: Customer Details */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Customer Details
                </h2>
              </div>
              <div className="text-[12px] text-galla-ink-soft">
                {order.type}
              </div>
            </div>

            <div className="p-4 bg-galla-paper/40 border border-galla-line/70 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-galla-teal-soft border border-galla-teal/30 flex items-center justify-center text-galla-teal font-bold text-[16px] shrink-0">
                  {order.customer.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[16px] text-galla-ink">
                      {order.customer}
                    </span>
                  </div>
                  {order.customerPhone ? (
                    <div className="tabular-nums text-[13px] text-galla-ink-soft mt-0.5 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-galla-teal" />
                      <span>{formatPhoneNumber(order.customerPhone)}</span>
                    </div>
                  ) : (
                    <div className="text-[12px] text-galla-ink-soft/70 italic mt-0.5">
                      No phone number recorded
                    </div>
                  )}
                </div>
              </div>

              {order.customerPhone && (
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12.5px] font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-teal hover:text-galla-teal transition-all shadow-2xs"
                    title={`Call ${order.customer}`}
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
                      title="Open WhatsApp message"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Timeline & Status Tracking */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-galla-teal" />
              <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                Timeline &amp; Order Status
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Created / Placed At */}
              <div className="p-3.5 bg-galla-paper/30 border border-galla-line rounded-[5px] flex items-start gap-3">
                <Calendar className="h-4 w-4 text-galla-teal shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[12px] font-medium text-galla-ink-soft">
                    Order Placed
                  </span>
                  <span className="text-[13px] font-semibold text-galla-ink mt-0.5 block">
                    {formatDateTime(order.createdAt) || order.time}
                  </span>
                  {order.recordedBy && (
                    <span className="text-[11.5px] text-galla-ink-soft/75 mt-0.5 block capitalize">
                      Recorded by: {order.recordedBy}
                    </span>
                  )}
                </div>
              </div>

              {/* Latest Lifecycle Status Card */}
              {isCompleted ? (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/90 rounded-[5px] flex items-start gap-3 text-emerald-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="block text-[12px] font-semibold text-emerald-900">
                        {order.scheduledFor
                          ? order.type === "Product sale"
                            ? "Picked Up (Completed)"
                            : "Appointment Slot (Completed)"
                          : "Completed & Settled"}
                      </span>
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                        Done
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold mt-0.5 block text-emerald-950">
                      {formatDateTime(order.completedAt || order.latestActivityAt || order.createdAt) || "Completed at counter"}
                    </span>
                  </div>
                </div>
              ) : isRefunded ? (
                <div className="p-3.5 bg-rose-50/60 border border-rose-200/90 rounded-[5px] flex items-start gap-3 text-rose-950">
                  <RotateCcw className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="block text-[12px] font-semibold text-rose-900">
                        Order Refunded
                      </span>
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-rose-100 text-rose-800 border border-rose-300/80">
                        Refunded
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold mt-0.5 block text-rose-950">
                      {formatDateTime(order.refundedAt || order.latestActivityAt || order.createdAt) || "Refund processed"}
                    </span>
                  </div>
                </div>
              ) : order.scheduledFor ? (
                <div
                  className={`p-3.5 rounded-[5px] flex items-start gap-3 ${
                    isReplacement && isTomorrow
                      ? "bg-rose-50 border border-rose-300 text-rose-950 ring-1 ring-rose-300/40"
                      : "bg-amber-50/60 border border-amber-200/80 text-amber-950"
                  }`}
                >
                  <Clock
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      isReplacement && isTomorrow ? "text-rose-700" : "text-amber-700"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`block text-[12px] font-semibold ${
                          isReplacement && isTomorrow ? "text-rose-900" : "text-amber-900"
                        }`}
                      >
                        {isReplacement
                          ? "Expected Replacement Delivery"
                          : isDue && !hasPendingDelivery
                          ? "Payment Due Date"
                          : order.type === "Product sale"
                          ? "Expected Pickup"
                          : "Appointment Slot"}
                      </span>
                      <span
                        className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] border ${
                          isReplacement && isTomorrow
                            ? "bg-rose-100 text-rose-800 border-rose-300 font-semibold"
                            : "bg-amber-100 text-amber-800 border-amber-300/80"
                        }`}
                      >
                        {isReplacement && isTomorrow
                          ? "Urgent: Tomorrow"
                          : isToday
                          ? "Today"
                          : "Upcoming"}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold mt-0.5 block">
                      {formatBookingDate(order.scheduledFor)}
                      {order.scheduledTime ? ` at ${formatAppointmentTime(order.scheduledTime)}` : ""}
                    </span>
                  </div>
                </div>
              ) : isDue ? (
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-[5px] flex items-start gap-3 text-amber-950">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="block text-[12px] font-semibold text-amber-900">
                        Payment Due
                      </span>
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-amber-100 text-amber-800 border border-amber-300/80">
                        Pending
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold mt-0.5 block text-amber-950">
                      {formatDateTime(order.latestActivityAt || order.createdAt) || order.time}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-galla-paper/30 border border-galla-line rounded-[5px] flex items-start gap-3">
                  <Clock className="h-4 w-4 text-galla-teal shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-galla-ink-soft">
                      Last Activity
                    </span>
                    <span className="text-[13px] font-semibold text-galla-ink mt-0.5 block">
                      {formatDateTime(order.latestActivityAt || order.createdAt) || order.time}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Items Purchased */}
          <section className="bg-galla-surface border border-galla-line rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-galla-teal" />
                <h2 className="text-[14px] font-bold text-galla-ink uppercase tracking-wider">
                  Items Purchased ({order.lineItems?.length || (order.itemsSummary ? 1 : 0)})
                </h2>
              </div>
              <span className="text-[12px] font-semibold text-galla-ink-soft tabular-nums">
                {totalUnits} {totalUnits === 1 ? "unit" : "units"} total
              </span>
            </div>

            <div className="border border-galla-line rounded-[6px] overflow-hidden bg-galla-surface">
              {order.lineItems && order.lineItems.length > 0 ? (
                <div className="divide-y divide-galla-line/60">
                  {order.lineItems.map((item, idx) => {
                    const itemReturns = (order.returns || []).filter(
                      (r) =>
                        (r.lineItemId && item.itemId && String(r.lineItemId) === String(item.itemId)) ||
                        (typeof r.lineItemIndex === "number" && r.lineItemIndex === idx) ||
                        (r.productId && item.itemId && String(r.productId) === String(item.itemId)) ||
                        (r.productName && item.name && r.productName.trim().toLowerCase() === item.name.trim().toLowerCase())
                    );

                    const returnedQty = itemReturns.length > 0
                      ? itemReturns
                          .filter((r) => r.customerResolution === "refund" || !r.customerResolution)
                          .reduce((sum, r) => sum + (r.quantity || 0), 0)
                      : (item.returnedQuantity || 0);

                    const replacedQty = itemReturns.length > 0
                      ? itemReturns
                          .filter((r) => r.customerResolution === "replacement")
                          .reduce((sum, r) => sum + (r.quantity || 0), 0)
                      : (item.replacedQuantity || 0);

                    const isFullyReturned = returnedQty >= item.quantity;
                    const totalHandled = returnedQty + replacedQty;

                    return (
                      <div key={idx} className="p-4 hover:bg-galla-paper/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.itemType === "product" ? (
                                <ShoppingBag className="h-4 w-4 text-blue-600 shrink-0" />
                              ) : item.itemType === "package" ? (
                                <Package className="h-4 w-4 text-indigo-600 shrink-0" />
                              ) : (
                                <Scissors className="h-4 w-4 text-purple-600 shrink-0" />
                              )}
                              <span className={`font-semibold text-[14px] ${isFullyReturned ? "text-galla-ink-soft line-through" : "text-galla-ink"}`}>
                                {item.name}
                              </span>
                              <span
                                className={`text-[10.5px] font-semibold uppercase px-1.5 py-0.5 rounded-[4px] border ${
                                  item.itemType === "product"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : item.itemType === "package"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                {item.itemType}
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
                              {item.itemType === "product" &&
                                !isAdvance &&
                                !isPaidFull &&
                                item.fulfilled !== false &&
                                order.status !== "cancelled_refunded" &&
                                order.status !== "cancelled_converted" &&
                                totalHandled < item.quantity && (
                                <button
                                  type="button"
                                  onClick={() => setReturningItemIndex(idx)}
                                  className="text-[11.5px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-[4px] border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Undo2 className="h-3 w-3" />
                                  <span>Return Item</span>
                                </button>
                              )}
                            </div>

                            {/* Package Components Breakdown */}
                            {item.packageDetails?.components && item.packageDetails.components.length > 0 && (
                              <div className="pl-6 pt-1 space-y-0.5">
                                <span className="text-[11.5px] font-medium text-galla-ink-soft">
                                  Includes services:
                                </span>
                                <ul className="list-disc list-inside text-[11.5px] text-galla-ink-soft/90 space-y-0.5">
                                  {item.packageDetails.components.map((comp, cIdx) => (
                                    <li key={cIdx}>
                                      {comp.name} ({formatRupee(comp.componentPrice)})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Fulfillment status */}
                            {item.itemType === "product" && (
                              <div className="pl-6 text-[11.5px]">
                                {item.fulfilled ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Delivered / Handed over
                                  </span>
                                ) : order.paid >= order.amount ? (
                                  <span className="text-blue-700 font-medium inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Fully Paid &bull; Delivery Pending (Awaiting Stock Pickup)
                                  </span>
                                ) : order.paid > 0 ? (
                                  <span className="text-amber-800 font-medium inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Advance Received &bull; Delivery Pending
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Pending Pickup / Backorder
                                  </span>
                                )}
                              </div>
                            )}

                            {item.itemType === "package" && (
                              <div className="pl-6 text-[11.5px]">
                                {item.fulfilled ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Package Rendered &bull; Products Deducted
                                  </span>
                                ) : (
                                  <span className="text-indigo-700 font-medium inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Advance Booking &bull; Products deducted on order completion
                                  </span>
                                )}
                              </div>
                            )}

                            {item.itemType === "service" && (
                              <div className="pl-6 text-[11.5px]">
                                {item.fulfilled ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Service Rendered
                                  </span>
                                ) : (
                                  <span className="text-purple-700 font-medium inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Advance Booking &bull; Consumed products deducted on completion
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[15px] font-bold text-galla-ink tabular-nums">
                              {formatRupee(item.unitPrice * (item.quantity || 1))}
                            </div>
                            <div className="text-[11.5px] text-galla-ink-soft tabular-nums mt-0.5">
                              {item.quantity} &times; {formatRupee(item.unitPrice)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Subtotal row */}
                  <div className="px-5 py-3.5 bg-galla-paper/70 border-t border-galla-line flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-galla-ink">
                      Items Subtotal ({order.lineItems.length} {order.lineItems.length === 1 ? "Item" : "Items"} &bull; {totalUnits} {totalUnits === 1 ? "Unit" : "Units"})
                    </span>
                    <span className="text-[15px] font-bold text-galla-ink tabular-nums">
                      {formatRupee(originalSubtotal)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-[13px] text-galla-ink-soft">
                  {order.itemsSummary ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-galla-ink">{order.itemsSummary}</span>
                      <span className="text-[15px] font-bold text-galla-ink tabular-nums">
                        {formatRupee(order.amount)}
                      </span>
                    </div>
                  ) : (
                    <span>{order.type} &bull; {formatRupee(order.amount)}</span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Card 4: Returns & Replacements History (if any) */}
          {hasReturns && (
            <section className="bg-galla-surface border border-rose-200/80 rounded-[8px] p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-rose-700" />
                  <h2 className="text-[14px] font-bold text-rose-950 uppercase tracking-wider">
                    Item Returns &amp; Replacements ({order.returns!.length})
                  </h2>
                </div>
              </div>

              <div className="space-y-2.5">
                {order.returns!.map((ret, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3.5 bg-rose-50/40 rounded-[5px] border border-rose-200/70 text-[12px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-galla-ink text-[13px]">
                          {ret.quantity}x {ret.productName}
                        </span>
                        <span
                          className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] border ${
                            ret.returnCondition === "defective_dealer_claim"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {ret.returnCondition === "defective_dealer_claim" ? "Defective" : "Good (Restocked)"}
                        </span>
                      </div>
                      <span className="tabular-nums text-[11.5px] text-galla-ink-soft">
                        {ret.returnedAt ? formatDateTime(ret.returnedAt) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-galla-ink-soft">
                      <span>
                        Resolution:{" "}
                        <strong className="text-galla-ink font-semibold">
                          {ret.customerResolution === "replacement"
                            ? ret.expectedPickupDate
                              ? `Replacement Scheduled (Expected: ${formatBookingDate(ret.expectedPickupDate)})`
                              : ret.replacementProductName && ret.replacementProductName !== ret.productName
                              ? `Replacement Handed Over (Upgraded to ${ret.replacementProductName}${
                                  typeof ret.priceDifference === "number" && ret.priceDifference !== 0
                                    ? ` • ${ret.priceDifference > 0 ? `Price Diff: +${formatRupee(ret.priceDifference)} via ${(ret.priceDifferencePaymentMode || "cash").toUpperCase()}` : `Excess Refund: -${formatRupee(Math.abs(ret.priceDifference))}`}`
                                    : ""
                                })`
                              : "Replacement Handed Over"
                            : (() => {
                                const hasDueDed = (ret.dueDeduction || 0) > 0;
                                const hasCash = (ret.cashRefund || 0) > 0;
                                if (hasDueDed && hasCash) {
                                  return `Deducted ${formatRupee(ret.dueDeduction || 0)} due & Refunded ${formatRupee(ret.cashRefund || 0)} via ${(ret.refundMode || "cash").toUpperCase()}`;
                                }
                                if (hasDueDed) {
                                  return `Deducted ${formatRupee(ret.dueDeduction || ret.refundAmount || 0)} from pending due`;
                                }
                                return `Refunded ${formatRupee(ret.cashRefund || ret.refundAmount || 0)} via ${(ret.refundMode || "cash").toUpperCase()}`;
                              })()}
                        </strong>
                      </span>
                      {ret.restockLocation && (
                        <span>
                          &bull; Restock:{" "}
                          <span className="text-galla-ink font-medium">
                            {ret.restockLocation === "sellStock" ? "Retail Shelf" : "Salon Use"}
                          </span>
                        </span>
                      )}
                    </div>

                    {ret.notes && (
                      <div className="text-[11.5px] text-galla-ink-soft/80 italic pt-1 border-t border-rose-200/50">
                        &ldquo;{ret.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Card 5: Refund Details (if refunded) */}
          {isRefunded && (
            <section className="bg-rose-50/50 border border-rose-200 rounded-[8px] p-5 shadow-xs space-y-2 text-[13px] text-rose-950">
              <div className="flex items-center justify-between font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-rose-700" />
                  <span>Refund Issued:</span>
                </span>
                <span className="tabular-nums font-bold text-rose-800 text-[15px]">
                  {formatRupee(totalRefunded)}
                  {order.refundMode ? ` (${order.refundMode.toUpperCase()})` : ""}
                </span>
              </div>

              {retainedByShop > 0 && (
                <div className="flex items-center justify-between text-[12.5px] text-emerald-800 font-semibold pt-1.5 border-t border-rose-200/60">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Retained by Shop (Charge / Fee):</span>
                  </span>
                  <span className="tabular-nums font-bold text-emerald-700">
                    +{formatRupee(retainedByShop)}
                  </span>
                </div>
              )}

              {order.refundReason && (
                <div className="text-[12px] text-rose-800 pt-1">
                  Reason: {order.refundReason}
                </div>
              )}
            </section>
          )}

          {/* Card 6: Order Notes & Settlement Memo */}
          {order.notes && (
            <section className="bg-amber-50/50 border border-amber-200/80 rounded-[8px] p-5 shadow-xs space-y-1.5 text-[12.5px] text-amber-950">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-700 shrink-0" />
                <h2 className="text-[14px] font-bold text-amber-950 uppercase tracking-wider">
                  Notes &amp; Settlement Memo
                </h2>
              </div>
              <p className="pt-1 text-galla-ink leading-relaxed">
                {order.notes}
              </p>
            </section>
          )}
        </main>

        {/* ====================================================== */}
        {/* RIGHT COLUMN: BILL SUMMARY, PAYMENTS & ACTIONS         */}
        {/* ====================================================== */}
        <aside className="bg-galla-surface border border-galla-line rounded-[8px] shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-92px)] order-2">
          {/* Summary Header */}
          <div className="p-4 border-b border-galla-line/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-galla-teal" />
              <h2 className="text-[15px] font-bold text-galla-ink">Bill &amp; Settlement</h2>
            </div>
            <StatusPill status={order.status} />
          </div>

          {/* Scrollable Summary Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Financial Breakdown */}
            <div className="space-y-2 text-[12.5px]">
              <span className="block text-[12px] font-semibold text-galla-ink-soft border-b border-galla-line/60 pb-1.5 uppercase tracking-wider">
                Financial Breakdown
              </span>

              {/* 1. Subtotal */}
              <div className="flex justify-between text-galla-ink-soft">
                <span>Items Subtotal</span>
                <span className="tabular-nums font-medium text-galla-ink">
                  {formatRupee(originalSubtotal)}
                </span>
              </div>

              {/* 2. Discount */}
              {originalDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>
                    Discount {order.discountType === "percentage" ? `(${order.discountValue}%)` : ""}
                  </span>
                  <span className="tabular-nums font-semibold">
                    - {formatRupee(originalDiscountAmount)}
                  </span>
                </div>
              )}

              {/* Extra paid */}
              {extraOnBill > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Extra Paid</span>
                  <span className="tabular-nums font-semibold">+{formatRupee(extraOnBill)}</span>
                </div>
              )}

              {/* 3. Total Bill Amount */}
              <div className="flex justify-between items-baseline pt-2 border-t border-galla-line text-[14.5px] font-semibold text-galla-ink">
                <span>Total Bill Amount</span>
                <span className="text-[17px] font-bold tabular-nums text-galla-ink">
                  {formatRupee(originalBillAmount)}
                </span>
              </div>

              {/* 4. Returns Deduction if any */}
              {hasReturns && totalReturnRefundAmount > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-dashed border-rose-200">
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span className="flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />
                      <span>Returned Items Deduction</span>
                    </span>
                    <span className="tabular-nums font-semibold">
                      - {formatRupee(totalReturnRefundAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[13.5px] font-semibold text-galla-ink pt-1 border-t border-galla-line/40">
                    <span>Reduced Net Bill</span>
                    <span className="tabular-nums font-bold text-galla-teal">
                      {formatRupee(netBillAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* 5. Payments & Due / Settled */}
              {isRefunded ? (
                <div className="space-y-1.5 pt-2 border-t border-galla-line/60">
                  <div className="flex justify-between text-galla-ink font-medium">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-galla-ink-soft" />
                      <span>Amount Collected</span>
                    </span>
                    <span className="tabular-nums font-medium">{formatRupee(totalCollected)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Undo2 className="h-3.5 w-3.5" />
                      <span>Total Refunded</span>
                    </span>
                    <span className="tabular-nums font-bold">- {formatRupee(totalRefunded)}</span>
                  </div>
                  {retainedByShop > 0 && (
                    <div className="flex justify-between text-emerald-800 font-semibold bg-emerald-50/70 p-2 rounded-[5px] border border-emerald-200/80">
                      <span>Retained Charge / Fee</span>
                      <span className="tabular-nums font-bold">+{formatRupee(retainedByShop)}</span>
                    </div>
                  )}
                </div>
              ) : isDue ? (
                <div className="space-y-1.5 pt-2 border-t border-galla-line/60">
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Amount Paid</span>
                      {order.paymentMode && (
                        <span className="text-[10.5px] font-medium px-1.5 py-0.2 rounded-[4px] bg-galla-paper text-galla-ink-soft border border-galla-line/60 uppercase">
                          {order.paymentMode}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums font-bold">{formatRupee(netAmountPaid)}</span>
                  </div>

                  <div className="flex justify-between items-baseline text-[14px] text-rose-700 font-bold pt-1.5 border-t border-rose-200">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>Balance Due</span>
                    </span>
                    <span className="text-xl tabular-nums font-extrabold text-rose-700">
                      {formatRupee(dueAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-2 border-t border-galla-line/60">
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Amount Paid</span>
                    </span>
                    <span className="tabular-nums font-bold">
                      {formatRupee(netAmountPaid || (hasReturns ? netBillAmount : originalBillAmount))}
                    </span>
                  </div>

                  <div className="flex justify-between text-[12.5px] text-emerald-800 font-semibold pt-1 border-t border-emerald-200">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Settlement Status</span>
                    </span>
                    <span>Fully Settled (₹0 Due)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment History Log */}
            {combinedPayments.length > 0 && (() => {
              const getPaymentBadge = (p: typeof combinedPayments[number], idx: number, total: number) => {
                if (p.type === "refund" || p.amount < 0) {
                  return { label: "Refund", style: "bg-rose-50 text-rose-800 border-rose-200/90" };
                }
                if (p.type === "advance") {
                  return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                }
                if (p.type === "partial_payment" || p.type === "down_payment") {
                  return { label: "Partial Paid", style: "bg-blue-50 text-blue-800 border-blue-200/90" };
                }
                if (p.type === "settlement") {
                  return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                }
                if (p.type === "full_payment") {
                  return { label: "Full Payment", style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20" };
                }

                if (total > 1) {
                  if (idx === 0) {
                    if (order.status === "created" || (!order.scheduledFor && order.status !== "advance_paid")) {
                      return { label: "Partial Paid", style: "bg-blue-50 text-blue-800 border-blue-200/90" };
                    }
                    return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                  }
                  if (idx === total - 1) {
                    return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                  }
                  return { label: `Part ${idx + 1}`, style: "bg-blue-50 text-blue-800 border-blue-200/90" };
                }

                if (
                  order.status === "advance_paid" ||
                  (order.advanceAmount && order.advanceAmount > 0)
                ) {
                  return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                }
                if (order.status === "created" || order.paid < order.amount) {
                  return { label: "Partial Paid", style: "bg-blue-50 text-blue-800 border-blue-200/90" };
                }
                if (order.notes?.toLowerCase().includes("cleared via")) {
                  return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                }
                return { label: "Full Payment", style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20" };
              };

              return (
                <div className="pt-2 border-t border-galla-line/60 space-y-2">
                  <span className="text-[12px] font-semibold text-galla-ink-soft block uppercase tracking-wider">
                    Payment History ({combinedPayments.length})
                  </span>
                  <div className="space-y-1.5">
                    {combinedPayments.map((p, pIdx) => {
                      const badge = getPaymentBadge(p, pIdx, combinedPayments.length);
                      const isRefund = p.type === "refund" || p.amount < 0;
                      return (
                        <div
                          key={pIdx}
                          className="bg-galla-paper/30 rounded-[5px] border border-galla-line/60 flex flex-col overflow-hidden"
                        >
                          <div className="flex items-center justify-between text-[12px] px-3 py-2 text-galla-ink-soft">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] border shrink-0 ${badge.style}`}
                              >
                                {badge.label}
                              </span>
                              <span>
                                <strong className={isRefund ? "text-rose-700 font-semibold" : "text-galla-ink font-semibold"}>
                                  {formatRupee(p.amount)}
                                </strong> via{" "}
                                <span className="uppercase font-medium text-galla-ink">{p.mode}</span>
                                {p.recordedBy ? ` (${p.recordedBy})` : ""}
                              </span>
                            </div>
                            <span className="tabular-nums text-[11px] text-galla-ink-soft/75">
                              {formatDateTime(p.recordedAt)}
                            </span>
                          </div>
                          {p.notes && (
                            <div className="px-3 pb-2 pt-0.5 text-[11px] text-galla-ink-soft/80 bg-galla-paper/50">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Sidebar Footer Actions */}
          <div className="p-4 border-t border-galla-line/60 bg-galla-surface space-y-2.5 shrink-0">
            {/* Status notice */}
            <div className="text-[11.5px] text-galla-ink-soft">
              {isDue ? (
                <span className="text-amber-800 font-medium">
                  Customer has {formatRupee(dueAmount)} remaining due
                  {!isScheduledDateArrived && order.scheduledFor && (
                    <span className="text-[11px] text-galla-ink-soft/80 block font-normal">
                      Settle available on {isDue && !hasPendingDelivery ? "due date" : order.type === "Product sale" ? "pickup day" : "appointment day"} ({formatBookingDate(order.scheduledFor)})
                    </span>
                  )}
                </span>
              ) : isReplacement ? (
                <span className="text-amber-800 font-medium">Replacement order &bull; Awaiting dealer delivery</span>
              ) : isCompleted ? (
                <span className="text-emerald-700 font-medium">Order is complete</span>
              ) : hasPendingDelivery ? (
                <span className="text-blue-700 font-medium">Paid in full &bull; Delivery pending stock pickup</span>
              ) : null}
            </div>

            {/* Primary Action Button */}
            {isDue && isScheduledDateArrived && onOpenSettle && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettle(order);
                }}
                className="w-full py-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[14px] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Settle Due ({formatRupee(dueAmount)})</span>
              </button>
            )}

            {!isDue && !isCompleted && hasPendingDelivery && isScheduledDateArrived && onOpenSettle && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettle(order);
                }}
                className="w-full py-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[14px] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Deliver &amp; Complete Order</span>
              </button>
            )}

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2">
              {(isAdvance || isPaidFull || isDue || isReplacement) && onOpenReschedule && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenReschedule(order);
                  }}
                  className="flex-1 py-2.5 rounded-[5px] border border-galla-line bg-galla-surface hover:bg-galla-paper/70 text-galla-ink font-sans font-medium text-[13px] transition-colors cursor-pointer text-center"
                >
                  {order.scheduledFor
                    ? isDue && !hasPendingDelivery
                      ? "Change Due Date"
                      : "Reschedule"
                    : isDue && !hasPendingDelivery
                    ? "Set Due Date"
                    : isReplacement
                    ? "Set Delivery Date"
                    : "Set Date"}
                </button>
              )}

              {canOrderBeRefunded(order) && onOpenRefund && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenRefund(order);
                  }}
                  className="flex-1 py-2.5 rounded-[5px] border border-galla-line bg-galla-surface hover:bg-galla-paper/70 text-galla-ink font-sans font-medium text-[13px] transition-colors cursor-pointer text-center"
                >
                  Refund
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className={`${
                  ((isAdvance || isPaidFull || isDue || isReplacement) && onOpenReschedule) ||
                  (canOrderBeRefunded(order) && onOpenRefund)
                    ? "flex-1"
                    : "w-full"
                } py-2.5 rounded-[5px] bg-galla-teal hover:bg-galla-teal/90 text-white font-sans font-medium text-[13px] transition-colors cursor-pointer text-center shadow-xs`}
              >
                Close
              </button>
            </div>
          </div>
        </aside>
      </div>

      {returningItemIndex !== null && order.lineItems && !isAdvance && !isPaidFull && (
        <ReturnCustomerOrderItemModal
          isOpen={returningItemIndex !== null}
          onClose={() => setReturningItemIndex(null)}
          order={order}
          lineItem={order.lineItems[returningItemIndex]}
          lineItemIndex={returningItemIndex}
          onSuccess={() => {
            setReturningItemIndex(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
