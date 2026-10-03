import { Types } from "mongoose";
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
import { CustomerReplacement } from "@/lib/db/models/customer-replacement.model";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getOrSyncTodayRollup } from "@/lib/analytics/rollup-service";
import {
  formatPhoneNumber,
  checkIsToday,
  checkIsLast24Hours,
  formatOrderTime,
  getBillLastUpdatedTime,
  resolveOrderLineItems,
  resolvePurchaseOrderItems,
  formatNoteDisplay,
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
  DashboardCustomerReplacement,
  OrderStatus,
  OrderType,
  DashboardPaymentMode,
  DashboardRefundMode,
} from "@/types/dashboard";

export interface DashboardInitialData {
  resolvedTenantId: string;
  salonName: string;
  initialOrders: DashboardOrder[];
  initialTotalOrdersCount: number;
  initialProducts: DashboardProduct[];
  initialSuppliers: DashboardSupplier[];
  initialPurchaseOrders: DashboardPurchaseOrder[];
  initialCustomers: DashboardCustomer[];
  initialExpenses: DashboardExpense[];
  initialTotalExpensesCount: number;
  initialExpenseCategoryCounts: Record<string, number>;
  initialExpensesTotalAmount: number;
  initialSalonProfile: DashboardSalonProfile;
  initialServices: DashboardService[];
  initialPackages: DashboardPackage[];
  initialCustomerReplacements: DashboardCustomerReplacement[];
  initialOrderStatusCounts: Record<string, number>;
  initialTodayIncome: number;
  initialTodayExpense: number;
  initialTodayAdvance: number;
  initialTodayNetProfit: number;
  initialCustomerDues: number;
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

export async function getDashboardInitialData(
  userId: string,
  sessionTenantId?: string,
  userEmail?: string,
  userName?: string
): Promise<DashboardInitialData | null> {
  await connectToDatabase();

  let tenantId = sessionTenantId || "";
  let tenant = null;

  // 1. Try finding tenant by session's tenantId
  if (tenantId && Types.ObjectId.isValid(tenantId)) {
    tenant = await Tenant.findById(new Types.ObjectId(tenantId)).lean();
  }

  // 2. If not found, resolve fresh from user record
  if (!tenant && userId && Types.ObjectId.isValid(userId)) {
    const dbUser = await User.findById(new Types.ObjectId(userId)).lean();
    if (dbUser && dbUser.tenantId) {
      tenantId = dbUser.tenantId.toString();
      tenant = await Tenant.findById(dbUser.tenantId).lean();
    }
  }

  if (!tenant || !tenantId) {
    return null;
  }

  const resolvedTenantId = tenantId;
  const salonName = tenant.name;
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
    rawCustomerReplacements,
    replacementOrdersCount,
    todayRollup,
    customerDuesAgg,
  ] = await Promise.all([
    Order.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).limit(20).lean(),
    Product.find({ tenantId: tenantObjectId }).sort({ createdAt: 1 }).lean(),
    Customer.find({ tenantId: tenantObjectId, isActive: true })
      .sort({ "stats.lastVisitAt": -1, updatedAt: -1 })
      .lean(),
    Expense.find({ tenantId: tenantObjectId, category: { $ne: "stock_transfer_internal" } })
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
    Expense.countDocuments({ tenantId: tenantObjectId, category: { $ne: "stock_transfer_internal" } }),
    Expense.aggregate([
      { $match: { tenantId: tenantObjectId, category: { $ne: "stock_transfer_internal" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { tenantId: tenantObjectId, category: { $ne: "stock_transfer_internal" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Supplier.find({
      tenantId: tenantObjectId,
      $or: [{ isActive: true }, { totalPending: { $ne: 0 } }],
    }).sort({ name: 1 }).lean(),
    PurchaseOrder.find({ tenantId: tenantObjectId }).sort({ createdAt: -1 }).limit(100).lean(),
    CustomerReplacement.find({
      tenantId: tenantObjectId,
      status: { $in: ["pending_dealer", "arrived_call_client"] },
    }).sort({ expectedDate: 1 }).lean(),
    Order.countDocuments({
      tenantId: tenantObjectId,
      status: { $in: ["replacement", "replacement_pending", "replacement_completed"] },
    }),
    getOrSyncTodayRollup(tenantObjectId),
    Customer.aggregate([
      { $match: { tenantId: tenantObjectId, isActive: true } },
      { $group: { _id: null, total: { $sum: "$stats.outstandingBalance" } } },
    ]),
  ]);

  const initialTodayIncome = todayRollup?.metrics?.revenue?.total ?? 0;
  const initialTodayExpense = todayRollup?.metrics?.expenses?.total ?? 0;
  const initialTodayAdvance = todayRollup?.metrics?.advancePayment ?? 0;
  const initialTodayNetProfit = todayRollup?.metrics?.netProfit ?? 0;
  const initialCustomerDues = customerDuesAgg[0]?.total ?? 0;

  const initialTotalOrdersCount = count;
  const initialOrderStatusCounts: Record<string, number> = {
    all: count,
    created: 0,
    advance_paid: 0,
    paid_full: 0,
    completed: 0,
    cancelled_refunded: 0,
    replacement: replacementOrdersCount,
  };
  statusAgg.forEach((item: { _id: string; count: number }) => {
    if (item._id && initialOrderStatusCounts[item._id] !== undefined) {
      initialOrderStatusCounts[item._id] = item.count;
    }
  });
  // Combine paid_full into advance_paid for unified Advance Bookings count
  initialOrderStatusCounts.advance_paid =
    (initialOrderStatusCounts.advance_paid || 0) + (initialOrderStatusCounts.paid_full || 0);

  const initialOrders: DashboardOrder[] = rawOrders.map((o) => {
    const hasTodayPayment = Boolean(
      o.payments && Array.isArray(o.payments) && o.payments.some((p: any) => p.recordedAt && checkIsToday(p.recordedAt))
    );
    const hasLast24hPayment = Boolean(
      o.payments && Array.isArray(o.payments) && o.payments.some((p: any) => p.recordedAt && checkIsLast24Hours(p.recordedAt))
    );
    const hasTodayRefund = Boolean(o.refundDetails?.refundedAt && checkIsToday(o.refundDetails.refundedAt));
    const hasLast24hRefund = Boolean(o.refundDetails?.refundedAt && checkIsLast24Hours(o.refundDetails.refundedAt));
    const hasTodayReturn = Boolean(o.returns && Array.isArray(o.returns) && o.returns.some((r: any) => r.returnedAt && checkIsToday(r.returnedAt)));
    const hasLast24hReturn = Boolean(o.returns && Array.isArray(o.returns) && o.returns.some((r: any) => r.returnedAt && checkIsLast24Hours(r.returnedAt)));
    const isToday = checkIsToday(o.createdAt) || Boolean(o.completedAt && checkIsToday(o.completedAt)) || hasTodayPayment || hasTodayRefund || hasTodayReturn;
    const isLast24Hours = checkIsLast24Hours(o.createdAt) || Boolean(o.completedAt && checkIsLast24Hours(o.completedAt)) || hasLast24hPayment || hasLast24hRefund || hasLast24hReturn;

    const todayPaid = (() => {
      let rawTodayPaid = 0;
      if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
        rawTodayPaid = o.payments
          .filter((p: any) => {
            if (!p.recordedAt || !checkIsToday(p.recordedAt)) return false;
            if (checkIsToday(o.createdAt)) return true;
            return p.type !== "refund" && p.amount > 0;
          })
          .reduce((sum: number, p: any) => sum + (typeof p.amount === "number" && !isNaN(p.amount) ? p.amount : 0), 0);
      } else {
        rawTodayPaid = checkIsToday(o.createdAt) ? (typeof o.amountPaid === "number" && !isNaN(o.amountPaid) ? o.amountPaid : 0) : 0;
      }

      const totalCashRefunds = o.returns && Array.isArray(o.returns)
        ? o.returns.reduce((sum: number, r: any) => sum + (r.cashRefund || (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? r.refundAmount || 0 : 0)), 0)
        : (o.refundDetails?.refundAmount || 0);

      const netRetained = Math.max(0, (o.amountPaid || 0) - (o.status === "cancelled_refunded" ? (o.refundDetails?.refundAmount || o.amountPaid || 0) : totalCashRefunds));
      return Math.max(0, Math.min(rawTodayPaid, netRetained));
    })();

    const latestPaymentDate = (o.payments && Array.isArray(o.payments) && o.payments.length > 0)
      ? o.payments[o.payments.length - 1]?.recordedAt
      : null;
    const refundedDate = o.refundDetails?.refundedAt || null;
    const returnedDate = (o.returns && Array.isArray(o.returns) && o.returns.length > 0)
      ? o.returns[o.returns.length - 1]?.returnedAt
      : null;
    const candidateTimestamps = [
      o.createdAt ? new Date(o.createdAt).getTime() : 0,
      o.completedAt ? new Date(o.completedAt).getTime() : 0,
      latestPaymentDate ? new Date(latestPaymentDate).getTime() : 0,
      refundedDate ? new Date(refundedDate).getTime() : 0,
      returnedDate ? new Date(returnedDate).getTime() : 0,
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
      notes: o.notes ? formatNoteDisplay(o.notes) : undefined,
      recordedBy: o.recordedBy || undefined,
      payments: o.payments && Array.isArray(o.payments) ? o.payments.map((p: any) => ({
        amount: p.amount,
        mode: p.mode,
        recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : new Date().toISOString(),
        recordedBy: p.recordedBy,
        type: p.type || undefined,
        notes: p.notes ? formatNoteDisplay(p.notes) : undefined,
      })) : undefined,
      lineItems: resolveOrderLineItems(o.lineItems, o.returns),
      returns: o.returns && Array.isArray(o.returns) ? o.returns.map((r: any) => ({
        returnNumber: r.returnNumber,
        lineItemId: r.lineItemId ? r.lineItemId.toString() : undefined,
        lineItemIndex: typeof r.lineItemIndex === "number" ? r.lineItemIndex : 0,
        productId: r.productId ? r.productId.toString() : undefined,
        productName: r.productName,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        refundAmount: r.refundAmount,
        dueDeduction: typeof r.dueDeduction === "number" ? r.dueDeduction : (r.refundMode === "reduce_due" ? r.refundAmount || 0 : 0),
        cashRefund: typeof r.cashRefund === "number" ? r.cashRefund : (r.refundMode !== "reduce_due" && r.customerResolution === "refund" ? r.refundAmount || 0 : 0),
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
      })) : [],
    };
  });

  // Sort initialOrders by latest activity descending
  initialOrders.sort((a, b) => {
    const timeA = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (Math.abs(timeB - timeA) < 5000) {
      if (a.id && b.id) {
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      }
    }
    return timeB - timeA;
  });

  const initialProducts = rawProducts
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category || "General Supplies",
      sell: p.sellStock,
      use: p.useStock,
      defectiveStock: p.defectiveStock || 0,
      price: p.expectedSellPrice,
      purchaseCost: p.purchaseCost,
      lowStockThreshold: p.lowStockThreshold,
      description: p.description,
      barcode: p.barcode,
      isActive: p.isActive !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const initialCustomers = rawCustomers.map((c) => ({
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

  const initialSuppliers = (rawSuppliers || []).map((s: any) => ({
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

  const initialPurchaseOrders = (rawPurchaseOrders || []).map((po: any) => ({
    id: po._id.toString(),
    purchaseOrderNumber: po.purchaseOrderNumber,
    supplierId: po.supplierId?.toString() || "",
    supplierName: po.supplierSnapshot?.name || "Supplier",
    supplierPhone: po.supplierSnapshot?.phone ? formatPhoneNumber(po.supplierSnapshot.phone) : undefined,
    supplierCompany: po.supplierSnapshot?.companyName,
    itemsCount: po.items?.length || 0,
    items: resolvePurchaseOrderItems(po.items, po.returns),
    payments: (po.payments || []).map((p: any) => ({
      amount: p.amount,
      paymentMode: p.paymentMode,
      notes: p.notes,
      recordedBy: p.recordedBy,
      type: p.type || "settlement",
      recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : undefined,
    })),
    returns: (po.returns || []).map((r: any) => ({
      returnNumber: r.returnNumber,
      productId: r.productId?.toString() || "",
      productName: r.productName,
      quantity: r.quantity,
      stockType: r.stockType,
      unitCost: r.unitCost,
      totalRefundAmount: r.totalRefundAmount,
      refundMode: r.refundMode,
      amountDeductedFromDue: r.amountDeductedFromDue || 0,
      replacementStatus: r.replacementStatus || undefined,
      notes: r.notes,
      recordedBy: r.recordedBy,
      returnedAt: r.returnedAt ? new Date(r.returnedAt).toISOString() : undefined,
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

  const initialCustomerReplacements = (rawCustomerReplacements || []).map((cr: any) => ({
    id: cr._id.toString(),
    orderId: cr.orderId.toString(),
    orderNumber: cr.orderNumber,
    customerId: cr.customerId ? cr.customerId.toString() : undefined,
    customerName: cr.customerName,
    customerPhone: cr.customerPhone,
    productId: cr.productId.toString(),
    productName: cr.productName,
    totalQuantity: cr.totalQuantity,
    handedQuantity: cr.handedQuantity,
    pendingQuantity: cr.pendingQuantity,
    expectedDate: new Date(cr.expectedDate).toISOString(),
    status: cr.status,
    notes: cr.notes ? formatNoteDisplay(cr.notes) : undefined,
    recordedBy: cr.recordedBy,
    completedAt: cr.completedAt ? new Date(cr.completedAt).toISOString() : undefined,
    createdAt: new Date(cr.createdAt).toISOString(),
    updatedAt: new Date(cr.updatedAt).toISOString(),
  }));


  const initialExpenses: DashboardExpense[] = rawExpenses.map((e) => ({
    id: e._id.toString(),
    expenseNumber: e.expenseNumber,
    desc: formatNoteDisplay(e.title),
    amount: e.amount,
    category: mapExpenseCategory(e.category, e.title),
    time: formatOrderTime(e.expenseDate || e.createdAt),
    isToday: checkIsToday(e.expenseDate || e.createdAt),
    notes: e.notes ? formatNoteDisplay(e.notes) : undefined,
    createdAt: (e.expenseDate || e.createdAt)
      ? new Date(e.expenseDate || e.createdAt).toISOString()
      : undefined,
    paymentMode: e.paymentMode || undefined,
    recipient: e.recipient || undefined,
    recordedBy: e.recordedBy || undefined,
    linkedPurchaseOrderId: e.linkedPurchaseOrderId?.toString() || undefined,
    linkedOrderId: e.linkedOrderId?.toString() || undefined,
  }));

  const initialTotalExpensesCount = expensesCount;
  const initialExpensesTotalAmount = expenseSumAgg[0]?.total ?? 0;
  const initialExpenseCategoryCounts: Record<string, number> = {
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

  const initialServices = rawServices.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    category: s.category || "General",
    price: s.price,
    description: s.description || "",
    isActive: s.isActive,
    products: (s.products || []).map((p: any) => ({
      productId: p.productId.toString(),
      name: p.name,
      quantity: p.quantity,
      unitCost: p.unitCost,
    })),
  }));

  const initialPackages = rawPackages.map((pkg) => ({
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

  const initialSalonProfile: DashboardSalonProfile = {
    id: tenant._id.toString(),
    tenantCode: tenant.tenantCode || "",
    name: tenant.name || "",
    slug: tenant.slug || "",
    email: ownerUser?.ownerEmail || userEmail || "",
    phone: tenant.phone || "",
    address: tenant.address || "",
    profileImageUrl: tenant.profileImageUrl || "",
    profileImagePublicId: tenant.profileImagePublicId || "",
    status: tenant.status || "active",
    currency: tenant.settings?.currency || "INR",
    ownerName: tenant.name || userName || "Owner",
  };

  return {
    resolvedTenantId,
    salonName,
    initialOrders,
    initialTotalOrdersCount,
    initialProducts,
    initialSuppliers,
    initialPurchaseOrders,
    initialCustomers,
    initialExpenses,
    initialTotalExpensesCount,
    initialExpenseCategoryCounts,
    initialExpensesTotalAmount,
    initialSalonProfile,
    initialServices,
    initialPackages,
    initialCustomerReplacements,
    initialOrderStatusCounts,
    initialTodayIncome,
    initialTodayExpense,
    initialTodayAdvance,
    initialTodayNetProfit,
    initialCustomerDues,
  };
}
