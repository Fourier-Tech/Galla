"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order } from "@/lib/db/models/order.model";
import { Product } from "@/lib/db/models/product.model";
import { Expense } from "@/lib/db/models/expense.model";
import { Customer } from "@/lib/db/models/customer.model";
import {
  createOrderSchema,
  completeOrderSchema,
  refundOrderSchema,
  createExpenseSchema,
  transferStockSchema,
  updateSalonProfileSchema,
} from "@/lib/validations/dashboard";
import {
  DashboardOrder,
  DashboardExpense,
  DashboardProduct,
  DashboardSalonProfile,
  OrderType,
} from "@/types/dashboard";
import { triggerTenantEvent } from "@/lib/realtime/pusher-server";
import {
  formatPhoneNumber,
  formatOrderTime,
  checkIsToday,
  checkIsLast24Hours,
} from "@/lib/utils";

interface SessionLike {
  user?: {
    id?: string;
    tenantId?: string;
    email?: string | null;
    role?: string;
  };
}

async function broadcastUpdate(tenantId: Types.ObjectId | string, actionType: string) {
  try {
    await triggerTenantEvent({
      tenantId: tenantId.toString(),
      event: "data_updated",
      data: { action: actionType, timestamp: Date.now() },
    });
  } catch (err) {
    console.warn("[Realtime] broadcastUpdate warning:", err);
  }
}

async function resolveTenantId(session: SessionLike): Promise<Types.ObjectId | null> {
  const tenantIdStr = session?.user?.tenantId;
  if (tenantIdStr && Types.ObjectId.isValid(tenantIdStr)) {
    const exists = await Tenant.exists({ _id: new Types.ObjectId(tenantIdStr) });
    if (exists) return new Types.ObjectId(tenantIdStr);
  }

  if (session?.user?.id && Types.ObjectId.isValid(session.user.id)) {
    const dbUser = await User.findById(new Types.ObjectId(session.user.id));
    if (dbUser && dbUser.tenantId) {
      return dbUser.tenantId;
    }
  }

  const fallback = await Tenant.findOne({ slug: "shreehari" });
  return fallback ? fallback._id : null;
}

