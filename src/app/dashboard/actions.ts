"use server";

import { revalidatePath } from "next/cache";
import { ClientSession, Types } from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Tenant } from "@/lib/db/models/tenant.model";
import { User } from "@/lib/db/models/user.model";
import { Order, type IOrderLineItem } from "@/lib/db/models/order.model";
import { Product, type IProduct } from "@/lib/db/models/product.model";
import { PurchaseOrder } from "@/lib/db/models/purchase-order.model";
import { Supplier } from "@/lib/db/models/supplier.model";
import { Counter } from "@/lib/db/models/counter.model";
import { Expense } from "@/lib/db/models/expense.model";
import { Customer } from "@/lib/db/models/customer.model";
import { Service, type IService } from "@/lib/db/models/service.model";
import { PackageTemplate, type IPackageTemplate } from "@/lib/db/models/package-template.model";
import { withTransaction } from "@/lib/db/transaction";
import {
  createOrderSchema,
  completeOrderSchema,
  rescheduleOrderSchema,
  refundOrderSchema,
  createExpenseSchema,
  transferStockSchema,
  consumeUseStockSchema,
  createPurchaseOrderSchema,
  recordPurchaseOrderPaymentSchema,
  reschedulePurchaseOrderSchema,
  fulfillOrderLineItemSchema,
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  updateSalonProfileSchema,
  createServiceSchema,
  updateServiceSchema,
  createPackageSchema,
  updatePackageSchema,
  createSupplierSchema,
  updateSupplierSchema,
  deleteSupplierSchema,
  updateCustomerSchema,
} from "@/lib/validations/dashboard";
import {
  DashboardOrder,
  DashboardExpense,
  DashboardProduct,
  DashboardSalonProfile,
  DashboardService,
  DashboardPackage,
  DashboardPurchaseOrder,
  DashboardPurchaseOrderPayment,
  DashboardSupplier,
  DashboardCustomer,
  OrderType,
  DashboardPaymentMode,
} from "@/types/dashboard";
import { triggerTenantEvent } from "@/lib/realtime/pusher-server";
import { formatPhoneNumber, checkIsToday, checkIsLast24Hours, formatOrderTime, formatDisplayNumber } from "@/lib/utils";

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

  return null;
}

/**
 * Resolves all product batches belonging to a product family (by ID or base name),
 * sorted by profit margin ascending (i.e. the "not better" / lower margin batch is prioritized first for salon usage).
 */
async function getProductBatchesForInternalUse(
  tenantId: Types.ObjectId | string,
  productId: Types.ObjectId | string,
  session?: ClientSession
): Promise<IProduct[]> {
  const primary = await Product.findOne({ _id: productId, tenantId }).session(session || null);
  if (!primary) return [];
  const baseName = primary.name.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim();
  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = await Product.find({
    tenantId,
    isActive: true,
    name: new RegExp(`^${escapedBase}(\\s*\\((Old|New|Batch[^\)]*)\\))?$`, "i"),
  }).session(session || null);

  // Sort ascending by absolute profit: (Sell - Cost) — use lowest-profit batch for internal use first
  return candidates.sort((a, b) => {
    const profitA = Math.max(0, a.expectedSellPrice - a.purchaseCost);
    const profitB = Math.max(0, b.expectedSellPrice - b.purchaseCost);
    return profitA - profitB;
  });
}

/**
 * Checks if all required products for a package template are available in stock.
 * Returns { available: boolean; missing: { name: string; needed: number; available: number }[] }
 */
async function checkPackageProductsAvailability(
  tenantId: Types.ObjectId | string,
  templateId: Types.ObjectId | string,
  packageQuantity: number,
  session?: ClientSession
): Promise<{
  available: boolean;
  missing: { name: string; needed: number; available: number }[];
}> {
  const template = await PackageTemplate.findOne({ _id: templateId, tenantId }).session(session || null);
  if (!template || !template.products || template.products.length === 0) {
    return { available: true, missing: [] };
  }

  const missing: { name: string; needed: number; available: number }[] = [];

  for (const pItem of template.products) {
    const needed = packageQuantity * pItem.quantity;
    const batches = await getProductBatchesForInternalUse(tenantId, pItem.productId, session);
    const totalAvailable = batches.reduce(
      (sum, b) => sum + Math.max(0, b.useStock) + Math.max(0, b.sellStock),
      0
    );
    if (totalAvailable < needed) {
      missing.push({
        name: pItem.name,
        needed,
        available: totalAvailable,
      });
    }
  }

  return {
    available: missing.length === 0,
    missing,
  };
}

/**
 * Deducts package product requirements from stock:
 * - Checks useStock first, falls back to sellStock
 * - Prioritizes the lower profit margin batch for in-salon consumption
 */
async function deductPackageProductsFromStock(
  tenantId: Types.ObjectId | string,
  templateId: Types.ObjectId | string,
  packageQuantity: number,
  session?: ClientSession
): Promise<void> {
  const template = await PackageTemplate.findOne({ _id: templateId, tenantId }).session(session || null);
  if (!template || !template.products || template.products.length === 0) return;

  for (const pItem of template.products) {
    let remaining = packageQuantity * pItem.quantity;
    const batches = await getProductBatchesForInternalUse(tenantId, pItem.productId, session);
    for (const batch of batches) {
      if (remaining <= 0) break;
      const takeUse = Math.min(batch.useStock, remaining);
      batch.useStock -= takeUse;
      remaining -= takeUse;
      if (remaining > 0 && batch.sellStock > 0) {
        const takeSell = Math.min(batch.sellStock, remaining);
        batch.sellStock -= takeSell;
        remaining -= takeSell;
      }
      await batch.save(session ? { session } : undefined);
    }
    if (batches.length > 0) {
      await cleanupProductBatchNames(tenantId, batches[0].name, session);
    }
  }
}

/**
 * Ensures that when batches are emptied (0 stock) or deleted, if only ONE active product
 * remains with stock (or only one active product exists for that base name), its name is
 * restored to the clean original name without (Old)/(New)/(Batch...).
 * Any emptied 0-stock sibling batches are soft-deactivated to keep inventory clean.
 */
async function cleanupProductBatchNames(
  tenantId: Types.ObjectId | string,
  baseName: string,
  session?: ClientSession
): Promise<IProduct | null> {
  const cleanBase = baseName.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim();
  const escapedBase = cleanBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const candidates = await Product.find({
    tenantId,
    isActive: true,
    name: new RegExp(`^${escapedBase}(\\s*\\((Old|New|Batch[^\)]*)\\))?$`, "i"),
  }).session(session || null);

  if (candidates.length === 0) return null;

  if (candidates.length === 1) {
    if (candidates[0].name !== cleanBase) {
      candidates[0].name = cleanBase;
      await candidates[0].save(session ? { session } : undefined);
      return candidates[0];
    }
    return null;
  }

  // Multiple active candidates exist. Check which have stock:
  const stocked = candidates.filter((p) => p.sellStock > 0 || p.useStock > 0);

  if (stocked.length === 1) {
    const soleStocked = stocked[0];

    // Deactivate zero-stock siblings so they no longer clutter inventory or collide on unique index
    for (const other of candidates) {
      if (!other._id.equals(soleStocked._id) && other.sellStock === 0 && other.useStock === 0) {
        other.isActive = false;
        await other.save(session ? { session } : undefined);
      }
    }

    if (soleStocked.name !== cleanBase) {
      soleStocked.name = cleanBase;
      await soleStocked.save(session ? { session } : undefined);
      return soleStocked;
    }
  }

  return null;
}



function mapOrderType(type?: string): OrderType {
  if (type === "service_booking") return "Service booking";
  if (type === "package_sale") return "Package sale";
  return "Product sale";
}

