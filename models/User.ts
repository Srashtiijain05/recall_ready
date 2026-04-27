import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  googleId?: string;
  email: string;
  name: string;
  picture?: string;
  password?: string;
  createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  googleId: { type: String, sparse: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: { type: String },
  password: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