export async function createOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = createOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    // Auto-generate order number based on tenant count
    const orderCount = await Order.countDocuments({ tenantId });
    const orderNumber = `#${1042 + orderCount}`;

    const dbOrderType =
      input.orderType === "Service booking"
        ? "service_booking"
        : input.orderType === "Package sale"
          ? "package_sale"
          : "product_sale";

    const isFullPayment = input.paidAmount >= input.totalAmount;
    const amountPending = Math.max(0, input.totalAmount - input.paidAmount);

    const formattedPhone = input.customerPhone ? formatPhoneNumber(input.customerPhone) : "";

    const newDoc = await Order.create({
      tenantId,
      orderNumber,
      customerSnapshot: {
        name: input.customerName,
        phone: formattedPhone,
      },
      orderType: dbOrderType,
      status: input.status,
      lineItems: [
        {
          itemType:
            dbOrderType === "service_booking"
              ? "service"
              : dbOrderType === "package_sale"
                ? "package"
                : "product",
          itemId: new Types.ObjectId(),
          name: `${input.orderType} — ${input.customerName}`,
          unitPrice: input.totalAmount,
          quantity: 1,
          discount: 0,
          finalPrice: input.totalAmount,
          fulfilled: isFullPayment,
        },
      ],
      subtotal: input.totalAmount,
      discountType: "flat",
      discountValue: 0,
      discountAmount: 0,
      totalAmount: input.totalAmount,
      amountPaid: input.paidAmount,
      amountPending: amountPending,
      paymentMode: "cash",
      payments:
        input.paidAmount > 0
          ? [
            {
              amount: input.paidAmount,
              mode: "cash",
              recordedAt: new Date(),
              recordedBy: session.user.role === "staff" ? "staff" : "owner",
            },
          ]
          : [],
      recordedBy: session.user.role === "staff" ? "staff" : "owner",
    });

    // Update customer visit stats if customer exists
    if (formattedPhone) {
      const rawDigits = formattedPhone.replace(/\D/g, "").slice(-10);
      const existingCustomer = await Customer.findOne({
        tenantId,
        $or: [
          { phone: formattedPhone },
          ...(rawDigits.length === 10
            ? [{ phone: rawDigits }, { phone: `+91${rawDigits}` }, { phone: `0${rawDigits}` }]
            : []),
        ],
      });

      if (existingCustomer) {
        existingCustomer.phone = formattedPhone;
        existingCustomer.name = input.customerName || existingCustomer.name;
        if (!existingCustomer.stats) {
          existingCustomer.stats = { totalVisits: 0, totalSpend: 0, outstandingBalance: 0, lastVisitAt: new Date() };
        }
        existingCustomer.stats.totalVisits = (existingCustomer.stats.totalVisits || 0) + 1;
        existingCustomer.stats.totalSpend = (existingCustomer.stats.totalSpend || 0) + input.paidAmount;
        existingCustomer.stats.outstandingBalance = (existingCustomer.stats.outstandingBalance || 0) + amountPending;
        existingCustomer.stats.lastVisitAt = new Date();
        await existingCustomer.save();
      } else {
        await Customer.create({
          tenantId,
          name: input.customerName,
          phone: formattedPhone,
          isActive: true,
          stats: {
            totalVisits: 1,
            totalSpend: input.paidAmount,
            outstandingBalance: amountPending,
            lastVisitAt: new Date(),
          },
        });
      }
    } else {
      await Customer.findOneAndUpdate(
        { tenantId, name: input.customerName },
        {
          $inc: {
            "stats.totalVisits": 1,
            "stats.totalSpend": input.paidAmount,
            "stats.outstandingBalance": amountPending,
          },
          $set: { "stats.lastVisitAt": new Date() },
        }
      );
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_created");

    return {
      success: true,
      order: {
        id: newDoc.orderNumber,
        customer: input.customerName,
        type: input.orderType,
        amount: newDoc.totalAmount,
        paid: newDoc.amountPaid,
        status: newDoc.status,
        time: "Today, Just now",
        isToday: true,
        isLast24Hours: true,
        createdAt: newDoc.createdAt ? new Date(newDoc.createdAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to create order:", error);
    return { success: false, error: "Failed to persist order to database" };
  }
}

export async function completeOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = completeOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { orderId } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    // Match order by orderNumber (e.g. "#1042") or by ObjectId
    const query = Types.ObjectId.isValid(orderId)
      ? { tenantId, $or: [{ _id: new Types.ObjectId(orderId) }, { orderNumber: orderId }] }
      : { tenantId, orderNumber: orderId };

    const order = await Order.findOne(query);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Settle remaining balance if any (e.g. from advance_paid)
    const remainingDue = Math.max(0, order.totalAmount - order.amountPaid);
    if (remainingDue > 0) {
      order.amountPaid = order.totalAmount;
      order.amountPending = 0;
      order.payments.push({
        amount: remainingDue,
        mode: "cash",
        recordedAt: new Date(),
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
      });

      // Update customer stats
      if (order.customerSnapshot?.phone) {
        const cleanPhone = formatPhoneNumber(order.customerSnapshot.phone);
        const rawDigits = cleanPhone.replace(/\D/g, "").slice(-10);
        await Customer.findOneAndUpdate(
          {
            tenantId,
            $or: [
              { phone: cleanPhone },
              ...(rawDigits.length === 10
                ? [{ phone: rawDigits }, { phone: order.customerSnapshot.phone }]
                : [{ phone: order.customerSnapshot.phone }]),
            ],
          },
          {
            $inc: {
              "stats.totalSpend": remainingDue,
              "stats.outstandingBalance": -remainingDue,
            },
          }
        );
      }
    }

    // Mark line items fulfilled and status completed
    order.status = "completed";
    if (order.lineItems && order.lineItems.length > 0) {
      order.lineItems.forEach((item) => {
        item.fulfilled = true;
      });
    }

    await order.save();
    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_completed");

    const mappedType: OrderType =
      order.orderType === "service_booking"
        ? "Service booking"
        : order.orderType === "package_sale"
          ? "Package sale"
          : "Product sale";

    return {
      success: true,
      order: {
        id: order.orderNumber,
        customer: order.customerSnapshot?.name || "Walk-in Customer",
        type: mappedType,
        amount: order.totalAmount,
        paid: order.amountPaid,
        status: "completed",
        time: "Today, Just now",
        isToday: true,
        isLast24Hours: true,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to complete order:", error);
    return { success: false, error: "Failed to mark order as completed" };
  }
}

export async function refundOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  newExpense?: DashboardExpense;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = refundOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { orderId, refundAmount, refundMode, refundReason } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const query = Types.ObjectId.isValid(orderId)
      ? { tenantId, $or: [{ _id: new Types.ObjectId(orderId) }, { orderNumber: orderId }] }
      : { tenantId, orderNumber: orderId };

    const order = await Order.findOne(query);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "cancelled_refunded") {
      return { success: false, error: "This order is already marked as refunded" };
    }

    if (refundAmount > order.amountPaid) {
      return {
        success: false,
        error: `Refund amount (₹${refundAmount}) cannot exceed total amount paid (₹${order.amountPaid})`,
      };
    }

    const prevPending = order.amountPending || 0;

    // Determine if refund happened on the same calendar day the order was created
    const isSameDay = order.createdAt
      ? (() => {
        const d = new Date(order.createdAt);
        const now = new Date();
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })()
      : true;

    // Record formal refund details in order
    order.refundDetails = {
      refundAmount,
      refundMode,
      refundReason: refundReason || "Customer refund at counter",
      refundedAt: new Date(),
      refundedBy: session.user.role === "staff" ? "staff" : "owner",
    };

    // Deduct refunded amount from order.amountPaid so it reflects the net retained amount
    order.amountPaid = Math.max(0, order.amountPaid - refundAmount);

    let newExpense: DashboardExpense | undefined = undefined;

    if (!isSameDay) {
      // Next-day (or later) refund: past day's income stays closed, and an outflow Expense is recorded for TODAY
      // so today's counter cash drawer reconciles with physical cash handed out
      const expenseDoc = await Expense.create({
        tenantId,
        title: `Customer Refund — Order ${order.orderNumber} (${order.customerSnapshot?.name || "Customer"})`,
        category: "refund",
        amount: refundAmount,
        paymentMode: refundMode,
        notes: refundReason || `Refund processed for order ${order.orderNumber}`,
        expenseDate: new Date(),
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
      });

      newExpense = {
        id: expenseDoc._id.toString(),
        desc: expenseDoc.title,
        amount: expenseDoc.amount,
        category: "Refund",
        time: "Today, Just now",
        isToday: true,
        createdAt: expenseDoc.expenseDate ? new Date(expenseDoc.expenseDate).toISOString() : new Date().toISOString(),
      };
    }

    order.amountPending = 0;
    order.status = "cancelled_refunded";

    await order.save();

    // Adjust customer lifetime stats
    if (order.customerSnapshot?.phone) {
      const cleanPhone = formatPhoneNumber(order.customerSnapshot.phone);
      const rawDigits = cleanPhone.replace(/\D/g, "").slice(-10);
      await Customer.findOneAndUpdate(
        {
          tenantId,
          $or: [
            { phone: cleanPhone },
            ...(rawDigits.length === 10
              ? [{ phone: rawDigits }, { phone: order.customerSnapshot.phone }]
              : [{ phone: order.customerSnapshot.phone }]),
          ],
        },
        {
          $inc: {
            "stats.totalSpend": -refundAmount,
            "stats.outstandingBalance": -prevPending,
          },
        }
      );
    }

    try {
      revalidatePath("/dashboard");
      broadcastUpdate(tenantId, "order_refunded");
    } catch (revalErr) {
      console.warn("revalidatePath warning:", revalErr);
    }

    const mappedType: OrderType =
      order.orderType === "service_booking"
        ? "Service booking"
        : order.orderType === "package_sale"
          ? "Package sale"
          : "Product sale";

    const result: {
      success: boolean;
      order: DashboardOrder;
      newExpense?: DashboardExpense;
    } = {
      success: true,
      order: {
        id: order.orderNumber,
        customer: order.customerSnapshot?.name || "Walk-in Customer",
        type: mappedType,
        amount: order.totalAmount,
        paid: order.amountPaid,
        status: "cancelled_refunded",
        time: "Today, Just now",
        isToday: isSameDay,
        isLast24Hours: true,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        refundAmount: refundAmount,
        refundReason: order.refundDetails?.refundReason || refundReason,
      },
    };

    if (newExpense) {
      result.newExpense = newExpense;
    }

    return result;
  } catch (error) {
    console.error("Failed to refund order:", error);
    return { success: false, error: "Failed to process refund in database" };
  }
}

