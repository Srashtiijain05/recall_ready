import { NextRequest } from "next/server";
import { validateAPIKey, generateJWTToken } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { logAPIRequest } from "@/lib/api/logging";

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        const body = await req.json();
        const { api_key } = body;

        if (!api_key) {
            logAPIRequest(req, 400, Date.now() - startTime, undefined, "Missing api_key");
            return errorResponse("BAD_REQUEST", "api_key is required");
        }

        // Validate API key
        const userId = await validateAPIKey(api_key);
        if (!userId) {
            logAPIRequest(req, 401, Date.now() - startTime, undefined, "Invalid API key");
            return errorResponse("UNAUTHORIZED", "Invalid API key", 401);
        }

        // Generate JWT token (1 hour expiry)
        const token = await generateJWTToken(userId, 3600);

        logAPIRequest(req, 200, Date.now() - startTime, userId);

        return successResponse({
            token,
            expires_in: 3600,
            token_type: "Bearer",
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
        return errorResponse("INTERNAL_ERROR", message, 500);
    }
}
