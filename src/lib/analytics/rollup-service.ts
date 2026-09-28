import { Types } from "mongoose";
import { AnalyticsRollup, AnalyticsPeriodType } from "@/lib/db/models/analytics-rollup.model";
import { Order } from "@/lib/db/models/order.model";
import { Expense } from "@/lib/db/models/expense.model";
import { Customer } from "@/lib/db/models/customer.model";

// Calculate TTL expiration date based on tiered retention requirements:
// Daily: 2 months (60 days)
// Weekly: 6 months (180 days)
// Monthly: 2 years (730 days)
// Yearly: permanent (null)
export function getRollupExpirationDate(periodType: AnalyticsPeriodType, referenceDate: Date = new Date()): Date | null {
  const msInDay = 24 * 60 * 60 * 1000;
  if (periodType === "daily") {
    return new Date(referenceDate.getTime() + 60 * msInDay);
  }
  if (periodType === "weekly") {
    return new Date(referenceDate.getTime() + 180 * msInDay);
  }
  if (periodType === "monthly") {
    return new Date(referenceDate.getTime() + 730 * msInDay);
  }
  // Yearly: permanent
  return null;
}

// Generate Period Key (IST timezone)
export function getPeriodKey(date: Date, periodType: AnalyticsPeriodType): {
  periodKey: string;
  startDate: Date;
  endDate: Date;
} {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  if (periodType === "daily") {
    const periodKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const startUtc = Date.UTC(year, month, day) - istOffsetMs;
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1;
    return {
      periodKey,
      startDate: new Date(startUtc),
      endDate: new Date(endUtc),
    };
  }

  if (periodType === "monthly") {
    const periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const startUtc = Date.UTC(year, month, 1) - istOffsetMs;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const endUtc = Date.UTC(nextMonthYear, nextMonth, 1) - istOffsetMs - 1;
    return {
      periodKey,
      startDate: new Date(startUtc),
      endDate: new Date(endUtc),
    };
  }

  if (periodType === "yearly") {
    const periodKey = `${year}`;
    const startUtc = Date.UTC(year, 0, 1) - istOffsetMs;
    const endUtc = Date.UTC(year + 1, 0, 1) - istOffsetMs - 1;
    return {
      periodKey,
      startDate: new Date(startUtc),
      endDate: new Date(endUtc),
    };
  }

  // Weekly (ISO week)
  const d = new Date(Date.UTC(year, month, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const periodKey = `${year}-W${String(weekNo).padStart(2, "0")}`;

  // Start Monday, End Sunday
  const startDay = new Date(istDate);
  const diffToMonday = (istDate.getUTCDay() + 6) % 7;
  startDay.setUTCDate(istDate.getUTCDate() - diffToMonday);
  const startUtc = Date.UTC(startDay.getUTCFullYear(), startDay.getUTCMonth(), startDay.getUTCDate()) - istOffsetMs;
  const endUtc = startUtc + 7 * 24 * 60 * 60 * 1000 - 1;

  return {
    periodKey,
    startDate: new Date(startUtc),
    endDate: new Date(endUtc),
  };
}

// Compute & Upsert Rollup for a specific time window
export async function syncRollupForPeriod(
  tenantId: Types.ObjectId,
  periodType: AnalyticsPeriodType,
  date: Date
) {
  const { periodKey, startDate, endDate } = getPeriodKey(date, periodType);

  const [ordersSummary, expensesSummary, internalExpense, duesSummary, newCustomersCount] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: ["cancelled_refunded", "cancelled_converted"] },
          },
        },
        { $unwind: { path: "$lineItems", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amountPaid" },
            totalOrders: { $addToSet: "$_id" },
            completedOrders: {
              $sum: {
                $cond: [{ $in: ["$status", ["completed", "paid_full"]] }, 1, 0],
              },
            },
            serviceRev: {
              $sum: {
                $cond: [
                  { $eq: ["$lineItems.itemType", "service"] },
                  { $multiply: [{ $ifNull: ["$lineItems.unitPrice", 0] }, { $ifNull: ["$lineItems.quantity", 1] }] },
                  0,
                ],
              },
            },
            productRev: {
              $sum: {
                $cond: [
                  { $eq: ["$lineItems.itemType", "product"] },
                  { $multiply: [{ $ifNull: ["$lineItems.unitPrice", 0] }, { $ifNull: ["$lineItems.quantity", 1] }] },
                  0,
                ],
              },
            },
            packageRev: {
              $sum: {
                $cond: [
                  { $eq: ["$lineItems.itemType", "package"] },
                  { $multiply: [{ $ifNull: ["$lineItems.unitPrice", 0] }, { $ifNull: ["$lineItems.quantity", 1] }] },
                  0,
                ],
              },
            },
            cash: {
              $sum: { $cond: [{ $eq: ["$paymentMode", "cash"] }, "$amountPaid", 0] },
            },
            upi: {
              $sum: { $cond: [{ $eq: ["$paymentMode", "upi"] }, "$amountPaid", 0] },
            },
            card: {
              $sum: { $cond: [{ $eq: ["$paymentMode", "card"] }, "$amountPaid", 0] },
            },
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: {
            tenantId,
            expenseDate: { $gte: startDate, $lte: endDate },
            category: { $ne: "stock_transfer_internal" },
          },
        },
        {
          $group: {
            _id: null,
            totalExpense: { $sum: "$amount" },
            inventoryPurchases: {
              $sum: {
                $cond: [{ $in: ["$category", ["inventory_purchase", "inventory"]] }, "$amount", 0],
              },
            },
            salary: {
              $sum: { $cond: [{ $eq: ["$category", "salary"] }, "$amount", 0] },
            },
            rent: {
              $sum: { $cond: [{ $eq: ["$category", "rent"] }, "$amount", 0] },
            },
            refunds: {
              $sum: { $cond: [{ $eq: ["$category", "refund"] }, "$amount", 0] },
            },
            dayToDay: {
              $sum: {
                $cond: [
                  {
                    $in: ["$category", ["refreshments", "utilities", "maintenance", "marketing", "other"]],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: {
            tenantId,
            expenseDate: { $gte: startDate, $lte: endDate },
            category: "stock_transfer_internal",
          },
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: "$amount" },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            tenantId,
            amountPending: { $gt: 0 },
            status: { $nin: ["cancelled_refunded", "cancelled_converted", "completed"] },
          },
        },
        {
          $group: {
            _id: null,
            uncollectedDues: { $sum: "$amountPending" },
          },
        },
      ]),

      Customer.countDocuments({
        tenantId,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

  const ord = ordersSummary[0] || {};
  const exp = expensesSummary[0] || {};

  const totalRev = ord.totalRevenue || 0;
  const totalExp = exp.totalExpense || 0;
  const netProfit = totalRev - totalExp;
  const totalOrders = ord.totalOrders?.length || 0;
  const completedOrders = ord.completedOrders || 0;
  const atv = completedOrders > 0 ? Math.round(totalRev / completedOrders) : 0;

  const expiresAt = getRollupExpirationDate(periodType, endDate);

  await AnalyticsRollup.findOneAndUpdate(
    { tenantId, periodType, periodKey },
    {
      $set: {
        startDate,
        endDate,
        metrics: {
          revenue: {
            total: totalRev,
            product: ord.productRev || 0,
            service: ord.serviceRev || 0,
            package: ord.packageRev || 0,
          },
          expenses: {
            total: totalExp,
            inventoryPurchases: exp.inventoryPurchases || 0,
            internalStockConsumables: internalExpense[0]?.totalCost || 0,
            salary: exp.salary || 0,
            rent: exp.rent || 0,
            dayToDay: exp.dayToDay || 0,
            refunds: exp.refunds || 0,
          },
          netProfit,
          totalOrders,
          completedOrders,
          footfall: totalOrders,
          averageTicketValue: atv,
          uncollectedDues: duesSummary[0]?.uncollectedDues || 0,
          newCustomersCount,
          returningCustomersCount: Math.max(0, totalOrders - newCustomersCount),
          paymentModes: {
            cash: ord.cash || 0,
            upi: ord.upi || 0,
            card: ord.card || 0,
            split: 0,
          },
        },
        expiresAt,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
}
