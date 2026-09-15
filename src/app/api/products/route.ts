import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Product } from "@/lib/db/models/product.model";
import { DashboardProduct } from "@/types/dashboard";

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
    const category = searchParams.get("category") || "all";
    const search = (searchParams.get("search") || "").trim();
    const showInactive = searchParams.get("showInactive") === "true";
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? -1 : 1;

    // Base query scoped to tenant
    const query: Record<string, unknown> = { tenantId };

    // Active status filter
    if (!showInactive) {
      query.isActive = { $ne: false };
    }

    // Category filter
    if (category && category !== "all") {
      query.category = category;
    }

    // Low stock filter
    if (lowStockOnly) {
      query.$expr = { $lte: ["$sellStock", { $ifNull: ["$lowStockThreshold", 2] }] };
    }

    // Search filter (name, category, description)
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { name: regex },
        { category: regex },
        { description: regex },
      ];
    }

    // Sort definition
    const sortObj: Record<string, 1 | -1> = {};
    if (sortBy === "price") {
      sortObj.expectedSellPrice = sortOrder;
    } else if (sortBy === "sellStock") {
      sortObj.sellStock = sortOrder;
    } else if (sortBy === "createdAt") {
      sortObj.createdAt = sortOrder;
    } else {
      sortObj.name = sortOrder;
    }

    // Fetch products and category aggregations in parallel
    const [rawProducts, rawCategories, inactiveCount] = await Promise.all([
      Product.find(query).sort(sortObj).lean(),
      Product.aggregate([
        {
          $match: {
            tenantId,
            ...(showInactive ? {} : { isActive: { $ne: false } }),
          },
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Product.countDocuments({ tenantId, isActive: false }),
    ]);

    const products: DashboardProduct[] = rawProducts.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category || "General Supplies",
      sell: p.sellStock,
      use: p.useStock,
      price: p.expectedSellPrice,
      purchaseCost: p.purchaseCost,
      lowStockThreshold: p.lowStockThreshold,
      description: p.description,
      barcode: p.barcode,
      isActive: p.isActive !== false,
    }));

    // ponytail: In-memory low-stock sort and slicing assumes salon catalog <= 5,000 SKUs. Upgrade path: MongoDB $facet aggregation pipeline with computed $lte if catalog reaches enterprise scale.
    // By default, sort low stock products to the top
    if (sortBy === "name") {
      products.sort((a, b) => {
        const aInactive = a.isActive === false;
        const bInactive = b.isActive === false;
        if (aInactive && !bInactive) return 1;
        if (!aInactive && bInactive) return -1;

        const aLow = !aInactive && a.sell <= (a.lowStockThreshold ?? 2);
        const bLow = !bInactive && b.sell <= (b.lowStockThreshold ?? 2);

        if (aLow && !bLow) return -1;
        if (!aLow && bLow) return 1;

        if (aLow && bLow) {
          if (a.sell !== b.sell) return a.sell - b.sell;
          return a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
      });
    }

    const overallTotal = rawCategories.reduce((acc: number, c: { count: number }) => acc + (c.count || 0), 0);
    const categoryCounts: Record<string, number> = {
      all: overallTotal,
    };
    rawCategories.forEach((c: { _id: string; count: number }) => {
      if (c._id) {
        categoryCounts[c._id] = c.count;
      }
    });

    const totalCount = products.length;
    const paginatedProducts = products.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      success: true,
      products: paginatedProducts,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      categoryCounts,
      inactiveCount,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
