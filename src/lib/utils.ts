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
