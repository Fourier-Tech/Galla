import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AnalyticsPeriodType = "daily" | "weekly" | "monthly" | "yearly";

export interface IAnalyticsRevenueMetrics {
  total: number;
  product: number;
  service: number;
  package: number;
}

export interface IAnalyticsExpenseMetrics {
  total: number; // Operating expenses (excluding internal stock moves)
  inventoryPurchases: number;
  internalStockConsumables: number; // Rupee value of internal product moves
  salary: number;
  rent: number;
  dayToDay: number;
  refunds: number;
}

export interface IAnalyticsPaymentModeMetrics {
  cash: number;
  upi: number;
  card: number;
  split: number;
}

export interface IAnalyticsRollupMetrics {
  revenue: IAnalyticsRevenueMetrics;
  expenses: IAnalyticsExpenseMetrics;
  netProfit: number;
  totalOrders: number;
  completedOrders: number;
  advancePayment: number;
  footfall: number;
  averageTicketValue: number;
  uncollectedDues: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  paymentModes: IAnalyticsPaymentModeMetrics;
}

export interface IAnalyticsRollup extends Document {
  tenantId: Types.ObjectId;
  periodType: AnalyticsPeriodType;
  periodKey: string; // e.g., "2026-09-28" (daily), "2026-W39" (weekly), "2026-09" (monthly), "2026" (yearly)
  startDate: Date;
  endDate: Date;
  metrics: IAnalyticsRollupMetrics;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsRollupSchema = new Schema<IAnalyticsRollup>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is strictly required"],
      index: true,
      immutable: true,
    },
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: [true, "Period type is required"],
      index: true,
    },
    periodKey: {
      type: String,
      required: [true, "Period key is required"],
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    metrics: {
      revenue: {
        total: { type: Number, default: 0 },
        product: { type: Number, default: 0 },
        service: { type: Number, default: 0 },
        package: { type: Number, default: 0 },
      },
      expenses: {
        total: { type: Number, default: 0 },
        inventoryPurchases: { type: Number, default: 0 },
        internalStockConsumables: { type: Number, default: 0 },
        salary: { type: Number, default: 0 },
        rent: { type: Number, default: 0 },
        dayToDay: { type: Number, default: 0 },
        refunds: { type: Number, default: 0 },
      },
      netProfit: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      completedOrders: { type: Number, default: 0 },
      advancePayment: { type: Number, default: 0 },
      footfall: { type: Number, default: 0 },
      averageTicketValue: { type: Number, default: 0 },
      uncollectedDues: { type: Number, default: 0 },
      newCustomersCount: { type: Number, default: 0 },
      returningCustomersCount: { type: Number, default: 0 },
      paymentModes: {
        cash: { type: Number, default: 0 },
        upi: { type: Number, default: 0 },
        card: { type: Number, default: 0 },
        split: { type: Number, default: 0 },
      },
    },
    // TTL index field:
    // Daily: 2 months (60 days)
    // Weekly: 6 months (180 days)
    // Monthly: 2 years (730 days)
    // Yearly: null (permanent, all-time retention)
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for strict tenant-scoped period deduplication
AnalyticsRollupSchema.index(
  { tenantId: 1, periodType: 1, periodKey: 1 },
  { unique: true }
);

// TTL index: MongoDB native background thread automatically deletes documents once expiresAt has passed
AnalyticsRollupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsRollup: Model<IAnalyticsRollup> =
  mongoose.models.AnalyticsRollup ||
  mongoose.model<IAnalyticsRollup>("AnalyticsRollup", AnalyticsRollupSchema);
