import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICreditTransaction extends Document {
  transactionId: string;
  userId: mongoose.Types.ObjectId;
  type: "credit" | "debit";
  amount: number;
  action: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const CreditTransactionSchema: Schema<ICreditTransaction> = new Schema({
  transactionId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true, min: 0 },
  action: { type: String, required: true },
  referenceId: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

CreditTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CreditTransaction: Model<ICreditTransaction> =
  mongoose.models.CreditTransaction || mongoose.model<ICreditTransaction>("CreditTransaction", CreditTransactionSchema);
