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
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  DashboardCustomer,
  DashboardExpense,
  DashboardOrder,
  DashboardProduct,
  DashboardSalonProfile,
  OrderStatus,
  OrderType,
  UserRole,
} from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Counter Dashboard — Galla",
  description: "Live parlour counter operations, orders, split inventory & owner analytics",
};

function checkIsToday(date: Date | string | undefined): boolean {
  if (!date) return true;
  const d = new Date(date);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function formatOrderTime(date: Date | string | undefined): string {
  if (!date) return "Today, Just now";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Today, Just now";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeStr}`;
}

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
  cat: string
): "Inventory purchase" | "Day-to-day" | "Salary" | "Rent" {
  if (cat === "inventory_purchase" || cat === "inventory")
    return "Inventory purchase";
  if (cat === "salary") return "Salary";
  if (cat === "rent") return "Rent";
  return "Day-to-day";
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let salonName = "";
  let initialOrders: DashboardOrder[] = [];
  let initialProducts: DashboardProduct[] = [];
  let initialCustomers: DashboardCustomer[] = [];
  let initialExpenses: DashboardExpense[] = [];
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

    let tenantId = session.user.tenantId;
    let tenant = null;

    // 1. Try finding tenant by session's tenantId
    if (tenantId && Types.ObjectId.isValid(tenantId)) {
      tenant = await Tenant.findById(new Types.ObjectId(tenantId)).lean();
    }

    // 2. If not found (e.g. database reseeded while session cookie remained active), resolve fresh from user record
    if (!tenant && session.user.email) {
      const cleanEmail = session.user.email.trim().toLowerCase();
      const dbUser = await User.findOne({
        $or: [
          { email: cleanEmail },
          { email: `${cleanEmail}@gmail.com` },
        ],
      }).lean();
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
      salonName = tenant.name;
      const tenantObjectId = new Types.ObjectId(tenantId);

      const [rawOrders, rawProducts, rawCustomers, rawExpenses] =
        await Promise.all([
          Order.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean(),
          Product.find({ tenantId: tenantObjectId, isActive: true }).sort({ createdAt: 1 }).lean(),
          Customer.find({ tenantId: tenantObjectId, isActive: true })
            .sort({ "stats.lastVisitAt": -1, updatedAt: -1 })
            .lean(),
          Expense.find({ tenantId: tenantObjectId })
            .sort({ expenseDate: -1, createdAt: -1 })
            .lean(),
        ]);

      initialOrders = rawOrders.map((o) => ({
        id: o.orderNumber,
        customer: o.customerSnapshot?.name || "Walk-in Customer",
        type: mapOrderType(o.orderType),
        amount: o.totalAmount,
        paid: o.amountPaid,
        status: o.status as OrderStatus,
        time: formatOrderTime(o.createdAt),
        isToday: checkIsToday(o.createdAt),
      }));

      initialProducts = rawProducts.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        sell: p.sellStock,
        use: p.useStock,
        price: p.expectedSellPrice,
      }));

      initialCustomers = rawCustomers.map((c) => ({
        phone: c.phone,
        name: c.name,
        visits: c.stats?.totalVisits ?? 0,
        lastVisit: formatCustomerVisit(c.stats?.lastVisitAt || c.updatedAt),
      }));

      initialExpenses = rawExpenses.map((e) => ({
        id: e._id.toString(),
        desc: e.title,
        amount: e.amount,
        category: mapExpenseCategory(e.category),
        time: formatOrderTime(e.expenseDate || e.createdAt),
        isToday: checkIsToday(e.expenseDate || e.createdAt),
      }));

      const ownerUser = await User.findOne({
        tenantId: tenantObjectId,
        role: "owner",
      }).lean();

      initialSalonProfile = {
        id: tenant._id.toString(),
        name: tenant.name || "",
        slug: tenant.slug || "",
        email: ownerUser?.email || session.user.email || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        profileImageUrl: tenant.profileImageUrl || "",
        profileImagePublicId: tenant.profileImagePublicId || "",
        status: tenant.status || "active",
        currency: tenant.settings?.currency || "INR",
        ownerName: ownerUser?.name || session.user.name || "",
      };
    }
  } catch (error) {
    console.error("Failed to load dashboard data from database:", error);
  }

  const initialRole: UserRole =
    session.user.role === "staff" ? "staff" : "owner";

  return (
    <DashboardClient
      salonName={salonName}
      initialRole={initialRole}
      initialOrders={initialOrders}
      initialProducts={initialProducts}
      initialCustomers={initialCustomers}
      initialExpenses={initialExpenses}
      initialSalonProfile={initialSalonProfile}
    />
  );
}
