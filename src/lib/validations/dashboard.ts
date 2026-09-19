import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").trim(),
  customerPhone: z.string().optional(),
  orderType: z.enum(["Product sale", "Service booking", "Package sale"]),
  totalAmount: z.number().min(0, "Total amount cannot be negative"),
  paidAmount: z.number().min(0, "Paid amount cannot be negative"),
  status: z.enum([
    "completed",
    "paid_full",
    "advance_paid",
    "cancelled_refunded",
    "cancelled_converted",
    "created",
  ]),
  subtotal: z.number().optional(),
  discountType: z.enum(["flat", "percentage"]).optional(),
  discountValue: z.number().optional(),
  discountAmount: z.number().optional(),
  paymentMode: z.enum(["cash", "upi", "card"]).default("cash"),
  bookingDate: z.string().optional(),
  bookingTime: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        itemId: z.string(),
        itemType: z.enum(["service", "package", "product"]),
        name: z.string(),
        unitPrice: z.number(),
        quantity: z.number().default(1),
        finalPrice: z.number(),
      })
    )
    .optional(),
  clearedDueOrderIds: z.array(z.string()).optional(),
  clearedDueAmount: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const completeOrderSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  remainingAmount: z.number().min(0, "Remaining amount cannot be negative").optional(),
  paymentMode: z.enum(["cash", "upi", "card"]).default("cash"),
  notes: z.string().optional(),
});

export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;

export const rescheduleOrderSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  newDate: z.string().min(1, "New booking date is required"),
  newTime: z.string().optional(),
});

export type RescheduleOrderInput = z.infer<typeof rescheduleOrderSchema>;

export const refundOrderSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  refundAmount: z.number().positive("Refund amount must be greater than 0"),
  refundMode: z.enum(["cash", "upi", "card"]).default("cash"),
  refundReason: z.string().optional(),
});

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export const createExpenseSchema = z.object({
  desc: z.string().min(1, "Description is required").trim(),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["Day-to-day", "Salary", "Rent", "Inventory purchase", "Refund"]),
  paymentMode: z.enum(["cash", "upi", "card"]).default("cash"),
  notes: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const transferStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int("Quantity must be an integer").min(1, "Quantity must be at least 1").default(1),
  direction: z.enum(["sell_to_use", "use_to_sell"]).default("sell_to_use"),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;

export const consumeUseStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int("Quantity must be an integer").min(1, "Quantity must be at least 1").default(1),
  reason: z.enum(["service", "finished", "damaged", "other"]).default("service"),
  notes: z.string().optional(),
});

export type ConsumeUseStockInput = z.infer<typeof consumeUseStockSchema>;

export const purchaseOrderItemInputSchema = z.object({
  productId: z.string().optional(),
  isNewProduct: z.boolean().optional(),
  productName: z.string().min(1, "Product name is required").trim(),
  category: z.string().optional(),
  quantityForSell: z.number().int().min(0, "Quantity for sell cannot be negative").default(0),
  quantityForUse: z.number().int().min(0, "Quantity for use cannot be negative").default(0),
  purchaseCost: z.number().min(0, "Purchase cost cannot be negative"),
  expectedSellPrice: z.number().min(0, "Sell price cannot be negative"),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().min(1, "Supplier name is required").trim(),
  supplierPhone: z.string().optional(),
  supplierCompany: z.string().optional(),
  items: z.array(purchaseOrderItemInputSchema).min(1, "At least one item is required in a purchase order"),
  paymentMode: z.enum(["cash", "upi", "card", "bank_transfer", "credit"]).default("cash"),
  amountPaid: z.number().min(0, "Paid amount cannot be negative").optional(),
  settlementMode: z.enum(["completed", "pending", "advance", "paid_full"]).optional().default("completed"),
  dueDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  deliveryTime: z.string().optional(),
  dealerInvoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const recordPurchaseOrderPaymentSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase order ID is required"),
  amount: z.number().min(0, "Payment amount cannot be negative"),
  paymentMode: z.enum(["cash", "upi", "card", "bank_transfer"]).default("cash"),
  notes: z.string().optional(),
});

