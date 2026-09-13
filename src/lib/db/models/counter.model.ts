import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICounter extends Document {
  tenantId: Types.ObjectId;
  name: string;
  seq: number;
}

export interface ICounterModel extends Model<ICounter> {
  getNextSequence(
    tenantId: Types.ObjectId | string,
    name: "order" | "purchase_order",
    prefix?: string
  ): Promise<string>;
}

const CounterSchema = new Schema<ICounter>(
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
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

CounterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

CounterSchema.statics.getNextSequence = async function (
  tenantId: Types.ObjectId | string,
  name: "order" | "purchase_order",
  prefix = name === "order" ? "ORD" : "PO"
): Promise<string> {
  const counter = await this.findOneAndUpdate(
    { tenantId, name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, "0");
  return `${prefix}-${paddedSeq}`;
};

export const Counter = (mongoose.models.Counter ||
  mongoose.model<ICounter, ICounterModel>(
    "Counter",
    CounterSchema
  )) as ICounterModel;

export default Counter;
