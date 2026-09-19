import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupee(amount: number): string {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return "₹" + safe.toLocaleString("en-IN");
}

export function calculatePendingAmount(
  orders: { status: string; amount?: number; paid?: number }[]
): number {
  return orders
    .filter(
      (o) =>
        o.status !== "cancelled_refunded" &&
        o.status !== "cancelled_converted"
    )
    .reduce((sum, o) => {
      const amt = typeof o.amount === "number" && !isNaN(o.amount) ? o.amount : 0;
      const paid = typeof o.paid === "number" && !isNaN(o.paid) ? o.paid : 0;
      return sum + Math.max(0, amt - paid);
    }, 0);
}

/**
 * Normalizes and formats mobile numbers into the standard format: +91 00000 00000
 * Handles raw 10 digits, +91 prefixes, leading zeros, dashes, and spaces.
 */
export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (!cleaned) return "";

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;

  let standardDigits = digits;
  if (standardDigits.length === 12 && standardDigits.startsWith("91")) {
    standardDigits = standardDigits.slice(2);
  } else if (standardDigits.length === 11 && standardDigits.startsWith("0")) {
    standardDigits = standardDigits.slice(1);
  } else if (standardDigits.length > 10) {
    standardDigits = standardDigits.slice(-10);
  }

  if (standardDigits.length === 10) {
    return `+91 ${standardDigits.slice(0, 5)} ${standardDigits.slice(5)}`;
  }

  if (digits.length <= 5) {
    return `+91 ${digits}`;
  }
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function checkIsToday(date: Date | string | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function checkIsLast24Hours(date: Date | string | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= 24 * 60 * 60 * 1000;
}

export function formatOrderTime(date: Date | string | undefined): string {
  if (!date) return "Today, Just now";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Today, Just now";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeStr}`;
}

export function getLocalDateString(isoOrDate: string | Date = new Date()): string {
  if (!isoOrDate) return "";
  if (typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate;
  }
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFirstDayOfCurrentMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatBookingDate(date: Date | string | undefined): string {
  if (!date) return "";
  let d: Date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, day] = date.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type BookingUrgencyTone = "today" | "tomorrow" | "in_2_days" | "future" | "overdue";

export interface BookingUrgency {
  daysAway: number;
  tone: BookingUrgencyTone;
  label: string;
}

export function getBookingUrgency(dateInput: Date | string | undefined): BookingUrgency | null {
  if (!dateInput) return null;
  let d: Date;
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return null;

  // ponytail: Midnight comparison uses local date. Upgrade path: pass tenant timezone offset if multi-country support is needed.
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { daysAway: 0, tone: "today", label: "Today" };
  }
  if (diffDays === 1) {
    return { daysAway: 1, tone: "tomorrow", label: "Tomorrow" };
  }
  if (diffDays === 2) {
    return { daysAway: 2, tone: "in_2_days", label: "In 2 Days" };
  }
  if (diffDays < 0) {
    return { daysAway: diffDays, tone: "overdue", label: `${Math.abs(diffDays)}d ago` };
  }
  return { daysAway: diffDays, tone: "future", label: `In ${diffDays} days` };
}

export function formatAppointmentTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (!trimmed) return "";

  if (/am|pm/i.test(trimmed)) return trimmed;

  const [hStr, mStr] = trimmed.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return trimmed;

  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  const displayM = String(m).padStart(2, "0");
  return `${String(displayH).padStart(2, "0")}:${displayM} ${period}`;
}

