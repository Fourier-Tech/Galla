import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IService extends Document {
  tenantId: Types.ObjectId;
  name: string;
  category: string;
  price: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
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
      required: [true, "Service name is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Service price is required"],
      min: [0, "Service price cannot be negative"],
      default: 0,
    },
    description: {
      type: String,
      trim: true,
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

ServiceSchema.index({ tenantId: 1, name: 1 });
ServiceSchema.index({ tenantId: 1, category: 1 });
ServiceSchema.index({ tenantId: 1, isActive: 1 });

export const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);

export default Service;
