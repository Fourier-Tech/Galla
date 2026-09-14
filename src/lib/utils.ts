import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupee(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

export function calculatePendingAmount(
  orders: { status: string; amount: number; paid: number }[]
): number {
  return orders
    .filter(
      (o) =>
        o.status !== "cancelled_refunded" &&
        o.status !== "cancelled_converted"
    )
    .reduce((sum, o) => sum + Math.max(0, o.amount - o.paid), 0);
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
  if (!date) return true;
  const d = new Date(date);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function checkIsLast24Hours(date: Date | string | undefined): boolean {
  if (!date) return true;
  const d = new Date(date);
  if (isNaN(d.getTime())) return true;
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
