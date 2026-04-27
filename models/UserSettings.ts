import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  geminiApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  updatedAt: Date;
}

const UserSettingsSchema: Schema<IUserSettings> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  geminiApiKey: { type: String },
  supabaseUrl: { type: String },
  supabaseAnonKey: { type: String },
  supabaseServiceKey: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

export const UserSettings: Model<IUserSettings> = mongoose.models.UserSettings || mongoose.model<IUserSettings>("UserSettings", UserSettingsSchema);
