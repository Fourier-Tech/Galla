import mongoose, { Document, Model, Schema } from "mongoose";

export interface ITenantSettings {
  allowBackorders: boolean;
  lowStockNotification: boolean;
  currency: string;
}

export interface ITenant extends Document {
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial";
  ownerPinHash?: string;
  staffPinHash?: string;
  phone?: string;
  address?: string;
  profileImageUrl?: string;
  profileImagePublicId?: string;
  settings: ITenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
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

export const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