export function getUrgencyBadgeConfig(
  dateInput: Date | string | undefined,
  timeInput?: string | null,
  context: "booking" | "delivery" | "due_date" = "booking"
): {
  urgency: BookingUrgency | null;
  isUrgent: boolean;
  isOverdue: boolean;
  isToday: boolean;
  formattedDate: string;
  formattedSlot: string;
  badgeStyle: string;
  badgeLabel: string;
} {
  const urgency = getBookingUrgency(dateInput);
  const formattedDate = formatBookingDate(dateInput);
  const formattedTime = timeInput ? formatAppointmentTime(timeInput) : null;
  const formattedSlot = formattedTime ? `${formattedDate}, ${formattedTime}` : formattedDate;

  const isToday = urgency?.tone === "today";
  const isOverdue = urgency?.tone === "overdue";
  const isTomorrow = urgency?.tone === "tomorrow";
  const isUrgent = Boolean(isToday || isOverdue);

  let badgeStyle = "text-galla-ink-soft bg-galla-paper border-galla-line/80 font-normal";
  if (isOverdue) {
    badgeStyle = "text-red-900 bg-red-100 border-red-300 font-semibold";
  } else if (isToday) {
    badgeStyle = "text-rose-800 bg-rose-50 border-rose-300 font-semibold";
  } else if (isTomorrow) {
    badgeStyle = "text-amber-900 bg-amber-50 border-amber-300 font-medium";
  }

  let prefix = "";
  if (context === "due_date") {
    prefix = isOverdue ? "⚠️ Overdue Due Date" : isToday ? "🚨 Due Today" : "Due:";
  } else if (context === "delivery") {
    prefix = isOverdue ? "⚠️ Delivery Overdue" : isToday ? "🚨 Delivery Today" : "Delivery:";
  } else {
    prefix = isOverdue ? "⚠️ Overdue" : isToday ? "🚨 Today" : "Scheduled:";
  }

  const badgeLabel = `${prefix} (${formattedSlot})`;

  return {
    urgency,
    isUrgent,
    isOverdue,
    isToday,
    formattedDate,
    formattedSlot,
    badgeStyle,
    badgeLabel,
  };
}

export function getWhatsAppReminderUrl(options: {
  phone?: string;
  customerName: string;
  salonName: string;
  bookingDate: Date | string | undefined;
  bookingTime?: string;
  orderType?: "Product sale" | "Service booking" | "Package sale";
  productName?: string;
  orderId?: string;
  pendingAmount?: number;
  isPaymentDue?: boolean;
}): string | null {
  if (!options.phone) return null;
  const cleaned = options.phone.replace(/\D/g, "");
  if (!cleaned) return null;

  // ponytail: Assumes Indian 10-digit mobile numbers (+91). Upgrade path: Add country code support to tenant profile if expanding internationally.
  const standardNumber =
    cleaned.length === 10
      ? `91${cleaned}`
      : cleaned.startsWith("0") && cleaned.length === 11
        ? `91${cleaned.slice(1)}`
        : cleaned;

  const formattedDate = formatBookingDate(options.bookingDate);
  const formattedTime = formatAppointmentTime(options.bookingTime);

  // Payment Due reminder format
  if (options.isPaymentDue) {
    const dueAmountStr = options.pendingAmount && options.pendingAmount > 0
      ? ` of *${formatRupee(options.pendingAmount)}*`
      : "";

    const message =
      `Hello ${options.customerName}! 👋\n\n` +
      `This is a friendly reminder from *${options.salonName || "our salon"}* regarding your pending balance${dueAmountStr}.\n\n` +
      `Please let us know when you would like to clear the payment, or visit us at your convenience.\n\n` +
      `Thank you!`;

    return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
  }

  // Product pickup message format
  if (options.orderType === "Product sale") {
    const productInfo = options.productName ? ` for *${options.productName}*` : "";

    const message =
      `Hello ${options.customerName}! 👋\n\n` +
      `Great news! Your product order${productInfo} is available at *${options.salonName || "our salon"}* and ready for pickup! 🛍️\n\n` +
      `Please visit us at your convenience to collect your order. Let us know if you need any assistance!\n\n` +
      `Thank you!`;

    return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
  }

  // Service appointment reminder format
  const message = formattedTime
    ? `Hello ${options.customerName}! 👋\n\n` +
    `This is a friendly reminder from ${options.salonName || "our salon"} for your appointment tomorrow (${formattedDate} at ${formattedTime}).\n\n` +
    `Please let us know if you need to reschedule or adjust your time.\n\n` +
    `We look forward to welcoming you!`
    : `Hello ${options.customerName}! 👋\n\n` +
    `This is a friendly reminder from ${options.salonName || "our salon"} for your appointment tomorrow (${formattedDate}).\n\n` +
    `Please reply with your preferred time to visit the salon, or let us know if you need to reschedule.\n\n` +
    `We look forward to welcoming you!`;

  return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
}

/**
 * Strips the 4-digit tenant code prefix from standard Galla sequence numbers
 * for in-app display (e.g. "0007-S-2609-0014" -> "S-2609-0014", "0007-PO-2609-0004" -> "PO-2609-0004", "0007-EXP-2609-0032" -> "EXP-2609-0032").
 * Leaves legacy or non-matching numbers (e.g. "#1042", "PO-2026-0001") unchanged.
 */
export function formatDisplayNumber(num?: string | null): string {
  if (!num) return "";
  const match = num.match(/^\d{4}-([A-Z]+-\d{4}-\d{4})$/);
  if (match) {
    return match[1];
  }
  return num;
}