export async function createOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  clearedDueOrderIds?: string[];
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

    const isFullPayment = input.paidAmount >= input.totalAmount;
    const amountPending = Math.max(0, input.totalAmount - input.paidAmount);
    const formattedPhone = input.customerPhone ? formatPhoneNumber(input.customerPhone) : "";

    const mappedLineItems: IOrderLineItem[] =
      input.lineItems && input.lineItems.length > 0
        ? input.lineItems.map((item) => ({
            itemType: item.itemType,
            itemId: Types.ObjectId.isValid(item.itemId)
              ? new Types.ObjectId(item.itemId)
              : new Types.ObjectId(),
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity || 1,
            discount: 0,
            finalPrice: item.finalPrice,
            fulfilled: isFullPayment,
          }))
        : [
            {
              itemType:
                input.orderType === "Service booking"
                  ? "service"
                  : input.orderType === "Package sale"
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
          ];

    // Determine order type based on item types: P (product), S (service), K (package), or M (mixed)
    const distinctItemTypes = new Set(mappedLineItems.map((item) => item.itemType));
    let dbOrderType: "product_sale" | "service_booking" | "package_sale" | "mixed";
    if (distinctItemTypes.size > 1) {
      dbOrderType = "mixed";
    } else if (distinctItemTypes.has("product")) {
      dbOrderType = "product_sale";
    } else if (distinctItemTypes.has("package")) {
      dbOrderType = "package_sale";
    } else {
      dbOrderType = "service_booking";
    }

    // Execute atomic order creation and stock clamping inside transaction
    const newDoc = await withTransaction(async (dbSession) => {
      // Auto-generate atomic sequence number scoped by { tenantId, type, YYMM }
      const { fullNumber: orderNumber } = await Counter.getNextSequence({
        tenantId,
        type: dbOrderType,
        session: dbSession,
      });

      // Advance / Pre-order Support:
      // If customer is paying advance or booking for future pickup, counter orders specially for them.
      // Do NOT deduct current counter shelf stock at order creation time; shelf stock is kept intact for walk-ins.
      // Stock will be deducted upon customer pickup when the order is completed.
      const isAdvancePreOrder =
        input.status !== "completed" &&
        (Boolean(input.bookingDate) || input.status === "advance_paid" || input.status === "paid_full");
      let hasUnfulfilledProduct = false;
      const affectedProductNames = new Set<string>();

      for (const item of mappedLineItems) {
        if (item.itemType === "product" && Types.ObjectId.isValid(item.itemId)) {
          const prod = await Product.findOne({ _id: item.itemId, tenantId }).session(dbSession);
          if (prod) {
            // Snapshot current purchaseCost for profit calculation
            item.purchaseCost = typeof prod.purchaseCost === "number" ? prod.purchaseCost : 0;
            const available = Math.max(0, prod.sellStock);
            const requested = item.quantity || 1;

            if (isAdvancePreOrder || available < requested) {
              // Pre-order or out of stock: cannot fulfill now; delivery pending upon arrival
              item.fulfilled = false;
              hasUnfulfilledProduct = true;
            } else {
              prod.sellStock -= requested;
              item.fulfilled = isFullPayment;
              if (!item.fulfilled) hasUnfulfilledProduct = true;
              await prod.save({ session: dbSession });
              affectedProductNames.add(prod.name);
            }
          }
        } else if (item.itemType === "package" && Types.ObjectId.isValid(item.itemId)) {
          // Check package products stock availability
          const stockCheck = await checkPackageProductsAvailability(
            tenantId,
            item.itemId,
            item.quantity || 1,
            dbSession
          );

          if (!stockCheck.available || isAdvancePreOrder) {
            // Missing package products or advance booking: delivery pending upon stock arrival/settlement
            item.fulfilled = false;
            hasUnfulfilledProduct = true;
          } else {
            item.fulfilled = isFullPayment;
            if (!item.fulfilled) hasUnfulfilledProduct = true;
            await deductPackageProductsFromStock(tenantId, item.itemId, item.quantity || 1, dbSession);
          }
        }
      }

      for (const pName of affectedProductNames) {
        await cleanupProductBatchNames(tenantId, pName, dbSession);
      }

      let orderInitialStatus = input.status;
      if (hasUnfulfilledProduct) {
        if (input.paidAmount >= input.totalAmount) {
          orderInitialStatus = "paid_full";
        } else if (input.paidAmount > 0) {
          orderInitialStatus = "advance_paid";
        } else {
          orderInitialStatus = "created";
        }
      }

      const [createdOrder] = await Order.create(
        [
          {
            tenantId,
            orderNumber,
            customerSnapshot: {
              name: input.customerName,
              phone: formattedPhone,
            },
            orderType: dbOrderType,
            status: orderInitialStatus,
            lineItems: mappedLineItems,
            subtotal: input.subtotal ?? input.totalAmount,
            discountType: input.discountType || (input.discountValue !== undefined ? "percentage" : "flat"),
            discountValue: input.discountValue ?? (input.discountAmount ?? 0),
            discountAmount: input.discountAmount ?? 0,
            totalAmount: input.totalAmount,
            amountPaid: input.paidAmount,
            amountPending: amountPending,
            paymentMode: input.paymentMode || "cash",
            scheduledFor: input.bookingDate ? new Date(input.bookingDate) : undefined,
            scheduledTime: input.bookingTime ? input.bookingTime.trim() : undefined,
            notes: input.notes?.trim() || undefined,
            payments:
              input.paidAmount > 0
                ? [
                    {
                      amount: input.paidAmount,
                      mode: input.paymentMode || "cash",
                      recordedAt: new Date(),
                      recordedBy: session.user.role === "staff" ? "staff" : "owner",
                      type: orderInitialStatus === "advance_paid" || isAdvancePreOrder || (amountPending > 0)
                        ? "advance"
                        : "full_payment",
                    },
                  ]
                : [],
            recordedBy: session.user.role === "staff" ? "staff" : "owner",
          },
        ],
        { session: dbSession }
      );

      // If customer is settling previous due orders with this bill
      if (input.clearedDueOrderIds && input.clearedDueOrderIds.length > 0) {
        const orderIds = input.clearedDueOrderIds.flatMap((id) => [
          id,
          id.startsWith("#") ? id.slice(1) : `#${id}`,
        ]);
        const idRegexes = input.clearedDueOrderIds.map(
          (id) => new RegExp(`(^|\\b|-)${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        );
        const objectIds = input.clearedDueOrderIds
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));

        const previousOrders = await Order.find({
          tenantId,
          $or: [
            { orderNumber: { $in: orderIds } },
            { orderNumber: { $in: idRegexes } },
            ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
          ],
        }).session(dbSession);

        for (const prevOrder of previousOrders) {
          const remainingToSettle = Math.max(0, prevOrder.totalAmount - prevOrder.amountPaid);
          if (remainingToSettle > 0) {
            prevOrder.amountPaid += remainingToSettle;
            prevOrder.amountPending = 0;
            prevOrder.status = "completed";
            prevOrder.completedAt = new Date();
            prevOrder.payments.push({
              amount: remainingToSettle,
              mode: input.paymentMode || "cash",
              recordedAt: new Date(),
              recordedBy: session.user.role === "staff" ? "staff" : "owner",
              type: "settlement",
            });
            prevOrder.notes = prevOrder.notes
              ? `${prevOrder.notes} | Cleared via Order ${orderNumber}`
              : `Cleared via Order ${orderNumber}`;
            await prevOrder.save({ session: dbSession });
          }
        }
      }

      const netBalanceAdjustment = amountPending - (input.clearedDueAmount || 0);

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
        }).session(dbSession);

        if (existingCustomer) {
          existingCustomer.phone = formattedPhone;
          existingCustomer.name = input.customerName || existingCustomer.name;
          if (!existingCustomer.stats) {
            existingCustomer.stats = { totalVisits: 0, totalSpend: 0, outstandingBalance: 0, lastVisitAt: new Date() };
          }
          existingCustomer.stats.totalVisits = (existingCustomer.stats.totalVisits || 0) + 1;
          existingCustomer.stats.totalSpend = (existingCustomer.stats.totalSpend || 0) + input.paidAmount;
          existingCustomer.stats.outstandingBalance = (existingCustomer.stats.outstandingBalance || 0) + netBalanceAdjustment;
          existingCustomer.stats.lastVisitAt = new Date();
          await existingCustomer.save({ session: dbSession });
        } else {
          await Customer.create(
            [
              {
                tenantId,
                name: input.customerName,
                phone: formattedPhone,
                isActive: true,
                stats: {
                  totalVisits: 1,
                  totalSpend: input.paidAmount,
                  outstandingBalance: Math.max(0, netBalanceAdjustment),
                  lastVisitAt: new Date(),
                },
              },
            ],
            { session: dbSession }
          );
        }
      } else {
        await Customer.findOneAndUpdate(
          { tenantId, name: input.customerName },
          {
            $inc: {
              "stats.totalVisits": 1,
              "stats.totalSpend": input.paidAmount,
              "stats.outstandingBalance": netBalanceAdjustment,
            },
            $set: { "stats.lastVisitAt": new Date() },
          },
          { session: dbSession }
        );
      }

      return createdOrder;
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_created");

    return {
      success: true,
      clearedDueOrderIds: input.clearedDueOrderIds,
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
        todayPaid: newDoc.amountPaid,
        createdAt: newDoc.createdAt ? new Date(newDoc.createdAt).toISOString() : new Date().toISOString(),
        paymentMode: newDoc.paymentMode,
        advanceAmount: newDoc.status === "advance_paid" ? newDoc.amountPaid : undefined,
        advancePaymentMode: newDoc.status === "advance_paid" ? (newDoc.paymentMode as DashboardPaymentMode) : undefined,
        scheduledFor: newDoc.scheduledFor ? new Date(newDoc.scheduledFor).toISOString() : undefined,
        scheduledTime: newDoc.scheduledTime || undefined,
        customerPhone: formattedPhone || undefined,
        itemsSummary: (newDoc.lineItems || []).map((li: any) => li.name).join(", ") || undefined,
        latestActivityAt: new Date().toISOString(),
        subtotal: newDoc.subtotal ?? newDoc.totalAmount,
        discountType: newDoc.discountType,
        discountValue: newDoc.discountValue,
        discountAmount: newDoc.discountAmount,
        notes: newDoc.notes || undefined,
        recordedBy: newDoc.recordedBy || undefined,
        payments: (newDoc.payments || []).map((p: any) => ({
          amount: p.amount,
          mode: p.mode,
          recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : new Date().toISOString(),
          recordedBy: p.recordedBy,
          type: p.type || undefined,
        })),
        lineItems: (newDoc.lineItems || []).map((li: any) => ({
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
        })),
      },
    };
  } catch (error) {
    console.error("Failed to create order:", error);
    return { success: false, error: "Failed to persist order to database" };
  }
}

function buildOrderLookupQuery(tenantId: Types.ObjectId | string, orderId: string) {
  const trimmed = orderId.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const or: any[] = [{ orderNumber: trimmed }, { orderNumber: new RegExp(`(^|\\b|-)${escaped}$`, "i") }];
  if (Types.ObjectId.isValid(trimmed)) or.unshift({ _id: new Types.ObjectId(trimmed) });
  return { tenantId, $or: or };
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

    const { orderId, remainingAmount, paymentMode, notes } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const query = buildOrderLookupQuery(tenantId, orderId);

    const order = await Order.findOne(query);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Validate stock for all unfulfilled products and package products before allowing completion!
    if (order.lineItems && order.lineItems.length > 0) {
      for (const item of order.lineItems) {
        if (!item.fulfilled) {
          if (item.itemType === "product" && Types.ObjectId.isValid(item.itemId)) {
            const prod = await Product.findOne({ _id: item.itemId, tenantId });
            const qty = item.quantity || 1;
            if (!prod || prod.sellStock < qty) {
              const available = prod?.sellStock || 0;
              return {
                success: false,
                error: `Cannot complete delivery: Product "${item.name}" is out of stock (${available} available, ${qty} needed). Please stock in first before completing delivery.`,
              };
            }
          } else if (item.itemType === "package" && Types.ObjectId.isValid(item.itemId)) {
            const stockCheck = await checkPackageProductsAvailability(
              tenantId,
              item.itemId,
              item.quantity || 1
            );
            if (!stockCheck.available) {
              const missingDesc = stockCheck.missing
                .map((m) => `"${m.name}" (${m.available} available, ${m.needed} needed)`)
                .join(", ");
              return {
                success: false,
                error: `Cannot complete delivery: Package "${item.name}" requires out of stock products: ${missingDesc}. Please stock in first before completing delivery.`,
              };
            }
          }
        }
      }
    }

    // Default remaining balance from current total and paid
    const defaultRemaining = Math.max(0, order.totalAmount - order.amountPaid);
    const amountToCollect = remainingAmount !== undefined ? remainingAmount : defaultRemaining;

    // If counter adjusted the remaining price (e.g. concession discount or add-on)
    if (remainingAmount !== undefined && remainingAmount !== defaultRemaining) {
      if (amountToCollect < defaultRemaining) {
        const concession = defaultRemaining - amountToCollect;
        order.discountAmount = (order.discountAmount || 0) + concession;
      }
      order.totalAmount = order.amountPaid + amountToCollect;
    }

    if (amountToCollect > 0) {
      order.amountPaid += amountToCollect;
      order.payments.push({
        amount: amountToCollect,
        mode: paymentMode,
        recordedAt: new Date(),
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
        type: "settlement",
      });
      order.paymentMode = paymentMode;
    }

    order.amountPending = 0;
    order.status = "completed";
    order.completedAt = new Date();

    if (notes?.trim()) {
      order.notes = order.notes ? `${order.notes} | ${notes.trim()}` : notes.trim();
    }

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
            "stats.totalSpend": amountToCollect,
            "stats.outstandingBalance": -defaultRemaining,
          },
        }
      );
    }

    // Mark line items fulfilled & deduct stock upon customer pickup for backordered / pre-ordered products & packages
    const affectedProductNames = new Set<string>();
    if (order.lineItems && order.lineItems.length > 0) {
      for (const item of order.lineItems) {
        if (!item.fulfilled) {
          if (item.itemType === "product" && Types.ObjectId.isValid(item.itemId)) {
            const prod = await Product.findOne({ _id: item.itemId, tenantId });
            if (prod) {
              const qty = item.quantity || 1;
              prod.sellStock = Math.max(0, prod.sellStock - qty);
              await prod.save();
              affectedProductNames.add(prod.name);
            }
          } else if (item.itemType === "package" && Types.ObjectId.isValid(item.itemId)) {
            await deductPackageProductsFromStock(tenantId, item.itemId, item.quantity || 1);
          }
        }
        item.fulfilled = true;
      }
    }

    for (const pName of affectedProductNames) {
      await cleanupProductBatchNames(tenantId, pName);
    }

    await order.save();
    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_completed");

    const mappedType = mapOrderType(order.orderType);

    const hasAdvance = Boolean(
      order.payments && order.payments.length > 1 && order.payments[0].amount < order.totalAmount
    );
    const calculatedTodayPaid = order.payments && Array.isArray(order.payments)
      ? order.payments
          .filter((p) => p.recordedAt && checkIsToday(p.recordedAt))
          .reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0)
      : amountToCollect;

    return {
      success: true,
      order: {
        id: order.orderNumber,
        customer: order.customerSnapshot?.name || "Walk-in Customer",
        type: mappedType,
        amount: order.totalAmount,
        paid: order.amountPaid,
        status: "completed",
        time: formatOrderTime(order.createdAt),
        lastUpdatedTime: "Today, Just now",
        isToday: true,
        isLast24Hours: true,
        todayPaid: calculatedTodayPaid,
        completedAt: order.completedAt ? new Date(order.completedAt).toISOString() : new Date().toISOString(),
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        paymentMode: order.paymentMode,
        advanceAmount: hasAdvance ? order.payments[0].amount : undefined,
        advancePaymentMode: hasAdvance ? (order.payments[0].mode as DashboardPaymentMode) : undefined,
        scheduledFor: order.scheduledFor ? new Date(order.scheduledFor).toISOString() : undefined,
        scheduledTime: order.scheduledTime || undefined,
        customerPhone: order.customerSnapshot?.phone || undefined,
        itemsSummary: (order.lineItems || []).map((li: any) => li.name).join(", ") || undefined,
        latestActivityAt: order.completedAt ? new Date(order.completedAt).toISOString() : new Date().toISOString(),
        subtotal: order.subtotal ?? order.totalAmount,
        discountType: order.discountType,
        discountValue: order.discountValue,
        discountAmount: order.discountAmount,
        notes: order.notes || undefined,
        recordedBy: order.recordedBy || undefined,
        payments: (order.payments || []).map((p: any) => ({
          amount: p.amount,
          mode: p.mode,
          recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : new Date().toISOString(),
          recordedBy: p.recordedBy,
          type: p.type || undefined,
        })),
        lineItems: (order.lineItems || []).map((li: any) => ({
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
        })),
      },
    };
  } catch (error) {
    console.error("Failed to complete order:", error);
    return { success: false, error: "Failed to mark order as completed" };
  }
}

export async function rescheduleOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = rescheduleOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { orderId, newDate, newTime } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const query = buildOrderLookupQuery(tenantId, orderId);

    const order = await Order.findOne(query);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const parsedScheduledDate = new Date(newDate);
    if (isNaN(parsedScheduledDate.getTime())) {
      return { success: false, error: "Invalid booking date" };
    }

    order.scheduledFor = parsedScheduledDate;
    if (newTime !== undefined) {
      order.scheduledTime = newTime.trim() || undefined;
    }
    await order.save();

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_updated");

    const mappedType = mapOrderType(order.orderType);

    return {
      success: true,
      order: {
        id: order.orderNumber,
        customer: order.customerSnapshot?.name || "Walk-in Customer",
        customerPhone: order.customerSnapshot?.phone || undefined,
        type: mappedType,
        amount: order.totalAmount,
        paid: order.amountPaid,
        status: order.status,
        time: formatOrderTime(order.createdAt),
        lastUpdatedTime: "Today, Just now",
        isToday: true,
        isLast24Hours: true,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        paymentMode: order.paymentMode,
        advanceAmount: order.status === "advance_paid" ? order.amountPaid : undefined,
        scheduledFor: order.scheduledFor ? new Date(order.scheduledFor).toISOString() : undefined,
        scheduledTime: order.scheduledTime || undefined,
        itemsSummary: (order.lineItems || []).map((li: any) => li.name).join(", ") || undefined,
        latestActivityAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to reschedule order:", error);
    return { success: false, error: "Failed to update booking date in database" };
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

    const query = buildOrderLookupQuery(tenantId, orderId);

    const order = await Order.findOne(query);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "cancelled_refunded") {
      return { success: false, error: "This order is already marked as refunded" };
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
      refundReason: refundReason?.trim() || undefined,
      refundedAt: new Date(),
      refundedBy: session.user.role === "staff" ? "staff" : "owner",
    };

    const prevAmountPaid = order.amountPaid;
    const wasAdvance = prevAmountPaid < order.totalAmount;
    const advancePaidAmount = wasAdvance ? prevAmountPaid : undefined;

    // Deduct refunded amount from order.amountPaid so it reflects the net retained amount
    order.amountPaid = Math.max(0, order.amountPaid - refundAmount);

    let newExpense: DashboardExpense | undefined = undefined;

    if (!isSameDay) {
      // Next-day (or later) refund: past day's income stays closed, and an outflow Expense is recorded for TODAY
      // so today's counter cash drawer reconciles with physical cash handed out
      const { fullNumber: expenseNumber } = await Counter.getNextSequence({
        tenantId,
        type: "expense",
      });
      const expenseDoc = await Expense.create({
        tenantId,
        expenseNumber,
        title: `Customer Refund — Order ${formatDisplayNumber(order.orderNumber)} (${order.customerSnapshot?.name || "Customer"})`,
        category: "refund",
        amount: refundAmount,
        paymentMode: refundMode,
        notes: refundReason || `Refund processed for order ${order.orderNumber}`,
        expenseDate: new Date(),
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
      });

      newExpense = {
        id: expenseDoc._id.toString(),
        expenseNumber: expenseDoc.expenseNumber,
        desc: expenseDoc.title,
        amount: expenseDoc.amount,
        category: "Refund",
        time: "Today, Just now",
        isToday: true,
        createdAt: expenseDoc.expenseDate ? new Date(expenseDoc.expenseDate).toISOString() : new Date().toISOString(),
      };
    } else if (refundAmount > prevAmountPaid) {
      // Same-day refund where refund exceeds collected amount: record the excess compensation as an expense
      const excessAmount = refundAmount - prevAmountPaid;
      const { fullNumber: expenseNumber } = await Counter.getNextSequence({
        tenantId,
        type: "expense",
      });
      const expenseDoc = await Expense.create({
        tenantId,
        expenseNumber,
        title: `Customer Compensation (Excess Refund) — Order ${formatDisplayNumber(order.orderNumber)} (${order.customerSnapshot?.name || "Customer"})`,
        category: "refund",
        amount: excessAmount,
        paymentMode: refundMode,
        notes: refundReason || `Excess refund compensation for order ${order.orderNumber}`,
        expenseDate: new Date(),
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
      });

      newExpense = {
        id: expenseDoc._id.toString(),
        expenseNumber: expenseDoc.expenseNumber,
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
            "stats.totalSpend": -Math.min(prevAmountPaid, refundAmount),
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

    const mappedType = mapOrderType(order.orderType);

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
        todayPaid: Math.max(0, order.amountPaid),
        status: "cancelled_refunded",
        time: formatOrderTime(order.createdAt),
        lastUpdatedTime: "Today, Just now",
        isToday: isSameDay,
        isLast24Hours: true,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        refundedAt: order.refundDetails?.refundedAt ? new Date(order.refundDetails.refundedAt).toISOString() : new Date().toISOString(),
        latestActivityAt: new Date().toISOString(),
        refundAmount: refundAmount,
        refundReason: order.refundDetails?.refundReason || refundReason?.trim() || undefined,
        paymentMode: order.paymentMode,
        refundMode: refundMode,
        advanceAmount: advancePaidAmount,
        scheduledFor: order.scheduledFor ? new Date(order.scheduledFor).toISOString() : undefined,
        customerPhone: order.customerSnapshot?.phone || undefined,
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

    const expenseDate = new Date();
    const { fullNumber: expenseNumber } = await Counter.getNextSequence({
      tenantId,
      type: "expense",
      date: expenseDate,
    });

    const newDoc = await Expense.create({
      tenantId,
      expenseNumber,
      title: input.desc,
      category: dbCategory,
      amount: input.amount,
      paymentMode: input.paymentMode || "cash",
      notes: input.notes?.trim() || undefined,
      expenseDate,
      recordedBy: session.user.role === "staff" ? "staff" : "owner",
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "expense_created");

    return {
      success: true,
      expense: {
        id: newDoc._id.toString(),
        expenseNumber: newDoc.expenseNumber,
        desc: newDoc.title,
        amount: newDoc.amount,
        category: input.category,
        time: "Today, Just now",
        isToday: true,
        notes: newDoc.notes || undefined,
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

    const { productId, quantity, direction } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    // Atomic stock move inside Mongoose transaction
    const result = await withTransaction(async (dbSession) => {
      const product = await Product.findOne({ _id: productId, tenantId }).session(dbSession);
      if (!product) {
        throw new Error("Product not found");
      }

      if (direction === "use_to_sell") {
        if (product.useStock < quantity) {
          throw new Error(
            `Insufficient internal stock: requested ${quantity} pcs, but only ${product.useStock} pcs available in salon use`
          );
        }
        product.useStock -= quantity;
        product.sellStock += quantity;
      } else {
        // default "sell_to_use"
        if (product.sellStock < quantity) {
          throw new Error(
            `Insufficient stock: requested ${quantity} pcs, but only ${product.sellStock} pcs available in retail`
          );
        }
        product.sellStock -= quantity;
        product.useStock += quantity;
      }

      await product.save({ session: dbSession });

      // Invariant: Moving stock from sellStock -> useStock records an automatic Expense strictly at purchase price, NOT retail sell price
      const unitCost =
        typeof product.purchaseCost === "number" && !isNaN(product.purchaseCost)
          ? product.purchaseCost
          : 0;
      const transferCost = unitCost * quantity;

      const { fullNumber: expenseNumber } = await Counter.getNextSequence({
        tenantId,
        type: "expense",
        session: dbSession,
      });

      const [expense] = await Expense.create(
        [
          {
            tenantId,
            expenseNumber,
            title: `Internal transfer — ${quantity}x ${product.name}`,
            category: "stock_transfer_internal",
            amount: transferCost,
            paymentMode: "internal_transfer",
            linkedProductId: product._id,
            linkedQuantity: quantity,
            notes: `Moved ${quantity} pcs from retail to salon use. Expense calculated using purchase price (₹${unitCost}/pc) instead of sell price (₹${product.expectedSellPrice}/pc).`,
            expenseDate: new Date(),
            recordedBy: session.user.role === "staff" ? "staff" : "owner",
          },
        ],
        { session: dbSession }
      );

      return { product, expense };
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "stock_transferred");

    // Real-time notification if product crossed low stock threshold
    if (result.product.sellStock <= result.product.lowStockThreshold) {
      broadcastUpdate(tenantId, "low_stock_alert");
    }

    return {
      success: true,
      updatedProduct: {
        id: result.product._id.toString(),
        name: result.product.name,
        category: result.product.category,
        sell: result.product.sellStock,
        use: result.product.useStock,
        price: result.product.expectedSellPrice,
        purchaseCost: result.product.purchaseCost,
        lowStockThreshold: result.product.lowStockThreshold,
        description: result.product.description,
        barcode: result.product.barcode,
        isActive: result.product.isActive,
      },
      newExpense: {
        id: result.expense._id.toString(),
        expenseNumber: result.expense.expenseNumber,
        desc: result.expense.title,
        amount: result.expense.amount,
        category: "Day-to-day",
        time: "Today, Just now",
        isToday: true,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to transfer inventory";
    return { success: false, error: errorMsg };
  }
}

export async function consumeUseStockAction(rawInput: unknown): Promise<{
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

    const parseResult = consumeUseStockSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { productId, quantity, reason, notes } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const result = await withTransaction(async (dbSession) => {
      const product = await Product.findOne({ _id: productId, tenantId }).session(dbSession);
      if (!product) {
        throw new Error("Product not found");
      }

      if (product.useStock < quantity) {
        throw new Error(
          `Insufficient internal stock: requested ${quantity} pcs, but only ${product.useStock} pcs available in salon use`
        );
      }

      product.useStock -= quantity;
      await product.save({ session: dbSession });

      // Invariant: Deducting/consuming stock from salon use records an operational expense at purchase price
      const unitCost =
        typeof product.purchaseCost === "number" && !isNaN(product.purchaseCost)
          ? product.purchaseCost
          : 0;
      const consumptionCost = unitCost * quantity;

      const reasonLabels: Record<string, string> = {
        service: "Used in Service",
        finished: "Emptied / Finished",
        damaged: "Damaged / Expired",
        other: "Other Consumption",
      };
      const reasonLabel = reasonLabels[reason] || "Salon Consumption";

      let expense = null;
      if (consumptionCost > 0) {
        const [createdExpense] = await Expense.create(
          [
            {
              tenantId,
              title: `Internal consumption — ${quantity}x ${product.name} (${reasonLabel})`,
              category: "stock_transfer_internal",
              amount: consumptionCost,
              paymentMode: "internal_transfer",
              linkedProductId: product._id,
              linkedQuantity: quantity,
              notes: notes?.trim()
                ? `${notes.trim()} (Deducted ${quantity} pcs from salon use. Purchase price ₹${unitCost}/pc)`
                : `Deducted ${quantity} pcs from salon internal use (${reasonLabel}). Expense calculated using purchase price (₹${unitCost}/pc).`,
              expenseDate: new Date(),
              recordedBy: session.user.role === "staff" ? "staff" : "owner",
            },
          ],
          { session: dbSession }
        );
        expense = createdExpense;
      }

      return { product, expense };
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "stock_consumed");

    return {
      success: true,
      updatedProduct: {
        id: result.product._id.toString(),
        name: result.product.name,
        category: result.product.category,
        sell: result.product.sellStock,
        use: result.product.useStock,
        price: result.product.expectedSellPrice,
        purchaseCost: result.product.purchaseCost,
        lowStockThreshold: result.product.lowStockThreshold,
        description: result.product.description,
        barcode: result.product.barcode,
        isActive: result.product.isActive,
      },
      newExpense: result.expense
        ? {
            id: result.expense._id.toString(),
            desc: result.expense.title,
            amount: result.expense.amount,
            category: "Day-to-day",
            time: "Today, Just now",
            isToday: true,
          }
        : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to consume internal stock";
    return { success: false, error: errorMsg };
  }
}

export async function createProductAction(rawInput: unknown): Promise<{
  success: boolean;
  product?: DashboardProduct;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = createProductSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const trimmedName = input.name.trim();
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const activeExisting = await Product.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });
    if (activeExisting) {
      return { success: false, error: "A product with this name already exists." };
    }

    // Check if an inactive (soft-deleted) product with this name exists — revive and update it!
    const inactiveExisting = await Product.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isActive: false,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });

    let newDoc;
    if (inactiveExisting) {
      inactiveExisting.name = trimmedName;
      inactiveExisting.category = input.category;
      inactiveExisting.unit = "pieces";
      inactiveExisting.purchaseCost = input.purchaseCost;
      inactiveExisting.expectedSellPrice = input.price;
      inactiveExisting.sellStock = input.sellStock;
      inactiveExisting.useStock = input.useStock;
      inactiveExisting.lowStockThreshold = input.lowStockThreshold;
      inactiveExisting.barcode = input.barcode?.trim() || undefined;
      inactiveExisting.description = input.description?.trim() || undefined;
      inactiveExisting.isActive = true;
      await inactiveExisting.save();
      newDoc = inactiveExisting;
    } else {
      newDoc = await Product.create({
        tenantId: new Types.ObjectId(tenantId),
        name: trimmedName,
        category: input.category,
        unit: "pieces",
        purchaseCost: input.purchaseCost,
        expectedSellPrice: input.price,
        sellStock: input.sellStock,
        useStock: input.useStock,
        lowStockThreshold: input.lowStockThreshold,
        barcode: input.barcode?.trim() || undefined,
        description: input.description?.trim() || undefined,
        isActive: true,
      });
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "product_created");

    return {
      success: true,
      product: {
        id: newDoc._id.toString(),
        name: newDoc.name,
        category: newDoc.category,
        sell: newDoc.sellStock,
        use: newDoc.useStock,
        price: newDoc.expectedSellPrice,
        purchaseCost: newDoc.purchaseCost,
        lowStockThreshold: newDoc.lowStockThreshold,
        description: newDoc.description,
        barcode: newDoc.barcode,
        isActive: newDoc.isActive,
      },
    };
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return { success: false, error: "A product with this name already exists." };
    }
    console.error("Failed to create product:", error);
    return { success: false, error: "Failed to create product in database" };
  }
}

export async function updateProductAction(rawInput: unknown): Promise<{
  success: boolean;
  product?: DashboardProduct;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = updateProductSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const product = await Product.findOne({
      _id: new Types.ObjectId(input.id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!product) {
      return { success: false, error: "Product not found or access denied" };
    }

    const trimmedName = input.name.trim();
    if (trimmedName.toLowerCase() !== product.name.trim().toLowerCase()) {
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const existing = await Product.findOne({
        tenantId: new Types.ObjectId(tenantId),
        _id: { $ne: product._id },
        isActive: true,
        name: { $regex: new RegExp(`^${escapedName}$`, "i") },
      });
      if (existing) {
        return { success: false, error: "A product with this name already exists." };
      }
    }

    product.name = trimmedName;
    product.category = input.category;
    product.expectedSellPrice = input.price;
    product.purchaseCost = input.purchaseCost;
    product.lowStockThreshold = input.lowStockThreshold;
    if (input.barcode !== undefined) {
      const trimmedBarcode = input.barcode.trim();
      if (trimmedBarcode) {
        product.barcode = trimmedBarcode;
      } else {
        product.set("barcode", undefined);
      }
    }
    if (input.description !== undefined) {
      const trimmedDesc = input.description.trim();
      if (trimmedDesc) {
        product.description = trimmedDesc;
      } else {
        product.set("description", undefined);
      }
    }

    await product.save();

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "product_updated");

    return {
      success: true,
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        sell: product.sellStock,
        use: product.useStock,
        price: product.expectedSellPrice,
        purchaseCost: product.purchaseCost,
        lowStockThreshold: product.lowStockThreshold,
        description: product.description,
        barcode: product.barcode,
        isActive: product.isActive,
      },
    };
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return { success: false, error: "A product with this name already exists." };
    }
    console.error("Failed to update product:", error);
    return { success: false, error: "Failed to update product" };
  }
}

export async function deleteProductAction(rawInput: unknown): Promise<{
  success: boolean;
  product?: DashboardProduct;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = deleteProductSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { id, reactivate } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const product = await Product.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!product) {
      return { success: false, error: "Product not found or access denied" };
    }

    const baseName = product.name.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim();

    if (reactivate) {
      const escapedName = product.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const existingActive = await Product.findOne({
        tenantId: new Types.ObjectId(tenantId),
        _id: { $ne: product._id },
        isActive: true,
        name: { $regex: new RegExp(`^${escapedName}$`, "i") },
      });
      if (existingActive) {
        return { success: false, error: "An active product with this name already exists." };
      }
      product.isActive = true;
      await product.save();
    } else {
      await Product.deleteOne({
        _id: product._id,
        tenantId: new Types.ObjectId(tenantId),
      });
      // Restore clean name to remaining batch if only 1 active batch remains
      await cleanupProductBatchNames(tenantId, baseName);
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, reactivate ? "product_updated" : "product_deleted");

    return {
      success: true,
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        sell: product.sellStock,
        use: product.useStock,
        price: product.expectedSellPrice,
        purchaseCost: product.purchaseCost,
        lowStockThreshold: product.lowStockThreshold,
        description: product.description,
        barcode: product.barcode,
        isActive: product.isActive,
      },
    };
  } catch (error) {
    console.error("Failed to delete/reactivate product:", error);
    return { success: false, error: "Failed to perform product operation" };
  }
}

export async function createPurchaseOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  purchaseOrderNumber?: string;
  updatedProducts?: DashboardProduct[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = createPurchaseOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const result = await withTransaction(async (dbSession) => {
      const { fullNumber: poNumber } = await Counter.getNextSequence({
        tenantId,
        type: "purchase_order",
        session: dbSession,
      });

      const updatedProductsList: DashboardProduct[] = [];
      const poItems = [];

      // Guard: Ensure no duplicate products are passed in a single PO
      const seenItemKeys = new Set<string>();
      for (const item of input.items) {
        const itemKey = item.productId && item.productId !== "__new__"
          ? `id:${item.productId}`
          : `name:${item.productName.trim().toLowerCase()}`;
        if (seenItemKeys.has(itemKey)) {
          throw new Error(
            `Duplicate product "${item.productName}": A purchase order cannot contain the same product multiple times. Please combine the quantities into one entry.`
          );
        }
        seenItemKeys.add(itemKey);
      }

      for (const item of input.items) {
        let product = null;
        if (item.productId && item.productId !== "__new__" && Types.ObjectId.isValid(item.productId)) {
          product = await Product.findOne({ _id: new Types.ObjectId(item.productId), tenantId }).session(dbSession);
        }

        // If not found by ID or if adding a new product, check if a product with the same name exists
        if (!product) {
          const escapedName = item.productName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          product = await Product.findOne({
            tenantId: new Types.ObjectId(tenantId),
            name: { $regex: new RegExp(`^${escapedName}$`, "i") },
          }).session(dbSession);
        }

        let targetProduct = product;

        if (!product) {
          // Create new product on the fly
          const [createdProduct] = await Product.create(
            [
              {
                tenantId: new Types.ObjectId(tenantId),
                name: item.productName.trim(),
                category: item.category?.trim() || "General Supplies",
                unit: "pieces",
                sellStock: item.quantityForSell,
                useStock: item.quantityForUse,
                purchaseCost: item.purchaseCost,
                expectedSellPrice: item.expectedSellPrice,
                lowStockThreshold: 5,
                isActive: true,
              },
            ],
            { session: dbSession }
          );
          targetProduct = createdProduct;
          updatedProductsList.push({
            id: createdProduct._id.toString(),
            name: createdProduct.name,
            category: createdProduct.category,
            sell: createdProduct.sellStock,
            use: createdProduct.useStock,
            price: createdProduct.expectedSellPrice,
            purchaseCost: createdProduct.purchaseCost,
            lowStockThreshold: createdProduct.lowStockThreshold,
            description: createdProduct.description,
            barcode: createdProduct.barcode,
            isActive: createdProduct.isActive,
          });
        } else {
          const priceChanged =
            product.expectedSellPrice !== item.expectedSellPrice ||
            product.purchaseCost !== item.purchaseCost;

          if (!priceChanged) {
            targetProduct = product;
            product.sellStock += item.quantityForSell;
            product.useStock += item.quantityForUse;
            if (item.category?.trim() && (!product.category || product.category === "General Supplies" || product.category === "General")) {
              product.category = item.category.trim();
            }
            if (product.isActive === false) {
              product.isActive = true;
            }
            await product.save({ session: dbSession });

            updatedProductsList.push({
              id: product._id.toString(),
              name: product.name,
              category: product.category,
              sell: product.sellStock,
              use: product.useStock,
              price: product.expectedSellPrice,
              purchaseCost: product.purchaseCost,
              lowStockThreshold: product.lowStockThreshold,
              description: product.description,
              barcode: product.barcode,
              isActive: product.isActive,
            });
          } else {
          // New price detected: automatic batch separation (supporting 2 or more price points)
          const baseName = product.name.replace(/\s*\((Old|New|Batch[^\)]*)\)$/i, "").trim();
          const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          // Find all active products in this product family
          const activeSiblings = await Product.find({
            tenantId,
            isActive: true,
            name: new RegExp(`^${escapedBase}(\\s*\\((Old|New|Batch[^\)]*)\\))?$`, "i"),
          }).session(dbSession);

          // 1. If an active sibling already has this exact price, add stock to it
          const matchingSibling = activeSiblings.find(
            (p) => p.expectedSellPrice === item.expectedSellPrice && p.purchaseCost === item.purchaseCost
          );

          if (matchingSibling) {
            matchingSibling.sellStock += item.quantityForSell;
            matchingSibling.useStock += item.quantityForUse;
            await matchingSibling.save({ session: dbSession });
            targetProduct = matchingSibling;
          } else {
            const totalBatches = activeSiblings.length + 1;

            if (totalBatches === 2) {
              // 2 prices: label older as (Old) and incoming as (New)
              const existing = activeSiblings[0];
              if (!existing.name.endsWith("(Old)")) {
                existing.name = `${baseName} (Old)`;
                await existing.save({ session: dbSession });
              }

              const [createdNew] = await Product.create(
                [
                  {
                    tenantId,
                    name: `${baseName} (New)`,
                    category: product.category,
                    unit: "pieces",
                    purchaseCost: item.purchaseCost,
                    expectedSellPrice: item.expectedSellPrice,
                    sellStock: item.quantityForSell,
                    useStock: item.quantityForUse,
                    lowStockThreshold: product.lowStockThreshold,
                    description: product.description,
                    isActive: true,
                  },
                ],
                { session: dbSession }
              );
              targetProduct = createdNew;
            } else {
              // More than 2 prices: label each batch with its price tag (Batch ₹...) so owner can distinguish any number of prices
              for (const sib of activeSiblings) {
                const tag = `${baseName} (Batch ₹${sib.expectedSellPrice})`;
                if (sib.name !== tag) {
                  const conflict = activeSiblings.some((o) => !o._id.equals(sib._id) && o.name === tag);
                  if (!conflict) {
                    sib.name = tag;
                    await sib.save({ session: dbSession });
                  }
                }
              }

              let newTag = `${baseName} (Batch ₹${item.expectedSellPrice})`;
              const exists = activeSiblings.some((s) => s.name === newTag);
              if (exists) {
                newTag = `${baseName} (Batch ₹${item.expectedSellPrice} - New)`;
              }

              const [createdNew] = await Product.create(
                [
                  {
                    tenantId,
                    name: newTag,
                    category: product.category,
                    unit: "pieces",
                    purchaseCost: item.purchaseCost,
                    expectedSellPrice: item.expectedSellPrice,
                    sellStock: item.quantityForSell,
                    useStock: item.quantityForUse,
                    lowStockThreshold: product.lowStockThreshold,
                    description: product.description,
                    isActive: true,
                  },
                ],
                { session: dbSession }
              );
              targetProduct = createdNew;
            }
          }

          // Push all active siblings and targetProduct to updatedProductsList
          for (const s of activeSiblings) {
            updatedProductsList.push({
              id: s._id.toString(),
              name: s.name,
              category: s.category,
              sell: s.sellStock,
              use: s.useStock,
              price: s.expectedSellPrice,
              purchaseCost: s.purchaseCost,
              lowStockThreshold: s.lowStockThreshold,
              description: s.description,
              barcode: s.barcode,
              isActive: s.isActive,
            });
          }
          if (targetProduct && !activeSiblings.some((s) => s._id.equals(targetProduct!._id))) {
            updatedProductsList.push({
              id: targetProduct._id.toString(),
              name: targetProduct.name,
              category: targetProduct.category,
              sell: targetProduct.sellStock,
              use: targetProduct.useStock,
              price: targetProduct.expectedSellPrice,
              purchaseCost: targetProduct.purchaseCost,
              lowStockThreshold: targetProduct.lowStockThreshold,
              description: targetProduct.description,
              barcode: targetProduct.barcode,
              isActive: targetProduct.isActive,
            });
          }
        }
      }

        if (targetProduct) {
          const itemTotal = (item.quantityForSell + item.quantityForUse) * item.purchaseCost;
          poItems.push({
            productId: targetProduct._id,
            productName: targetProduct.name,
            quantityForSell: item.quantityForSell,
            quantityForUse: item.quantityForUse,
            purchaseCost: item.purchaseCost,
            expectedSellPrice: item.expectedSellPrice,
            itemTotalCost: itemTotal,
          });
        }
      }

      const totalAmount = poItems.reduce((sum, it) => sum + it.itemTotalCost, 0);

      // Rule 1: settlementMode, paymentMode and amountPaid calculation
      let finalAmountPaid: number;
      if (input.settlementMode === "completed" || input.settlementMode === "paid_full") {
        finalAmountPaid = totalAmount;
      } else if (input.settlementMode === "pending" || input.settlementMode === "advance") {
        finalAmountPaid = input.amountPaid !== undefined && input.amountPaid !== null ? input.amountPaid : 0;
      } else if (input.paymentMode === "credit") {
        finalAmountPaid = input.amountPaid !== undefined && input.amountPaid !== null ? input.amountPaid : 0;
      } else {
        finalAmountPaid = input.amountPaid !== undefined && input.amountPaid !== null ? input.amountPaid : totalAmount;
      }

      // Auto-calculate paymentStatus — do NOT let it be set manually:
      // if (amountPaid >= totalAmount) → "paid"
      // else if (amountPaid <= 0) → "unpaid"
      // else → "partial"
      let paymentStatus: "paid" | "partial" | "unpaid";
      if (finalAmountPaid >= totalAmount) {
        paymentStatus = "paid";
      } else if (finalAmountPaid <= 0) {
        paymentStatus = "unpaid";
      } else {
        paymentStatus = "partial";
      }

      // Auto-calculate amountPending = totalAmount - amountPaid
      const amountPending = Math.max(0, totalAmount - finalAmountPaid);
      const effectivePaymentMode = finalAmountPaid <= 0 ? "credit" : input.paymentMode === "credit" ? "cash" : input.paymentMode;

      // Find or create Supplier in the same transaction
      const tenantObjectId = new Types.ObjectId(tenantId);
      const normalizedSupplierPhone = input.supplierPhone?.trim()
        ? formatPhoneNumber(input.supplierPhone)
        : "";

      let supplier = null;
      if (input.supplierId && Types.ObjectId.isValid(input.supplierId)) {
        supplier = await Supplier.findOne({ _id: new Types.ObjectId(input.supplierId), tenantId: tenantObjectId }).session(dbSession);
      }
      if (!supplier && normalizedSupplierPhone) {
        supplier = await Supplier.findOne({
          tenantId: tenantObjectId,
          $or: [
            { phone: normalizedSupplierPhone },
            { phone: input.supplierPhone?.trim() },
          ],
        }).session(dbSession);
      }
      if (!supplier) {
        supplier = await Supplier.findOne({
          tenantId: tenantObjectId,
          name: { $regex: new RegExp(`^${input.supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        }).session(dbSession);
      }

      if (!supplier) {
        const [createdSupplier] = await Supplier.create(
          [
            {
              tenantId: tenantObjectId,
              name: input.supplierName.trim(),
              phone: normalizedSupplierPhone,
              companyName: input.supplierCompany?.trim() || undefined,
              totalPurchases: totalAmount,
              totalPaid: finalAmountPaid,
              totalPending: amountPending,
              isActive: true,
            },
          ],
          { session: dbSession }
        );
        supplier = createdSupplier;
      } else {
        supplier.totalPurchases = (supplier.totalPurchases || 0) + totalAmount;
        supplier.totalPaid = (supplier.totalPaid || 0) + finalAmountPaid;
        supplier.totalPending = (supplier.totalPending || 0) + amountPending;
        if (input.supplierCompany && !supplier.companyName) {
          supplier.companyName = input.supplierCompany.trim();
        }
        if (normalizedSupplierPhone && (!supplier.phone || supplier.phone === "")) {
          supplier.phone = normalizedSupplierPhone;
        }
        await supplier.save({ session: dbSession });
      }

      const [createdPO] = await PurchaseOrder.create(
        [
          {
            tenantId: tenantObjectId,
            purchaseOrderNumber: poNumber,
            supplierId: supplier._id,
            supplierSnapshot: {
              name: supplier.name,
              phone: supplier.phone || normalizedSupplierPhone || "",
              companyName: supplier.companyName || input.supplierCompany || undefined,
            },
            items: poItems,
            payments:
              finalAmountPaid > 0
                ? [
                    {
                      amount: finalAmountPaid,
                      paymentMode:
                        effectivePaymentMode === "credit" ? "cash" : effectivePaymentMode,
                      notes: input.notes || undefined,
                      recordedBy: session.user.role === "staff" ? "staff" : "owner",
                      type: finalAmountPaid >= totalAmount ? "full_payment" : "initial",
                    },
                  ]
                : [],
            totalAmount,
            amountPaid: finalAmountPaid,
            amountPending,
            paymentMode: effectivePaymentMode,
            paymentStatus,
            settlementMode: input.settlementMode || "completed",
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
            deliveryTime: input.deliveryTime?.trim() || undefined,
            invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
            dealerInvoiceNumber: input.dealerInvoiceNumber || undefined,
            notes: input.notes || undefined,
            recordedBy: session.user.role === "staff" ? "staff" : "owner",
          },
        ],
        { session: dbSession }
      );

      // Record corresponding Expense if amount paid > 0
      if (finalAmountPaid > 0) {
        const { fullNumber: expenseNumber } = await Counter.getNextSequence({
          tenantId: tenantObjectId,
          type: "expense",
          session: dbSession,
        });
        await Expense.create(
          [
            {
              tenantId: tenantObjectId,
              expenseNumber,
              title: `Stock In (${formatDisplayNumber(poNumber)}) — ${input.supplierName}`,
              category: "inventory_purchase",
              amount: finalAmountPaid,
              paymentMode:
                effectivePaymentMode === "cash" ||
                effectivePaymentMode === "upi" ||
                effectivePaymentMode === "card" ||
                effectivePaymentMode === "bank_transfer"
                  ? effectivePaymentMode
                  : "cash",
              linkedPurchaseOrderId: createdPO._id,
              expenseDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
              recordedBy: session.user.role === "staff" ? "staff" : "owner",
            },
          ],
          { session: dbSession }
        );
      }

      return {
        poNumber,
        updatedProductsList,
        purchaseOrderId: createdPO._id.toString(),
        totalAmount,
        amountPaid: finalAmountPaid,
        amountPending,
        paymentStatus,
      };
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "purchase_order_created");
    broadcastUpdate(tenantId, "stock_in_created");

    return {
      success: true,
      purchaseOrderNumber: result.poNumber,
      updatedProducts: result.updatedProductsList,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to create purchase order";
    return { success: false, error: errorMsg };
  }
}

export async function recordPurchaseOrderPaymentAction(rawInput: unknown): Promise<{
  success: boolean;
  purchaseOrder?: DashboardPurchaseOrder;
  supplier?: DashboardSupplier;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = recordPurchaseOrderPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);

    const result = await withTransaction(async (dbSession) => {
      // Find purchase order
      const query = Types.ObjectId.isValid(input.purchaseOrderId)
        ? { tenantId: tenantObjectId, $or: [{ _id: new Types.ObjectId(input.purchaseOrderId) }, { purchaseOrderNumber: input.purchaseOrderId }] }
        : { tenantId: tenantObjectId, purchaseOrderNumber: input.purchaseOrderId };

      const po = await PurchaseOrder.findOne(query).session(dbSession);
      if (!po) {
        throw new Error("Purchase order not found");
      }

      if (po.paymentStatus === "paid" || po.amountPending <= 0) {
        throw new Error("Purchase order is already fully paid");
      }

      if (input.amount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      if (input.amount > po.amountPending) {
        throw new Error(`Payment amount (₹${input.amount}) exceeds current pending balance (₹${po.amountPending})`);
      }

      // Update PurchaseOrder
      const priorPaid = po.amountPaid;
      po.amountPaid += input.amount;
      po.amountPending = Math.max(0, po.amountPending - input.amount);

      if (!po.payments) po.payments = [];
      if (po.payments.length === 0 && priorPaid > 0) {
        po.payments.push({
          amount: priorPaid,
          paymentMode: po.paymentMode !== "credit" ? (po.paymentMode as any) : "cash",
          notes: po.notes,
          recordedBy: po.recordedBy || "owner",
          type: "initial",
        });
      }

      po.payments.push({
        amount: input.amount,
        paymentMode: input.paymentMode,
        notes: input.notes?.trim() || undefined,
        recordedBy: session.user.role === "staff" ? "staff" : "owner",
        type: "settlement",
        recordedAt: new Date(),
      });

      // Recalculate paymentStatus using the same rule:
      // if (amountPaid >= totalAmount) → "paid"
      // else if (amountPaid <= 0) → "unpaid"
      // else → "partial"
      if (po.amountPaid >= po.totalAmount) {
        po.paymentStatus = "paid";
      } else if (po.amountPaid <= 0) {
        po.paymentStatus = "unpaid";
      } else {
        po.paymentStatus = "partial";
      }

      await po.save({ session: dbSession });

      // Update linked Supplier in the same transaction
      let updatedSupplierDoc = null;
      if (po.supplierId) {
        const supplier = await Supplier.findOne({ _id: po.supplierId, tenantId: tenantObjectId }).session(dbSession);
        if (supplier) {
          supplier.totalPaid = (supplier.totalPaid || 0) + input.amount;
          supplier.totalPending = Math.max(0, (supplier.totalPending || 0) - input.amount);
          await supplier.save({ session: dbSession });
          updatedSupplierDoc = supplier;
        }
      }

      // Record Expense for this payment
      const { fullNumber: expenseNumber } = await Counter.getNextSequence({
        tenantId: tenantObjectId,
        type: "expense",
        session: dbSession,
      });

      await Expense.create(
        [
          {
            tenantId: tenantObjectId,
            expenseNumber,
            title: `PO Payment (${formatDisplayNumber(po.purchaseOrderNumber)}) — ${po.supplierSnapshot?.name || "Supplier"}`,
            category: "inventory_purchase",
            amount: input.amount,
            paymentMode: input.paymentMode,
            linkedPurchaseOrderId: po._id,
            expenseDate: new Date(),
            notes: input.notes?.trim() || undefined,
            recordedBy: session.user.role === "staff" ? "staff" : "owner",
          },
        ],
        { session: dbSession }
      );

      return { po, supplier: updatedSupplierDoc };
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "purchase_order_updated");

    return {
      success: true,
      purchaseOrder: {
        id: result.po._id.toString(),
        purchaseOrderNumber: result.po.purchaseOrderNumber,
        supplierId: result.po.supplierId?.toString() || "",
        supplierName: result.po.supplierSnapshot.name,
        supplierPhone: result.po.supplierSnapshot.phone ? formatPhoneNumber(result.po.supplierSnapshot.phone) : undefined,
        itemsCount: result.po.items?.length || 0,
        items: (result.po.items || []).map((it: any) => ({
          productId: it.productId?.toString() || "",
          productName: it.productName || "Product",
          quantityForSell: it.quantityForSell || 0,
          quantityForUse: it.quantityForUse || 0,
          purchaseCost: it.purchaseCost || 0,
          expectedSellPrice: it.expectedSellPrice || 0,
          itemTotalCost: it.itemTotalCost || 0,
        })),
        payments: (result.po.payments || []).map((p: any) => ({
          amount: p.amount,
          paymentMode: p.paymentMode,
          notes: p.notes,
          recordedBy: p.recordedBy,
          type: p.type || "settlement",
        })),
        totalAmount: result.po.totalAmount,
        amountPaid: result.po.amountPaid,
        amountPending: result.po.amountPending,
        paymentMode: result.po.paymentMode,
        paymentStatus: result.po.paymentStatus,
        settlementMode: result.po.settlementMode,
        dueDate: result.po.dueDate ? new Date(result.po.dueDate).toISOString() : undefined,
        expectedDeliveryDate: result.po.expectedDeliveryDate ? new Date(result.po.expectedDeliveryDate).toISOString() : undefined,
        deliveryTime: result.po.deliveryTime,
        invoiceDate: result.po.invoiceDate ? new Date(result.po.invoiceDate).toISOString() : new Date().toISOString(),
        dealerInvoiceNumber: result.po.dealerInvoiceNumber,
        notes: result.po.notes,
        createdAt: result.po.createdAt ? new Date(result.po.createdAt).toISOString() : new Date().toISOString(),
      },
      supplier: result.supplier
        ? {
            id: result.supplier._id.toString(),
            name: result.supplier.name,
            companyName: result.supplier.companyName,
            phone: result.supplier.phone,
            email: result.supplier.email,
            address: result.supplier.address,
            gstin: result.supplier.gstin,
            notes: result.supplier.notes,
            totalPurchases: result.supplier.totalPurchases,
            totalPaid: result.supplier.totalPaid,
            totalPending: result.supplier.totalPending,
            isActive: result.supplier.isActive,
          }
        : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to record purchase order payment";
    return { success: false, error: errorMsg };
  }
}

export async function reschedulePurchaseOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  purchaseOrder?: DashboardPurchaseOrder;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = reschedulePurchaseOrderSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const query = Types.ObjectId.isValid(input.purchaseOrderId)
      ? { tenantId: tenantObjectId, $or: [{ _id: new Types.ObjectId(input.purchaseOrderId) }, { purchaseOrderNumber: input.purchaseOrderId }] }
      : { tenantId: tenantObjectId, purchaseOrderNumber: input.purchaseOrderId };

    const po = await PurchaseOrder.findOne(query);
    if (!po) {
      return { success: false, error: "Purchase order not found" };
    }

    if (input.expectedDeliveryDate !== undefined) {
      po.expectedDeliveryDate = input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined;
    }
    if (input.deliveryTime !== undefined) {
      po.deliveryTime = input.deliveryTime?.trim() || undefined;
    }
    if (input.dueDate !== undefined) {
      po.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    }
    if (po.expectedDeliveryDate && (!po.settlementMode || po.settlementMode === "completed")) {
      if (po.paymentStatus === "partial" || po.notes?.toLowerCase().includes("advance")) {
        po.settlementMode = "advance";
      }
    }

    await po.save();

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "purchase_order_updated");

    const refreshed = await getPurchaseOrdersAction();
    const updatedPO = refreshed.purchaseOrders?.find((p) => p.id === po._id.toString());

    return {
      success: true,
      purchaseOrder: updatedPO,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to reschedule purchase order";
    return { success: false, error: errorMsg };
  }
}

