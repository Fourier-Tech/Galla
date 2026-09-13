import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICustomerStats {
  totalVisits: number;
  totalSpend: number;
  outstandingBalance: number;
  lastVisitAt?: Date;
}

export interface ICustomer extends Document {
  tenantId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  gender?: "female" | "male" | "other";
  notes?: string;
  stats: ICustomerStats;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
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
      required: [true, "Customer name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Customer phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gender: {
      type: String,
      enum: ["female", "male", "other"],
    },
    notes: {
      type: String,
      trim: true,
    },
    stats: {
      totalVisits: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalSpend: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingBalance: {
        type: Number,
        default: 0,
      },
      lastVisitAt: {
        type: Date,
      },
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

// Compound tenant index: Phone MUST be unique PER TENANT
CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, name: 1 });
CustomerSchema.index({ tenantId: 1, "stats.lastVisitAt": -1 });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
