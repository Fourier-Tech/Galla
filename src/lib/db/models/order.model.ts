import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type OrderStatus =
  | "created"
  | "advance_paid"
  | "paid_full"
  | "fulfilled"
  | "completed"
  | "cancelled_refunded"
  | "cancelled_converted";

export type OrderType = "product_sale" | "service_booking" | "package_sale" | "mixed";
export type PaymentMode = "cash" | "upi" | "card" | "split";

export interface IOrderPackageComponent {
  serviceId: Types.ObjectId;
  name: string;
  componentPrice: number;
}

export interface IOrderLineItem {
  itemType: "product" | "service" | "package";
  itemId: Types.ObjectId;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  finalPrice: number;
  fulfilled: boolean;
  purchaseCost?: number;
  packageDetails?: {
    templateId?: Types.ObjectId;
    isCustomized: boolean;
    components: IOrderPackageComponent[];
  };
}

export interface IOrderPayment {
  amount: number;
  mode: "cash" | "upi" | "card";
  transactionRef?: string;
  recordedAt: Date;
  recordedBy: "owner" | "staff";
  type?: "advance" | "settlement" | "full_payment" | string;
}

export interface IOrderRefund {
  refundAmount: number;
  refundMode: "cash" | "upi" | "card";
  refundReason?: string;
  refundedAt: Date;
  refundedBy: "owner" | "staff";
}

export interface IOrderConversion {
  convertedToOrderId?: Types.ObjectId;
  convertedFromOrderId?: Types.ObjectId;
  transferredAmount: number;
  conversionReason?: string;
  convertedAt: Date;
}

export interface IOrder extends Document {
  tenantId: Types.ObjectId;
  orderNumber: string;
  customerId?: Types.ObjectId;
  customerSnapshot?: {
    name: string;
    phone: string;
  };
  orderType: OrderType;
  status: OrderStatus;
  lineItems: IOrderLineItem[];
  subtotal: number;
  discountType: "flat" | "percentage";
  discountValue: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  paymentMode: PaymentMode;
  payments: IOrderPayment[];
  refundDetails?: IOrderRefund;
  conversionDetails?: IOrderConversion;
  notes?: string;
  scheduledFor?: Date;
  scheduledTime?: string;
  recordedBy: "owner" | "staff";
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderPackageComponentSchema = new Schema<IOrderPackageComponent>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    componentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const OrderLineItemSchema = new Schema<IOrderLineItem>(
  {
    itemType: {
      type: String,
      enum: ["product", "service", "package"],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    fulfilled: {
      type: Boolean,
      default: true,
    },
    purchaseCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    packageDetails: {
      templateId: {
        type: Schema.Types.ObjectId,
        ref: "PackageTemplate",
      },
      isCustomized: {
        type: Boolean,
        default: false,
      },
      components: [OrderPackageComponentSchema],
    },
  },
  { _id: true }
);

const OrderPaymentSchema = new Schema<IOrderPayment>(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    mode: {
      type: String,
      enum: ["cash", "upi", "card"],
      required: true,
    },
    transactionRef: {
      type: String,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: String,
      enum: ["owner", "staff"],
      required: true,
    },
    type: {
      type: String,
      enum: ["advance", "settlement", "full_payment", "other"],
    },
  },
  { _id: true }
);

const OrderSchema = new Schema<IOrder>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerSnapshot: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    orderType: {
      type: String,
      enum: ["product_sale", "service_booking", "package_sale", "mixed"],
      default: "service_booking",
    },
    status: {
      type: String,
      enum: [
        "created",
        "advance_paid",
        "paid_full",
        "fulfilled",
        "completed",
        "cancelled_refunded",
        "cancelled_converted",
      ],
      default: "created",
      index: true,
    },
    lineItems: {
      type: [OrderLineItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderLineItem[]) => items.length > 0,
        message: "Order must contain at least one line item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["flat", "percentage"],
      default: "flat",
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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
      enum: ["cash", "upi", "card", "split"],
      default: "cash",
    },
    payments: {
      type: [OrderPaymentSchema],
      default: [],
    },
    refundDetails: {
      refundAmount: { type: Number, min: 0 },
      refundMode: { type: String, enum: ["cash", "upi", "card"] },
      refundReason: { type: String, trim: true },
      refundedAt: { type: Date },
      refundedBy: { type: String, enum: ["owner", "staff"] },
    },
    conversionDetails: {
      convertedToOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
      convertedFromOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
      transferredAmount: { type: Number, min: 0 },
      conversionReason: { type: String, trim: true },
      convertedAt: { type: Date },
    },
    notes: {
      type: String,
      trim: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    scheduledTime: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: String,
      enum: ["owner", "staff"],
      default: "staff",
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant indexes
OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, status: 1 });
OrderSchema.index({ tenantId: 1, customerId: 1 });
OrderSchema.index({ tenantId: 1, "payments.recordedAt": -1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
