import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { logAPIRequest } from "@/lib/api/logging";
import { creditCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const adminKey = req.headers.get("x-admin-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      logAPIRequest(req, 401, Date.now() - startTime, undefined, "Admin unauthorized");
      return errorResponse("UNAUTHORIZED", "Admin API key is required", 401);
    }

    const body = await req.json();
    const { user_id, amount, reason } = body;

    if (!user_id || typeof user_id !== "string") {
      return errorResponse("BAD_REQUEST", "user_id is required and must be a string", 400);
    }

    if (typeof amount !== "number" || amount <= 0) {
      return errorResponse("BAD_REQUEST", "amount is required and must be a positive number", 400);
    }

    if (!reason || typeof reason !== "string") {
      return errorResponse("BAD_REQUEST", "reason is required and must be a string", 400);
    }

    const balance = await creditCredits(user_id, amount, "ADMIN_TOP_UP", undefined, {
      reason,
    });

    logAPIRequest(req, 200, Date.now() - startTime, undefined, `Added ${amount} credits to ${user_id}`);
    return successResponse({ user_id, balance }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logAPIRequest(req, 500, Date.now() - startTime, undefined, message);
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
