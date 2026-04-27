import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb/connect";
import { Doc } from "@/models/Document";
import { Project } from "@/models/Project";
import { UserSettings } from "@/models/UserSettings";
import { processAndStoreDocument } from "@/lib/rag/process";
import { creditCredits, debitCredits, getCreditBalance } from "@/lib/credits";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_for_development";

async function verifyAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
        throw new Error("Unauthorized");
    }

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(JWT_SECRET)
        );
        return payload;
    } catch (error) {
        throw new Error("Invalid token");
    }
}

export async function POST(req: NextRequest) {
    try {
        // Verify authentication
        const session = await verifyAuth();

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const projectId = formData.get("projectId") as string;
        const embeddingModel =
            (formData.get("embeddingModel") as string) || "gemini-embedding-001";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!projectId) {
            return NextResponse.json(
                { error: "No project ID provided" },
                { status: 400 }
            );
        }

        await connectToDatabase();

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
        }

        const project = await Project.findOne({
            _id: new mongoose.Types.ObjectId(projectId),
            userId: new mongoose.Types.ObjectId(String(session.id)),
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Create a temporary document ID for embedding processing
        const tempDocId = new mongoose.Types.ObjectId().toString();

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadCredits = 20;
        const embeddingCredits = Math.max(1, Math.ceil(buffer.length / (1024 * 100)));
        const currentBalance = await getCreditBalance(String(session.id));

        if (currentBalance < uploadCredits + embeddingCredits) {
            return NextResponse.json(
                { error: "Insufficient credits for file upload and embedding" },
                { status: 402 }
            );
        }

        try {
            await debitCredits(String(session.id), uploadCredits, "UPLOAD_FILE", tempDocId, {
                project_id: projectId,
                file_name: file.name,
                file_size: buffer.length,
            });
        } catch (err: any) {
            return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
        }

        // Get user settings for credentials
        const settings = await UserSettings.findOne({
            userId: new mongoose.Types.ObjectId(String(session.id)),
        }).lean();

        if (
            !settings ||
            !settings.geminiApiKey ||
            !settings.supabaseUrl ||
            !settings.supabaseServiceKey
        ) {
            return NextResponse.json(
                { error: "Missing required API keys in Settings" },
                { status: 400 }
            );
        }

        const { geminiApiKey, supabaseUrl, supabaseServiceKey } = settings;

        // Process embeddings FIRST - if this fails, MongoDB document won't be created
        try {
            await processAndStoreDocument(
                buffer,
                file.name,
                file.type || "text/plain",
                projectId,
                session.id as string,
                tempDocId,
                geminiApiKey,
                supabaseUrl,
                supabaseServiceKey,
                embeddingModel
            );
        } catch (err: any) {
            return NextResponse.json(
                { error: `Failed to process embeddings: ${err.message}` },
                { status: 500 }
            );
        }

        try {
            await debitCredits(String(session.id), embeddingCredits, "FILE_EMBEDDING", tempDocId, {
                project_id: projectId,
                file_name: file.name,
                file_size: buffer.length,
            });
        } catch (err: any) {
            await creditCredits(String(session.id), uploadCredits, "REFUND_UPLOAD_DUE_TO_EMBED_FAILURE", tempDocId, {
                project_id: projectId,
            }).catch(() => undefined);
            return NextResponse.json({ error: "Insufficient credits for embedding" }, { status: 402 });
        }

        // Only save document reference in MongoDB AFTER embeddings succeed
        try {
            const document = await Doc.create({
                projectId: new mongoose.Types.ObjectId(projectId),
                userId: new mongoose.Types.ObjectId(String(session.id)),
                fileName: file.name,
                fileType: file.type || "text/plain",
            });

            return NextResponse.json({
                success: true,
                documentId: document._id.toString(),
            });
        } catch (err: any) {
            await creditCredits(String(session.id), embeddingCredits, "REFUND_EMBEDDING_FAILED", tempDocId, {
                project_id: projectId,
                file_name: file.name,
            }).catch(() => undefined);

            return NextResponse.json(
                { error: `Failed to save document metadata: ${err.message}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Upload API error:", error);

        if (error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (error.message === "Invalid token") {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

// Set max duration for processing large files

export const maxDuration = 300; // 5 minutes timeout for large files
