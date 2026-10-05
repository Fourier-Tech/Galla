import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { getRoleSession } from "@/lib/auth/role-session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order } from "@/lib/db/models/order.model";
import { Product } from "@/lib/db/models/product.model";
import { Customer } from "@/lib/db/models/customer.model";
import { Supplier } from "@/lib/db/models/supplier.model";
import { PurchaseOrder } from "@/lib/db/models/purchase-order.model";
import { Expense } from "@/lib/db/models/expense.model";
import { ensureDailyRollupsForRange } from "@/lib/analytics/rollup-service";
import {
  AnalyticsRangePreset,
  AnalyticsResponseData,
  MainAnalyticsData,
  PerformanceAnalyticsData,
  TrafficAnalyticsData,
  WeekdayAnalyticsData,
  ConsumptionDetailsData,
  InternalConsumptionMovementItem,
  MonthlyRangePreset,
  TrafficRangePreset,
  WeekdayRangePreset,
  MetricDelta,
  TenderSplitItem,
} from "@/types/analytics";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function formatISTDateLabel(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${MONTH_NAMES[ist.getUTCMonth()]} ${ist.getUTCDate()}`;
}

// Helper: Calculate percentage change and trend
function calculateMetricDelta(current: number, previous: number): MetricDelta {
  if (previous === 0) {
    return {
      current,
      previous,
      deltaPercent: current > 0 ? 100 : 0,
      trend: current >= previous ? "up" : "neutral",
    };
  }
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return {
    current,
    previous,
    deltaPercent: delta,
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
  };
}

// Helper: Resolve date windows in Indian Standard Time (UTC+05:30) for Main Filter
function resolveDateWindows(
  range: AnalyticsRangePreset,
  customStart?: string | null,
  customEnd?: string | null
) {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);

  let startDate: Date;
  let endDate: Date = now;
  let previousStartDate: Date;
  let previousEndDate: Date;

  if (range === "today") {
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const date = istNow.getUTCDate();

    startDate = new Date(Date.UTC(year, month, date) - IST_OFFSET_MS);
    endDate = now;

    previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    previousEndDate = new Date(startDate.getTime() - 1);
  } else if (range === "7d") {
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const date = istNow.getUTCDate();

    const startOfTodayUtc = Date.UTC(year, month, date) - IST_OFFSET_MS;
    startDate = new Date(startOfTodayUtc - 6 * 24 * 60 * 60 * 1000);
    endDate = now;

    const windowDurationMs = endDate.getTime() - startDate.getTime();
    previousStartDate = new Date(startDate.getTime() - windowDurationMs);
    previousEndDate = new Date(startDate.getTime() - 1);
  } else if (range === "this_month") {
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();

    startDate = new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS);
    endDate = now;

    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    previousStartDate = new Date(Date.UTC(prevMonthYear, prevMonth, 1) - IST_OFFSET_MS);
    const windowDurationMs = endDate.getTime() - startDate.getTime();
    previousEndDate = new Date(previousStartDate.getTime() + windowDurationMs);
  } else if (range === "custom" && customStart && customEnd) {
    const [sYear, sMonth, sDate] = customStart.split("-").map(Number);
    const [eYear, eMonth, eDate] = customEnd.split("-").map(Number);

    if (sYear && sMonth && sDate && eYear && eMonth && eDate) {
      startDate = new Date(Date.UTC(sYear, sMonth - 1, sDate) - IST_OFFSET_MS);
      endDate = new Date(
        Date.UTC(eYear, eMonth - 1, eDate, 23, 59, 59, 999) - IST_OFFSET_MS
      );
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
    }

    const windowDurationMs = Math.max(
      24 * 60 * 60 * 1000,
      endDate.getTime() - startDate.getTime()
    );
    previousStartDate = new Date(startDate.getTime() - windowDurationMs);
    previousEndDate = new Date(startDate.getTime() - 1);
  } else {
    // Default: "30d"
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const date = istNow.getUTCDate();

    const startOfTodayUtc = Date.UTC(year, month, date) - IST_OFFSET_MS;
    startDate = new Date(startOfTodayUtc - 29 * 24 * 60 * 60 * 1000);
    endDate = now;

    const windowDurationMs = endDate.getTime() - startDate.getTime();
    previousStartDate = new Date(startDate.getTime() - windowDurationMs);
    previousEndDate = new Date(startDate.getTime() - 1);
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
}

// Helper: Resolve Monthly Windows
function resolveMonthlyWindows(
  monthlyRange: MonthlyRangePreset,
  customYear?: number | null,
  customMonth?: number | null
): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const currentYear = istNow.getUTCFullYear();
  const currentMonth = istNow.getUTCMonth(); // 0-indexed

  if (monthlyRange === "30d") {
    const startOfTodayUtc =
      Date.UTC(currentYear, currentMonth, istNow.getUTCDate()) - IST_OFFSET_MS;
    const startDate = new Date(startOfTodayUtc - 29 * 24 * 60 * 60 * 1000);
    return { startDate, endDate: now, label: "Last 30 Days" };
  }

  if (monthlyRange === "custom_month" && customYear && customMonth) {
    const y = customYear;
    const m = customMonth - 1; // 0-indexed
    const startDate = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
    const nextMonthUtc =
      Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1) - IST_OFFSET_MS;
    const endDate = new Date(nextMonthUtc - 1);
    return {
      startDate,
      endDate: y === currentYear && m === currentMonth ? now : endDate,
      label: `${MONTH_NAMES[m]} ${y}`,
    };
  }

  if (monthlyRange === "yearly") {
    const y = customYear || currentYear;
    const startDate = new Date(Date.UTC(y, 0, 1) - IST_OFFSET_MS);
    const endDate =
      y === currentYear
        ? now
        : new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - IST_OFFSET_MS);
    return { startDate, endDate, label: `Year ${y}` };
  }

  if (monthlyRange === "all_time") {
    const startDate = new Date(0);
    return { startDate, endDate: now, label: "All Time" };
  }

  // Default: "this_month"
  const startDate = new Date(Date.UTC(currentYear, currentMonth, 1) - IST_OFFSET_MS);
  return {
    startDate,
    endDate: now,
    label: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
  };
}

// Helper: Resolve Weekday Windows (Monday to Sunday in IST)
function resolveWeekdayWindows(preset: WeekdayRangePreset): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);

  // getUTCDay: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const currentDow = istNow.getUTCDay();
  const daysSinceMonday = (currentDow + 6) % 7; // Mon=0, Tue=1 ... Sun=6

  const startOfTodayUtc =
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
    IST_OFFSET_MS;
  const thisMondayUtc = startOfTodayUtc - daysSinceMonday * 24 * 60 * 60 * 1000;
  const thisSundayEndUtc = thisMondayUtc + 7 * 24 * 60 * 60 * 1000 - 1;

  if (preset === "last_week") {
    const lastMondayUtc = thisMondayUtc - 7 * 24 * 60 * 60 * 1000;
    const lastSundayEndUtc = thisMondayUtc - 1;
    return {
      startDate: new Date(lastMondayUtc),
      endDate: new Date(lastSundayEndUtc),
      label: "Last Week",
    };
  }

  // "this_week"
  return {
    startDate: new Date(thisMondayUtc),
    endDate: new Date(Math.min(now.getTime(), thisSundayEndUtc)),
    label: "This Week",
  };
}

// Helper: Resolve Traffic Windows (Today vs Yesterday in IST)
function resolveTrafficWindows(preset: TrafficRangePreset): {
  startDate: Date;
  endDate: Date;
  label: string;
  dateStr: string;
} {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);

  const isToday = preset === "today";
  const targetDate = isToday
    ? istNow
    : new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
  const tYear = targetDate.getUTCFullYear();
  const tMonth = targetDate.getUTCMonth();
  const tDate = targetDate.getUTCDate();

  const startUtc = new Date(Date.UTC(tYear, tMonth, tDate) - IST_OFFSET_MS);
  const endUtc = isToday
    ? now
    : new Date(Date.UTC(tYear, tMonth, tDate, 23, 59, 59, 999) - IST_OFFSET_MS);

  return {
    startDate: startUtc,
    endDate: endUtc,
    label: isToday ? "Today" : "Yesterday",
    dateStr: `${tYear}-${String(tMonth + 1).padStart(2, "0")}-${String(tDate).padStart(2, "0")}`,
  };
}

const EXCLUDED_ORDER_STATUSES = [
  "cancelled_refunded",
  "cancelled_converted",
  "replacement_pending",
  "replacement",
  "replacement_completed",
];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized session" },
        { status: 401 }
      );
    }

    const roleSession = await getRoleSession();
    if (!roleSession) {
      return NextResponse.json(
        { success: false, error: "Unauthorized role session" },
        { status: 401 }
      );
    }

    const { role } = roleSession;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Executive business analytics are restricted to owners only",
        },
        { status: 403 }
      );
    }

    await connectToDatabase();

    let tenantId: Types.ObjectId | null = null;
    if (session.user.tenantId) {
      tenantId = new Types.ObjectId(session.user.tenantId);
    } else {
      const user = await User.findById(session.user.id).select("tenantId").lean();
      if (user?.tenantId) {
        tenantId = user.tenantId as Types.ObjectId;
      } else {
        const tenant = await Tenant.findOne().select("_id").lean();
        if (tenant) tenantId = tenant._id as Types.ObjectId;
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant context not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "main";

    // ==========================================
    // SECTION: TRAFFIC (Hourly Booking Density)
    // ==========================================
    if (section === "traffic") {
      const preset = (searchParams.get("preset") as TrafficRangePreset) || "today";
      const { startDate, endDate, label, dateStr } = resolveTrafficWindows(preset);

      const hourlyAgg = await Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: EXCLUDED_ORDER_STATUSES },
          },
        },
        {
          $project: {
            amountPaid: 1,
            hour: { $hour: { date: "$createdAt", timezone: "+05:30" } },
          },
        },
        {
          $group: {
            _id: "$hour",
            count: { $sum: 1 },
            revenue: { $sum: "$amountPaid" },
          },
        },
      ]);

      const hourlyMap = new Map<number, { count: number; revenue: number }>();
      (hourlyAgg || []).forEach((item: { _id: number; count: number; revenue: number }) => {
        hourlyMap.set(item._id, { count: item.count, revenue: item.revenue });
      });

      const hourly = [];
      for (let h = 10; h <= 21; h++) {
        const data = hourlyMap.get(h) || { count: 0, revenue: 0 };
        const hLabel = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
        hourly.push({
          hour: h,
          label: hLabel,
          count: data.count,
          revenue: data.revenue,
        });
      }

      const trafficData: TrafficAnalyticsData = {
        preset,
        date: dateStr,
        label,
        hourly,
      };

      return NextResponse.json({ success: true, data: trafficData });
    }

    // ==========================================
    // SECTION: WEEKDAY (Busiest Days of Week)
    // ==========================================
    if (section === "weekday") {
      const preset = (searchParams.get("preset") as WeekdayRangePreset) || "this_week";
      const { startDate, endDate, label } = resolveWeekdayWindows(preset);

      const weekdayAgg = await Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: EXCLUDED_ORDER_STATUSES },
          },
        },
        {
          $project: {
            amountPaid: 1,
            dayOfWeek: { $dayOfWeek: { date: "$createdAt", timezone: "+05:30" } }, // 1=Sun, 2=Mon... 7=Sat
          },
        },
        {
          $group: {
            _id: "$dayOfWeek",
            count: { $sum: 1 },
            revenue: { $sum: "$amountPaid" },
          },
        },
      ]);

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weekdayMap = new Map<number, { count: number; revenue: number }>();
      (weekdayAgg || []).forEach((item: { _id: number; count: number; revenue: number }) => {
        const dow = item._id - 1; // 0=Sun, 1=Mon...
        weekdayMap.set(dow, { count: item.count, revenue: item.revenue });
      });

      // Display order: Mon, Tue, Wed, Thu, Fri, Sat, Sun
      const weekday = [1, 2, 3, 4, 5, 6, 0].map((dIndex) => {
        const data = weekdayMap.get(dIndex) || { count: 0, revenue: 0 };
        return {
          day: dayNames[dIndex],
          dayIndex: dIndex,
          count: data.count,
          revenue: data.revenue,
        };
      });

      const weekdayData: WeekdayAnalyticsData = {
        preset,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label,
        weekday,
      };

      return NextResponse.json({ success: true, data: weekdayData });
    }

    // ==========================================
    // SECTION: CONSUMPTION DETAILS (Drill-Down)
    // ==========================================
    if (section === "consumption_details") {
      const customStart = searchParams.get("startDate");
      const customEnd = searchParams.get("endDate");
      const rangeParam = (searchParams.get("range") as AnalyticsRangePreset) || "30d";

      const { startDate, endDate } = resolveDateWindows(
        rangeParam,
        customStart,
        customEnd
      );

      const expenses = await Expense.find({
        tenantId,
        expenseDate: { $gte: startDate, $lte: endDate },
        $or: [
          { category: "stock_transfer_internal" },
          { paymentMode: "internal_transfer" },
        ],
      })
        .populate("linkedProductId", "name category purchaseCost expectedSellPrice")
        .sort({ expenseDate: -1 })
        .lean();

      let totalCost = 0;
      const items: InternalConsumptionMovementItem[] = (expenses || []).map((exp: any) => {
        const p = exp.linkedProductId;
        const qty = exp.linkedQuantity || 1;
        const cost = exp.amount || 0;
        totalCost += cost;
        const unitPrice =
          qty > 0 ? Math.round((cost / qty) * 100) / 100 : p?.purchaseCost || 0;

        let pName = p?.name;
        if (!pName && exp.title) {
          const match =
            exp.title.match(/Internal consumption — \d+x (.+?) \(/) ||
            exp.title.match(/Service usage: \d+x (.+?) \(/);
          if (match) pName = match[1];
          else pName = exp.title;
        }

        let reason: string | undefined;
        if (exp.title && exp.title.includes("(") && exp.title.includes(")")) {
          reason = exp.title.substring(
            exp.title.indexOf("(") + 1,
            exp.title.lastIndexOf(")")
          );
        }

        return {
          id: exp._id.toString(),
          productName: pName || "Salon Consumable",
          productId: p?._id?.toString() || exp.linkedProductId?.toString(),
          dateTime: new Date(exp.expenseDate).toISOString(),
          quantity: qty,
          unitPrice,
          totalCost: cost,
          notes: exp.notes || undefined,
          recordedBy: exp.recordedBy === "staff" ? "staff" : "owner",
          reason,
        };
      });

      const detailsData: ConsumptionDetailsData = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalCost,
        totalItems: items.length,
        items,
      };

      return NextResponse.json({ success: true, data: detailsData });
    }

    // ==========================================
    // SECTION: PERFORMANCE (Monthly Group)
    // ==========================================
    if (section === "performance") {
      const monthlyRange =
        (searchParams.get("monthlyRange") as MonthlyRangePreset) || "this_month";
      const year = searchParams.get("year") ? Number(searchParams.get("year")) : null;
      const month = searchParams.get("month") ? Number(searchParams.get("month")) : null;

      const { startDate, endDate, label } = resolveMonthlyWindows(
        monthlyRange,
        year,
        month
      );

      const matchOrders = {
        tenantId,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: EXCLUDED_ORDER_STATUSES },
      };

      const [lineItemsFacetAgg, allActiveProducts] = await Promise.all([
        Order.aggregate([
          { $match: matchOrders },
          { $unwind: "$lineItems" },
          {
            $facet: {
              topServices: [
                { $match: { "lineItems.itemType": "service" } },
                {
                  $group: {
                    _id: {
                      itemId: "$lineItems.itemId",
                      name: "$lineItems.name",
                    },
                    revenue: {
                      $sum: {
                        $multiply: [
                          { $ifNull: ["$lineItems.unitPrice", 0] },
                          { $ifNull: ["$lineItems.quantity", 1] },
                        ],
                      },
                    },
                    bookingsCount: {
                      $sum: { $ifNull: ["$lineItems.quantity", 1] },
                    },
                  },
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
              ],
              topRetailProducts: [
                { $match: { "lineItems.itemType": "product" } },
                {
                  $group: {
                    _id: {
                      itemId: "$lineItems.itemId",
                      name: "$lineItems.name",
                    },
                    grossRevenue: {
                      $sum: {
                        $multiply: [
                          { $ifNull: ["$lineItems.unitPrice", 0] },
                          { $ifNull: ["$lineItems.quantity", 1] },
                        ],
                      },
                    },
                    unitsSold: {
                      $sum: { $ifNull: ["$lineItems.quantity", 1] },
                    },
                  },
                },
                { $sort: { grossRevenue: -1 } },
                { $limit: 5 },
              ],
              serviceCategories: [
                { $match: { "lineItems.itemType": "service" } },
                {
                  $lookup: {
                    from: "services",
                    localField: "lineItems.itemId",
                    foreignField: "_id",
                    as: "serviceDoc",
                  },
                },
                {
                  $group: {
                    _id: {
                      $ifNull: [
                        { $arrayElemAt: ["$serviceDoc.category", 0] },
                        "General",
                      ],
                    },
                    revenue: {
                      $sum: {
                        $multiply: [
                          { $ifNull: ["$lineItems.unitPrice", 0] },
                          { $ifNull: ["$lineItems.quantity", 1] },
                        ],
                      },
                    },
                    bookingsCount: {
                      $sum: { $ifNull: ["$lineItems.quantity", 1] },
                    },
                  },
                },
                { $sort: { revenue: -1 } },
              ],
            },
          },
        ]),
        Product.find(
          { tenantId, isActive: true },
          { name: 1, category: 1, sellStock: 1, purchaseCost: 1 }
        ).lean(),
      ]);

      const topServices = (lineItemsFacetAgg[0]?.topServices || []).map(
        (s: {
          _id: { itemId: Types.ObjectId; name: string };
          revenue: number;
          bookingsCount: number;
        }) => ({
          id: s._id?.itemId?.toString() || "",
          name: s._id?.name || "Service",
          category: "Treatment",
          revenue: s.revenue || 0,
          bookingsCount: s.bookingsCount || 0,
          avgPrice: s.bookingsCount > 0 ? Math.round(s.revenue / s.bookingsCount) : 0,
        })
      );

      const soldProductIds = new Set<string>();
      const topRetailProducts = (lineItemsFacetAgg[0]?.topRetailProducts || []).map(
        (p: {
          _id: { itemId: Types.ObjectId; name: string };
          grossRevenue: number;
          unitsSold: number;
        }) => {
          const prodId = p._id?.itemId?.toString() || "";
          soldProductIds.add(prodId);
          const matchingProduct = (allActiveProducts || []).find(
            (ap: any) => ap._id.toString() === prodId
          );
          return {
            id: prodId,
            name: p._id?.name || "Product",
            category: matchingProduct?.category || "Retail",
            unitsSold: p.unitsSold || 0,
            grossRevenue: p.grossRevenue || 0,
            currentStock: matchingProduct?.sellStock || 0,
          };
        }
      );

      const rawCategories = lineItemsFacetAgg[0]?.serviceCategories || [];
      const totalCatRevenue =
        rawCategories.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0) || 1;
      const categoryContribution = rawCategories.map((c: any) => ({
        category: c._id || "General",
        revenue: c.revenue || 0,
        percent: Math.round(((c.revenue || 0) / totalCatRevenue) * 100),
        bookingsCount: c.bookingsCount || 0,
      }));

      // Slow Moving & Dead Stock Warning (products with sellStock > 0 and 0 retail sales in this window)
      const slowMovingStock = (allActiveProducts || [])
        .filter(
          (p: any) =>
            p.sellStock > 0 &&
            !soldProductIds.has(p._id.toString()) &&
            p.purchaseCost > 0
        )
        .map((p: any) => ({
          id: p._id.toString(),
          name: p.name,
          category: p.category || "General",
          sellStock: p.sellStock || 0,
          purchaseCost: p.purchaseCost || 0,
          lockedCapital: (p.sellStock || 0) * (p.purchaseCost || 0),
        }))
        .sort((a: any, b: any) => b.lockedCapital - a.lockedCapital)
        .slice(0, 5);

      const performanceData: PerformanceAnalyticsData = {
        monthlyRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label,
        services: {
          topServices,
          categoryContribution,
        },
        inventory: {
          topRetailProducts,
          slowMovingStock,
        },
      };

      return NextResponse.json({ success: true, data: performanceData });
    }

    // ==========================================
    // SECTION: MAIN (Executive KPIs, Procurement, Cashflow, Retention)
    // ==========================================
    const rangeParam = (searchParams.get("range") as AnalyticsRangePreset) || "30d";
    const customStart = searchParams.get("customStart");
    const customEnd = searchParams.get("customEnd");

    const { startDate, endDate, previousStartDate, previousEndDate } =
      resolveDateWindows(rangeParam, customStart, customEnd);

    // 1. Ensure daily rollups exist for current range
    await ensureDailyRollupsForRange(tenantId, startDate, endDate);

    const { AnalyticsRollup } = await import(
      "@/lib/db/models/analytics-rollup.model"
    );

    const [
      currentRollups,
      previousRollups,
      uncollectedDuesAgg,
      procurementAgg,
      supplierBalancesAgg,
      vipClientsAgg,
      dormantClientsCount,
      internalConsumptionAgg,
      clientsServedAgg,
      lineItemsUnitsAgg,
      tenderCountsAgg,
    ] = await Promise.all([
      AnalyticsRollup.find({
        tenantId,
        periodType: "daily",
        startDate: { $gte: startDate, $lte: endDate },
      })
        .sort({ startDate: 1 })
        .lean(),

      AnalyticsRollup.find({
        tenantId,
        periodType: "daily",
        startDate: { $gte: previousStartDate, $lte: previousEndDate },
      })
        .sort({ startDate: 1 })
        .lean(),

      Customer.aggregate([
        { $match: { tenantId, totalDue: { $gt: 0 } } },
        { $group: { _id: null, totalDue: { $sum: "$totalDue" } } },
      ]),

      PurchaseOrder.aggregate([
        {
          $match: {
            tenantId,
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { invoiceDate: { $gte: startDate, $lte: endDate } },
            ],
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: "$totalAmount" },
            count: { $sum: 1 },
          },
        },
      ]),

      Supplier.aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: null,
            pendingDues: {
              $sum: { $cond: [{ $gt: ["$totalPending", 0] }, "$totalPending", 0] },
            },
            credits: {
              $sum: { $ifNull: ["$totalCredit", 0] },
            },
          },
        },
      ]),

      Customer.find(
        { tenantId, isActive: true },
        { name: 1, phone: 1, stats: 1 }
      )
        .sort({ "stats.totalSpend": -1 })
        .limit(5)
        .lean(),

      Customer.countDocuments({
        tenantId,
        isActive: true,
        "stats.totalVisits": { $gte: 2 },
        "stats.lastVisitAt": {
          $lt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        },
      }),

      Expense.aggregate([
        {
          $match: {
            tenantId,
            expenseDate: { $gte: startDate, $lte: endDate },
            $or: [
              { category: "stock_transfer_internal" },
              { paymentMode: "internal_transfer" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: "$amount" },
            transfersCount: { $sum: 1 },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: EXCLUDED_ORDER_STATUSES },
          },
        },
        {
          $facet: {
            registeredClients: [
              { $match: { customerId: { $ne: null } } },
              {
                $group: {
                  _id: "$customerId",
                  firstOrderInWindow: { $min: "$createdAt" },
                },
              },
              {
                $lookup: {
                  from: "orders",
                  let: { custId: "$_id", firstWinDate: "$firstOrderInWindow" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$customerId", "$$custId"] },
                            { $lt: ["$createdAt", "$$firstWinDate"] },
                            { $not: { $in: ["$status", EXCLUDED_ORDER_STATUSES] } },
                          ],
                        },
                      },
                    },
                    { $limit: 1 },
                  ],
                  as: "priorOrders",
                },
              },
              {
                $project: {
                  _id: 1,
                  hasPriorOrders: { $gt: [{ $size: "$priorOrders" }, 0] },
                },
              },
            ],
            guestOrders: [
              { $match: { customerId: null } },
              { $group: { _id: null, count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $nin: EXCLUDED_ORDER_STATUSES },
          },
        },
        { $unwind: "$lineItems" },
        {
          $group: {
            _id: "$lineItems.itemType",
            totalUnits: {
              $sum: {
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
            },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            tenantId,
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { "payments.recordedAt": { $gte: startDate, $lte: endDate } },
            ],
            status: { $nin: EXCLUDED_ORDER_STATUSES },
          },
        },
        {
          $project: {
            paymentMode: 1,
            amountPaid: 1,
            createdAt: 1,
            payments: {
              $filter: {
                input: { $ifNull: ["$payments", []] },
                as: "p",
                cond: {
                  $and: [
                    { $gte: ["$$p.recordedAt", startDate] },
                    { $lte: ["$$p.recordedAt", endDate] },
                    { $gt: ["$$p.amount", 0] },
                    { $ne: ["$$p.type", "refund"] },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            effectivePayments: {
              $cond: [
                { $gt: [{ $size: "$payments" }, 0] },
                "$payments",
                {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$createdAt", startDate] },
                        { $lte: ["$createdAt", endDate] },
                        { $gt: ["$amountPaid", 0] },
                      ],
                    },
                    [{ mode: { $ifNull: ["$paymentMode", "cash"] }, amount: "$amountPaid" }],
                    [],
                  ],
                },
              ],
            },
          },
        },
        { $unwind: "$effectivePayments" },
        {
          $group: {
            _id: { $toLower: "$effectivePayments.mode" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Aggregate Executive Totals
    const currentRev = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.revenue?.total || 0),
      0
    );
    const prevRev = previousRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.revenue?.total || 0),
      0
    );

    const currentExp = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.expenses?.total || 0),
      0
    );
    const prevExp = previousRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.expenses?.total || 0),
      0
    );

    const currentProfit = currentRev - currentExp;
    const prevProfit = prevRev - prevExp;

    const currentMarginPct =
      currentRev > 0 ? Math.round((currentProfit / currentRev) * 1000) / 10 : 0;
    const prevMarginPct =
      prevRev > 0 ? Math.round((prevProfit / prevRev) * 1000) / 10 : 0;

    const currentOrdersCount = currentRollups.reduce(
      (acc: number, r: any) =>
        acc + (r.metrics?.totalOrders ?? r.metrics?.completedOrders ?? 0),
      0
    );
    const prevOrdersCount = previousRollups.reduce(
      (acc: number, r: any) =>
        acc + (r.metrics?.totalOrders ?? r.metrics?.completedOrders ?? 0),
      0
    );

    const currentAtv =
      currentOrdersCount > 0 ? Math.round(currentRev / currentOrdersCount) : 0;
    const prevAtv = prevOrdersCount > 0 ? Math.round(prevRev / prevOrdersCount) : 0;

    const uncollectedDues = uncollectedDuesAgg[0]?.totalDue || 0;

    // Cashflow Timeline
    const timeline = [];
    if (rangeParam === "today") {
      const [todayHourlyRev, todayHourlyExp] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              tenantId,
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $nin: EXCLUDED_ORDER_STATUSES },
            },
          },
          {
            $group: {
              _id: { $hour: { date: "$createdAt", timezone: "+05:30" } },
              revenue: { $sum: "$amountPaid" },
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
              _id: { $hour: { date: "$expenseDate", timezone: "+05:30" } },
              expense: { $sum: "$amount" },
            },
          },
        ]),
      ]);

      const revByHour = new Map<number, number>();
      todayHourlyRev.forEach((item: any) => revByHour.set(item._id, item.revenue));
      const expByHour = new Map<number, number>();
      todayHourlyExp.forEach((item: any) => expByHour.set(item._id, item.expense));

      for (let h = 10; h <= 21; h++) {
        const rev = revByHour.get(h) || 0;
        const exp = expByHour.get(h) || 0;
        const hourStr = `${h}:00`;
        const label = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
        timeline.push({
          date: hourStr,
          label,
          revenue: rev,
          expense: exp,
          net: rev - exp,
        });
      }
    } else {
      currentRollups.forEach((r: any) => {
        const rev = r.metrics?.revenue?.total || 0;
        const exp = r.metrics?.expenses?.total || 0;
        timeline.push({
          date: r.periodKey,
          label: formatISTDateLabel(r.startDate),
          revenue: rev,
          expense: exp,
          net: rev - exp,
        });
      });
    }

    // Revenue Mix
    const totalServiceRev = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.revenue?.service || 0),
      0
    );
    const totalProductRev = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.revenue?.product || 0),
      0
    );
    const totalPackageRev = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.revenue?.package || 0),
      0
    );
    const totalMixRevenue = totalServiceRev + totalProductRev + totalPackageRev || currentRev;

    let serviceUnits = 0;
    let productUnits = 0;
    let packageUnits = 0;
    (lineItemsUnitsAgg || []).forEach((item: any) => {
      if (item._id === "service") serviceUnits = item.totalUnits;
      else if (item._id === "product") productUnits = item.totalUnits;
      else if (item._id === "package") packageUnits = item.totalUnits;
    });

    const revenueMix = {
      services: {
        amount: totalServiceRev,
        percent:
          totalMixRevenue > 0
            ? Math.round((totalServiceRev / totalMixRevenue) * 100)
            : 0,
        count: serviceUnits,
      },
      products: {
        amount: totalProductRev,
        percent:
          totalMixRevenue > 0
            ? Math.round((totalProductRev / totalMixRevenue) * 100)
            : 0,
        count: productUnits,
      },
      packages: {
        amount: totalPackageRev,
        percent:
          totalMixRevenue > 0
            ? Math.round((totalPackageRev / totalMixRevenue) * 100)
            : 0,
        count: packageUnits,
      },
      total: totalMixRevenue,
    };

    // Tender Split
    const cashTotal = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.paymentModes?.cash || 0),
      0
    );
    const upiTotal = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.paymentModes?.upi || 0),
      0
    );
    const cardTotal = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.paymentModes?.card || 0),
      0
    );
    const splitTotal = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.paymentModes?.split || 0),
      0
    );
    const totalTender = cashTotal + upiTotal + cardTotal + splitTotal || currentRev;

    const tenderCounts: Record<string, number> = {};
    (tenderCountsAgg || []).forEach((item: any) => {
      if (item._id) tenderCounts[String(item._id).toLowerCase()] = item.count || 0;
    });

    const tenderSplit: TenderSplitItem[] = [
      {
        mode: "upi",
        label: "UPI / QR",
        amount: upiTotal,
        percent: totalTender > 0 ? Math.round((upiTotal / totalTender) * 100) : 0,
        count: tenderCounts["upi"] || 0,
      },
      {
        mode: "cash" as const,
        label: "Cash",
        amount: cashTotal,
        percent: totalTender > 0 ? Math.round((cashTotal / totalTender) * 100) : 0,
        count: tenderCounts["cash"] || 0,
      },
      {
        mode: "card" as const,
        label: "Card / POS",
        amount: cardTotal,
        percent: totalTender > 0 ? Math.round((cardTotal / totalTender) * 100) : 0,
        count: tenderCounts["card"] || 0,
      },
    ];
    if (splitTotal > 0 || (tenderCounts["split"] && tenderCounts["split"] > 0)) {
      tenderSplit.push({
        mode: "split" as const,
        label: "Split / Other",
        amount: splitTotal,
        percent: totalTender > 0 ? Math.round((splitTotal / totalTender) * 100) : 0,
        count: tenderCounts["split"] || 0,
      });
    }

    // Client Retention
    const clientRetentionFacet = (clientsServedAgg as any)?.[0] || {};
    const registeredList = clientRetentionFacet.registeredClients || [];
    const guestCount = clientRetentionFacet.guestOrders?.[0]?.count || 0;

    let returningClientsCount = 0;
    let newClientsCount = guestCount;
    for (const c of registeredList) {
      if (c.hasPriorOrders) {
        returningClientsCount++;
      } else {
        newClientsCount++;
      }
    }
    const totalClientsServed = newClientsCount + returningClientsCount;
    const repeatRatePercent =
      totalClientsServed > 0
        ? Math.round((returningClientsCount / totalClientsServed) * 100)
        : 0;

    const vipClients = (vipClientsAgg || []).map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
      phone: c.phone || "",
      periodSpend: c.stats?.totalSpend || 0,
      lifetimeSpend: c.stats?.totalSpend || 0,
      totalVisits: c.stats?.totalVisits || 0,
      lastVisitAt: c.stats?.lastVisitAt
        ? new Date(c.stats.lastVisitAt).toISOString()
        : undefined,
    }));

    // Procurement Balances
    const poSpend = procurementAgg[0]?.totalSpend || 0;
    const poCount = procurementAgg[0]?.count || 0;
    const pendingDealerDues = supplierBalancesAgg[0]?.pendingDues || 0;
    const supplierCredits = Math.abs(supplierBalancesAgg[0]?.credits || 0);

    const procurement = {
      totalPOSpend: poSpend,
      purchaseOrdersCount: poCount,
      totalPendingDealerDues: pendingDealerDues,
      totalSupplierCredits: supplierCredits,
      netDealerBalance: pendingDealerDues - supplierCredits,
    };

    const internalStockCost = currentRollups.reduce(
      (acc: number, r: any) => acc + (r.metrics?.expenses?.internalStockConsumables || 0),
      0
    );

    const internalConsumption = {
      totalCost: internalConsumptionAgg[0]?.totalCost || internalStockCost || 0,
      transfersCount: internalConsumptionAgg[0]?.transfersCount || 0,
    };

    const executive = {
      netRevenue: calculateMetricDelta(currentRev, prevRev),
      totalExpenses: calculateMetricDelta(currentExp, prevExp),
      netProfit: calculateMetricDelta(currentProfit, prevProfit),
      profitMarginPercent: calculateMetricDelta(currentMarginPct, prevMarginPct),
      averageTicketValue: calculateMetricDelta(currentAtv, prevAtv),
      totalFootfall: calculateMetricDelta(currentOrdersCount, prevOrdersCount),
      uncollectedDues,
    };

    if (section === "main") {
      const mainData: MainAnalyticsData = {
        range: rangeParam,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        previousStartDate: previousStartDate.toISOString(),
        previousEndDate: previousEndDate.toISOString(),
        executive,
        procurement,
        cashflow: {
          timeline,
          revenueMix,
          tenderSplit,
        },
        internalConsumption,
        clients: {
          retention: {
            newClientsCount,
            returningClientsCount,
            totalClientsServed,
            repeatRatePercent,
            dormantClientsCount: dormantClientsCount || 0,
          },
          vipClients,
        },
      };

      return NextResponse.json({ success: true, data: mainData });
    }

    // Default: Return all (for backward-compatibility, omitting highestMarginProducts)
    const responsePayload: AnalyticsResponseData = {
      range: rangeParam,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      previousStartDate: previousStartDate.toISOString(),
      previousEndDate: previousEndDate.toISOString(),
      executive,
      cashflow: {
        timeline,
        revenueMix,
        tenderSplit,
      },
      services: {
        topServices: [],
        categoryContribution: [],
        hourlyDistribution: [],
        weekdayDistribution: [],
      },
      inventory: {
        topRetailProducts: [],
        internalConsumption,
        slowMovingStock: [],
      },
      clients: {
        retention: {
          newClientsCount,
          returningClientsCount,
          totalClientsServed,
          repeatRatePercent,
          dormantClientsCount: dormantClientsCount || 0,
        },
        vipClients,
      },
      procurement,
    };

    return NextResponse.json({ success: true, data: responsePayload });
  } catch (error: any) {
    console.error("[Analytics API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics intelligence",
      },
      { status: 500 }
    );
  }
}
