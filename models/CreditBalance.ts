import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICreditBalance extends Document {
  userId: mongoose.Types.ObjectId;
  creditsBalance: number;
  updatedAt: Date;
}

const CreditBalanceSchema: Schema<ICreditBalance> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  creditsBalance: { type: Number, required: true, default: 10000, min: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export const CreditBalance: Model<ICreditBalance> =
  mongoose.models.CreditBalance || mongoose.model<ICreditBalance>("CreditBalance", CreditBalanceSchema);
