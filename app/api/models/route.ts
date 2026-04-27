import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { UserSettings } from "@/models/UserSettings";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const settings = await UserSettings.findOne({ userId: new mongoose.Types.ObjectId(String(session.id)) }).lean();
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key missing in Settings" },
        { status: 400 }
      );
    }

    // Correct endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.geminiApiKey}`
    );

    const data = await response.json();


    const embeddingModels =
      data.models
        ?.map((m: any) => ({
          name: m.name.replace("models/", ""),
          supportedMethods: m.supportedGenerationMethods || [],
          displayName: m.displayName || m.name
        }))
        .filter((m: any) => m.supportedMethods.includes("embedContent")) || [];

    return NextResponse.json({ models: embeddingModels });

  } catch (error: any) {
    console.error("List models error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}