export async function getPurchaseOrdersAction(options?: {
  pendingOnly?: boolean;
  supplierId?: string;
}): Promise<{
  success: boolean;
  purchaseOrders: DashboardPurchaseOrder[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, purchaseOrders: [], error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, purchaseOrders: [], error: "Tenant not found" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const filter: Record<string, unknown> = { tenantId: tenantObjectId };

    if (options?.pendingOnly) {
      filter.paymentStatus = { $ne: "paid" };
    }

    if (options?.supplierId && Types.ObjectId.isValid(options.supplierId)) {
      filter.supplierId = new Types.ObjectId(options.supplierId);
    }

    const sortOrder: Record<string, 1 | -1> = options?.pendingOnly
      ? { invoiceDate: 1 }
      : { invoiceDate: -1, createdAt: -1 };

    const rawOrders = await PurchaseOrder.find(filter).sort(sortOrder).lean();

    const poIds = rawOrders.map((po) => po._id);
    const linkedExpenses = await Expense.find({
      tenantId: tenantObjectId,
      linkedPurchaseOrderId: { $in: poIds },
    })
      .sort({ createdAt: 1 })
      .lean();

    const expensesByPoId = new Map<string, typeof linkedExpenses>();
    for (const exp of linkedExpenses) {
      if (exp.linkedPurchaseOrderId) {
        const key = exp.linkedPurchaseOrderId.toString();
        const list = expensesByPoId.get(key) || [];
        list.push(exp);
        expensesByPoId.set(key, list);
      }
    }

    // Lookup linked suppliers so bills always display the latest live supplier phone, name, and company
    const supplierIds = Array.from(
      new Set(
        rawOrders
          .map((po) => po.supplierId?.toString())
          .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(id))
      )
    ).map((id) => new Types.ObjectId(id));

    const suppliersList =
      supplierIds.length > 0
        ? await Supplier.find({
            _id: { $in: supplierIds },
            tenantId: tenantObjectId,
          }).lean()
        : [];

    const suppliersById = new Map(
      suppliersList.map((s) => [s._id.toString(), s])
    );

    const purchaseOrders: DashboardPurchaseOrder[] = rawOrders.map((po) => {
      let payments: DashboardPurchaseOrderPayment[] = [];
      if (po.payments && po.payments.length > 0) {
        payments = po.payments.map((p: any) => ({
          amount: p.amount,
          paymentMode: p.paymentMode,
          notes: p.notes,
          recordedBy: p.recordedBy,
          type: p.type || "settlement",
          recordedAt: p.recordedAt
            ? new Date(p.recordedAt).toISOString()
            : po.createdAt
            ? new Date(po.createdAt).toISOString()
            : undefined,
        }));
      } else {
        const poExps = expensesByPoId.get(po._id.toString()) || [];
        if (poExps.length > 0) {
          payments = poExps.map((e, idx) => ({
            amount: e.amount,
            paymentMode: e.paymentMode as any,
            notes: e.notes,
            recordedBy: e.recordedBy,
            type:
              idx === 0 && poExps.length > 1
                ? "initial"
                : e.title?.toLowerCase().includes("stock in")
                ? "initial"
                : "settlement",
            recordedAt: e.expenseDate
              ? new Date(e.expenseDate).toISOString()
              : e.createdAt
              ? new Date(e.createdAt).toISOString()
              : undefined,
          }));
        } else if (po.amountPaid > 0) {
          payments = [
            {
              amount: po.amountPaid,
              paymentMode: po.paymentMode !== "credit" ? (po.paymentMode as any) : "cash",
              notes: po.notes,
              recordedBy: po.recordedBy || "owner",
              type: po.amountPaid >= po.totalAmount ? "full_payment" : "initial",
              recordedAt: po.createdAt ? new Date(po.createdAt).toISOString() : undefined,
            },
          ];
        }
      }

      const liveSupplier = po.supplierId ? suppliersById.get(po.supplierId.toString()) : null;
      const supplierName = liveSupplier?.name || po.supplierSnapshot?.name || "Unknown Supplier";
      const supplierPhone = liveSupplier?.phone || po.supplierSnapshot?.phone;
      const supplierCompany = liveSupplier?.companyName || po.supplierSnapshot?.companyName;

      return {
        id: po._id.toString(),
        purchaseOrderNumber: po.purchaseOrderNumber,
        supplierId: po.supplierId?.toString() || "",
        supplierName,
        supplierPhone: supplierPhone ? formatPhoneNumber(supplierPhone) : undefined,
        supplierCompany,
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
        payments,
        totalAmount: po.totalAmount,
        amountPaid: po.amountPaid,
        amountPending: po.amountPending,
        paymentMode: po.paymentMode,
        paymentStatus: po.paymentStatus,
        settlementMode: po.settlementMode,
        dueDate: po.dueDate ? new Date(po.dueDate).toISOString() : undefined,
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString() : undefined,
        deliveryTime: po.deliveryTime,
        invoiceDate: po.invoiceDate ? new Date(po.invoiceDate).toISOString() : new Date().toISOString(),
        dealerInvoiceNumber: po.dealerInvoiceNumber,
        notes: po.notes,
        recordedBy: po.recordedBy || undefined,
        createdAt: po.createdAt ? new Date(po.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: po.updatedAt ? new Date(po.updatedAt).toISOString() : undefined,
      };
    });

    return { success: true, purchaseOrders };
  } catch (error) {
    console.error("Failed to get purchase orders:", error);
    return { success: false, purchaseOrders: [], error: "Failed to get purchase orders" };
  }
}

