import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { extractUserIdFromRequest } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { logAPIRequest } from "@/lib/api/logging";
import { checkRateLimit, getRateLimitKey } from "@/lib/api/rateLimit";
import {
    handleIdempotency,
    generateIdempotencyKey,
    storeIdempotentResponse,
} from "@/lib/api/idempotency";
import connectToDatabase from "@/lib/mongodb/connect";
import { Project } from "@/models/Project";
import { Doc } from "@/models/Document";
import { creditCredits, debitCredits } from "@/lib/credits";

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// POST /api/v1/projects/{id}/files - Upload a file
export async function POST(req: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    const { id } = await params;

    try {
        // Extract and validate user
        const userId = await extractUserIdFromRequest(req);
        if (!userId) {
            logAPIRequest(req, 401, Date.now() - startTime, undefined, "Unauthorized");
            return errorResponse("UNAUTHORIZED", undefined, 401);
        }

        // Check idempotency
        const idempotencyResult = await handleIdempotency(req, userId);
        if (idempotencyResult) {
            logAPIRequest(req, idempotencyResult.response.status, Date.now() - startTime, userId, "Idempotency replay");
            return idempotencyResult.response;
        }

        // Check rate limit
        const rateLimitKey = getRateLimitKey(req, userId);
        const rateLimit = checkRateLimit(rateLimitKey);
        if (!rateLimit.allowed) {
            logAPIRequest(req, 429, Date.now() - startTime, userId, "Rate limited");
            return errorResponse("RATE_LIMITED", undefined, 429);
        }

        await connectToDatabase();

        if (!mongoose.Types.ObjectId.isValid(id)) {
            logAPIRequest(req, 400, Date.now() - startTime, userId, "Invalid project ID");
            return errorResponse("BAD_REQUEST", "Invalid project ID format");
        }

        // Verify project ownership
        const project = await Project.findOne({
            _id: new mongoose.Types.ObjectId(id),
            userId: new mongoose.Types.ObjectId(userId),
        });

        if (!project) {
            logAPIRequest(req, 404, Date.now() - startTime, userId, "Project not found");
            return errorResponse("NOT_FOUND", "Project not found", 404);
        }

        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            logAPIRequest(req, 400, Date.now() - startTime, userId, "Missing file");
            return errorResponse("BAD_REQUEST", "file is required");
        }

        // Validate file
        if (file.size > MAX_FILE_SIZE) {
            logAPIRequest(
                req,
                400,
                Date.now() - startTime,
                userId,
                `File too large: ${file.size} > ${MAX_FILE_SIZE}`
            );
            return errorResponse("BAD_REQUEST", `File size exceeds maximum of 50MB`);
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            logAPIRequest(req, 400, Date.now() - startTime, userId, `Invalid file type: ${file.type}`);
            return errorResponse("BAD_REQUEST", "File type not supported");
        }

        const UPLOAD_FILE_COST = 20;
        try {
            await debitCredits(userId, UPLOAD_FILE_COST, "UPLOAD_FILE", undefined, {
                project_id: id,
                file_name: file.name,
            });
        } catch (err: any) {
            logAPIRequest(req, 402, Date.now() - startTime, userId, "Insufficient credits");
            return errorResponse("INSUFFICIENT_CREDITS", "Not enough credits to upload file", 402);
        }

        // Create document record
        const doc = new Doc({
            projectId: new mongoose.Types.ObjectId(id),
            userId: new mongoose.Types.ObjectId(userId),
            fileName: file.name,
            fileType: file.type,
        });

        try {
            await doc.save();
        } catch (saveError) {
            await creditCredits(userId, UPLOAD_FILE_COST, "REFUND_FILE_UPLOAD_FAILED", doc._id.toString(), {
                project_id: id,
                file_name: file.name,
            }).catch(() => undefined);
            throw saveError;
        }

        const responseData = {
            file_id: doc._id.toString(),
            name: doc.fileName,
            status: "processing",
            created_at: doc.createdAt,
        };

        const statusCode = 201;

        // Store for idempotency
        const idempotencyKey = generateIdempotencyKey(req);
        if (idempotencyKey) {
            storeIdempotentResponse(userId, idempotencyKey, { success: true, data: responseData }, statusCode);
        }

        // TODO: Trigger async processing (chunking, embedding, etc.)
        // triggerDocumentProcessing(doc._id);

        logAPIRequest(req, statusCode, Date.now() - startTime, userId);

        return successResponse(responseData, statusCode);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
        return errorResponse("INTERNAL_ERROR", message, 500);
    }
}

// GET /api/v1/projects/{id}/files - List files in a project
export async function GET(req: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    const { id } = await params;

    try {
        // Extract and validate user
        const userId = await extractUserIdFromRequest(req);
        if (!userId) {
            logAPIRequest(req, 401, Date.now() - startTime, undefined, "Unauthorized");
            return errorResponse("UNAUTHORIZED", undefined, 401);
        }

        // Check rate limit
        const rateLimitKey = getRateLimitKey(req, userId);
        const rateLimit = checkRateLimit(rateLimitKey);
        if (!rateLimit.allowed) {
            logAPIRequest(req, 429, Date.now() - startTime, userId, "Rate limited");
            return errorResponse("RATE_LIMITED", undefined, 429);
        }

        await connectToDatabase();

        if (!mongoose.Types.ObjectId.isValid(id)) {
            logAPIRequest(req, 400, Date.now() - startTime, userId, "Invalid project ID");
            return errorResponse("BAD_REQUEST", "Invalid project ID format");
        }

        // Verify project ownership
        const project = await Project.findOne({
            _id: new mongoose.Types.ObjectId(id),
            userId: new mongoose.Types.ObjectId(userId),
        });

        if (!project) {
            logAPIRequest(req, 404, Date.now() - startTime, userId, "Project not found");
            return errorResponse("NOT_FOUND", "Project not found", 404);
        }

        // Get query parameters
        const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
        const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "20"));
        const skip = (page - 1) * limit;

        const files = await Doc.find({
            projectId: new mongoose.Types.ObjectId(id),
            userId: new mongoose.Types.ObjectId(userId),
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Doc.countDocuments({
            projectId: new mongoose.Types.ObjectId(id),
            userId: new mongoose.Types.ObjectId(userId),
        });

        logAPIRequest(req, 200, Date.now() - startTime, userId);

        return successResponse({
            files: files.map((f) => ({
                file_id: f._id.toString(),
                name: f.fileName,
                type: f.fileType,
                created_at: f.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
        return errorResponse("INTERNAL_ERROR", message, 500);
    }
}
