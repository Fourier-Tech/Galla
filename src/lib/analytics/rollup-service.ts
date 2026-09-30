import { Types } from "mongoose";
import { AnalyticsRollup, AnalyticsPeriodType, IAnalyticsRollup } from "@/lib/db/models/analytics-rollup.model";
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
): Promise<IAnalyticsRollup | null> {
  const { periodKey, startDate, endDate } = getPeriodKey(date, periodType);

  const [ordersSummary, expensesSummary, internalExpense, duesSummary, newCustomersCount] =
    await Promise.all([
      // 1. Order metrics: Use $facet so lineItems unwinding never multiplies total amountPaid
      Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: ["cancelled_refunded", "cancelled_converted"] },
          },
        },
        {
          $facet: {
            orderLevel: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$amountPaid" },
                  totalOrders: { $sum: 1 },
                  completedOrders: {
                    $sum: {
                      $cond: [{ $in: ["$status", ["completed", "paid_full"]] }, 1, 0],
                    },
                  },
                  advancePayment: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["advance_paid", "paid_full"]] },
                        { $ifNull: ["$advanceAmount", "$amountPaid"] },
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
                  split: {
                    $sum: { $cond: [{ $eq: ["$paymentMode", "split"] }, "$amountPaid", 0] },
                  },
                },
              },
            ],
            lineItemLevel: [
              { $unwind: "$lineItems" },
              {
                $group: {
                  _id: "$lineItems.itemType",
                  amount: {
                    $sum: {
                      $multiply: [
                        { $ifNull: ["$lineItems.unitPrice", 0] },
                        { $ifNull: ["$lineItems.quantity", 1] },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),

      // 2. Expenses Summary
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

      // 3. Internal Consumables
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

      // 4. Uncollected Dues in Window
      Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
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

      // 5. New Customers
      Customer.countDocuments({
        tenantId,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

  const ordMeta = ordersSummary[0]?.orderLevel?.[0] || {};
  const lineItemsList = ordersSummary[0]?.lineItemLevel || [];
  const exp = expensesSummary[0] || {};

  let serviceRev = 0;
  let productRev = 0;
  let packageRev = 0;

  for (const item of lineItemsList) {
    if (item._id === "service") serviceRev = item.amount || 0;
    else if (item._id === "product") productRev = item.amount || 0;
    else if (item._id === "package") packageRev = item.amount || 0;
  }

  const totalRev = ordMeta.totalRevenue || 0;
  const totalExp = exp.totalExpense || 0;
  const netProfit = totalRev - totalExp;
  const totalOrders = ordMeta.totalOrders || 0;
  const completedOrders = ordMeta.completedOrders || 0;
  const atv = completedOrders > 0 ? Math.round(totalRev / completedOrders) : 0;

  const expiresAt = getRollupExpirationDate(periodType, endDate);

  const rollup = await AnalyticsRollup.findOneAndUpdate(
    { tenantId, periodType, periodKey },
    {
      $set: {
        startDate,
        endDate,
        metrics: {
          revenue: {
            total: totalRev,
            product: productRev,
            service: serviceRev,
            package: packageRev,
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
          advancePayment: ordMeta.advancePayment || 0,
          footfall: totalOrders,
          averageTicketValue: atv,
          uncollectedDues: duesSummary[0]?.uncollectedDues || 0,
          newCustomersCount,
          returningCustomersCount: Math.max(0, totalOrders - newCustomersCount),
          paymentModes: {
            cash: ordMeta.cash || 0,
            upi: ordMeta.upi || 0,
            card: ordMeta.card || 0,
            split: ordMeta.split || 0,
          },
        },
        expiresAt,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return rollup;
}

// Ensure all daily rollups in a given date range exist and are populated
// Automatically backfills missing historical daily rollups and refreshes today's rollup
export async function ensureDailyRollupsForRange(
  tenantId: Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<IAnalyticsRollup[]> {
  const targetKeys: { periodKey: string; date: Date }[] = [];
  const now = new Date();
  const todayKey = getPeriodKey(now, "daily").periodKey;

  // Generate day-by-day cursor from startDate to endDate
  const dateCursor = new Date(startDate.getTime());
  while (dateCursor.getTime() <= endDate.getTime()) {
    const { periodKey } = getPeriodKey(dateCursor, "daily");
    if (!targetKeys.some((k) => k.periodKey === periodKey)) {
      targetKeys.push({ periodKey, date: new Date(dateCursor.getTime()) });
    }
    dateCursor.setTime(dateCursor.getTime() + 24 * 60 * 60 * 1000);
  }

  // Ensure endDate's key is included
  const endKeyInfo = getPeriodKey(endDate, "daily");
  if (!targetKeys.some((k) => k.periodKey === endKeyInfo.periodKey)) {
    targetKeys.push({ periodKey: endKeyInfo.periodKey, date: new Date(endDate.getTime()) });
  }

  // Find existing rollups in DB
  const existingDocs = await AnalyticsRollup.find({
    tenantId,
    periodType: "daily",
    periodKey: { $in: targetKeys.map((k) => k.periodKey) },
  }).lean();

  const existingMap = new Map<string, any>();
  for (const doc of existingDocs) {
    existingMap.set(doc.periodKey, doc);
  }

  // Determine what needs syncing:
  // 1. Missing historical dates
  // 2. Today's date (always refreshed live for real-time order tracking)
  const toSync = targetKeys.filter(
    (k) => !existingMap.has(k.periodKey) || k.periodKey === todayKey
  );

  if (toSync.length > 0) {
    const batchSize = 5;
    for (let i = 0; i < toSync.length; i += batchSize) {
      const batch = toSync.slice(i, i + batchSize);
      await Promise.all(
        batch.map((item) => syncRollupForPeriod(tenantId, "daily", item.date))
      );
    }
  }

  // Return all rollups in range sorted chronologically
  const finalDocs = await AnalyticsRollup.find({
    tenantId,
    periodType: "daily",
    periodKey: { $in: targetKeys.map((k) => k.periodKey) },
  })
    .sort({ periodKey: 1 })
    .lean();

  return finalDocs as unknown as IAnalyticsRollup[];
}

// Fast O(1) read of today's saved rollup in MongoDB; syncs once if not yet initialized for today
export async function getOrSyncTodayRollup(
  tenantId: Types.ObjectId
): Promise<IAnalyticsRollup | null> {
  const now = new Date();
  const { periodKey } = getPeriodKey(now, "daily");

  let rollup = await AnalyticsRollup.findOne({
    tenantId,
    periodType: "daily",
    periodKey,
  }).lean();

  if (!rollup) {
    const synced = await syncRollupForPeriod(tenantId, "daily", now);
    if (synced) {
      rollup = synced.toObject ? synced.toObject() : (synced as any);
    }
  }

  return rollup as unknown as IAnalyticsRollup | null;
}

// Live write-through trigger: immediately updates today's persistent rollup document
export async function triggerLiveRollupSync(
  tenantId: Types.ObjectId
): Promise<void> {
  try {
    const now = new Date();
    await syncRollupForPeriod(tenantId, "daily", now);
  } catch (err) {
    console.error("[LiveRollupSync Error]:", err);
  }
}