export async function getPendingPurchaseOrdersAction(): Promise<{
  success: boolean;
  purchaseOrders: DashboardPurchaseOrder[];
  totalPendingAmount: number;
  count: number;
  error?: string;
}> {
  try {
    const res = await getPurchaseOrdersAction({ pendingOnly: true });
    if (!res.success) {
      return { success: false, purchaseOrders: [], totalPendingAmount: 0, count: 0, error: res.error };
    }
    const totalPendingAmount = res.purchaseOrders.reduce((sum, po) => sum + po.amountPending, 0);
    return {
      success: true,
      purchaseOrders: res.purchaseOrders,
      totalPendingAmount,
      count: res.purchaseOrders.length,
    };
  } catch (error) {
    return { success: false, purchaseOrders: [], totalPendingAmount: 0, count: 0, error: "Failed to fetch pending purchase orders" };
  }
}

export async function getSupplierDetailAction(supplierId: string): Promise<{
  success: boolean;
  supplier?: DashboardSupplier;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const query = Types.ObjectId.isValid(supplierId)
      ? { _id: new Types.ObjectId(supplierId), tenantId: tenantObjectId }
      : { phone: supplierId, tenantId: tenantObjectId };

    const doc = await Supplier.findOne(query).lean();
    if (!doc) {
      return { success: false, error: "Supplier not found" };
    }

    return {
      success: true,
      supplier: {
        id: doc._id.toString(),
        name: doc.name,
        companyName: doc.companyName,
        phone: doc.phone,
        email: doc.email,
        address: doc.address,
        gstin: doc.gstin,
        notes: doc.notes,
        totalPurchases: doc.totalPurchases ?? 0,
        totalPaid: doc.totalPaid ?? 0,
        totalPending: doc.totalPending ?? 0,
        isActive: doc.isActive,
      },
    };
  } catch (error) {
    return { success: false, error: "Failed to fetch supplier details" };
  }
}

