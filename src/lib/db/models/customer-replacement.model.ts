import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CustomerReplacementStatus =
  | "pending_dealer"
  | "arrived_call_client"
  | "completed"
  | "cancelled";

export interface ICustomerReplacement extends Document {
  tenantId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  productId: Types.ObjectId;
  productName: string;
  totalQuantity: number;
  handedQuantity: number;
  pendingQuantity: number;
  expectedDate: Date;
  status: CustomerReplacementStatus;
  notes?: string;
  recordedBy: "owner" | "staff";
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerReplacementSchema = new Schema<ICustomerReplacement>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
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
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    handedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    expectedDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending_dealer", "arrived_call_client", "completed", "cancelled"],
      default: "pending_dealer",
      index: true,
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
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

CustomerReplacementSchema.index({ tenantId: 1, status: 1, expectedDate: 1 });
CustomerReplacementSchema.index({ tenantId: 1, productId: 1, status: 1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.CustomerReplacement;
}

export const CustomerReplacement: Model<ICustomerReplacement> =
  mongoose.models.CustomerReplacement ||
  mongoose.model<ICustomerReplacement>(
    "CustomerReplacement",
    CustomerReplacementSchema
  );

export default CustomerReplacement;
