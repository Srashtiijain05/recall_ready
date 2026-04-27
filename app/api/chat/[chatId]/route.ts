import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb/connect";
import { Chat } from "@/models/Chat";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { chatId } = await params;

        await connectToDatabase();

        const chat = await Chat.findOne({
            _id: new mongoose.Types.ObjectId(chatId),
            userId: new mongoose.Types.ObjectId(String(session.id)),
        }).lean();

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        return NextResponse.json({
            messages: chat.messages || [],
            title: chat.title,
        });
    } catch (error: any) {
        console.error("Get chat error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