export async function getSuppliersAction(): Promise<{
  success: boolean;
  suppliers: DashboardSupplier[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, suppliers: [], error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, suppliers: [], error: "Tenant not found" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const docs = await Supplier.find({ tenantId: tenantObjectId, isActive: true })
      .sort({ updatedAt: -1 })
      .lean();

    const suppliers: DashboardSupplier[] = docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      companyName: doc.companyName,
      phone: doc.phone,
      email: doc.email,
      address: doc.address,
      gstin: doc.gstin,
      notes: doc.notes,
      totalPurchases: doc.totalPurchases ?? 0,
      totalPaid: doc.totalPaid ?? 0,
      totalPending: doc.totalPending ?? 0,
      isActive: doc.isActive,
    }));

    return { success: true, suppliers };
  } catch (error) {
    return { success: false, suppliers: [], error: "Failed to fetch suppliers" };
  }
}

export async function searchSuppliersAction(searchTerm: string): Promise<{
  success: boolean;
  suppliers: { id: string; name: string; phone: string; companyName?: string }[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, suppliers: [], error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, suppliers: [], error: "Tenant not found" };
    }

    const trimmed = searchTerm?.trim();
    if (!trimmed) {
      return { success: true, suppliers: [] };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const matches = await Supplier.find({
      tenantId: tenantObjectId,
      isActive: true,
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { companyName: { $regex: escaped, $options: "i" } },
      ],
    })
      .limit(8)
      .sort({ updatedAt: -1 })
      .lean();

    const suppliers = matches.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      phone: s.phone || "",
      companyName: s.companyName,
    }));

    return { success: true, suppliers };
  } catch (error) {
    console.error("Failed to search suppliers:", error);
    return { success: false, suppliers: [], error: "Failed to search suppliers" };
  }
}

