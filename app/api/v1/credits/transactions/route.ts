import { NextRequest } from "next/server";
import { extractUserIdFromRequest } from "@/lib/api/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { logAPIRequest } from "@/lib/api/logging";
import { getRateLimitKey, checkRateLimit } from "@/lib/api/rateLimit";
import { getTransactions } from "@/lib/credits";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = await extractUserIdFromRequest(req);
    if (!userId) {
      logAPIRequest(req, 401, Date.now() - startTime, undefined, "Unauthorized");
      return errorResponse("UNAUTHORIZED", undefined, 401);
    }

    const rateLimitKey = getRateLimitKey(req, userId);
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      logAPIRequest(req, 429, Date.now() - startTime, userId, "Rate limited");
      return errorResponse("RATE_LIMITED", undefined, 429);
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10));

    const result = await getTransactions(userId, page, limit);

    logAPIRequest(req, 200, Date.now() - startTime, userId);
    return successResponse(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
