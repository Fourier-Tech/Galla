import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupee(amount: number): string {
  const safe = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const floored = Math.floor(Math.abs(safe));
  if (safe < 0) {
    return "-₹" + floored.toLocaleString("en-IN");
  }
  return "₹" + floored.toLocaleString("en-IN");
}

export function getOrderEffectiveBilling(order: {
  amount?: number;
  paid?: number;
  returns?: { refundAmount?: number; cashRefund?: number; dueDeduction?: number; refundMode?: string; customerResolution?: string }[];
}) {
  const returnEvents = Array.isArray(order.returns) ? order.returns : [];
  const returnRefundTotal = returnEvents
    .filter((r) => r.customerResolution === "refund")
    .reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const cashRefundTotal = returnEvents.reduce((sum, r) => {
    if (typeof r.cashRefund === "number") return sum + r.cashRefund;
    return sum + (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? r.refundAmount || 0 : 0);
  }, 0);
  const effectiveOrderAmount = Math.max(0, (order.amount || 0) - returnRefundTotal);
  const effectivePaid = Math.max(0, (order.paid || 0) - cashRefundTotal);
  const effectiveDue = Math.max(0, effectiveOrderAmount - effectivePaid);

  return { effectiveOrderAmount, effectivePaid, effectiveDue };
}

export function getOrderPendingDue(order: {
  status?: string;
  amount?: number;
  paid?: number;
  returns?: { refundAmount?: number; cashRefund?: number; dueDeduction?: number; refundMode?: string; customerResolution?: string }[];
}): number {
  if (
    order.status === "completed" ||
    order.status === "replacement_completed" ||
    order.status === "cancelled_refunded" ||
    order.status === "cancelled_converted"
  ) {
    return 0;
  }
  return getOrderEffectiveBilling(order).effectiveDue;
}

export function calculatePendingAmount(
  orders: Parameters<typeof getOrderPendingDue>[0][]
): number {
  return orders.reduce((sum, o) => sum + getOrderPendingDue(o), 0);
}

export function getOrderEffectiveStatus(order: Parameters<typeof getOrderPendingDue>[0]): string {
  if (order.status === "created" && getOrderPendingDue(order) <= 0) {
    return "completed";
  }
  return order.status || "created";
}

export function getPhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (!cleaned) return "";

  let s = cleaned;
  if (s.startsWith("+91") || s.startsWith("+ 91")) {
    s = s.replace(/^\+\s*91[\s-]*/, "");
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2, 12);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1, 11);
  } else if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits.slice(0, 10);
}

/**
 * Normalizes and formats mobile numbers into standard format: +91 00000 00000
 * Handles raw 10 digits, +91 prefixes, leading zeros, dashes, and spaces.
 */
