import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order } from "@/lib/db/models/order.model";
import { Product } from "@/lib/db/models/product.model";
import { Customer } from "@/lib/db/models/customer.model";
import { Expense } from "@/lib/db/models/expense.model";
import { Service } from "@/lib/db/models/service.model";
import { PackageTemplate } from "@/lib/db/models/package-template.model";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  formatPhoneNumber,
  checkIsToday,
  checkIsLast24Hours,
  formatOrderTime,
} from "@/lib/utils";
import {
  DashboardCustomer,
  DashboardExpense,
  DashboardOrder,
  DashboardProduct,
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  OrderStatus,
  OrderType,
  UserRole,
} from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Counter Dashboard — Galla",
  description: "Live parlour counter operations, orders, split inventory & owner analytics",
};


function formatCustomerVisit(date: Date | string | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Never";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapOrderType(type: string): OrderType {
  if (type === "service_booking") return "Service booking";
  if (type === "package_sale") return "Package sale";
  return "Product sale";
}

function mapExpenseCategory(
  cat: string,
  title?: string
): "Inventory purchase" | "Day-to-day" | "Salary" | "Rent" | "Refund" {
  if (cat === "refund" || (cat === "other" && title?.toLowerCase().includes("refund"))) {
    return "Refund";
  }
  if (cat === "inventory_purchase" || cat === "inventory")
    return "Inventory purchase";
  if (cat === "salary") return "Salary";
  if (cat === "rent") return "Rent";
  return "Day-to-day";
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?error=session_expired");
  }

  let salonName = "";
  let resolvedTenantId = session.user.tenantId || "";
  let initialOrders: DashboardOrder[] = [];
  let initialTotalOrdersCount = 0;
  let initialProducts: DashboardProduct[] = [];
  let initialCustomers: DashboardCustomer[] = [];
  let initialExpenses: DashboardExpense[] = [];
  let initialServices: DashboardService[] = [];
  let initialPackages: DashboardPackage[] = [];
  let initialOrderStatusCounts: Record<string, number> = {
    all: 0,
    advance_paid: 0,
    paid_full: 0,
    completed: 0,
    cancelled_refunded: 0,
  };
  let initialSalonProfile: DashboardSalonProfile = {
    id: "",
    name: "",
    slug: "",
    email: session.user.email || "",
    phone: "",
    address: "",
    profileImageUrl: "",
    profileImagePublicId: "",
    status: "active",
    currency: "INR",
    ownerName: session.user.name || "",
  };

  try {
    await connectToDatabase();

    let tenantId = resolvedTenantId;
    let tenant = null;

    // 1. Try finding tenant by session's tenantId
    if (tenantId && Types.ObjectId.isValid(tenantId)) {
      tenant = await Tenant.findById(new Types.ObjectId(tenantId)).lean();
    }

    // 2. If not found, resolve fresh from user record
    if (!tenant && session.user.id && Types.ObjectId.isValid(session.user.id)) {
      const dbUser = await User.findById(new Types.ObjectId(session.user.id)).lean();
      if (dbUser && dbUser.tenantId) {
        tenantId = dbUser.tenantId.toString();
        tenant = await Tenant.findById(dbUser.tenantId).lean();
      }
    }

    // 3. If still not found, fallback to default ShreeHari tenant
    if (!tenant) {
      tenant = await Tenant.findOne({ slug: "shreehari" }).lean();
      if (tenant) {
        tenantId = tenant._id.toString();
      }
    }

    if (tenant && tenantId) {
      resolvedTenantId = tenantId;
      salonName = tenant.name;
      const tenantObjectId = new Types.ObjectId(tenantId);

      const [
        rawOrders,
        rawProducts,
        rawCustomers,
        rawExpenses,
        count,
        rawServices,
        rawPackages,
        statusAgg,
      ] = await Promise.all([
        Order.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).limit(20).lean(),
        Product.find({ tenantId: tenantObjectId, isActive: true }).sort({ createdAt: 1 }).lean(),
        Customer.find({ tenantId: tenantObjectId, isActive: true })
          .sort({ "stats.lastVisitAt": -1, updatedAt: -1 })
          .lean(),
        Expense.find({ tenantId: tenantObjectId })
          .sort({ expenseDate: -1, createdAt: -1 })
          .lean(),
        Order.countDocuments({ tenantId: tenantObjectId }),
        Service.find({ tenantId: tenantObjectId }).sort({ category: 1, name: 1 }).lean(),
        PackageTemplate.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean(),
        Order.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

      initialTotalOrdersCount = count;
      initialOrderStatusCounts = {
        all: count,
        advance_paid: 0,
        paid_full: 0,
        completed: 0,
        cancelled_refunded: 0,
      };
      statusAgg.forEach((item: { _id: string; count: number }) => {
        if (item._id && initialOrderStatusCounts[item._id] !== undefined) {
          initialOrderStatusCounts[item._id] = item.count;
        }
      });

      initialOrders = rawOrders.map((o) => ({
        id: o.orderNumber,
        customer: o.customerSnapshot?.name || "Walk-in Customer",
        type: mapOrderType(o.orderType),
        amount: o.totalAmount,
        paid: o.amountPaid,
        status: o.status as OrderStatus,
        time: formatOrderTime(o.createdAt),
        isToday: checkIsToday(o.createdAt),
        isLast24Hours: checkIsLast24Hours(o.createdAt),
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : undefined,
        refundAmount: o.refundDetails?.refundAmount,
        refundReason: o.refundDetails?.refundReason,
      }));

      initialProducts = rawProducts.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        sell: p.sellStock,
        use: p.useStock,
        price: p.expectedSellPrice,
      }));

      initialCustomers = rawCustomers.map((c) => ({
        phone: formatPhoneNumber(c.phone),
        name: c.name,
        visits: c.stats?.totalVisits ?? 0,
        lastVisit: formatCustomerVisit(c.stats?.lastVisitAt || c.updatedAt),
      }));

      // Background migration for any legacy unformatted customer phones in DB
      const unformatted = rawCustomers.filter(
        (c) => c.phone && (!c.phone.startsWith("+91 ") || c.phone.length !== 15)
      );
      if (unformatted.length > 0) {
        Promise.all(
          unformatted.map((c) =>
            Customer.updateOne(
              { _id: c._id },
              { $set: { phone: formatPhoneNumber(c.phone) } }
            )
          )
        ).catch(() => {});
      }

      initialExpenses = rawExpenses.map((e) => ({
        id: e._id.toString(),
        desc: e.title,
        amount: e.amount,
        category: mapExpenseCategory(e.category, e.title),
        time: formatOrderTime(e.expenseDate || e.createdAt),
        isToday: checkIsToday(e.expenseDate || e.createdAt),
        createdAt: (e.expenseDate || e.createdAt)
          ? new Date(e.expenseDate || e.createdAt).toISOString()
          : undefined,
      }));

      initialServices = rawServices.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        category: s.category || "General",
        price: s.price,
        durationMinutes: s.durationMinutes || 30,
        description: s.description || "",
        isActive: s.isActive ?? true,
      }));

      initialPackages = rawPackages.map((pkg) => ({
        id: pkg._id.toString(),
        name: pkg.name,
        description: pkg.description || "",
        pricingType: (pkg.pricingType as "fixed" | "sum_of_items") || "fixed",
        packagePrice: pkg.packagePrice,
        services: (pkg.services || []).map((s) => ({
          serviceId: s.serviceId.toString(),
          name: s.name,
          componentPrice: s.componentPrice,
        })),
        products: (pkg.products || []).map((p) => ({
          productId: p.productId.toString(),
          name: p.name,
          quantity: p.quantity,
          componentPrice: p.componentPrice,
        })),
        isActive: pkg.isActive ?? true,
      }));

      const ownerUser = await User.findOne({
        tenantId: tenantObjectId,
      }).lean();

      initialSalonProfile = {
        id: tenant._id.toString(),
        name: tenant.name || "",
        slug: tenant.slug || "",
        email: ownerUser?.ownerEmail || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        profileImageUrl: tenant.profileImageUrl || "",
        profileImagePublicId: tenant.profileImagePublicId || "",
        status: tenant.status || "active",
        currency: tenant.settings?.currency || "INR",
        ownerName: tenant.name || "Owner",
      };
    }
  } catch (error) {
    console.error("Failed to load dashboard data from database:", error);
  }

  const initialRole: UserRole =
    session.user.role === "staff" ? "staff" : "owner";

  return (
    <DashboardClient
      tenantId={resolvedTenantId}
      salonName={salonName}
      initialRole={initialRole}
      initialOrders={initialOrders}
      initialTotalOrdersCount={initialTotalOrdersCount}
      initialProducts={initialProducts}
      initialCustomers={initialCustomers}
      initialExpenses={initialExpenses}
      initialSalonProfile={initialSalonProfile}
      initialServices={initialServices}
      initialPackages={initialPackages}
      initialOrderStatusCounts={initialOrderStatusCounts}
    />
  );
}
