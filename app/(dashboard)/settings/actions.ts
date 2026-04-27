"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/connect";
import { UserSettings } from "@/models/UserSettings";
import { getSession } from "@/lib/auth";

export async function saveSettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const geminiApiKey = formData.get("geminiApiKey") as string;
  const supabaseUrl = formData.get("supabaseUrl") as string;
  const supabaseServiceKey = formData.get("supabaseServiceKey") as string;

  await connectToDatabase();

  await UserSettings.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(String(session.id)) },
    {
      geminiApiKey: geminiApiKey || undefined,
      supabaseUrl: supabaseUrl || undefined,
      supabaseServiceKey: supabaseServiceKey || undefined,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  revalidatePath("/settings");
  revalidatePath("/projects");
  
  return { success: true };
}
