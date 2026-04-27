import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDoc extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: string;
  createdAt: Date;
}

const DocSchema: Schema<IDoc> = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Doc: Model<IDoc> = mongoose.models.Doc || mongoose.model<IDoc>("Doc", DocSchema);
