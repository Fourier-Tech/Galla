import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  tenantId: Types.ObjectId;
  ownerEmail: string;
  passwordHash?: string;
  ownerPinHash?: string;
  staffPinHash?: string;
  ownerActiveSessionId?: string | null;
  staffActiveSessionId?: string | null;
  lastRoleLoginAt?: Date | null;
  resetOtpHash?: string | null;
  resetOtpExpiresAt?: Date | null;
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
    passwordHash: {
      type: String,
      required: false,
    },
    ownerPinHash: {
      type: String,
      default: null,
      index: true,
    },
    staffPinHash: {
      type: String,
      default: null,
      index: true,
    },
    ownerActiveSessionId: {
      type: String,
      default: null,
    },
    staffActiveSessionId: {
      type: String,
      default: null,
    },
    lastRoleLoginAt: {
      type: Date,
      default: null,
      index: true,
    },
    resetOtpHash: {
      type: String,
      default: null,
    },
    resetOtpExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre("save", async function () {
  if (!this.passwordHash) {
    this.passwordHash = await bcrypt.hash("password123", 10);
  }
  if (!this.ownerPinHash) {
    this.ownerPinHash = await bcrypt.hash("888888", 10);
  }
  if (!this.staffPinHash) {
    this.staffPinHash = await bcrypt.hash("567890", 10);
  }
});

if (mongoose.models.User) {
  delete (mongoose.models as Record<string, unknown>).User;
}

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export default User;
