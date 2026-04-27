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
import { creditCredits, debitCredits } from "@/lib/credits";

// POST /api/v1/projects - Create a new project
export async function POST(req: NextRequest) {
    const startTime = Date.now();

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

        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            logAPIRequest(req, 400, Date.now() - startTime, userId, "Missing or invalid name");
            return errorResponse("BAD_REQUEST", "name is required and must be a non-empty string");
        }

        const PROJECT_CREATE_COST = 50;
        try {
            await debitCredits(userId, PROJECT_CREATE_COST, "CREATE_PROJECT", undefined, {
                project_name: name.trim(),
            });
        } catch (err: any) {
            logAPIRequest(req, 402, Date.now() - startTime, userId, "Insufficient credits");
            return errorResponse("INSUFFICIENT_CREDITS", "Not enough credits to create project", 402);
        }

        // Create project
        const project = new Project({
            userId: new mongoose.Types.ObjectId(userId),
            name: name.trim(),
        });

        try {
            await project.save();
        } catch (saveError) {
            await creditCredits(userId, PROJECT_CREATE_COST, "REFUND_CREATE_PROJECT", undefined, {
                project_name: name.trim(),
            }).catch(() => undefined);
            throw saveError;
        }

        const responseData = {
            id: project._id.toString(),
            name: project.name,
            created_at: project.createdAt,
        };

        const statusCode = 201;

        // Store for idempotency
        const idempotencyKey = generateIdempotencyKey(req);
        if (idempotencyKey) {
            storeIdempotentResponse(userId, idempotencyKey, { success: true, data: responseData }, statusCode);
        }

        logAPIRequest(req, statusCode, Date.now() - startTime, userId);

        return successResponse(responseData, statusCode);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
        return errorResponse("INTERNAL_ERROR", message, 500);
    }
}

// GET /api/v1/projects - List all projects for the user
export async function GET(req: NextRequest) {
    const startTime = Date.now();

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

        // Get query parameters
        const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
        const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "20"));
        const skip = (page - 1) * limit;

        const projects = await Project.find({
            userId: new mongoose.Types.ObjectId(userId),
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Project.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
        });

        logAPIRequest(req, 200, Date.now() - startTime, userId);

        return successResponse({
            projects: projects.map((p) => ({
                id: p._id.toString(),
                name: p.name,
                created_at: p.createdAt,
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