export async function createExpenseAction(rawInput: unknown): Promise<{
  success: boolean;
  expense?: DashboardExpense;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = createExpenseSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    let dbCategory:
      | "inventory_purchase"
      | "refreshments"
      | "salary"
      | "rent"
      | "refund" = "refreshments";
    if (input.category === "Inventory purchase") dbCategory = "inventory_purchase";
    else if (input.category === "Salary") dbCategory = "salary";
    else if (input.category === "Rent") dbCategory = "rent";
    else if (input.category === "Refund") dbCategory = "refund";

    const newDoc = await Expense.create({
      tenantId,
      title: input.desc,
      category: dbCategory,
      amount: input.amount,
      paymentMode: "cash",
      expenseDate: new Date(),
      recordedBy: session.user.role === "staff" ? "staff" : "owner",
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "expense_created");

    return {
      success: true,
      expense: {
        id: newDoc._id.toString(),
        desc: newDoc.title,
        amount: newDoc.amount,
        category: input.category,
        time: "Today, Just now",
        isToday: true,
        createdAt: newDoc.expenseDate ? new Date(newDoc.expenseDate).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to create expense:", error);
    return { success: false, error: "Failed to persist expense to database" };
  }
}

export async function transferStockAction(rawInput: unknown): Promise<{
  success: boolean;
  updatedProduct?: DashboardProduct;
  newExpense?: DashboardExpense;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = transferStockSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { productId } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    // Invariant: Scoped to tenant, sellStock must be > 0
    const product = await Product.findOne({ _id: productId, tenantId });
    if (!product) {
      return { success: false, error: "Product not found" };
    }

    if (product.sellStock <= 0) {
      return { success: false, error: "No retail stock available to transfer" };
    }

    product.sellStock -= 1;
    product.useStock += 1;
    await product.save();

    // Invariant: Moving stock from sellStock -> useStock records an automatic Expense at purchase cost
    const transferCost =
      product.purchaseCost > 0
        ? product.purchaseCost
        : Math.round(product.expectedSellPrice * 0.6);

    const expense = await Expense.create({
      tenantId,
      title: `Internal transfer — 1x ${product.name}`,
      category: "stock_transfer_internal",
      amount: transferCost,
      paymentMode: "internal_transfer",
      linkedProductId: product._id,
      linkedQuantity: 1,
      expenseDate: new Date(),
      recordedBy: session.user.role === "staff" ? "staff" : "owner",
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "stock_transferred");

    return {
      success: true,
      updatedProduct: {
        id: product._id.toString(),
        name: product.name,
        sell: product.sellStock,
        use: product.useStock,
        price: product.expectedSellPrice,
      },
      newExpense: {
        id: expense._id.toString(),
        desc: expense.title,
        amount: expense.amount,
        category: "Day-to-day",
        time: "Today, Just now",
        isToday: true,
      },
    };
  } catch (error) {
    console.error("Failed to transfer stock:", error);
    return { success: false, error: "Failed to transfer inventory" };
  }
}

export async function updateSalonProfileAction(rawInput: unknown): Promise<{
  success: boolean;
  profile?: DashboardSalonProfile;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    if (session.user.role !== "owner") {
      return { success: false, error: "Only the shop owner can edit the salon profile" };
    }

    const parseResult = updateSalonProfileSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      {
        $set: {
          name: input.name,
          phone: input.phone || null,
          address: input.address || null,
          profileImageUrl: input.profileImageUrl || null,
        },
      },
      { new: true }
    ).lean();

    if (!updatedTenant) {
      return { success: false, error: "Failed to find tenant to update" };
    }

    if (input.email) {
      await User.findOneAndUpdate(
        { tenantId },
        { $set: { ownerEmail: input.email.trim().toLowerCase() } }
      );
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "profile_updated");

    return {
      success: true,
      profile: {
        id: updatedTenant._id.toString(),
        name: updatedTenant.name,
        slug: updatedTenant.slug,
        email: input.email || "",
        phone: updatedTenant.phone || "",
        address: updatedTenant.address || "",
        profileImageUrl: updatedTenant.profileImageUrl || "",
        profileImagePublicId: updatedTenant.profileImagePublicId || "",
        status: updatedTenant.status,
        currency: updatedTenant.settings?.currency || "INR",
        ownerName: input.ownerName || updatedTenant.name || "Owner",
      },
    };
  } catch (error) {
    console.error("Failed to update salon profile:", error);
    return { success: false, error: "Failed to update salon profile" };
  }
}

