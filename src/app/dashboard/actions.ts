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

interface SessionLike {
  user?: {
    tenantId?: string;
    email?: string | null;
    role?: string;
  };
}

async function resolveTenantId(session: SessionLike): Promise<Types.ObjectId | null> {
  const tenantIdStr = session?.user?.tenantId;
  if (tenantIdStr && Types.ObjectId.isValid(tenantIdStr)) {
    const exists = await Tenant.exists({ _id: new Types.ObjectId(tenantIdStr) });
    if (exists) return new Types.ObjectId(tenantIdStr);
  }

  if (session?.user?.email) {
    const cleanEmail = session.user.email.trim().toLowerCase();
    const dbUser = await User.findOne({
      $or: [{ email: cleanEmail }, { email: `${cleanEmail}@gmail.com` }],
    });
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

    const newDoc = await Order.create({
      tenantId,
      orderNumber,
      customerSnapshot: {
        name: input.customerName,
        phone: input.customerPhone || "",
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
    if (input.customerPhone) {
      await Customer.findOneAndUpdate(
        { tenantId, phone: input.customerPhone },
        {
          $setOnInsert: { name: input.customerName, isActive: true },
          $inc: {
            "stats.totalVisits": 1,
            "stats.totalSpend": input.paidAmount,
            "stats.outstandingBalance": amountPending,
          },
          $set: { "stats.lastVisitAt": new Date() },
        },
        { upsert: true }
      );
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
        await Customer.findOneAndUpdate(
          { tenantId, phone: order.customerSnapshot.phone },
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

    // Record formal refund details in order
    order.refundDetails = {
      refundAmount,
      refundMode,
      refundReason: refundReason || "Customer refund at counter",
      refundedAt: new Date(),
      refundedBy: session.user.role === "staff" ? "staff" : "owner",
    };

    // Update financial amounts and cancel status
    order.amountPaid = Math.max(0, order.amountPaid - refundAmount);
    order.amountPending = 0;
    order.status = "cancelled_refunded";

    await order.save();

    // Adjust customer spend stats
    if (order.customerSnapshot?.phone) {
      await Customer.findOneAndUpdate(
        { tenantId, phone: order.customerSnapshot.phone },
        {
          $inc: {
            "stats.totalSpend": -refundAmount,
            "stats.outstandingBalance": -prevPending,
          },
        }
      );
    }

    revalidatePath("/dashboard");

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
        status: "cancelled_refunded",
        time: "Today, Just now",
        isToday: true,
      },
    };
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
      | "rent" = "refreshments";
    if (input.category === "Inventory purchase") dbCategory = "inventory_purchase";
    else if (input.category === "Salary") dbCategory = "salary";
    else if (input.category === "Rent") dbCategory = "rent";

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

    return {
      success: true,
      expense: {
        id: newDoc._id.toString(),
        desc: newDoc.title,
        amount: newDoc.amount,
        category: input.category,
        time: "Today, Just now",
        isToday: true,
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

    if (input.ownerName && session.user.email) {
      await User.findOneAndUpdate(
        { email: session.user.email },
        { $set: { name: input.ownerName } }
      );
    }

    revalidatePath("/dashboard");

    return {
      success: true,
      profile: {
        id: updatedTenant._id.toString(),
        name: updatedTenant.name,
        slug: updatedTenant.slug,
        email: session.user.email || "",
        phone: updatedTenant.phone || "",
        address: updatedTenant.address || "",
        profileImageUrl: updatedTenant.profileImageUrl || "",
        profileImagePublicId: updatedTenant.profileImagePublicId || "",
        status: updatedTenant.status,
        currency: updatedTenant.settings?.currency || "INR",
        ownerName: input.ownerName || session.user.name || "",
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