export function getSupplierWhatsAppReminderUrl(options: {
  phone?: string;
  supplierName: string;
  salonName?: string;
  poNumber: string;
  dealerInvoiceNumber?: string;
  deliveryDate?: Date | string;
  deliveryTime?: string;
  dueDate?: Date | string;
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  itemsSummary?: string;
  items?: {
    productName: string;
    quantityForSell?: number;
    quantityForUse?: number;
    itemTotalCost?: number;
  }[];
  mode?: "delivery" | "payment_due" | "advance";
  isAdvance?: boolean;
}): string | null {
  if (!options.phone) return null;
  const cleaned = options.phone.replace(/\D/g, "");
  if (!cleaned) return null;

  // ponytail: Assumes Indian 10-digit mobile numbers (+91). Upgrade path: Add country code support to tenant profile if expanding internationally.
  const standardNumber =
    cleaned.length === 10
      ? `91${cleaned}`
      : cleaned.startsWith("0") && cleaned.length === 11
        ? `91${cleaned.slice(1)}`
        : cleaned;

  const salonDisplayName = options.salonName?.trim() || "our salon";
  const hasDealerInvoice = Boolean(options.dealerInvoiceNumber && options.dealerInvoiceNumber.trim());
  const dealerInv = options.dealerInvoiceNumber?.trim();

  // User rule: "don't show our bill no. show their bill no."
  const billReference = hasDealerInvoice
    ? `your Bill / Invoice *#${dealerInv}*`
    : `our stock purchase`;

  // Format products list
  let itemsFormatted = "";
  if (options.items && options.items.length > 0) {
    itemsFormatted = options.items
      .map((it: any) => {
        const name = it.productName || it.name || "Product";
        const qty =
          (it.quantityForSell || 0) + (it.quantityForUse || 0) ||
          it.quantity ||
          0;
        const qtyStr = qty > 0 ? ` (${qty} pcs)` : "";
        const cost = it.itemTotalCost ?? it.totalCost ?? (it.unitPrice && qty ? it.unitPrice * qty : undefined);
        const costStr = cost ? ` - ${formatRupee(cost)}` : "";
        return `• ${name}${qtyStr}${costStr}`;
      })
      .join("\n");
  } else if (options.itemsSummary) {
    itemsFormatted = options.itemsSummary
      .split(",")
      .map((s) => `• ${s.trim()}`)
      .filter(Boolean)
      .join("\n");
  }

  const formattedDeliveryDate = options.deliveryDate ? formatBookingDate(options.deliveryDate) : "";
  const formattedDeliveryTime = options.deliveryTime ? formatAppointmentTime(options.deliveryTime) : "";
  const deliveryStr = formattedDeliveryDate
    ? `${formattedDeliveryDate}${formattedDeliveryTime ? ` at ${formattedDeliveryTime}` : ""}`
    : "Expected soon";

  const formattedDueDate = options.dueDate ? formatBookingDate(options.dueDate) : "Immediate / On Delivery";

  // Case 1: Advance Order Message
  if (options.mode === "advance" || options.isAdvance) {
    const message =
      `Hello ${options.supplierName}! 👋\n\n` +
      `This is an update from *${salonDisplayName}* regarding our advance order for ${billReference}.\n\n` +
      (itemsFormatted ? `📦 *Products Ordered:*\n${itemsFormatted}\n\n` : "") +
      (hasDealerInvoice ? `📄 *Bill / Invoice No:* #${dealerInv}\n` : "") +
      `💰 *Total Amount:* ${formatRupee(options.totalAmount)}\n` +
      `✅ *Advance Paid:* ${formatRupee(options.amountPaid)}\n` +
      `⏳ *Balance Remaining:* ${formatRupee(options.amountPending)}\n` +
      `📅 *Expected Delivery:* ${deliveryStr}\n\n` +
      `Could you please share the current dispatch / delivery status of this advance order?\n\n` +
      `Thank you!`;

    return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
  }

  // Case 2: Pending Payment Message (Salon owes supplier, inviting supplier to collect payment)
  if (options.mode === "payment_due" || options.amountPending > 0) {
    const message =
      `Hello ${options.supplierName}! 👋\n\n` +
      `This is a payment update from *${salonDisplayName}* regarding ${billReference}.\n\n` +
      (itemsFormatted ? `📦 *Products / Stock:*\n${itemsFormatted}\n\n` : "") +
      (hasDealerInvoice ? `📄 *Your Bill / Invoice No:* #${dealerInv}\n` : "") +
      `💰 *Total Bill:* ${formatRupee(options.totalAmount)}\n` +
      `✅ *Paid So Far:* ${formatRupee(options.amountPaid)}\n` +
      `⏳ *Pending Balance Due:* ${formatRupee(options.amountPending)}\n` +
      (options.dueDate ? `📅 *Due Date:* ${formattedDueDate}\n\n` : `\n`) +
      `Your pending payment of *${formatRupee(options.amountPending)}* is ready for collection. Please visit our salon to collect your payment or let us know your preferred payment method (UPI / Bank Transfer / Cash) so we can settle it right away.\n\n` +
      `Thank you!`;

    return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
  }

  // Case 3: Fully Paid / Delivery Inquiry
  const message =
    `Hello ${options.supplierName}! 👋\n\n` +
    `This is an inquiry from *${salonDisplayName}* regarding ${billReference}.\n\n` +
    (itemsFormatted ? `📦 *Products:*\n${itemsFormatted}\n\n` : "") +
    (hasDealerInvoice ? `📄 *Bill / Invoice No:* #${dealerInv}\n` : "") +
    `📅 *Expected Delivery:* ${deliveryStr}\n` +
    `💰 *Total Bill:* ${formatRupee(options.totalAmount)}\n` +
    `✨ *Payment Status:* Fully Paid\n\n` +
    `Could you please share the current delivery / dispatch status of this shipment?\n\n` +
    `Thank you!`;

  return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
}

