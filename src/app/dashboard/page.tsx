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
import { Supplier } from "@/lib/db/models/supplier.model";
import { PurchaseOrder } from "@/lib/db/models/purchase-order.model";
import { Service } from "@/lib/db/models/service.model";
import { PackageTemplate } from "@/lib/db/models/package-template.model";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  formatPhoneNumber,
  checkIsToday,
  checkIsLast24Hours,
  formatOrderTime,
  getBillLastUpdatedTime,
} from "@/lib/utils";
import {
  DashboardCustomer,
  DashboardExpense,
  DashboardOrder,
  DashboardProduct,
  DashboardSupplier,
  DashboardPurchaseOrder,
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  OrderStatus,
  OrderType,
  DashboardPaymentMode,
  DashboardRefundMode,
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
  let initialSuppliers: DashboardSupplier[] = [];
  let initialCustomers: DashboardCustomer[] = [];
  let initialPurchaseOrders: DashboardPurchaseOrder[] = [];
  let initialExpenses: DashboardExpense[] = [];
  let initialTotalExpensesCount = 0;
  let initialExpensesTotalAmount = 0;
  let initialExpenseCategoryCounts: Record<string, number> = {
    all: 0,
    "Day-to-day": 0,
    "Inventory purchase": 0,
    Salary: 0,
    Rent: 0,
    Refund: 0,
  };
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

    if (!tenant) {
      redirect("/login?error=AccessDenied");
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
        expensesCount,
        expenseCategoryAgg,
        expenseSumAgg,
        rawSuppliers,
        rawPurchaseOrders,
      ] = await Promise.all([
        Order.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).limit(20).lean(),
        Product.find({ tenantId: tenantObjectId }).sort({ createdAt: 1 }).lean(),
        Customer.find({ tenantId: tenantObjectId, isActive: true })
          .sort({ "stats.lastVisitAt": -1, updatedAt: -1 })
          .lean(),
        Expense.find({ tenantId: tenantObjectId })
          .sort({ expenseDate: -1, createdAt: -1 })
          .limit(20)
          .lean(),
        Order.countDocuments({ tenantId: tenantObjectId }),
        Service.find({ tenantId: tenantObjectId }).sort({ category: 1, name: 1 }).lean(),
        PackageTemplate.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).lean(),
        Order.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Expense.countDocuments({ tenantId: tenantObjectId }),
        Expense.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
        Expense.aggregate([
          { $match: { tenantId: tenantObjectId } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Supplier.find({
          tenantId: tenantObjectId,
          $or: [{ isActive: true }, { totalPending: { $gt: 0 } }],
        }).sort({ name: 1 }).lean(),
        PurchaseOrder.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).limit(100).lean(),
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
      // Combine paid_full into advance_paid for unified Advance Bookings count
      initialOrderStatusCounts.advance_paid =
        (initialOrderStatusCounts.advance_paid || 0) + (initialOrderStatusCounts.paid_full || 0);

      initialOrders = rawOrders.map((o) => {
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
              .filter((p: any) => p.recordedAt && checkIsToday(p.recordedAt))
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
        ].filter(Boolean);

        const latestActivityDate = candidateTimestamps.length > 0
          ? new Date(Math.max(...candidateTimestamps))
          : (o.createdAt ? new Date(o.createdAt) : new Date());

        const isMeaningfullyUpdated = Boolean(
          latestActivityDate &&
          o.createdAt &&
          new Date(latestActivityDate).getTime() - new Date(o.createdAt).getTime() > 60 * 1000
        );
        const lastUpdatedTime = isMeaningfullyUpdated ? formatOrderTime(latestActivityDate) : undefined;

        return {
          id: o.orderNumber,
          customer: o.customerSnapshot?.name || "Walk-in Customer",
          type: mapOrderType(o.orderType),
          itemsSummary: o.lineItems && Array.isArray(o.lineItems) ? o.lineItems.map((li: any) => li.name).filter(Boolean).join(", ") : undefined,
          amount: typeof o.totalAmount === "number" && !isNaN(o.totalAmount) ? o.totalAmount : 0,
          paid: typeof o.amountPaid === "number" && !isNaN(o.amountPaid) ? o.amountPaid : 0,
          todayPaid,
          status: o.status as OrderStatus,
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
          customerPhone: o.customerSnapshot?.phone || undefined,
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
          })) : undefined,
          lineItems: o.lineItems && Array.isArray(o.lineItems) ? o.lineItems.map((li: any) => ({
            name: li.name,
            itemType: li.itemType,
            unitPrice: typeof li.unitPrice === "number" ? li.unitPrice : 0,
            quantity: typeof li.quantity === "number" ? li.quantity : 1,
            discount: li.discount,
            finalPrice: typeof li.finalPrice === "number" ? li.finalPrice : ((li.unitPrice || 0) * (li.quantity || 1)),
            fulfilled: li.fulfilled,
            packageDetails: li.packageDetails ? {
              isCustomized: li.packageDetails.isCustomized,
              components: Array.isArray(li.packageDetails.components) ? li.packageDetails.components.map((c: any) => ({
                name: c.name,
                componentPrice: c.componentPrice,
              })) : [],
            } : undefined,
          })) : undefined,
        };
      });

      // Sort initialOrders by latest activity (settlements, completions, refunds, or creation) descending
      // This ensures orders settled/updated today (like #1061) are grouped chronologically with today's entries
      initialOrders.sort((a, b) => {
        const timeA = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      initialProducts = rawProducts.map((p) => ({
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

      initialCustomers = rawCustomers.map((c) => ({
        id: c._id.toString(),
        phone: formatPhoneNumber(c.phone),
        name: c.name,
        email: c.email || undefined,
        gender: c.gender || undefined,
        notes: c.notes || undefined,
        visits: c.stats?.totalVisits ?? 0,
        lastVisit: formatCustomerVisit(c.stats?.lastVisitAt || c.updatedAt),
        lastVisitRaw: c.stats?.lastVisitAt
          ? new Date(c.stats.lastVisitAt).toISOString()
          : c.updatedAt
          ? new Date(c.updatedAt).toISOString()
          : undefined,
        totalSpent: typeof c.stats?.totalSpend === "number" ? c.stats.totalSpend : 0,
        outstandingDue: typeof c.stats?.outstandingBalance === "number" ? c.stats.outstandingBalance : 0,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
      }));

      initialSuppliers = (rawSuppliers || []).map((s: any) => ({
        id: s._id.toString(),
        name: s.name,
        companyName: s.companyName,
        phone: formatPhoneNumber(s.phone || ""),
        email: s.email,
        address: s.address,
        gstin: s.gstin,
        notes: s.notes,
        totalPurchases: s.totalPurchases ?? 0,
        totalPaid: s.totalPaid ?? 0,
        totalPending: s.totalPending ?? 0,
        isActive: s.isActive !== false,
      }));

      initialPurchaseOrders = (rawPurchaseOrders || []).map((po: any) => ({
        id: po._id.toString(),
        purchaseOrderNumber: po.purchaseOrderNumber,
        supplierId: po.supplierId?.toString() || "",
        supplierName: po.supplierSnapshot?.name || "Supplier",
        supplierPhone: po.supplierSnapshot?.phone ? formatPhoneNumber(po.supplierSnapshot.phone) : undefined,
        supplierCompany: po.supplierSnapshot?.companyName,
        itemsCount: po.items?.length || 0,
        items: (po.items || []).map((it: any) => ({
          productId: it.productId?.toString() || "",
          productName: it.productName || "Product",
          quantityForSell: it.quantityForSell || 0,
          quantityForUse: it.quantityForUse || 0,
          purchaseCost: it.purchaseCost || 0,
          expectedSellPrice: it.expectedSellPrice || 0,
          itemTotalCost: it.itemTotalCost || 0,
        })),
        payments: (po.payments || []).map((p: any) => ({
          amount: p.amount,
          paymentMode: p.paymentMode,
          notes: p.notes,
          recordedBy: p.recordedBy,
          type: p.type || "settlement",
          recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : undefined,
        })),
        totalAmount: po.totalAmount,
        amountPaid: po.amountPaid,
        amountPending: po.amountPending,
        paymentMode: po.paymentMode,
        paymentStatus: po.paymentStatus,
        settlementMode: po.settlementMode,
        stockAllocated: po.stockAllocated ?? (po.settlementMode === "completed" || po.settlementMode === "pending"),
        dueDate: po.dueDate ? new Date(po.dueDate).toISOString() : undefined,
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString() : undefined,
        deliveryTime: po.deliveryTime,
        invoiceDate: po.invoiceDate ? new Date(po.invoiceDate).toISOString() : new Date().toISOString(),
        dealerInvoiceNumber: po.dealerInvoiceNumber,
        notes: po.notes,
        recordedBy: po.recordedBy || undefined,
        createdAt: po.createdAt ? new Date(po.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: po.updatedAt ? new Date(po.updatedAt).toISOString() : undefined,
        lastUpdatedTime: getBillLastUpdatedTime(po),
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
        expenseNumber: e.expenseNumber,
        desc: e.title,
        amount: e.amount,
        category: mapExpenseCategory(e.category, e.title),
        time: formatOrderTime(e.expenseDate || e.createdAt),
        isToday: checkIsToday(e.expenseDate || e.createdAt),
        notes: e.notes || undefined,
        createdAt: (e.expenseDate || e.createdAt)
          ? new Date(e.expenseDate || e.createdAt).toISOString()
          : undefined,
      }));

      initialTotalExpensesCount = expensesCount;
      initialExpensesTotalAmount = expenseSumAgg[0]?.total ?? 0;
      initialExpenseCategoryCounts = {
        all: expensesCount,
        "Day-to-day": 0,
        "Inventory purchase": 0,
        Salary: 0,
        Rent: 0,
        Refund: 0,
      };
      expenseCategoryAgg.forEach((item: { _id: string; count: number }) => {
        const uiCat = mapExpenseCategory(item._id);
        if (initialExpenseCategoryCounts[uiCat] !== undefined) {
          initialExpenseCategoryCounts[uiCat] += item.count;
        }
      });

      initialServices = rawServices.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        category: s.category || "General",
        price: s.price,
        description: s.description || "",
        isActive: s.isActive,
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
        tenantCode: tenant.tenantCode || "",
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
      initialSuppliers={initialSuppliers}
      initialPurchaseOrders={initialPurchaseOrders}
      initialCustomers={initialCustomers}
      initialExpenses={initialExpenses}
      initialTotalExpensesCount={initialTotalExpensesCount}
      initialExpenseCategoryCounts={initialExpenseCategoryCounts}
      initialExpensesTotalAmount={initialExpensesTotalAmount}
      initialSalonProfile={initialSalonProfile}
      initialServices={initialServices}
      initialPackages={initialPackages}
      initialOrderStatusCounts={initialOrderStatusCounts}
    />
  );
}
