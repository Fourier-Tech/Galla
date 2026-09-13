import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").trim(),
  customerPhone: z.string().optional(),
  orderType: z.enum(["Product sale", "Service booking", "Package sale"]),
  totalAmount: z.number().positive("Amount must be greater than 0"),
  paidAmount: z.number().min(0, "Paid amount cannot be negative"),
  status: z.enum([
    "completed",
    "paid_full",
    "advance_paid",
    "cancelled_refunded",
    "cancelled_converted",
    "created",
  ]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const createExpenseSchema = z.object({
  desc: z.string().min(1, "Description is required").trim(),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["Day-to-day", "Inventory purchase", "Salary", "Rent"]),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const transferStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export type TransferStockInput = z.infer<typeof transferStockSchema>;

export const updateSalonProfileSchema = z.object({
  name: z.string().min(1, "Salon name is required").trim(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileImageUrl: z.string().optional(),
  ownerName: z.string().optional(),
});

export type UpdateSalonProfileInput = z.infer<typeof updateSalonProfileSchema>;
