import mongoose, { ClientSession, Document, Model, Schema, Types } from "mongoose";

export type SequenceType =
  | "product_sale"
  | "service_booking"
  | "package_sale"
  | "mixed"
  | "purchase_order"
  | "expense";

export const SEQUENCE_TYPE_CODES: Record<SequenceType, string> = {
  product_sale: "P",
  service_booking: "S",
  package_sale: "K",
  mixed: "M",
  purchase_order: "PO",
  expense: "EXP",
};

export interface NextSequenceOptions {
  tenantId: Types.ObjectId | string;
  tenantCode?: string;
  type: SequenceType | string;
  date?: Date;
  session?: ClientSession;
}

export interface SequenceResult {
  fullNumber: string;
  shortNumber: string;
  seq: number;
}

export interface ICounter extends Document {
  tenantId?: Types.ObjectId | null;
  name: string;
  seq: number;
}

export interface ICounterModel extends Model<ICounter> {
  getNextTenantCode(session?: ClientSession): Promise<string>;
  getNextSequence(
    optionsOrTenantId: NextSequenceOptions | Types.ObjectId | string,
    legacyName?: string,
    legacyPrefix?: string
  ): Promise<SequenceResult>;
}

const CounterSchema = new Schema<ICounter>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: false,
      default: null,
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

CounterSchema.statics.getNextTenantCode = async function (
  session?: ClientSession
): Promise<string> {
  const counter = await this.findOneAndUpdate(
    { tenantId: null, name: "tenant_code" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );

  return String(counter.seq).padStart(4, "0");
};

CounterSchema.statics.getNextSequence = async function (
  optionsOrTenantId: NextSequenceOptions | Types.ObjectId | string,
  legacyName?: string,
  legacyPrefix?: string
): Promise<SequenceResult> {
  // Legacy fallback if called with (tenantId, name, prefix)
  if (typeof optionsOrTenantId === "string" || optionsOrTenantId instanceof Types.ObjectId) {
    const tenantId = optionsOrTenantId;
    const counter = await this.findOneAndUpdate(
      { tenantId, name: legacyName || "default" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const paddedSeq = String(counter.seq).padStart(4, "0");
    const num = `${legacyPrefix || legacyName || "SEQ"}-${paddedSeq}`;
    return { fullNumber: num, shortNumber: num, seq: counter.seq };
  }

  const { tenantId, type, date, session } = optionsOrTenantId;
  let tenantCode = optionsOrTenantId.tenantCode;

  // Resolve tenantCode if not provided
  if (!tenantCode) {
    const tenant = await mongoose
      .model("Tenant")
      .findById(tenantId)
      .select("tenantCode")
      .session(session || null)
      .lean();
    tenantCode = (tenant as { tenantCode?: string } | null)?.tenantCode || "0001";
  }

  // Map type to short code
  const typeCode =
    SEQUENCE_TYPE_CODES[type as SequenceType] || (type as string).toUpperCase();

  // Calculate YYMM based on provided date or current date
  const targetDate = date ? new Date(date) : new Date();
  const yy = String(targetDate.getFullYear()).slice(-2);
  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const yymm = `${yy}${mm}`;

  const counterKey = `${typeCode}_${yymm}`;

  const counter = await this.findOneAndUpdate(
    { tenantId: new Types.ObjectId(tenantId.toString()), name: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );

  const paddedSeq = String(counter.seq).padStart(4, "0");
  const shortNumber = `${typeCode}-${yymm}-${paddedSeq}`;
  const fullNumber = `${tenantCode}-${shortNumber}`;

  return { fullNumber, shortNumber, seq: counter.seq };
};

export const Counter = (mongoose.models.Counter ||
  mongoose.model<ICounter, ICounterModel>(
    "Counter",
    CounterSchema
  )) as ICounterModel;

export default Counter;
