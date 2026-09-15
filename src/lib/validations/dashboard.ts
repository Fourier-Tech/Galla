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
  category: z.enum(["Day-to-day", "Inventory purchase", "Salary", "Rent", "Refund"]),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const transferStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;

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
