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

export function getLocalDateString(isoOrDate?: string | Date): string | null {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
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
  const d = new Date(date);
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
  const d = new Date(dateInput);
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
