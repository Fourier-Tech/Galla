import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPurchaseOrderItem {
  productId: Types.ObjectId;
  productName: string;
  quantityForSell: number;
  quantityForUse: number;
  purchaseCost: number;
  expectedSellPrice: number;
  itemTotalCost: number;
}

export interface IPurchaseOrder extends Document {
  tenantId: Types.ObjectId;
  purchaseOrderNumber: string;
  supplierId: Types.ObjectId;
  supplierSnapshot: {
    name: string;
    phone: string;
    companyName?: string;
  };
  items: IPurchaseOrderItem[];
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer" | "credit";
  paymentStatus: "paid" | "partial" | "unpaid";
  invoiceDate: Date;
  dealerInvoiceNumber?: string;
  notes?: string;
  recordedBy: "owner" | "staff";
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantityForSell: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity for sell must be an integer piece count",
      },
    },
    quantityForUse: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity for use must be an integer piece count",
      },
    },
    purchaseCost: {
      type: Number,
      required: true,
      min: 0,
    },
    expectedSellPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    itemTotalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    purchaseOrderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier reference is required"],
      index: true,
    },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      companyName: { type: String },
    },
    items: {
      type: [PurchaseOrderItemSchema],
      required: true,
      validate: {
        validator: (v: IPurchaseOrderItem[]) => v.length > 0,
        message: "Purchase order must contain at least one product line item",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amountPending: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bank_transfer", "credit"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "paid",
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dealerInvoiceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: String,
      enum: ["owner", "staff"],
      default: "owner",
    },
  },
  {
    timestamps: true,
  }
);

PurchaseOrderSchema.index({ tenantId: 1, invoiceDate: -1 });
PurchaseOrderSchema.index({ tenantId: 1, supplierId: 1 });
PurchaseOrderSchema.index({ tenantId: 1, purchaseOrderNumber: 1 });

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);

export default PurchaseOrder;
