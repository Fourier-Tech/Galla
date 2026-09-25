import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPurchaseOrderItem {
  productId: Types.ObjectId;
  productName: string;
  quantityForSell: number;
  quantityForUse: number;
  purchaseCost: number;
  expectedSellPrice: number;
  itemTotalCost: number;
  returnedQuantity?: number;
}

export interface IPurchaseOrderPayment {
  amount: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer";
  notes?: string;
  recordedBy?: "owner" | "staff";
  type?: "initial" | "settlement" | "full_payment" | string;
  recordedAt?: Date;
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
  payments?: IPurchaseOrderPayment[];
  returns?: IPurchaseOrderReturn[];
  totalAmount: number;
  amountPaid: number;
  ledgerAdjustment?: number;
  amountPending: number;
  paymentMode: "cash" | "upi" | "card" | "bank_transfer" | "credit";
  paymentStatus: "paid" | "partial" | "unpaid";
  settlementMode?: "completed" | "pending" | "advance" | "paid_full";
  stockAllocated?: boolean;
  dueDate?: Date;
  expectedDeliveryDate?: Date;
  deliveryTime?: string;
  invoiceDate: Date;
  dealerInvoiceNumber?: string;
  notes?: string;
  recordedBy: "owner" | "staff";
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderPaymentSchema = new Schema<IPurchaseOrderPayment>(
  {
    amount: { type: Number, required: true },
    paymentMode: {
      type: String,
      enum: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "reduce_due",
        "refund",
        "replacement_pending",
        "cash_refund",
        "upi_refund",
      ],
      required: true,
    },
    notes: { type: String, trim: true },
    recordedBy: { type: String, enum: ["owner", "staff"], default: "owner" },
    type: { type: String, default: "settlement" },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

export interface IPurchaseOrderReturn {
  returnNumber: string;
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  stockType: "sell" | "use";
  unitCost: number;
  totalRefundAmount: number;
  refundMode: "reduce_due" | "replacement_pending";
  amountDeductedFromDue: number;
  replacementStatus?: "pending" | "fulfilled";
  notes?: string;
  recordedBy: "owner" | "staff";
  returnedAt: Date;
}

const PurchaseOrderReturnSchema = new Schema<IPurchaseOrderReturn>(
  {
    returnNumber: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    stockType: { type: String, enum: ["sell", "use"], required: true },
    unitCost: { type: Number, required: true, min: 0 },
    totalRefundAmount: { type: Number, required: true, min: 0 },
    refundMode: {
      type: String,
      enum: ["reduce_due", "replacement_pending"],
      required: true,
    },
    amountDeductedFromDue: { type: Number, default: 0 },
    replacementStatus: {
      type: String,
      enum: ["pending", "fulfilled"],
      default: "pending",
    },
    notes: { type: String, trim: true },
    recordedBy: { type: String, enum: ["owner", "staff"], default: "owner" },
    returnedAt: { type: Date, default: Date.now },
  },
  { _id: false },
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
    payments: {
      type: [PurchaseOrderPaymentSchema],
      default: [],
    },
    returns: {
      type: [PurchaseOrderReturnSchema],
      default: [],
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
    ledgerAdjustment: {
      type: Number,
      default: 0,
    },
    amountPending: {
      type: Number,
      required: true,
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
    settlementMode: {
      type: String,
      enum: ["completed", "pending", "advance", "paid_full"],
      default: "completed",
    },
    stockAllocated: {
      type: Boolean,
      default: false,
    },
    dueDate: {
      type: Date,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    deliveryTime: {
      type: String,
      trim: true,
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
  },
);

PurchaseOrderSchema.index({ tenantId: 1, invoiceDate: -1 });
PurchaseOrderSchema.index({ tenantId: 1, supplierId: 1 });
PurchaseOrderSchema.index({ tenantId: 1, purchaseOrderNumber: 1 });

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.PurchaseOrder;
}

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);

export default PurchaseOrder;