export function formatPhoneNumber(phone?: string | null): string {
  // ponytail: Standard Indian +91 10-digit mobile number format. Upgrade path: international dial code parser (e.g. libphonenumber-js) if supporting non-Indian phone numbers.
  const digits = getPhoneDigits(phone);
  if (!digits) return "";
  if (digits.length <= 5) return `+91 ${digits}`;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * Formats a customer name in Title Case where the first letter of each word
 * is capitalized and all other letters are lowercase (e.g. "ANSh GaJera" -> "Ansh Gajera").
 */
export function formatCustomerName(name?: string | null): string {
  // ponytail: Simple whitespace title-casing. Upgrade path: add locale-aware capitalization rules or prefix handling (e.g. McDonald, von, van) if expanding internationally.
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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
  isReplacement?: boolean;
  isTomorrow?: boolean;
  isToday?: boolean;
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

  // Replacement order pickup / delivery reminder format
  if (options.isReplacement) {
    const productInfo = options.productName ? ` for *${options.productName}*` : "";
    const timing = options.isTomorrow ? "tomorrow" : options.isToday ? "today" : `on *${formattedDate}*`;
    const message =
      `Hello ${options.customerName}! 👋\n\n` +
      `This is an update from *${options.salonName || "our salon"}* regarding your replacement product${productInfo}.\n\n` +
      `Your replacement delivery is scheduled ${timing}. We will notify you as soon as it arrives for pickup!\n\n` +
      `Please let us know if you have any questions or wish to reschedule.\n\n` +
      `Thank you!`;

    return `https://api.whatsapp.com/send/?phone=${standardNumber}&text=${encodeURIComponent(message)}`;
  }

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
 * Strips tenant sequence prefixes from standard Galla sequence numbers
 * for in-app display (e.g. "0001-S-2609-0014" -> "S-2609-0014", "0001-PO-2609-0004" -> "PO-2609-0004", "0001-EXP-2609-0032" -> "EXP-2609-0032").
 * Leaves legacy or non-matching numbers (e.g. "#1042", "PO-2026-0001") unchanged.
 */
export function formatDisplayNumber(num?: string | null): string {
  if (!num) return "";
  const clean = num.startsWith("#") ? num.slice(1) : num;
  const retPrefix = clean.startsWith("RET-") ? "RET-" : "";
  const toMatch = retPrefix ? clean.slice(4) : clean;
  const match = toMatch.match(/^\d{3,6}-([A-Za-z]+-\d{4}-\d{4}(?:-\d+)?)$/);
  if (match) {
    return retPrefix + match[1];
  }
  return clean;
}

/**
 * Strips tenant sequence prefixes from order/expense/PO IDs found anywhere inside free-form notes, memos, or text
 * (e.g. "Replacement order for 1x ... (Original Order #0001-P-2610-0006)." -> "... #P-2610-0006).")
 */
export function formatNoteDisplay(text?: string | null): string {
  return text ? text.replace(/\b\d{3,6}-([A-Za-z]+-\d{4}-\d{4}(?:-\d+)?)\b/g, "$1") : "";
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
  if ((options.mode === "advance" || options.isAdvance) && options.amountPending > 0) {
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
  pillStatus: "advance_paid" | "completed" | "created" | "paid_full";
  label: string;
} {
  const isCleared = po.paymentStatus === "paid" || po.amountPending <= 0;

  // 1. If explicitly marked completed, it is Completed
  if (po.settlementMode === "completed" || (isCleared && po.stockAllocated === true)) {
    return { statusKey: "completed", pillStatus: "completed", label: "Completed" };
  }

  // 2. If stock is not yet allocated, goods are awaiting delivery (advance / pre-order)
  if (po.stockAllocated === false) {
    const isPaidFull = po.settlementMode === "paid_full" || isCleared;
    return {
      statusKey: "advance",
      pillStatus: isPaidFull ? "paid_full" : "advance_paid",
      label: isPaidFull ? "Paid in full" : "Advance",
    };
  }

  // 3. If fully cleared and stock is allocated -> Completed
  if (isCleared) {
    return { statusKey: "completed", pillStatus: "completed", label: "Completed" };
  }

  // 3. For legacy POs where stockAllocated is undefined:
  if (po.stockAllocated === undefined) {
    const isLegacyAdvance =
      po.settlementMode === "advance" ||
      po.settlementMode === "paid_full" ||
      Boolean(po.expectedDeliveryDate) ||
      Boolean(po.notes && /advance/i.test(po.notes));
    if (isLegacyAdvance && !isCleared) {
      return { statusKey: "advance", pillStatus: "advance_paid", label: "Advance" };
    }
  }

  // 4. Otherwise (stock is received, but payment is still pending) -> Pending / Pay Later
  return { statusKey: "pending", pillStatus: "created", label: "Pending" };
}

export function getOrderRefundBreakdown(order: {
  status: string;
  paid?: number;
  refundAmount?: number;
  payments?: Array<{ amount: number; type?: string }>;
  returns?: Array<{ cashRefund?: number; refundMode?: string; customerResolution?: string; refundAmount?: number }>;
}): {
  isRefunded: boolean;
  isPartialRefund: boolean;
  totalCollected: number;
  totalRefunded: number;
  retainedAmount: number;
} {
  const isRefunded = order.status === "cancelled_refunded";
  if (!isRefunded) {
    return {
      isRefunded: false,
      isPartialRefund: false,
      totalCollected: order.paid || 0,
      totalRefunded: 0,
      retainedAmount: 0,
    };
  }

  const returnEvents = Array.isArray(order.returns) ? order.returns : [];
  const cashRefundTotal = returnEvents.reduce((sum, r) => {
    if (typeof r.cashRefund === "number") return sum + r.cashRefund;
    return sum + (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? r.refundAmount || 0 : 0);
  }, 0);

  const positivePayments = (order.payments || [])
    .filter((p) => p.amount > 0 && p.type !== "refund")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCollected = positivePayments > 0 ? positivePayments : (order.paid || 0) + cashRefundTotal;
  const totalRefunded = (order.refundAmount ?? (order.paid || 0)) + cashRefundTotal;
  const retainedAmount = Math.max(0, totalCollected - totalRefunded);
  const isPartialRefund = retainedAmount > 0;

  return {
    isRefunded,
    isPartialRefund,
    totalCollected,
    totalRefunded,
    retainedAmount,
  };
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

export function resolveOrderLineItems(lineItems: any[], returns?: any[]) {
  if (!Array.isArray(lineItems)) return [];
  return lineItems.map((li: any, idx: number) => {
    const itemReturns = Array.isArray(returns)
      ? returns.filter(
          (r: any) =>
            (r.lineItemId && li._id && r.lineItemId.toString() === li._id.toString()) ||
            (typeof r.lineItemIndex === "number" && r.lineItemIndex === idx) ||
            (r.productId && li.itemId && r.productId.toString() === li.itemId.toString()) ||
            (r.productName && li.name && r.productName.trim().toLowerCase() === li.name.trim().toLowerCase())
        )
      : [];

    let returnedQuantity = typeof li.returnedQuantity === "number" ? li.returnedQuantity : 0;
    let replacedQuantity = typeof li.replacedQuantity === "number" ? li.replacedQuantity : 0;

    if (itemReturns.length > 0) {
      returnedQuantity = itemReturns
        .filter((r: any) => r.customerResolution === "refund" || !r.customerResolution)
        .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
      replacedQuantity = itemReturns
        .filter((r: any) => r.customerResolution === "replacement")
        .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
    }

    return {
      name: li.name,
      itemType: li.itemType,
      itemId: li.itemId ? li.itemId.toString() : undefined,
      unitPrice: typeof li.unitPrice === "number" ? li.unitPrice : 0,
      quantity: typeof li.quantity === "number" ? li.quantity : 1,
      discount: li.discount,
      finalPrice:
        typeof li.finalPrice === "number"
          ? li.finalPrice
          : (li.unitPrice || 0) * (li.quantity || 1),
      fulfilled: li.fulfilled,
      returnedQuantity,
      replacedQuantity,
      returnCondition: li.returnCondition,
      packageDetails: li.packageDetails
        ? {
            isCustomized: li.packageDetails.isCustomized,
            components: Array.isArray(li.packageDetails.components)
              ? li.packageDetails.components.map((c: any) => ({
                  name: c.name,
                  componentPrice: c.componentPrice,
                }))
              : [],
          }
        : undefined,
    };
  });
}

export function resolvePurchaseOrderItems(items: any[], returns?: any[]) {
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => {
    const itemReturns = Array.isArray(returns)
      ? returns.filter(
          (r: any) =>
            (r.productId && it.productId && r.productId.toString() === it.productId.toString()) ||
            (r.productName && it.productName && r.productName.trim().toLowerCase() === it.productName.trim().toLowerCase())
        )
      : [];

    let returnedQuantity = typeof it.returnedQuantity === "number" ? it.returnedQuantity : 0;
    let replacedQuantity = typeof it.replacedQuantity === "number" ? it.replacedQuantity : 0;

    if (itemReturns.length > 0) {
      replacedQuantity = itemReturns
        .filter(
          (r: any) =>
            r.refundMode === "replacement_pending" ||
            (r.refundMode !== "reduce_due" &&
              !["cash", "upi", "card", "bank_transfer"].includes(r.refundMode) &&
              (r.replacementStatus === "pending" || r.replacementStatus === "fulfilled"))
        )
        .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
      returnedQuantity = itemReturns
        .filter(
          (r: any) =>
            r.refundMode === "reduce_due" ||
            ["cash", "upi", "card", "bank_transfer"].includes(r.refundMode) ||
            (r.refundMode !== "replacement_pending" &&
              r.replacementStatus !== "pending" &&
              r.replacementStatus !== "fulfilled")
        )
        .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
    }

    return {
      productId: it.productId ? it.productId.toString() : "",
      productName: it.productName || "Product",
      quantityForSell: it.quantityForSell || 0,
      quantityForUse: it.quantityForUse || 0,
      purchaseCost: it.purchaseCost || 0,
      expectedSellPrice: it.expectedSellPrice || 0,
      itemTotalCost: it.itemTotalCost || 0,
      returnedQuantity,
      replacedQuantity,
    };
  });
}

export function canOrderBeRefunded(order: {
  status?: string;
  paid?: number;
  amount?: number;
  refundAmount?: number;
  lineItems?: Array<{
    itemType?: string;
    quantity?: number;
    returnedQuantity?: number;
    replacedQuantity?: number;
    itemId?: string;
    name?: string;
  }>;
  returns?: Array<{
    quantity?: number;
    customerResolution?: string;
    lineItemId?: string;
    lineItemIndex?: number;
    productId?: string;
    productName?: string;
  }>;
}): boolean {
  const effectiveStatus = getOrderEffectiveStatus(order);
  if (
    effectiveStatus === "cancelled_refunded" ||
    effectiveStatus === "cancelled_converted"
  ) {
    return false;
  }
  const isCompleted =
    effectiveStatus === "completed" || effectiveStatus === "replacement_completed";
  if (!isCompleted) return false;

  const lineItems = order.lineItems || [];
  const hasProducts = lineItems.some((i) => i.itemType === "product");
  const hasServicesOrPackages = lineItems.some(
    (i) => i.itemType === "service" || i.itemType === "package"
  );

  // If order contains services or packages, it is refundable if paid > 0
  if (hasServicesOrPackages) {
    return (order.paid || 0) > 0;
  }

  // If order is purely products:
  if (hasProducts) {
    const hasRemainingProducts = lineItems.some((item, idx) => {
      if (item.itemType !== "product") return false;
      const itemReturns = (order.returns || []).filter(
        (r) =>
          (r.lineItemId && item.itemId && String(r.lineItemId) === String(item.itemId)) ||
          (typeof r.lineItemIndex === "number" && r.lineItemIndex === idx) ||
          (r.productId && item.itemId && String(r.productId) === String(item.itemId)) ||
          (r.productName && item.name && r.productName.trim().toLowerCase() === item.name.trim().toLowerCase())
      );
      const totalHandled = itemReturns.length > 0
        ? itemReturns.reduce((sum, r) => sum + (r.quantity || 0), 0)
        : (item.returnedQuantity || 0) + (item.replacedQuantity || 0);

      return (item.quantity || 1) > totalHandled;
    });

    return hasRemainingProducts;
  }

  return (order.paid || 0) > 0;
}