export type BillStatusKey = "advance" | "completed" | "pending";

export function getBillStatus(po: {
  amountPending: number;
  amountPaid: number;
  totalAmount: number;
  paymentStatus?: "paid" | "partial" | "unpaid";
  settlementMode?: "advance" | "pending" | "paid_full" | "completed";
  stockAllocated?: boolean;
  expectedDeliveryDate?: Date | string;
  notes?: string;
  paymentMode?: string;
}): {
  statusKey: BillStatusKey;
  pillStatus: "advance_paid" | "completed" | "created";
  label: string;
} {
  const isCleared = po.paymentStatus === "paid" || po.amountPending <= 0;

  // 1. If stock is not yet allocated, goods are awaiting delivery (advance / pre-order)
  if (po.stockAllocated === false) {
    return { statusKey: "advance", pillStatus: "advance_paid", label: "Advance" };
  }

  // 2. If fully cleared and stock is allocated -> Completed
  if (isCleared) {
    return { statusKey: "completed", pillStatus: "completed", label: "Completed" };
  }

  // 3. For legacy POs where stockAllocated is undefined:
  if (po.stockAllocated === undefined) {
    const isLegacyAdvance =
      po.settlementMode === "advance" ||
      Boolean(po.expectedDeliveryDate) ||
      Boolean(po.notes && /advance/i.test(po.notes));
    if (isLegacyAdvance && !isCleared) {
      return { statusKey: "advance", pillStatus: "advance_paid", label: "Advance" };
    }
  }

  // 4. Otherwise (stock is received, but payment is still pending) -> Pending / Pay Later
  return { statusKey: "pending", pillStatus: "created", label: "Pending" };
}

export function getBillLastUpdatedTime(po: {
  updatedAt?: Date | string;
  createdAt?: Date | string;
  invoiceDate?: Date | string;
  lastUpdatedTime?: string;
  payments?: Array<{ recordedAt?: Date | string; type?: string }>;
}): string | undefined {
  if (po.lastUpdatedTime) return po.lastUpdatedTime;

  const candidateTimestamps = [
    po.updatedAt ? new Date(po.updatedAt).getTime() : 0,
    ...(po.payments || []).map((p) => (p.recordedAt ? new Date(p.recordedAt).getTime() : 0)),
  ].filter((t): t is number => Boolean(t) && !isNaN(t));

  if (candidateTimestamps.length === 0) return undefined;

  const latestTime = Math.max(...candidateTimestamps);
  const createdTime = po.createdAt
    ? new Date(po.createdAt).getTime()
    : po.invoiceDate
    ? new Date(po.invoiceDate).getTime()
    : 0;

  const isMeaningfullyUpdated = Boolean(
    (createdTime > 0 && latestTime - createdTime > 5000) ||
    (po.payments && po.payments.length > 1) ||
    po.payments?.some((p) => p.type === "settlement")
  );

  if (isMeaningfullyUpdated && latestTime) {
    return formatOrderTime(new Date(latestTime));
  }

  return undefined;
}
