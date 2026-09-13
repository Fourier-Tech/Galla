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
