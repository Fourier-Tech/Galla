import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ExpenseCategory =
  | "stock_transfer_internal"
  | "inventory_purchase"
  | "salary"
  | "rent"
  | "refreshments"
  | "utilities"
  | "maintenance"
  | "marketing"
  | "refund"
  | "other";

export type ExpensePaymentMode =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "internal_transfer";

export interface IExpense extends Document {
  tenantId: Types.ObjectId;
  expenseNumber?: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: ExpensePaymentMode;
  expenseDate: Date;
  recipient?: string;
  linkedProductId?: Types.ObjectId;
  linkedQuantity?: number;
  linkedPurchaseOrderId?: Types.ObjectId;
  linkedOrderId?: Types.ObjectId;
  notes?: string;
  recordedBy: "owner" | "staff";
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    expenseNumber: {
      type: String,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Expense title is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "stock_transfer_internal",
        "inventory_purchase",
        "salary",
        "rent",
        "refreshments",
        "utilities",
        "maintenance",
        "marketing",
        "refund",
        "other",
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Expense amount is required"],
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bank_transfer", "internal_transfer"],
      default: "cash",
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recipient: {
      type: String,
      trim: true,
    },
    linkedProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    linkedQuantity: {
      type: Number,
      min: 1,
      validate: {
        validator: (v: number) => v === undefined || Number.isInteger(v),
        message: "Linked quantity must be an integer",
      },
    },
    linkedPurchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    linkedOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: String,
      enum: ["owner", "staff"],
      default: "staff",
    },
  },
  {
    timestamps: true,
  }
);

ExpenseSchema.index({ tenantId: 1, expenseDate: -1 });
ExpenseSchema.index({ tenantId: 1, category: 1 });
ExpenseSchema.index({ tenantId: 1, expenseNumber: 1 });

export const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
