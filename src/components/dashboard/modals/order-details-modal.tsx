"use client";

import React from "react";
import {
  X,
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
}

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  salonName,
  onOpenSettle,
  onOpenReschedule,
  onOpenRefund,
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

  if (!isOpen || !order) return null;

  const dueAmount = Math.max(0, order.amount - order.paid);
  const isDue = dueAmount > 0 && order.status !== "cancelled_refunded" && order.status !== "cancelled_converted";
  const isAdvance = order.status === "advance_paid";
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

  // Prefill reminder text for advance booking, payment due, or replacement orders
  const shouldPrefillMsg = isAdvance || isDue || isReplacement;

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

  const itemsSubtotal =
    typeof order.subtotal === "number" && order.subtotal > 0
      ? order.subtotal
      : order.lineItems && order.lineItems.length > 0
      ? order.lineItems.reduce(
          (sum, item) => sum + (item.finalPrice || item.unitPrice * (item.quantity || 1)),
          0
        )
      : order.amount;

  const expectedNet = Math.max(0, itemsSubtotal - (order.discountAmount || 0));
  const extraOnBill = order.amount > expectedNet ? order.amount - expectedNet : 0;
  const overpaid = order.paid > order.amount ? order.paid - order.amount : 0;
  const totalExtra = extraOnBill + overpaid;

  const combinedPayments = (() => {
    const list = [...(order.payments || [])];
    // If order is cancelled_refunded, order.payments already contains the complete order-level refund.
    // We only synthesize missing refund payments for item returns if not cancelled_refunded.
    if (!isRefunded && order.returns && Array.isArray(order.returns)) {
      for (const ret of order.returns) {
        if (ret.customerResolution === "refund" && ret.refundAmount > 0) {
          const alreadyInPayments = list.some(
            (p) =>
              (p.type === "refund" || p.amount < 0) &&
              Math.abs(Math.abs(p.amount) - ret.refundAmount) < 0.01 &&
              (p.notes?.includes(ret.productName) ||
                (ret.returnedAt &&
                  p.recordedAt &&
                  Math.abs(new Date(p.recordedAt).getTime() - new Date(ret.returnedAt).getTime()) < 60000))
          );
          if (!alreadyInPayments) {
            list.push({
              amount: -ret.refundAmount,
              mode: (ret.refundMode === "reduce_due" ? "cash" : ret.refundMode || "cash") as any,
              recordedAt: ret.returnedAt || new Date().toISOString(),
              recordedBy: ret.recordedBy,
              type: "refund",
              notes: `Return refund: ${ret.quantity}x ${ret.productName}${ret.refundMode === "reduce_due" ? " (Due reduced)" : ""}${ret.notes ? ` - ${ret.notes}` : ""}`,
            });
          }
        }
      }
    }
    return list;
  })();

  const totalCollected =
    order.payments && order.payments.length > 0 && order.payments.some((p) => p.amount > 0)
      ? order.payments.filter((p) => p.amount > 0).reduce((sum, p) => sum + p.amount, 0)
      : order.paid + (order.refundAmount || 0);

  const totalRefunded = isRefunded
    ? (order.refundAmount ?? Math.abs(order.payments?.filter((p) => p.amount < 0).reduce((sum, p) => sum + p.amount, 0) || 0) ?? order.paid)
    : Math.abs(
        combinedPayments
          .filter((p) => p.type === "refund" || p.amount < 0)
          .reduce((sum, p) => sum + p.amount, 0)
      );

  const retainedByShop = Math.max(0, totalCollected - totalRefunded);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div className="w-full max-w-[620px] bg-galla-surface border border-galla-line rounded-[10px] shadow-2xl transition-all max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-galla-line/80 flex items-center justify-between bg-galla-paper/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-[6px] bg-galla-teal/10 border border-galla-teal/20 flex items-center justify-center text-galla-teal">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-[18px] text-galla-ink tracking-tight">
                  Order {formatDisplayNumber(order.id)}
                </h2>
                <StatusPill status={order.status} />
              </div>
              <p className="font-sans text-[12px] text-galla-ink-soft mt-0.5">
                {order.type} &bull; {order.time}
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
          {/* Customer & Quick Contact Card */}
          <div className="p-3.5 bg-galla-paper/50 border border-galla-line rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-galla-paper border border-galla-line flex items-center justify-center text-galla-ink font-heading font-semibold text-[15px] shrink-0">
                {order.customer.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-galla-ink-soft" />
                  <span className="font-sans font-semibold text-[15px] text-galla-ink">
                    {order.customer}
                  </span>
                </div>
                {order.customerPhone ? (
                  <div className="font-mono text-[12.5px] text-galla-ink-soft mt-0.5">
                    {formatPhoneNumber(order.customerPhone)}
                  </div>
                ) : (
                  <div className="text-[12px] text-galla-ink-soft/70 italic mt-0.5">
                    No phone recorded
                  </div>
                )}
              </div>
            </div>

            {order.customerPhone && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${order.customerPhone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-sans font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-teal hover:text-galla-teal transition-all shadow-2xs"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-sans font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
                    title="Open WhatsApp message"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Date & Time Tracking Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Created / Placed At */}
            <div className="p-3 bg-galla-paper/30 border border-galla-line rounded-[6px] flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-galla-teal shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
                  Order Placed
                </span>
                <span className="text-[12.5px] font-medium text-galla-ink mt-0.5 block">
                  {formatDateTime(order.createdAt) || order.time}
                </span>
                {order.recordedBy && (
                  <span className="text-[11px] text-galla-ink-soft/75 mt-0.5 block capitalize">
                    Recorded by: {order.recordedBy}
                  </span>
                )}
              </div>
            </div>

            {/* Latest Lifecycle Status Card */}
            {isCompleted ? (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/90 rounded-[6px] flex items-start gap-2.5 text-emerald-950">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-emerald-900">
                      {order.scheduledFor
                        ? order.type === "Product sale"
                          ? "Picked Up (Completed)"
                          : "Appointment Slot (Completed)"
                        : "Completed & Settled"}
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                      Done
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-emerald-950">
                    {formatDateTime(order.completedAt || order.latestActivityAt || order.createdAt) || "Completed at counter"}
                  </span>
                </div>
              </div>
            ) : isRefunded ? (
              <div className="p-3 bg-rose-50/60 border border-rose-200/90 rounded-[6px] flex items-start gap-2.5 text-rose-950">
                <RotateCcw className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-rose-900">
                      Order Refunded
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300/80">
                      Refunded
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-rose-950">
                    {formatDateTime(order.refundedAt || order.latestActivityAt || order.createdAt) || "Refund processed"}
                  </span>
                </div>
              </div>
            ) : order.scheduledFor ? (
              <div
                className={`p-3 rounded-[6px] flex items-start gap-2.5 ${
                  isReplacement && isTomorrow
                    ? "bg-rose-50 border border-rose-300 text-rose-950 ring-1 ring-rose-300/40"
                    : "bg-amber-50/50 border border-amber-200/80 text-amber-950"
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
                      className={`block text-[11px] font-heading uppercase tracking-wider font-semibold ${
                        isReplacement && isTomorrow ? "text-rose-900" : "text-amber-900"
                      }`}
                    >
                      {isReplacement
                        ? "Expected Replacement Delivery"
                        : order.type === "Product sale"
                        ? "Expected Pickup"
                        : "Appointment Slot"}
                    </span>
                    <span
                      className={`text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${
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
                  <span className="text-[12.5px] font-medium mt-0.5 block">
                    {formatBookingDate(order.scheduledFor)}
                    {order.scheduledTime ? ` at ${formatAppointmentTime(order.scheduledTime)}` : ""}
                  </span>
                </div>
              </div>
            ) : isDue ? (
              <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-[6px] flex items-start gap-2.5 text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-[11px] font-heading uppercase tracking-wider font-semibold text-amber-900">
                      Payment Due
                    </span>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300/80">
                      Pending
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium mt-0.5 block text-amber-950">
                    {formatDateTime(order.latestActivityAt || order.createdAt) || order.time}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-galla-paper/30 border border-galla-line rounded-[6px] flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-galla-teal shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-heading uppercase tracking-wider text-galla-ink-soft font-semibold">
                    Last Activity
                  </span>
                  <span className="text-[12.5px] font-medium text-galla-ink mt-0.5 block">
                    {formatDateTime(order.latestActivityAt || order.createdAt) || order.time}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Items Purchased ("What they buy") */}
          <div className="border border-galla-line rounded-[8px] overflow-hidden bg-galla-surface shadow-2xs">
            <div className="px-4 py-2.5 bg-galla-paper/60 border-b border-galla-line flex items-center justify-between">
              <span className="font-heading font-bold text-[12px] uppercase tracking-wider text-galla-ink-soft">
                Items Purchased ({order.lineItems?.length || (order.itemsSummary ? 1 : 0)})
              </span>
              <span className="text-[11.5px] text-galla-ink-soft font-sans">
                Type &bull; Qty &bull; Price
              </span>
            </div>

            {order.lineItems && order.lineItems.length > 0 ? (
              <div className="divide-y divide-galla-line/70">
                {order.lineItems.map((item, idx) => (
                  <div key={idx} className="p-3.5 hover:bg-galla-paper/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.itemType === "product" ? (
                            <ShoppingBag className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          ) : item.itemType === "package" ? (
                            <Package className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <Scissors className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          )}
                          <span className={`font-sans font-semibold text-[14px] ${item.returnedQuantity && item.returnedQuantity === item.quantity ? "text-galla-ink-soft line-through" : "text-galla-ink"}`}>
                            {item.name}
                          </span>
                          <span
                            className={`text-[10.5px] font-medium uppercase px-1.5 py-0.2 rounded border ${
                              item.itemType === "product"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : item.itemType === "package"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}
                          >
                            {item.itemType}
                          </span>
                          {item.returnedQuantity ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 ml-1">
                              {item.returnedQuantity} Returned
                            </span>
                          ) : null}
                          {item.itemType === "product" && order.status !== "cancelled_refunded" && order.status !== "cancelled_converted" && (!item.returnedQuantity || item.returnedQuantity < item.quantity) && (
                            <button
                              onClick={() => setReturningItemIndex(idx)}
                              className="ml-2 text-[11px] font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-100 transition-colors flex items-center gap-1"
                            >
                              <Undo2 className="h-3 w-3" />
                              Return
                            </button>
                          )}
                        </div>

                        {/* Package Components Breakdown */}
                        {item.packageDetails?.components && item.packageDetails.components.length > 0 && (
                          <div className="pl-5 pt-1 space-y-0.5">
                            <span className="text-[11px] font-medium text-galla-ink-soft">
                              Includes services:
                            </span>
                            <ul className="list-disc list-inside text-[11px] text-galla-ink-soft/90 space-y-0.5">
                              {item.packageDetails.components.map((comp, cIdx) => (
                                <li key={cIdx}>
                                  {comp.name} ({formatRupee(comp.componentPrice)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Product Delivery / Fulfillment status */}
                        {item.itemType === "product" && (
                          <div className="pl-5 text-[11px]">
                            {item.fulfilled ? (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Delivered / Handed over
                              </span>
                            ) : order.paid >= order.amount ? (
                              <span className="text-blue-700 font-medium inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Fully Paid &bull; Delivery Pending (Awaiting Stock Pickup)
                              </span>
                            ) : order.paid > 0 ? (
                              <span className="text-amber-800 font-medium inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Advance Received &bull; Delivery Pending
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Pending Pickup / Backorder
                              </span>
                            )}
                          </div>
                        )}

                        {/* Package Fulfillment status */}
                        {item.itemType === "package" && (
                          <div className="pl-5 text-[11px]">
                            {item.fulfilled ? (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Package Rendered &bull; Products Deducted
                              </span>
                            ) : (
                              <span className="text-indigo-700 font-medium inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Advance Booking &bull; Products deducted on order completion
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-heading font-semibold text-[14px] text-galla-ink tabular-nums">
                          {formatRupee(item.finalPrice)}
                        </div>
                        <div className="text-[11.5px] text-galla-ink-soft font-mono">
                          {item.quantity} &times; {formatRupee(item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-[13px] text-galla-ink-soft">
                {order.itemsSummary ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-galla-ink">{order.itemsSummary}</span>
                    <span className="font-heading font-semibold text-galla-ink tabular-nums">
                      {formatRupee(order.amount)}
                    </span>
                  </div>
                ) : (
                  <span>{order.type} &bull; {formatRupee(order.amount)}</span>
                )}
              </div>
            )}
          </div>

          {/* Billing & Financial Breakdown */}
          <div className="p-4 bg-galla-paper/40 border border-galla-line rounded-[8px] space-y-2">
                <span className="block font-heading font-bold text-[12px] uppercase tracking-wider text-galla-ink-soft border-b border-galla-line/60 pb-1.5">
                  Payment &amp; Financial Summary
                </span>

                {(typeof order.subtotal === "number" || (order.lineItems && order.lineItems.length > 0)) &&
                  (itemsSubtotal !== order.amount || extraOnBill > 0) && (
                    <div className="flex justify-between text-[13px] text-galla-ink-soft">
                      <span>Subtotal:</span>
                      <span className="tabular-nums font-mono">{formatRupee(itemsSubtotal)}</span>
                    </div>
                  )}

                {order.discountAmount && order.discountAmount > 0 ? (
                  <div className="flex justify-between text-[13px] text-emerald-700 font-medium">
                    <span>
                      Discount {order.discountType === "percentage" ? `(${order.discountValue}%)` : ""}:
                    </span>
                    <span className="tabular-nums font-mono">- {formatRupee(order.discountAmount)}</span>
                  </div>
                ) : null}

                {extraOnBill > 0 && (
                  <div className="flex justify-between text-[13px] text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Extra Paid:</span>
                    </span>
                    <span className="tabular-nums font-mono">+{formatRupee(extraOnBill)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[14px] font-heading font-semibold text-galla-ink pt-1 border-t border-galla-line/40">
                  <span>Total Bill Amount:</span>
                  <span className="tabular-nums text-[16px]">{formatRupee(order.amount)}</span>
                </div>

                {isRefunded ? (
                  <>
                    <div className="flex justify-between text-[13.5px] text-galla-ink font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-galla-ink-soft" />
                        <span>Amount Collected:</span>
                      </span>
                      <span className="tabular-nums font-mono">
                        {formatRupee(totalCollected)}
                      </span>
                    </div>

                    <div className="flex justify-between text-[13px] text-rose-700 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Undo2 className="h-3.5 w-3.5" />
                        <span>Total Refunded:</span>
                      </span>
                      <span className="tabular-nums font-mono">
                        - {formatRupee(totalRefunded)}
                      </span>
                    </div>

                    {retainedByShop > 0 && (
                      <div className="flex justify-between text-[13px] text-emerald-800 font-semibold bg-emerald-50/70 p-2 rounded border border-emerald-200/80">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Retained by Shop (Charge / Fee):</span>
                        </span>
                        <span className="tabular-nums font-mono text-[14px]">+{formatRupee(retainedByShop)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-[13.5px] text-emerald-700 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" />
                        <span>Amount Paid:</span>
                      </span>
                      <span className="tabular-nums font-mono">{formatRupee(order.paid)}</span>
                    </div>

                    {combinedPayments.some((p) => p.type === "refund" || p.amount < 0) && (
                      <div className="flex justify-between text-[13px] text-rose-700 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Undo2 className="h-3.5 w-3.5" />
                          <span>Total Refunded:</span>
                        </span>
                        <span className="tabular-nums font-mono">
                          - {formatRupee(
                            combinedPayments
                              .filter((p) => p.type === "refund" || p.amount < 0)
                              .reduce((sum, p) => sum + Math.abs(p.amount), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {overpaid > 0 && (
                  <div className="flex justify-between text-[13px] text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Overpaid Extra:</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                        +{formatRupee(overpaid)}
                      </span>
                    </span>
                    <span className="tabular-nums font-mono">+{formatRupee(overpaid)}</span>
                  </div>
                )}

                {isDue ? (
                  <div className="flex justify-between text-[13.5px] text-rose-700 font-semibold pt-1 border-t border-galla-line/40">
                    <span className="inline-flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Pending Due Balance:</span>
                    </span>
                    <span className="tabular-nums font-mono text-[15px]">{formatRupee(dueAmount)}</span>
                  </div>
                ) : isCompleted ? (
                  <div className="flex justify-between text-[12.5px] text-emerald-800 font-medium pt-1 border-t border-galla-line/40">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Balance:</span>
                    </span>
                    {totalExtra > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>Fully Settled</span>
                        <span className="text-[10.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                          +{formatRupee(totalExtra)} Extra Paid
                        </span>
                      </span>
                    ) : (
                      <span>Fully Settled (₹0 Due)</span>
                    )}
                  </div>
                ) : null}

            {/* Payment History Log */}
            {combinedPayments.length > 0 && (() => {
              const getPaymentBadge = (p: typeof combinedPayments[number], idx: number, total: number) => {
                if (p.type === "refund" || p.amount < 0) {
                  return { label: "Refund", style: "bg-rose-50 text-rose-800 border-rose-200/90" };
                }
                if (p.type === "advance") {
                  return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                }
                if (p.type === "settlement") {
                  return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                }
                if (p.type === "full_payment") {
                  return { label: "Full Payment", style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20" };
                }

                // Intelligently infer for existing historical orders
                if (total > 1) {
                  if (idx === 0) {
                    return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                  }
                  if (idx === total - 1) {
                    return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                  }
                  return { label: `Part ${idx + 1}`, style: "bg-blue-50 text-blue-800 border-blue-200/90" };
                }

                if (
                  order.status === "advance_paid" ||
                  (order.advanceAmount && order.advanceAmount > 0) ||
                  order.paid < order.amount
                ) {
                  return { label: "Advance", style: "bg-amber-50 text-amber-800 border-amber-200/90" };
                }
                if (order.notes?.toLowerCase().includes("cleared via")) {
                  return { label: "Settle", style: "bg-emerald-50 text-emerald-800 border-emerald-200/90" };
                }
                return { label: "Full Payment", style: "bg-galla-teal/10 text-galla-teal border-galla-teal/20" };
              };

              return (
                <div className="pt-2 border-t border-galla-line/60 space-y-1.5">
                  <span className="text-[11px] font-heading uppercase tracking-wider text-galla-ink-soft block font-semibold">
                    Payment History ({combinedPayments.length})
                  </span>
                  <div className="space-y-1">
                    {combinedPayments.map((p, pIdx) => {
                      const badge = getPaymentBadge(p, pIdx, combinedPayments.length);
                      const isRefund = p.type === "refund" || p.amount < 0;
                      return (
                        <div
                          key={pIdx}
                          className="bg-galla-surface rounded border border-galla-line/60 flex flex-col"
                        >
                          <div className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5 text-galla-ink-soft">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0 ${badge.style}`}
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
                            <span className="font-mono text-[11px] text-galla-ink-soft/75">
                              {formatDateTime(p.recordedAt)}
                            </span>
                          </div>
                          {p.notes && (
                            <div className="px-2.5 pb-1.5 pt-1 text-[11px] text-galla-ink-soft/80 bg-galla-paper/30">
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

          {/* Returns & Replacements History Log */}
          {order.returns && order.returns.length > 0 && (
            <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-[6px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-heading uppercase tracking-wider text-rose-900 font-semibold flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-rose-700" />
                  <span>Item Returns &amp; Replacements ({order.returns.length})</span>
                </span>
              </div>
              <div className="space-y-1.5">
                {order.returns.map((ret, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-2.5 bg-galla-surface rounded-[4px] border border-rose-200/70 text-[11.5px] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-galla-ink">
                          {ret.quantity}x {ret.productName}
                        </span>
                        <span
                          className={`text-[9.5px] font-heading font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                            ret.returnCondition === "defective_dealer_claim"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {ret.returnCondition === "defective_dealer_claim" ? "Defective" : "Good (Restocked)"}
                        </span>
                      </div>
                      <span className="font-mono text-[10.5px] text-galla-ink-soft">
                        {ret.returnedAt ? formatDateTime(ret.returnedAt) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-galla-ink-soft">
                      <span>
                        Resolution:{" "}
                        <strong className="text-galla-ink font-medium">
                          {ret.customerResolution === "replacement"
                            ? ret.expectedPickupDate
                              ? `Replacement Scheduled (Expected: ${formatBookingDate(ret.expectedPickupDate)})`
                              : "Replacement Handed Over"
                            : `Refunded ${formatRupee(ret.refundAmount)} via ${(ret.refundMode || "cash").toUpperCase()}`}
                        </strong>
                      </span>
                      {ret.restockLocation && (
                        <span>
                          &bull; Destination:{" "}
                          <span className="text-galla-ink font-medium">
                            {ret.restockLocation === "sellStock" ? "Retail Shelf" : "Salon Use"}
                          </span>
                        </span>
                      )}
                    </div>

                    {ret.notes && (
                      <div className="text-[11px] text-galla-ink-soft/80 italic pt-0.5 border-t border-galla-line/40">
                        &ldquo;{ret.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refund Details if refunded */}
          {isRefunded && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] space-y-1.5 text-[12.5px] text-rose-900">
              <div className="flex items-center justify-between font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-rose-700" />
                  <span>Refund Issued:</span>
                </span>
                <span className="font-mono tabular-nums text-rose-800">
                  {formatRupee(totalRefunded)}
                  {order.refundMode ? ` (${order.refundMode.toUpperCase()})` : ""}
                </span>
              </div>

              {retainedByShop > 0 && (
                <div className="flex items-center justify-between text-[12px] text-emerald-800 font-semibold pt-1 border-t border-rose-200/60">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Retained by Shop (Charge / Fee):</span>
                  </span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    +{formatRupee(retainedByShop)}
                  </span>
                </div>
              )}

              {order.refundReason && (
                <div className="text-[12px] text-rose-800 pt-0.5">
                  Reason: {order.refundReason}
                </div>
              )}
            </div>
          )}

          {/* Order Notes / Settlement Notice */}
          {order.notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-[6px] flex items-start gap-2 text-[12px] text-amber-950">
              <FileText className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Notes &amp; Settlement:</span>
                <p className="mt-0.5 leading-relaxed">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-galla-line bg-galla-paper/30 flex items-center justify-between shrink-0">
          <div className="text-[12px] text-galla-ink-soft">
            {isDue ? (
              <span className="text-amber-800 font-medium">
                Customer has {formatRupee(dueAmount)} remaining due
                {!isScheduledDateArrived && order.scheduledFor && (
                  <span className="text-[11px] text-galla-ink-soft/80 block sm:inline sm:ml-1 font-normal">
                    &bull; Settle available on appointment day ({formatBookingDate(order.scheduledFor)})
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

          <div className="flex items-center gap-2">
            {isDue && isScheduledDateArrived && onOpenSettle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettle(order);
                }}
                className="px-3.5 py-1.5 rounded-[5px] text-[12.5px] font-sans font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
              >
                Settle Due ({formatRupee(dueAmount)})
              </button>
            )}

            {!isDue && !isCompleted && hasPendingDelivery && isScheduledDateArrived && onOpenSettle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettle(order);
                }}
                className="px-3.5 py-1.5 rounded-[5px] text-[12.5px] font-sans font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Deliver &amp; Complete Order</span>
              </button>
            )}

            {(isAdvance || isDue || isReplacement) && onOpenReschedule && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReschedule(order);
                }}
                className="px-3 py-1.5 rounded-[5px] text-[12.5px] font-sans font-medium bg-galla-surface text-galla-ink border border-galla-line hover:border-galla-ink-soft transition-colors cursor-pointer"
              >
                {order.scheduledFor ? "Reschedule" : "Set Delivery Date"}
              </button>
            )}

            {isCompleted && order.paid > 0 && onOpenRefund && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRefund(order);
                }}
                className="px-3 py-1.5 rounded-[5px] text-[12.5px] font-sans font-medium bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Refund
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

      {returningItemIndex !== null && order.lineItems && (
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