export async function fulfillOrderLineItemAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: DashboardOrder;
  updatedProduct?: DashboardProduct;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = fulfillOrderLineItemSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { orderId, lineItemIndex } = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const result = await withTransaction(async (dbSession) => {
      const query = Types.ObjectId.isValid(orderId)
        ? { tenantId, $or: [{ _id: new Types.ObjectId(orderId) }, { orderNumber: orderId }] }
        : { tenantId, orderNumber: orderId };

      const order = await Order.findOne(query).session(dbSession);
      if (!order) {
        throw new Error("Order not found");
      }

      if (!order.lineItems || !order.lineItems[lineItemIndex]) {
        throw new Error("Order line item not found");
      }

      const item = order.lineItems[lineItemIndex];
      if (item.fulfilled) {
        throw new Error("Line item is already fulfilled");
      }

      let updatedProduct: DashboardProduct | undefined;

      if (item.itemType === "product" && Types.ObjectId.isValid(item.itemId)) {
        const prod = await Product.findOne({ _id: item.itemId, tenantId }).session(dbSession);
        if (!prod) {
          throw new Error("Product for line item no longer exists in database");
        }

        const qtyNeeded = item.quantity || 1;
        if (prod.sellStock < qtyNeeded) {
          throw new Error(
            `Insufficient stock to fulfill: retail stock has ${prod.sellStock} pcs, but order needs ${qtyNeeded} pcs. Please stock in first.`
          );
        }

        prod.sellStock -= qtyNeeded;
        await prod.save({ session: dbSession });

        const cleaned = await cleanupProductBatchNames(tenantId, prod.name, dbSession);
        if (cleaned && cleaned._id.equals(prod._id)) {
          prod.name = cleaned.name;
        }

        updatedProduct = {
          id: prod._id.toString(),
          name: prod.name,
          category: prod.category,
          sell: prod.sellStock,
          use: prod.useStock,
          price: prod.expectedSellPrice,
          purchaseCost: prod.purchaseCost,
          lowStockThreshold: prod.lowStockThreshold,
          description: prod.description,
          barcode: prod.barcode,
          isActive: prod.isActive,
        };
      } else if (item.itemType === "package" && Types.ObjectId.isValid(item.itemId)) {
        const stockCheck = await checkPackageProductsAvailability(
          tenantId,
          item.itemId,
          item.quantity || 1,
          dbSession
        );
        if (!stockCheck.available) {
          const missingDesc = stockCheck.missing
            .map((m) => `"${m.name}" (${m.available} available, ${m.needed} needed)`)
            .join(", ");
          throw new Error(
            `Cannot fulfill package: Required products are out of stock: ${missingDesc}. Please stock in first.`
          );
        }
        await deductPackageProductsFromStock(tenantId, item.itemId, item.quantity || 1, dbSession);
      }

      item.fulfilled = true;

      // If all items are fulfilled and order is fully paid, transition order to completed
      const allFulfilled = order.lineItems.every((li) => li.fulfilled);
      if (allFulfilled && order.amountPaid >= order.totalAmount) {
        order.status = "completed";
        order.completedAt = new Date();
      }

      await order.save({ session: dbSession });
      return { order, updatedProduct };
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "order_updated");

    const mappedType = mapOrderType(result.order.orderType);

    return {
      success: true,
      order: {
        id: result.order.orderNumber,
        customer: result.order.customerSnapshot?.name || "Walk-in Customer",
        customerPhone: result.order.customerSnapshot?.phone || undefined,
        type: mappedType,
        amount: result.order.totalAmount,
        paid: result.order.amountPaid,
        status: result.order.status,
        time: "Today, Just now",
        isToday: true,
        isLast24Hours: true,
        createdAt: result.order.createdAt ? new Date(result.order.createdAt).toISOString() : new Date().toISOString(),
        paymentMode: result.order.paymentMode,
        advanceAmount: result.order.status === "advance_paid" ? result.order.amountPaid : undefined,
        scheduledFor: result.order.scheduledFor ? new Date(result.order.scheduledFor).toISOString() : undefined,
      },
      updatedProduct: result.updatedProduct,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to fulfill line item";
    return { success: false, error: errorMsg };
  }
}

