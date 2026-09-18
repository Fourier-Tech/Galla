import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Expense } from "@/lib/db/models/expense.model";
import { DashboardExpense } from "@/types/dashboard";
import { formatOrderTime, checkIsToday } from "@/lib/utils";

function mapExpenseCategory(
  cat: string,
  title?: string
): "Inventory purchase" | "Day-to-day" | "Salary" | "Rent" | "Refund" {
  if (cat === "refund" || (cat === "other" && title?.toLowerCase().includes("refund"))) {
    return "Refund";
  }
  if (cat === "inventory_purchase" || cat === "inventory") {
    return "Inventory purchase";
  }
  if (cat === "salary") return "Salary";
  if (cat === "rent") return "Rent";
  return "Day-to-day";
}

function getMongoCategoryFilter(categoryParam: string) {
  switch (categoryParam) {
    case "Inventory purchase":
      return { $in: ["inventory_purchase", "inventory"] };
    case "Salary":
      return "salary";
    case "Rent":
      return "rent";
    case "Refund":
      return "refund";
    case "Day-to-day":
      return {
        $in: [
          "stock_transfer_internal",
          "refreshments",
          "utilities",
          "maintenance",
          "marketing",
          "other",
        ],
      };
    default:
      return null;
  }
}

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
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const sortOrder = searchParams.get("sortOrder") === "oldest" ? "oldest" : "newest";

    const query: Record<string, unknown> = { tenantId };

    // Category filter
    if (category && category !== "all") {
      const mongoCat = getMongoCategoryFilter(category);
      if (mongoCat) {
        query.category = mongoCat;
      }
    }

    // Date range filter (against expenseDate or createdAt)
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
      query.expenseDate = dateFilter;
    }

    // Search filter (expenseNumber, title, recipient, notes, or exact amount)
    if (search) {
      const regex = new RegExp(search, "i");
      const searchConditions: Record<string, unknown>[] = [
        { expenseNumber: regex },
        { title: regex },
        { recipient: regex },
        { notes: regex },
      ];
      const parsedNum = Number(search);
      if (!isNaN(parsedNum)) {
        searchConditions.push({ amount: parsedNum });
      }
      query.$or = searchConditions;
    }

    const sortDirection = sortOrder === "oldest" ? 1 : -1;

    // Parallel queries: paginated expenses, filtered count, category counts, and filtered amount sum
    const [totalCount, rawExpenses, rawCategoryAgg, totalTenantExpenses, sumAgg] =
      await Promise.all([
        Expense.countDocuments(query),
        Expense.find(query)
          .sort({ expenseDate: sortDirection, createdAt: sortDirection })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Expense.aggregate([
          { $match: { tenantId } },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
        Expense.countDocuments({ tenantId }),
        Expense.aggregate([
          { $match: query },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    // Map category counts to UI categories
    const categoryCounts: Record<string, number> = {
      all: totalTenantExpenses,
      "Day-to-day": 0,
      "Inventory purchase": 0,
      Salary: 0,
      Rent: 0,
      Refund: 0,
    };

    rawCategoryAgg.forEach((item: { _id: string; count: number }) => {
      const uiCat = mapExpenseCategory(item._id);
      if (categoryCounts[uiCat] !== undefined) {
        categoryCounts[uiCat] += item.count;
      }
    });

    const totalFilteredAmount = sumAgg[0]?.total ?? 0;

    const expenses: DashboardExpense[] = rawExpenses.map((e) => ({
      id: e._id.toString(),
      expenseNumber: e.expenseNumber,
      desc: e.title,
      amount: e.amount,
      category: mapExpenseCategory(e.category, e.title),
      time: formatOrderTime(e.expenseDate || e.createdAt),
      isToday: checkIsToday(e.expenseDate || e.createdAt),
      createdAt: (e.expenseDate || e.createdAt)
        ? new Date(e.expenseDate || e.createdAt).toISOString()
        : undefined,
    }));

    return NextResponse.json(
      {
        success: true,
        expenses,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / pageSize),
        categoryCounts,
        totalFilteredAmount,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[API] GET /api/expenses error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}
