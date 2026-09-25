import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IProduct extends Document {
  tenantId: Types.ObjectId;
  name: string;
  category: string;
  unit: "pieces";
  purchaseCost: number;
  expectedSellPrice: number;
  sellStock: number;
  useStock: number;
  defectiveStock: number;
  lowStockThreshold: number;
  barcode?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
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
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },
    unit: {
      type: String,
      enum: ["pieces"],
      default: "pieces",
      required: true,
    },
    purchaseCost: {
      type: Number,
      required: [true, "Purchase cost is required"],
      min: [0, "Purchase cost cannot be negative"],
      default: 0,
    },
    expectedSellPrice: {
      type: Number,
      required: [true, "Expected retail sell price is required"],
      min: [0, "Sell price cannot be negative"],
      default: 0,
    },
    sellStock: {
      type: Number,
      required: true,
      min: [0, "Sell stock cannot be negative"],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Sell stock must be an integer piece quantity",
      },
    },
    useStock: {
      type: Number,
      required: true,
      min: [0, "Use stock cannot be negative"],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Use stock must be an integer piece quantity",
      },
    },
    defectiveStock: {
      type: Number,
      required: true,
      min: [0, "Defective stock cannot be negative"],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Defective stock must be an integer piece quantity",
      },
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 0,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
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

// Compound tenant indexes
ProductSchema.index(
  { tenantId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    collation: { locale: "en", strength: 2 },
  }
);
ProductSchema.index({ tenantId: 1, category: 1 });
ProductSchema.index({ tenantId: 1, isActive: 1, sellStock: 1 });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
