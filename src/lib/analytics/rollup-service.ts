import { Types } from "mongoose";
import { AnalyticsRollup, AnalyticsPeriodType, IAnalyticsRollup } from "@/lib/db/models/analytics-rollup.model";
import { Order } from "@/lib/db/models/order.model";
import { Expense } from "@/lib/db/models/expense.model";
import { Customer } from "@/lib/db/models/customer.model";
import { PurchaseOrder } from "@/lib/db/models/purchase-order.model";

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

  const [ordersSummary, expensesSummary, internalExpense, duesSummary, newCustomersCount, supplierRefundsSummary] =
    await Promise.all([
      // 1. Order metrics: Use $facet so lineItems unwinding never multiplies total amountPaid
      Order.aggregate([
        {
          $match: {
            tenantId,
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { "payments.recordedAt": { $gte: startDate, $lte: endDate } },
            ],
            status: { $nin: ["cancelled_refunded", "cancelled_converted"] },
          },
        },
        {
          $addFields: {
            periodPaid: {
              $cond: [
                {
                  $and: [
                    { $isArray: "$payments" },
                    { $gt: [{ $size: "$payments" }, 0] },
                  ],
                },
                {
                  $reduce: {
                    input: "$payments",
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        {
                          $cond: [
                            {
                              $and: [
                                { $gte: ["$$this.recordedAt", startDate] },
                                { $lte: ["$$this.recordedAt", endDate] },
                                { $gt: ["$$this.amount", 0] },
                                { $ne: ["$$this.type", "refund"] },
                              ],
                            },
                            "$$this.amount",
                            0,
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$createdAt", startDate] },
                        { $lte: ["$createdAt", endDate] },
                      ],
                    },
                    { $ifNull: ["$amountPaid", 0] },
                    0,
                  ],
                },
              ],
            },
            orderCashRefunds: {
              $reduce: {
                input: { $ifNull: ["$returns", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        {
                          $and: [
                            { $gte: ["$$this.returnedAt", startDate] },
                            { $lte: ["$$this.returnedAt", endDate] },
                          ],
                        },
                        {
                          $cond: [
                            { $gt: ["$$this.cashRefund", 0] },
                            "$$this.cashRefund",
                            {
                              $cond: [
                                {
                                  $and: [
                                    { $eq: ["$$this.customerResolution", "refund"] },
                                    { $ne: ["$$this.refundMode", "reduce_due"] },
                                  ],
                                },
                                { $ifNull: ["$$this.refundAmount", 0] },
                                0,
                              ],
                            },
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            netPaid: {
              $max: [0, { $subtract: ["$periodPaid", "$orderCashRefunds"] }],
            },
          },
        },
        {
          $facet: {
            orderLevel: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$netPaid" },
                  totalOrders: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $gte: ["$createdAt", startDate] },
                            { $lte: ["$createdAt", endDate] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  completedOrders: {
                    $sum: {
                      $cond: [{ $in: ["$status", ["completed", "paid_full"]] }, 1, 0],
                    },
                  },
                  advancePayment: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["advance_paid", "paid_full"]] },
                        { $ifNull: ["$advanceAmount", "$netPaid"] },
                        0,
                      ],
                    },
                  },
                  cash: {
                    $sum: { $cond: [{ $eq: ["$paymentMode", "cash"] }, "$netPaid", 0] },
                  },
                  upi: {
                    $sum: { $cond: [{ $eq: ["$paymentMode", "upi"] }, "$netPaid", 0] },
                  },
                  card: {
                    $sum: { $cond: [{ $eq: ["$paymentMode", "card"] }, "$netPaid", 0] },
                  },
                  split: {
                    $sum: { $cond: [{ $eq: ["$paymentMode", "split"] }, "$netPaid", 0] },
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
                        {
                          $max: [
                            0,
                            {
                              $subtract: [
                                { $ifNull: ["$lineItems.quantity", 1] },
                                {
                                  $add: [
                                    { $ifNull: ["$lineItems.returnedQuantity", 0] },
                                    { $ifNull: ["$lineItems.replacedQuantity", 0] },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
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
            // ponytail: Same-day customer refunds directly reduce totalRevenue at source; isSameDay: true expenses are excluded from totalExpense to avoid double deduction. Upgrade path: configurable tenant policy if gross accrual accounting is requested.
            isSameDay: { $ne: true },
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

      // 6. Supplier Returns / Refunds Received
      PurchaseOrder.aggregate([
        {
          $match: {
            tenantId,
            "payments.recordedAt": { $gte: startDate, $lte: endDate },
          },
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.recordedAt": { $gte: startDate, $lte: endDate },
            "payments.type": "refund",
            "payments.amount": { $lt: 0 },
            "payments.paymentMode": { $ne: "reduce_due" },
          },
        },
        {
          $group: {
            _id: null,
            totalSupplierRefunds: { $sum: { $abs: "$payments.amount" } },
            cash: {
              $sum: { $cond: [{ $eq: ["$payments.paymentMode", "cash"] }, { $abs: "$payments.amount" }, 0] },
            },
            upi: {
              $sum: { $cond: [{ $eq: ["$payments.paymentMode", "upi"] }, { $abs: "$payments.amount" }, 0] },
            },
            card: {
              $sum: { $cond: [{ $eq: ["$payments.paymentMode", "card"] }, { $abs: "$payments.amount" }, 0] },
            },
          },
        },
      ]),
    ]);

  const ordMeta = ordersSummary[0]?.orderLevel?.[0] || {};
  const lineItemsList = ordersSummary[0]?.lineItemLevel || [];
  const exp = expensesSummary[0] || {};
  const suppRefund = (supplierRefundsSummary as any)?.[0] || {};
  const totalSuppRefund = suppRefund.totalSupplierRefunds || 0;

  let serviceRev = 0;
  let productRev = totalSuppRefund;
  let packageRev = 0;

  for (const item of lineItemsList) {
    if (item._id === "service") serviceRev = item.amount || 0;
    else if (item._id === "product") productRev += item.amount || 0;
    else if (item._id === "package") packageRev = item.amount || 0;
  }

  const totalRev = (ordMeta.totalRevenue || 0) + totalSuppRefund;
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
            cash: (ordMeta.cash || 0) + (suppRefund.cash || 0),
            upi: (ordMeta.upi || 0) + (suppRefund.upi || 0),
            card: (ordMeta.card || 0) + (suppRefund.card || 0),
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

  // 1. Find existing rollups in DB (single fast indexed query)
  const existingDocs = await AnalyticsRollup.find({
    tenantId,
    periodType: "daily",
    periodKey: { $in: targetKeys.map((k) => k.periodKey) },
  }).lean();

  const existingMap = new Map<string, any>();
  for (const doc of existingDocs) {
    existingMap.set(doc.periodKey, doc);
  }

  // 2. Identify missing keys and today's key if not yet initialized
  const missingKeys = targetKeys.filter((k) => !existingMap.has(k.periodKey));
  const needsTodaySync = !existingMap.has(todayKey) && targetKeys.some((k) => k.periodKey === todayKey);

  if (missingKeys.length > 0) {
    // Only check transaction activity for missing date windows in THREE fast aggregation queries
    const [activeOrderDays, activeExpenseDays, activeSupplierRefundDays] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            tenantId,
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { "payments.recordedAt": { $gte: startDate, $lte: endDate } },
            ],
          },
        },
        {
          $project: {
            dates: {
              $concatArrays: [
                ["$createdAt"],
                {
                  $map: {
                    input: { $ifNull: ["$payments", []] },
                    as: "p",
                    in: "$$p.recordedAt",
                  },
                },
              ],
            },
          },
        },
        { $unwind: "$dates" },
        {
          $match: {
            dates: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$dates",
                timezone: "+05:30",
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
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$expenseDate",
                timezone: "+05:30",
              },
            },
          },
        },
      ]),
      PurchaseOrder.aggregate([
        {
          $match: {
            tenantId,
            "payments.recordedAt": { $gte: startDate, $lte: endDate },
            "payments.type": "refund",
            "payments.amount": { $lt: 0 },
            "payments.paymentMode": { $ne: "reduce_due" },
          },
        },
        { $unwind: "$payments" },
        {
          $match: {
            "payments.recordedAt": { $gte: startDate, $lte: endDate },
            "payments.type": "refund",
            "payments.amount": { $lt: 0 },
            "payments.paymentMode": { $ne: "reduce_due" },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$payments.recordedAt",
                timezone: "+05:30",
              },
            },
          },
        },
      ]),
    ]);

    const activeDateSet = new Set<string>();
    activeOrderDays.forEach((d: any) => {
      if (d._id) activeDateSet.add(d._id);
    });
    activeExpenseDays.forEach((d: any) => {
      if (d._id) activeDateSet.add(d._id);
    });
    activeSupplierRefundDays.forEach((d: any) => {
      if (d._id) activeDateSet.add(d._id);
    });

    // Only sync missing dates that actually have transactions
    const toSync = missingKeys.filter((k) => activeDateSet.has(k.periodKey));

    if (toSync.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < toSync.length; i += batchSize) {
        const batch = toSync.slice(i, i + batchSize);
        const syncedDocs = await Promise.all(
          batch.map((item) => syncRollupForPeriod(tenantId, "daily", item.date))
        );
        for (const doc of syncedDocs) {
          if (doc) existingMap.set(doc.periodKey, doc.toObject ? doc.toObject() : doc);
        }
      }
    }
  }

  // If today was completely missing, sync it once
  if (needsTodaySync && !existingMap.has(todayKey)) {
    const todayDoc = await syncRollupForPeriod(tenantId, "daily", now);
    if (todayDoc) {
      existingMap.set(todayKey, todayDoc.toObject ? todayDoc.toObject() : todayDoc);
    }
  }

  // 3. Assemble complete chronological list of rollups
  // For inactive days without data, synthesize clean zero-rollups in memory without hitting the DB
  const result: IAnalyticsRollup[] = targetKeys.map((k) => {
    if (existingMap.has(k.periodKey)) {
      return existingMap.get(k.periodKey);
    }
    const { startDate: sDate, endDate: eDate } = getPeriodKey(k.date, "daily");
    return {
      tenantId,
      periodType: "daily",
      periodKey: k.periodKey,
      startDate: sDate,
      endDate: eDate,
      metrics: {
        revenue: { total: 0, product: 0, service: 0, package: 0 },
        expenses: {
          total: 0,
          inventoryPurchases: 0,
          internalStockConsumables: 0,
          salary: 0,
          rent: 0,
          dayToDay: 0,
          refunds: 0,
        },
        netProfit: 0,
        totalOrders: 0,
        completedOrders: 0,
        advancePayment: 0,
        footfall: 0,
        averageTicketValue: 0,
        uncollectedDues: 0,
        newCustomersCount: 0,
        returningCustomersCount: 0,
        paymentModes: { cash: 0, upi: 0, card: 0, split: 0 },
      },
    } as unknown as IAnalyticsRollup;
  });

  return result;
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

