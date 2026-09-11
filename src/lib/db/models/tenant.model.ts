import mongoose, { Document, Model, Schema } from "mongoose";

export interface ITenant extends Document {
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial";
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
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
