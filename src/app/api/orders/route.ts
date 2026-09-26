import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order } from "@/lib/db/models/order.model";
import { DashboardOrder, DashboardPaymentMode, DashboardRefundMode } from "@/types/dashboard";
import { formatOrderTime, checkIsToday, checkIsLast24Hours } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized session" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Zero-tolerance multi-tenant scoping: resolve tenantId strictly server-side
    let tenantId: Types.ObjectId | null = null;
    const sessionTenantId = session.user.tenantId;

    if (sessionTenantId && Types.ObjectId.isValid(sessionTenantId)) {
      const exists = await Tenant.exists({ _id: new Types.ObjectId(sessionTenantId) });
      if (exists) tenantId = new Types.ObjectId(sessionTenantId);
    }

    if (!tenantId && session.user.id && Types.ObjectId.isValid(session.user.id)) {
      const dbUser = await User.findById(new Types.ObjectId(session.user.id));
      if (dbUser && dbUser.tenantId) {
        tenantId = dbUser.tenantId;
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Salon tenant not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize")) || 20));
    const status = searchParams.get("status") || "all";
    const search = (searchParams.get("search") || "").trim();
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const sortOrder = searchParams.get("sortOrder") === "oldest" ? "oldest" : "newest";

    const conditions: Record<string, unknown>[] = [{ tenantId }];

    // Status filter
    if (status && status !== "all") {
      if (status === "advance_paid") {
        conditions.push({ status: { $in: ["advance_paid", "paid_full"] } });
      } else if (status === "replacement") {
        conditions.push({
          $or: [
            { status: { $in: ["replacement", "replacement_pending", "replacement_completed"] } },
            { "returns.customerResolution": "replacement" },
          ],
        });
      } else {
        conditions.push({ status });
      }
    }

    // Date range filter: matches creation OR activity date (completion, payment settlement, refund, or updates)
    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate && endDate) {
        const from = startDate <= endDate ? startDate : endDate;
        const to = startDate <= endDate ? endDate : startDate;
        dateFilter.$gte = new Date(`${from}T00:00:00`);
        dateFilter.$lte = new Date(`${to}T23:59:59.999`);
      } else if (startDate) {
        dateFilter.$gte = new Date(`${startDate}T00:00:00`);
      } else if (endDate) {
        dateFilter.$lte = new Date(`${endDate}T23:59:59.999`);
      }
      conditions.push({
        $or: [
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
          { completedAt: dateFilter },
          { "payments.recordedAt": dateFilter },
          { "refundDetails.refundedAt": dateFilter },
        ],
      });
    }

    // Search filter (orderNumber, customer name, phone, status, or refund reason)
    if (search) {
      const regex = new RegExp(search, "i");
      conditions.push({
        $or: [
          { orderNumber: regex },
          { "customerSnapshot.name": regex },
          { "customerSnapshot.phone": regex },
          { status: regex },
          { "refundDetails.refundReason": regex },
        ],
      });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const sortDirection = sortOrder === "oldest" ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> =
      status === "advance_paid" && !searchParams.get("sortOrder")
        ? { scheduledFor: 1, createdAt: -1 }
        : status === "created" && !searchParams.get("sortOrder")
        ? { scheduledFor: -1, createdAt: -1 }
        : { updatedAt: sortDirection, createdAt: sortDirection };

    const [totalCount, rawOrders, statusAgg, overallTotal, replacementCount] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .sort(sortQuery)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Order.aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ tenantId }),
      Order.countDocuments({
        tenantId,
        $or: [
          { status: { $in: ["replacement", "replacement_pending", "replacement_completed"] } },
          { "returns.customerResolution": "replacement" },
        ],
      }),
    ]);

    const statusCounts: Record<string, number> = {
      all: overallTotal,
      created: 0,
      advance_paid: 0,
      paid_full: 0,
      completed: 0,
      cancelled_refunded: 0,
      replacement: replacementCount,
    };
    statusAgg.forEach((item: { _id: string; count: number }) => {
      if (item._id && statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });
    // Combine paid_full into advance_paid for unified Advance Bookings count
    statusCounts.advance_paid = (statusCounts.advance_paid || 0) + (statusCounts.paid_full || 0);

    const orders: DashboardOrder[] = rawOrders.map((o) => {
      const hasTodayPayment = Boolean(
        o.payments && Array.isArray(o.payments) && o.payments.some((p: any) => p.recordedAt && checkIsToday(p.recordedAt))
      );
      const hasLast24hPayment = Boolean(
        o.payments && Array.isArray(o.payments) && o.payments.some((p: any) => p.recordedAt && checkIsLast24Hours(p.recordedAt))
      );
      const hasTodayRefund = Boolean(o.refundDetails?.refundedAt && checkIsToday(o.refundDetails.refundedAt));
      const hasLast24hRefund = Boolean(o.refundDetails?.refundedAt && checkIsLast24Hours(o.refundDetails.refundedAt));
      const isToday = checkIsToday(o.createdAt) || Boolean(o.completedAt && checkIsToday(o.completedAt)) || hasTodayPayment || hasTodayRefund;
      const isLast24Hours = checkIsLast24Hours(o.createdAt) || Boolean(o.completedAt && checkIsLast24Hours(o.completedAt)) || hasLast24hPayment || hasLast24hRefund;

      const todayPaid = (() => {
        let rawTodayPaid = 0;
        if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
          rawTodayPaid = o.payments
            .filter((p: any) => p.recordedAt && checkIsToday(p.recordedAt) && p.type !== "refund" && p.amount > 0)
            .reduce((sum: number, p: any) => sum + (typeof p.amount === "number" && !isNaN(p.amount) ? p.amount : 0), 0);
        } else {
          rawTodayPaid = checkIsToday(o.createdAt) ? (typeof o.amountPaid === "number" && !isNaN(o.amountPaid) ? o.amountPaid : 0) : 0;
        }

        if (o.status === "cancelled_refunded") {
          const netRetained = typeof o.amountPaid === "number" ? Math.max(0, o.amountPaid) : 0;
          return Math.min(rawTodayPaid, netRetained);
        }
        return rawTodayPaid;
      })();

      const latestPaymentDate = (o.payments && Array.isArray(o.payments) && o.payments.length > 0)
        ? o.payments[o.payments.length - 1]?.recordedAt
        : null;
      const refundedDate = o.refundDetails?.refundedAt || null;
      const candidateTimestamps = [
        o.createdAt ? new Date(o.createdAt).getTime() : 0,
        o.completedAt ? new Date(o.completedAt).getTime() : 0,
        latestPaymentDate ? new Date(latestPaymentDate).getTime() : 0,
        refundedDate ? new Date(refundedDate).getTime() : 0,
        o.updatedAt ? new Date(o.updatedAt).getTime() : 0,
      ].filter(Boolean);

      const latestActivityDate = candidateTimestamps.length > 0
        ? new Date(Math.max(...candidateTimestamps))
        : (o.createdAt ? new Date(o.createdAt) : new Date());

      const createdTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      const latestTime = latestActivityDate.getTime();
      const hasMultiplePayments = o.payments && o.payments.length > 1;
      const isMeaningfullyUpdated = 
        (createdTime > 0 && latestTime - createdTime > 5000) ||
        hasMultiplePayments ||
        Boolean(o.refundDetails?.refundedAt) ||
        (o.lineItems && o.lineItems.some((li: any) => li.returnedQuantity && li.returnedQuantity > 0));
        
      const lastUpdatedTime = isMeaningfullyUpdated ? formatOrderTime(new Date(latestTime)) : undefined;

      return {
        id: o.orderNumber,
        customer: o.customerSnapshot?.name || "Walk-in Customer",
        customerPhone: o.customerSnapshot?.phone || undefined,
        type:
          o.orderType === "service_booking"
            ? "Service booking"
            : o.orderType === "package_sale"
            ? "Package sale"
            : "Product sale",
        itemsSummary: o.lineItems && Array.isArray(o.lineItems) ? o.lineItems.map((li: any) => li.name).filter(Boolean).join(", ") : undefined,
        amount: typeof o.totalAmount === "number" && !isNaN(o.totalAmount) ? o.totalAmount : 0,
        paid: typeof o.amountPaid === "number" && !isNaN(o.amountPaid) ? o.amountPaid : 0,
        todayPaid,
        status: o.status,
        time: formatOrderTime(o.createdAt),
        lastUpdatedTime,
        isToday,
        isLast24Hours,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
        completedAt: o.completedAt ? new Date(o.completedAt).toISOString() : undefined,
        refundedAt: o.refundDetails?.refundedAt ? new Date(o.refundDetails.refundedAt).toISOString() : undefined,
        latestActivityAt: latestActivityDate ? new Date(latestActivityDate).toISOString() : undefined,
        scheduledFor: o.scheduledFor ? new Date(o.scheduledFor).toISOString() : undefined,
        scheduledTime: o.scheduledTime || undefined,
        refundAmount: o.refundDetails?.refundAmount,
        refundReason: o.refundDetails?.refundReason,
        paymentMode: (o.paymentMode || o.payments?.[o.payments.length - 1]?.mode || o.payments?.[0]?.mode) as DashboardPaymentMode | undefined,
        refundMode: o.refundDetails?.refundMode as DashboardRefundMode | undefined,
        advanceAmount: (() => {
          if (o.status === "advance_paid") return o.amountPaid;
          if (o.status === "cancelled_refunded") {
            const collected = (o.amountPaid || 0) + (o.refundDetails?.refundAmount || 0);
            if (collected > 0 && collected < o.totalAmount) return collected;
            if (o.payments && o.payments.length > 0 && o.payments[0].amount < o.totalAmount) {
              return o.payments[0].amount;
            }
          }
          if (o.status === "completed" && o.payments && o.payments.length > 1) {
            if (o.payments[0].amount < o.totalAmount) {
              return o.payments[0].amount;
            }
          }
          return undefined;
        })(),
        advancePaymentMode: (() => {
          if (o.status === "completed" && o.payments && o.payments.length > 1 && o.payments[0].amount < o.totalAmount) {
            return o.payments[0].mode as DashboardPaymentMode;
          }
          if (o.status === "cancelled_refunded" && o.payments && o.payments.length > 0) {
            return o.payments[0].mode as DashboardPaymentMode;
          }
          if (o.status === "advance_paid") {
            return (o.payments?.[0]?.mode || o.paymentMode) as DashboardPaymentMode;
          }
          return undefined;
        })(),
        subtotal: typeof o.subtotal === "number" ? o.subtotal : (typeof o.totalAmount === "number" ? o.totalAmount : 0),
        discountType: o.discountType,
        discountValue: o.discountValue,
        discountAmount: o.discountAmount,
        notes: o.notes || undefined,
        recordedBy: o.recordedBy || undefined,
        payments: o.payments && Array.isArray(o.payments) ? o.payments.map((p: any) => ({
          amount: p.amount,
          mode: p.mode,
          recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : new Date().toISOString(),
          recordedBy: p.recordedBy,
          type: p.type || undefined,
          notes: p.notes || undefined,
        })) : undefined,
        lineItems: o.lineItems && Array.isArray(o.lineItems) ? o.lineItems.map((li: any) => ({
          name: li.name,
          itemType: li.itemType,
          itemId: li.itemId ? li.itemId.toString() : undefined,
          unitPrice: typeof li.unitPrice === "number" ? li.unitPrice : 0,
          quantity: typeof li.quantity === "number" ? li.quantity : 1,
          discount: li.discount,
          finalPrice: typeof li.finalPrice === "number" ? li.finalPrice : ((li.unitPrice || 0) * (li.quantity || 1)),
          fulfilled: li.fulfilled,
          returnedQuantity: li.returnedQuantity || 0,
          returnCondition: li.returnCondition,
          packageDetails: li.packageDetails ? {
            isCustomized: li.packageDetails.isCustomized,
            components: Array.isArray(li.packageDetails.components) ? li.packageDetails.components.map((c: any) => ({
              name: c.name,
              componentPrice: c.componentPrice,
            })) : [],
          } : undefined,
        })) : undefined,
        returns: o.returns && Array.isArray(o.returns) ? o.returns.map((r: any) => ({
          returnNumber: r.returnNumber,
          lineItemId: r.lineItemId ? r.lineItemId.toString() : undefined,
          lineItemIndex: r.lineItemIndex,
          productId: r.productId ? r.productId.toString() : undefined,
          productName: r.productName,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          refundAmount: r.refundAmount,
          returnCondition: r.returnCondition,
          customerResolution: r.customerResolution,
          refundMode: r.refundMode,
          supplierClaim:
            r.supplierClaim &&
            (r.supplierClaim.poId ||
              r.supplierClaim.purchaseOrderNumber ||
              r.supplierClaim.supplierName)
              ? {
                  poId: r.supplierClaim.poId
                    ? r.supplierClaim.poId.toString()
                    : undefined,
                  purchaseOrderNumber:
                    r.supplierClaim.purchaseOrderNumber || undefined,
                  supplierName: r.supplierClaim.supplierName || undefined,
                  refundMode: r.supplierClaim.refundMode || undefined,
                }
              : undefined,
          customerReplacementId: r.customerReplacementId ? r.customerReplacementId.toString() : undefined,
          expectedPickupDate: r.expectedPickupDate ? new Date(r.expectedPickupDate).toISOString() : undefined,
          restockLocation: r.restockLocation,
          isSameDayReturn: r.isSameDayReturn,
          notes: r.notes,
          recordedBy: r.recordedBy,
          returnedAt: r.returnedAt ? new Date(r.returnedAt).toISOString() : new Date().toISOString(),
        })) : undefined,
      };
    });

    // In-memory sort by latest activity when viewing newest first so orders updated today are top
    if (!sortOrder || sortOrder === "newest") {
      orders.sort((a, b) => {
        const timeA = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    }

    return NextResponse.json(
      {
        success: true,
        orders,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / pageSize),
        statusCounts,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[API] GET /api/orders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