export type RecordPurchaseOrderPaymentInput = z.infer<typeof recordPurchaseOrderPaymentSchema>;

export const reschedulePurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase order ID is required"),
  expectedDeliveryDate: z.string().optional(),
  deliveryTime: z.string().optional(),
  dueDate: z.string().optional(),
});

export type ReschedulePurchaseOrderInput = z.infer<typeof reschedulePurchaseOrderSchema>;


export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").trim(),
  category: z.string().min(1, "Category is required").trim().default("General"),
  price: z.number().min(0, "Retail sell price cannot be negative"),
  purchaseCost: z.number().min(0, "Purchase cost cannot be negative").default(0),
  sellStock: z.number().int("Sell stock must be an integer").min(0, "Sell stock cannot be negative").default(0),
  useStock: z.number().int("Use stock must be an integer").min(0, "Use stock cannot be negative").default(0),
  lowStockThreshold: z.number().int().min(0).default(0),
  barcode: z.string().optional(),
  description: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Product name is required").trim(),
  category: z.string().min(1, "Category is required").trim().default("General"),
  price: z.number().min(0, "Retail sell price cannot be negative"),
  purchaseCost: z.number().min(0, "Purchase cost cannot be negative").default(0),
  lowStockThreshold: z.number().int().min(0).default(0),
  barcode: z.string().optional(),
  description: z.string().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const deleteProductSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
  reactivate: z.boolean().optional(),
});

export type DeleteProductInput = z.infer<typeof deleteProductSchema>;

export const updateSalonProfileSchema = z.object({
  name: z.string().min(1, "Salon name is required").trim(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileImageUrl: z.string().optional(),
  ownerName: z.string().optional(),
});

export type UpdateSalonProfileInput = z.infer<typeof updateSalonProfileSchema>;

export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").trim(),
  category: z.string().min(1, "Category is required").trim().default("General"),
  price: z.number().min(0, "Price cannot be negative"),
  description: z.string().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  id: z.string().min(1, "Service ID is required"),
  name: z.string().min(1, "Service name is required").trim(),
  category: z.string().min(1, "Category is required").trim().default("General"),
  price: z.number().min(0, "Price cannot be negative"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const packageServiceItemSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  name: z.string().min(1, "Service name is required"),
  componentPrice: z.number().min(0),
});

export const packageProductItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Product name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  componentPrice: z.number().min(0),
});

export const createPackageSchema = z.object({
  name: z.string().min(1, "Package name is required").trim(),
  description: z.string().optional(),
  pricingType: z.enum(["fixed", "sum_of_items"]).default("fixed"),
  packagePrice: z.number().min(0, "Package price cannot be negative"),
  services: z.array(packageServiceItemSchema).default([]),
  products: z.array(packageProductItemSchema).default([]),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;

export const updatePackageSchema = z.object({
  id: z.string().min(1, "Package ID is required"),
  name: z.string().min(1, "Package name is required").trim(),
  description: z.string().optional(),
  pricingType: z.enum(["fixed", "sum_of_items"]).default("fixed"),
  packagePrice: z.number().min(0, "Package price cannot be negative"),
  services: z.array(packageServiceItemSchema).default([]),
  products: z.array(packageProductItemSchema).default([]),
  isActive: z.boolean().optional(),
});

export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  companyName: z.string().optional(),
  phone: z.string().trim().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z.object({
  id: z.string().min(1, "Supplier ID is required"),
  name: z.string().trim().min(1, "Supplier name is required"),
  companyName: z.string().optional(),
  phone: z.string().trim().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;


export const updateCustomerSchema = z.object({
  id: z.string().optional(),
  originalPhone: z.string().optional(),
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  gender: z.enum(["female", "male", "other"]).optional(),
  notes: z.string().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
