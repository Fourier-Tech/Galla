import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface ITenantSettings {
  allowBackorders: boolean;
  lowStockNotification: boolean;
  currency: string;
}

export interface ITenant extends Document {
  tenantCode?: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial";
  planType: "trial" | "active" | "lifetime";
  planExpiresAt?: Date | null;
  ownerPinHash?: string | null;
  staffPinHash?: string | null;
  phone?: string | null;
  address?: string | null;
  profileImageUrl?: string | null;
  profileImagePublicId?: string | null;
  settings: ITenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantCode: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Tenant slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "trial"],
      default: "active",
      index: true,
    },
    planType: {
      type: String,
      enum: ["trial", "active", "lifetime"],
      default: "trial",
      index: true,
    },
    planExpiresAt: {
      type: Date,
      default: null,
    },
    ownerPinHash: {
      type: String,
      default: null,
    },
    staffPinHash: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    profileImagePublicId: {
      type: String,
      trim: true,
      default: null,
    },
    settings: {
      allowBackorders: {
        type: Boolean,
        default: true,
      },
      lowStockNotification: {
        type: Boolean,
        default: true,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },
  },
  {
    timestamps: true,
  }
);

TenantSchema.pre("save", async function () {
  if (!this.ownerPinHash) {
    this.ownerPinHash = await bcrypt.hash("888888", 10);
  }
  if (!this.staffPinHash) {
    this.staffPinHash = await bcrypt.hash("567890", 10);
  }
});

if (mongoose.models.Tenant) {
  delete (mongoose.models as Record<string, unknown>).Tenant;
}

export const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
