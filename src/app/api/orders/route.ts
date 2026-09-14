import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order } from "@/lib/db/models/order.model";
import { DashboardOrder } from "@/types/dashboard";
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
      const fallback = await Tenant.findOne({ slug: "shreehari" });
      tenantId = fallback ? fallback._id : null;
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

    const query: Record<string, unknown> = { tenantId };

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Date range filter
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
      query.createdAt = dateFilter;
    }

    // Search filter (orderNumber, customer name, phone, status, or refund reason)
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { orderNumber: regex },
        { "customerSnapshot.name": regex },
        { "customerSnapshot.phone": regex },
        { status: regex },
        { "refundDetails.refundReason": regex },
      ];
    }

    const sortDirection = sortOrder === "oldest" ? 1 : -1;

    const [totalCount, rawOrders, statusAgg, overallTotal] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .sort({ createdAt: sortDirection })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Order.aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ tenantId }),
    ]);

    const statusCounts: Record<string, number> = {
      all: overallTotal,
      advance_paid: 0,
      paid_full: 0,
      completed: 0,
      cancelled_refunded: 0,
    };
    statusAgg.forEach((item: { _id: string; count: number }) => {
      if (item._id && statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    const orders: DashboardOrder[] = rawOrders.map((o) => ({
      id: o.orderNumber,
      customer: o.customerSnapshot?.name || "Walk-in Customer",
      type:
        o.orderType === "service_booking"
          ? "Service booking"
          : o.orderType === "package_sale"
          ? "Package sale"
          : "Product sale",
      amount: o.totalAmount,
      paid: o.amountPaid,
      status: o.status,
      time: formatOrderTime(o.createdAt),
      isToday: checkIsToday(o.createdAt),
      isLast24Hours: checkIsLast24Hours(o.createdAt),
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
      refundAmount: o.refundDetails?.refundAmount,
      refundReason: o.refundDetails?.refundReason,
    }));

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
