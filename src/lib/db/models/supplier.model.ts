import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISupplier extends Document {
  tenantId: Types.ObjectId;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  totalPurchases: number;
  totalPaid: number;
  totalPending: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    totalPurchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPending: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

SupplierSchema.index({ tenantId: 1, phone: 1 });
SupplierSchema.index({ tenantId: 1, name: 1 });

export const Supplier: Model<ISupplier> =
  mongoose.models.Supplier || mongoose.model<ISupplier>("Supplier", SupplierSchema);

export default Supplier;
