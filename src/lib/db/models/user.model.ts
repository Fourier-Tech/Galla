import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUser extends Document {
  tenantId: Types.ObjectId;
  ownerEmail: string;
  ownerCodeHash: string;
  staffCodeHash: string;
  previousOwnerCodeHash?: string | null;
  previousStaffCodeHash?: string | null;
  codeExpiresAt: Date;
  graceExpiresAt?: Date | null;
  ownerActiveSessionId?: string | null;
  staffActiveSessionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"],
      unique: true,
      index: true,
      immutable: true,
    },
    ownerEmail: {
      type: String,
      required: [true, "Owner email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerCodeHash: {
      type: String,
      required: [true, "Owner code hash is required"],
      index: true,
    },
    staffCodeHash: {
      type: String,
      required: [true, "Staff code hash is required"],
      index: true,
    },
    previousOwnerCodeHash: {
      type: String,
      default: null,
      index: true,
    },
    previousStaffCodeHash: {
      type: String,
      default: null,
      index: true,
    },
    codeExpiresAt: {
      type: Date,
      required: [true, "Code expiration date is required"],
      index: true,
    },
    graceExpiresAt: {
      type: Date,
      default: null,
    },
    ownerActiveSessionId: {
      type: String,
      default: null,
    },
    staffActiveSessionId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.User) {
  delete (mongoose.models as Record<string, unknown>).User;
}

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export default User;