export async function uploadSalonProfileImageAction(formData: FormData): Promise<{
  success: boolean;
  profileImageUrl?: string;
  profileImagePublicId?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: "No image file provided" };
    }

    // Validate image format
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Please upload an image file (PNG, JPG, or WEBP)" };
    }

    // Max 5MB file size limit
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Image file exceeds 5MB size limit" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return { success: false, error: "Tenant record not found" };
    }

    // Convert file to base64 Data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Uri = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Upload to Cloudinary & auto-delete previous image if present
    const { uploadSalonImage } = await import("@/lib/cloudinary");
    const result = await uploadSalonImage(base64Uri, tenant.profileImagePublicId);

    // Persist new Cloudinary details to tenant in MongoDB
    tenant.profileImageUrl = result.url;
    tenant.profileImagePublicId = result.publicId;
    await tenant.save();

    revalidatePath("/dashboard");

    return {
      success: true,
      profileImageUrl: result.url,
      profileImagePublicId: result.publicId,
    };
  } catch (error) {
    console.error("Failed to upload salon image to Cloudinary:", error);
    const message = error instanceof Error ? error.message : "Failed to upload image";
    return { success: false, error: message };
  }
}


export async function getOrdersAction(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sortOrder?: "newest" | "oldest";
}): Promise<{
  success: boolean;
  orders: DashboardOrder[];
  totalCount: number;
  page: number;
  totalPages: number;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, orders: [], totalCount: 0, page: 1, totalPages: 0, error: "Unauthorized" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, orders: [], totalCount: 0, page: 1, totalPages: 0, error: "Salon tenant not found" };
    }

    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20));

    const query: Record<string, unknown> = { tenantId };

    // Status filter
    if (params.status && params.status !== "all") {
      query.status = params.status;
    }

    // Date range filter
    if (params.startDate || params.endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (params.startDate && params.endDate) {
        const from = params.startDate <= params.endDate ? params.startDate : params.endDate;
        const to = params.startDate <= params.endDate ? params.endDate : params.startDate;
        dateFilter.$gte = new Date(`${from}T00:00:00`);
        dateFilter.$lte = new Date(`${to}T23:59:59.999`);
      } else if (params.startDate) {
        dateFilter.$gte = new Date(`${params.startDate}T00:00:00`);
      } else if (params.endDate) {
        dateFilter.$lte = new Date(`${params.endDate}T23:59:59.999`);
      }
      query.createdAt = dateFilter;
    }

    // Search filter
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const regex = new RegExp(q, "i");
      query.$or = [
        { orderNumber: regex },
        { "customerSnapshot.name": regex },
        { "customerSnapshot.phone": regex },
        { status: regex },
        { "refundDetails.refundReason": regex },
      ];
    }

    const sortDirection = params.sortOrder === "oldest" ? 1 : -1;

    const [totalCount, rawOrders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .sort({ createdAt: sortDirection })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const orders: DashboardOrder[] = rawOrders.map((o) => ({
      id: o.orderNumber,
      customer: o.customerSnapshot?.name || "Walk-in Customer",
      type: o.orderType === "service_booking"
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

    return {
      success: true,
      orders,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  } catch (error) {
    console.error("Failed to fetch paginated orders:", error);
    return { success: false, orders: [], totalCount: 0, page: 1, totalPages: 0, error: "Failed to fetch orders" };
  }
}