export async function getLowStockAlertsAction(): Promise<{
  success: boolean;
  enabled: boolean;
  count: number;
  products: DashboardProduct[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, enabled: false, count: 0, products: [], error: "Unauthorized" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, enabled: false, count: 0, products: [], error: "Tenant not found" };
    }

    const tenant = await Tenant.findById(new Types.ObjectId(tenantId)).lean();
    if (!tenant) {
      return { success: false, enabled: false, count: 0, products: [], error: "Tenant not found" };
    }

    // Check setting
    if (tenant.settings?.lowStockNotification === false) {
      return { success: true, enabled: false, count: 0, products: [] };
    }

    const rawProducts = await Product.find({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
      $expr: { $lte: ["$sellStock", "$lowStockThreshold"] },
    })
      .sort({ sellStock: 1, name: 1 })
      .lean();

    const products: DashboardProduct[] = rawProducts.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      sell: p.sellStock,
      use: p.useStock,
      price: p.expectedSellPrice,
      purchaseCost: p.purchaseCost,
      lowStockThreshold: p.lowStockThreshold,
      description: p.description,
      barcode: p.barcode,
      isActive: p.isActive,
    }));

    return {
      success: true,
      enabled: true,
      count: products.length,
      products,
    };
  } catch (error) {
    console.error("Failed to get low stock alerts:", error);
    return { success: false, enabled: false, count: 0, products: [], error: "Failed to query low stock" };
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

export async function createServiceAction(rawInput: unknown): Promise<{
  success: boolean;
  service?: DashboardService;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    const parseResult = createServiceSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const newDoc = (await Service.create({
      tenantId: new Types.ObjectId(tenantId),
      name: input.name,
      category: input.category,
      price: input.price,
      description: input.description || undefined,
      isActive: true,
    })) as unknown as IService;

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "service_created");

    return {
      success: true,
      service: {
        id: newDoc._id.toString(),
        name: newDoc.name,
        category: newDoc.category,
        price: newDoc.price,
        description: newDoc.description || "",
        isActive: newDoc.isActive,
      },
    };
  } catch (error) {
    console.error("Failed to create service:", error);
    return { success: false, error: "Failed to persist service in database" };
  }
}

export async function updateServiceAction(rawInput: unknown): Promise<{
  success: boolean;
  service?: DashboardService;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    const parseResult = updateServiceSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const descriptionToSet = input.description !== undefined ? input.description.trim() : undefined;

    const updateDoc: any = {
      $set: {
        name: input.name,
        category: input.category,
        price: input.price,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    };

    if (descriptionToSet !== undefined) {
      if (descriptionToSet.length > 0) {
        updateDoc.$set.description = descriptionToSet;
      } else {
        updateDoc.$unset = { description: 1 };
      }
    }

    const updated = (await Service.findOneAndUpdate(
      { _id: new Types.ObjectId(input.id), tenantId: new Types.ObjectId(tenantId) },
      updateDoc,
      { new: true }
    ).lean()) as IService | null;

    if (!updated) {
      return { success: false, error: "Service not found or permission denied" };
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "service_updated");

    return {
      success: true,
      service: {
        id: updated._id.toString(),
        name: updated.name,
        category: updated.category,
        price: updated.price,
        description: updated.description || "",
        isActive: updated.isActive,
      },
    };
  } catch (error) {
    console.error("Failed to update service:", error);
    return { success: false, error: "Failed to update service in database" };
  }
}

export async function toggleServiceStatusAction(serviceId: string): Promise<{
  success: boolean;
  isActive?: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    const doc = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (!doc) {
      return { success: false, error: "Service not found" };
    }

    doc.isActive = !doc.isActive;
    await doc.save();

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "service_updated");

    return { success: true, isActive: doc.isActive };
  } catch (error) {
    console.error("Failed to toggle service status:", error);
    return { success: false, error: "Failed to toggle service status" };
  }
}

export async function deleteServiceAction(serviceId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    const deleted = await Service.findOneAndDelete({
      _id: new Types.ObjectId(serviceId),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (!deleted) {
      return { success: false, error: "Service not found or permission denied" };
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "service_deleted");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { success: false, error: "Failed to delete service" };
  }
}

export async function createPackageAction(rawInput: unknown): Promise<{
  success: boolean;
  package?: DashboardPackage;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    const parseResult = createPackageSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const services = input.services.map((s) => ({
      serviceId: new Types.ObjectId(s.serviceId),
      name: s.name,
      componentPrice: s.componentPrice,
    }));

    const products = input.products.map((p) => ({
      productId: new Types.ObjectId(p.productId),
      name: p.name,
      quantity: p.quantity,
      componentPrice: p.componentPrice,
    }));

    const newDoc = (await PackageTemplate.create({
      tenantId: new Types.ObjectId(tenantId),
      name: input.name,
      description: input.description || undefined,
      pricingType: input.pricingType,
      packagePrice: input.packagePrice,
      services,
      products,
      isActive: true,
    })) as unknown as IPackageTemplate;

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "package_created");

    return {
      success: true,
      package: {
        id: newDoc._id.toString(),
        name: newDoc.name,
        description: newDoc.description || "",
        pricingType: newDoc.pricingType,
        packagePrice: newDoc.packagePrice,
        services: input.services,
        products: input.products,
        isActive: newDoc.isActive,
      },
    };
  } catch (error) {
    console.error("Failed to create package:", error);
    return { success: false, error: "Failed to persist package in database" };
  }
}

export async function updatePackageAction(rawInput: unknown): Promise<{
  success: boolean;
  package?: DashboardPackage;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    const parseResult = updatePackageSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const services = input.services.map((s) => ({
      serviceId: new Types.ObjectId(s.serviceId),
      name: s.name,
      componentPrice: s.componentPrice,
    }));

    const products = input.products.map((p) => ({
      productId: new Types.ObjectId(p.productId),
      name: p.name,
      quantity: p.quantity,
      componentPrice: p.componentPrice,
    }));

    const descriptionToSet = input.description !== undefined ? input.description.trim() : undefined;

    const updateDoc: any = {
      $set: {
        name: input.name,
        pricingType: input.pricingType,
        packagePrice: input.packagePrice,
        services,
        products,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    };

    if (descriptionToSet !== undefined) {
      if (descriptionToSet.length > 0) {
        updateDoc.$set.description = descriptionToSet;
      } else {
        updateDoc.$unset = { description: 1 };
      }
    }

    const updated = (await PackageTemplate.findOneAndUpdate(
      { _id: new Types.ObjectId(input.id), tenantId: new Types.ObjectId(tenantId) },
      updateDoc,
      { new: true }
    ).lean()) as IPackageTemplate | null;

    if (!updated) {
      return { success: false, error: "Package not found or permission denied" };
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "package_updated");

    return {
      success: true,
      package: {
        id: updated._id.toString(),
        name: updated.name,
        description: updated.description || "",
        pricingType: updated.pricingType,
        packagePrice: updated.packagePrice,
        services: input.services,
        products: input.products,
        isActive: updated.isActive,
      },
    };
  } catch (error) {
    console.error("Failed to update package:", error);
    return { success: false, error: "Failed to update package in database" };
  }
}

export async function togglePackageStatusAction(packageId: string): Promise<{
  success: boolean;
  isActive?: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    const doc = await PackageTemplate.findOne({
      _id: new Types.ObjectId(packageId),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (!doc) {
      return { success: false, error: "Package not found" };
    }

    doc.isActive = !doc.isActive;
    await doc.save();

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "package_updated");

    return { success: true, isActive: doc.isActive };
  } catch (error) {
    console.error("Failed to toggle package status:", error);
    return { success: false, error: "Failed to toggle package status" };
  }
}

