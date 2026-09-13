import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPackageServiceItem {
  serviceId: Types.ObjectId;
  name: string;
  componentPrice: number;
}

export interface IPackageProductItem {
  productId: Types.ObjectId;
  name: string;
  quantity: number;
  componentPrice: number;
}

export interface IPackageTemplate extends Document {
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  pricingType: "fixed" | "sum_of_items";
  packagePrice: number;
  services: IPackageServiceItem[];
  products: IPackageProductItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PackageServiceItemSchema = new Schema<IPackageServiceItem>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    componentPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const PackageProductItemSchema = new Schema<IPackageProductItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Product quantity must be an integer",
      },
    },
    componentPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const PackageTemplateSchema = new Schema<IPackageTemplate>(
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
      required: [true, "Package name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    pricingType: {
      type: String,
      enum: ["fixed", "sum_of_items"],
      default: "fixed",
    },
    packagePrice: {
      type: Number,
      required: [true, "Package price is required"],
      min: [0, "Package price cannot be negative"],
      default: 0,
    },
    services: {
      type: [PackageServiceItemSchema],
      default: [],
    },
    products: {
      type: [PackageProductItemSchema],
      default: [],
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

PackageTemplateSchema.index({ tenantId: 1, name: 1 });
PackageTemplateSchema.index({ tenantId: 1, isActive: 1 });

export const PackageTemplate: Model<IPackageTemplate> =
  mongoose.models.PackageTemplate ||
  mongoose.model<IPackageTemplate>("PackageTemplate", PackageTemplateSchema);

export default PackageTemplate;