export async function deletePackageAction(packageId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }
    if (session.user.role !== "owner") {
      return { success: false, error: "Only salon owners can manage services and packages" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    const deleted = await PackageTemplate.findOneAndDelete({
      _id: new Types.ObjectId(packageId),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (!deleted) {
      return { success: false, error: "Package not found or permission denied" };
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "package_deleted");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete package:", error);
    return { success: false, error: "Failed to delete package" };
  }
}

export async function getLiveProductsAction(): Promise<{
  success: boolean;
  products?: DashboardProduct[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const rawProducts = await Product.find({
      tenantId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    const products: DashboardProduct[] = rawProducts.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      category: p.category,
      sell: p.sellStock,
      use: p.useStock,
      price: p.expectedSellPrice,
      purchaseCost: p.purchaseCost,
      lowStockThreshold: p.lowStockThreshold,
      description: p.description,
      barcode: p.barcode,
      isActive: p.isActive,
    }));

    return { success: true, products };
  } catch (error) {
    console.error("Failed to fetch live products:", error);
    return { success: false, error: "Failed to fetch live products" };
  }
}

export async function getCustomerOrdersAction(input: {
  phone: string;
  name?: string;
  customerId?: string;
}): Promise<{
  success: boolean;
  orders?: DashboardOrder[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    // ponytail: Extracts last 10 digits for Indian mobile numbers with flexible delimiter matching. Upgrade path: Pass tenant country code if expanding internationally.
    const rawDigits = (input.phone || "").replace(/\D/g, "").slice(-10);
    const flexiblePhoneRegex = rawDigits ? rawDigits.split("").join("[\\s\\-\\(\\)]*") : "";

    const orConditions: any[] = [];
    if (flexiblePhoneRegex) {
      orConditions.push({ "customerSnapshot.phone": { $regex: flexiblePhoneRegex } });
    }
    if (input.phone && input.phone.trim()) {
      orConditions.push({ "customerSnapshot.phone": input.phone.trim() });
    }
    if (input.customerId && Types.ObjectId.isValid(input.customerId)) {
      orConditions.push({ customerId: new Types.ObjectId(input.customerId) });
    }
    if (input.name && input.name.trim() && input.name.trim().toLowerCase() !== "walk-in customer") {
      orConditions.push({
        "customerSnapshot.name": {
          $regex: `^${input.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
      });
    }

    if (orConditions.length === 0) {
      return { success: true, orders: [] };
    }

    const query: any = {
      tenantId: tenantObjectId,
      $or: orConditions,
    };

    const rawOrders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const mappedOrders: DashboardOrder[] = rawOrders.map((o: any) => {
      const isToday = checkIsToday(o.createdAt);
      const isLast24Hours = checkIsLast24Hours(o.createdAt);

      const latestPaymentDate =
        o.payments && Array.isArray(o.payments) && o.payments.length > 0
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

      const latestActivityDate =
        candidateTimestamps.length > 0
          ? new Date(Math.max(...candidateTimestamps))
          : o.createdAt
          ? new Date(o.createdAt)
          : new Date();

      return {
        id: o.orderNumber,
        customer: o.customerSnapshot?.name || "Customer",
        customerPhone: o.customerSnapshot?.phone || undefined,
        type: mapOrderType(o.orderType),
        itemsSummary:
          o.lineItems && Array.isArray(o.lineItems)
            ? o.lineItems.map((li: any) => li.name).filter(Boolean).join(", ")
            : undefined,
        amount: typeof o.totalAmount === "number" && !isNaN(o.totalAmount) ? o.totalAmount : 0,
        paid: typeof o.amountPaid === "number" && !isNaN(o.amountPaid) ? o.amountPaid : 0,
        todayPaid: Math.max(0, o.amountPaid || 0),
        status: o.status,
        time: formatOrderTime(o.createdAt),
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
        refundMode: o.refundDetails?.refundMode,
        paymentMode: (o.paymentMode || o.payments?.[o.payments.length - 1]?.mode || o.payments?.[0]?.mode),
        advanceAmount: o.status === "advance_paid" ? o.amountPaid : undefined,
        subtotal: o.subtotal,
        discountType: o.discountType,
        discountValue: o.discountValue,
        discountAmount: o.discountAmount,
        notes: o.notes || undefined,
        recordedBy: o.recordedBy || undefined,
        lineItems: o.lineItems?.map((li: any) => ({
          name: li.name,
          itemType: li.itemType,
          unitPrice: li.unitPrice,
          quantity: li.quantity,
          discount: li.discount,
          finalPrice: li.finalPrice,
          fulfilled: li.fulfilled,
          packageDetails: li.packageDetails,
        })),
        payments: o.payments?.map((p: any) => ({
          amount: p.amount,
          mode: p.mode,
          recordedAt: p.recordedAt ? new Date(p.recordedAt).toISOString() : new Date().toISOString(),
          recordedBy: p.recordedBy,
          type: p.type,
        })),
      };
    });

    return { success: true, orders: mappedOrders };
  } catch (error) {
    console.error("Failed to fetch customer orders:", error);
    return { success: false, error: "Failed to fetch customer orders" };
  }
}

export async function createSupplierAction(rawInput: unknown): Promise<{
  success: boolean;
  supplier?: DashboardSupplier;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = createSupplierSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const normalizedPhone = formatPhoneNumber(input.phone);

    const newDoc = await Supplier.create({
      tenantId: tenantObjectId,
      name: input.name.trim(),
      companyName: input.companyName?.trim() || undefined,
      phone: normalizedPhone,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      gstin: input.gstin?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      totalPurchases: 0,
      totalPaid: 0,
      totalPending: 0,
      isActive: true,
    });

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "supplier_created");

    return {
      success: true,
      supplier: {
        id: newDoc._id.toString(),
        name: newDoc.name,
        companyName: newDoc.companyName,
        phone: formatPhoneNumber(newDoc.phone),
        email: newDoc.email,
        address: newDoc.address,
        gstin: newDoc.gstin,
        notes: newDoc.notes,
        totalPurchases: newDoc.totalPurchases || 0,
        totalPaid: newDoc.totalPaid || 0,
        totalPending: newDoc.totalPending || 0,
        isActive: newDoc.isActive !== false,
      },
    };
  } catch (error) {
    console.error("Failed to create supplier:", error);
    return { success: false, error: "Failed to persist supplier to database" };
  }
}

export async function updateSupplierAction(rawInput: unknown): Promise<{
  success: boolean;
  supplier?: DashboardSupplier;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = updateSupplierSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const supplier = await Supplier.findOne({
      _id: new Types.ObjectId(input.id),
      tenantId: tenantObjectId,
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const oldName = supplier.name;
    const oldPhone = supplier.phone;
    const oldCompany = supplier.companyName;

    supplier.name = input.name.trim();
    supplier.companyName = input.companyName?.trim() || undefined;
    if (input.phone) {
      supplier.phone = formatPhoneNumber(input.phone);
    }
    supplier.email = input.email?.trim() || undefined;
    supplier.address = input.address?.trim() || undefined;
    supplier.gstin = input.gstin?.trim() || undefined;
    supplier.notes = input.notes?.trim() || undefined;
    if (input.isActive !== undefined) {
      supplier.isActive = input.isActive;
    }

    await supplier.save();

    // Sync supplierSnapshot in all purchase orders linked to this supplier
    if (
      supplier.phone !== oldPhone ||
      supplier.name !== oldName ||
      supplier.companyName !== oldCompany
    ) {
      await PurchaseOrder.updateMany(
        {
          tenantId: tenantObjectId,
          $or: [
            { supplierId: supplier._id },
            ...(oldPhone ? [{ "supplierSnapshot.phone": oldPhone }] : []),
            { "supplierSnapshot.name": oldName },
          ],
        },
        {
          $set: {
            "supplierSnapshot.name": supplier.name,
            "supplierSnapshot.phone": supplier.phone,
            "supplierSnapshot.companyName": supplier.companyName,
          },
        }
      );
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "supplier_updated");

    return {
      success: true,
      supplier: {
        id: supplier._id.toString(),
        name: supplier.name,
        companyName: supplier.companyName,
        phone: formatPhoneNumber(supplier.phone),
        email: supplier.email,
        address: supplier.address,
        gstin: supplier.gstin,
        notes: supplier.notes,
        totalPurchases: supplier.totalPurchases || 0,
        totalPaid: supplier.totalPaid || 0,
        totalPending: supplier.totalPending || 0,
        isActive: supplier.isActive !== false,
      },
    };
  } catch (error) {
    console.error("Failed to update supplier:", error);
    return { success: false, error: "Failed to update supplier in database" };
  }
}

export async function deleteSupplierAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = deleteSupplierSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const { id } = parseResult.data;
    await connectToDatabase();
    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found" };
    }

    await Supplier.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: { isActive: false } }
    );

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "supplier_updated");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete supplier:", error);
    return { success: false, error: "Failed to delete supplier" };
  }
}

export async function updateCustomerAction(rawInput: unknown): Promise<{
  success: boolean;
  customer?: DashboardCustomer;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized session" };
    }

    const parseResult = updateCustomerSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.issues[0].message };
    }

    const input = parseResult.data;
    await connectToDatabase();

    const tenantId = await resolveTenantId(session);
    if (!tenantId) {
      return { success: false, error: "Tenant not found for current session" };
    }

    const tenantObjectId = new Types.ObjectId(tenantId);

    // Locate existing customer by ID or phone
    const normalizedNewPhone = formatPhoneNumber(input.phone);
    let customer = null;
    if (input.id && Types.ObjectId.isValid(input.id)) {
      customer = await Customer.findOne({
        _id: new Types.ObjectId(input.id),
        tenantId: tenantObjectId,
      });
    }
    if (!customer && input.originalPhone) {
      const origPhone = formatPhoneNumber(input.originalPhone);
      customer = await Customer.findOne({
        phone: origPhone,
        tenantId: tenantObjectId,
      });
    }
    if (!customer) {
      customer = await Customer.findOne({
        phone: normalizedNewPhone,
        tenantId: tenantObjectId,
      });
    }

    if (!customer) {
      return { success: false, error: "Customer profile not found" };
    }

    const oldPhone = customer.phone;
    const oldName = customer.name;

    // If phone number is changing, verify no other customer has this phone
    if (normalizedNewPhone !== customer.phone) {
      const existingWithPhone = await Customer.findOne({
        tenantId: tenantObjectId,
        phone: normalizedNewPhone,
        _id: { $ne: customer._id },
      });
      if (existingWithPhone) {
        return {
          success: false,
          error: `Another customer with phone ${normalizedNewPhone} already exists.`,
        };
      }
      customer.phone = normalizedNewPhone;
    }

    customer.name = input.name.trim();
    customer.email = input.email?.trim() || undefined;
    customer.gender = input.gender || undefined;
    customer.notes = input.notes?.trim() || undefined;

    await customer.save();

    // Sync order snapshots if name or phone changed
    if (customer.name !== oldName || customer.phone !== oldPhone) {
      await Order.updateMany(
        {
          tenantId: tenantObjectId,
          $or: [
            { customerId: customer._id },
            { "customerSnapshot.phone": oldPhone },
          ],
        },
        {
          $set: {
            "customerSnapshot.name": customer.name,
            "customerSnapshot.phone": customer.phone,
          },
        }
      );
    }

    revalidatePath("/dashboard");
    broadcastUpdate(tenantId, "customer_updated");

    const mappedCustomer: DashboardCustomer = {
      id: customer._id.toString(),
      phone: formatPhoneNumber(customer.phone),
      name: customer.name,
      email: customer.email || undefined,
      gender: customer.gender || undefined,
      notes: customer.notes || undefined,
      visits: customer.stats?.totalVisits ?? 0,
      lastVisit: customer.stats?.lastVisitAt
        ? new Date(customer.stats.lastVisitAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "Never",
      lastVisitRaw: customer.stats?.lastVisitAt
        ? new Date(customer.stats.lastVisitAt).toISOString()
        : customer.updatedAt
        ? new Date(customer.updatedAt).toISOString()
        : undefined,
      totalSpent: typeof customer.stats?.totalSpend === "number" ? customer.stats.totalSpend : 0,
      outstandingDue: typeof customer.stats?.outstandingBalance === "number" ? customer.stats.outstandingBalance : 0,
      createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : undefined,
    };

    return {
      success: true,
      customer: mappedCustomer,
    };
  } catch (error) {
    console.error("Failed to update customer:", error);
    return { success: false, error: "Failed to update customer" };
  }
}


