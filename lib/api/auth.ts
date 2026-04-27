import { NextRequest } from "next/server";
import { signToken, verifyToken } from "@/lib/auth";

const API_KEY_MAP = new Map<string, string>();

(process.env.API_KEYS || "")
  .split(",")
  .map((pair) => pair.trim())
  .filter(Boolean)
  .forEach((pair) => {
    const [key, userId] = pair.split(":");
    if (key && userId) {
      API_KEY_MAP.set(key.trim(), userId.trim());
    }
  });

export async function validateAPIKey(apiKey: string) {
  if (!apiKey) {
    return null;
  }

  return API_KEY_MAP.get(apiKey) || null;
}

export async function generateJWTToken(userId: string, expiresInSeconds = 3600) {
  return signToken({ userId, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
}

export async function extractUserIdFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : req.cookies.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  return (payload as { userId?: string; id?: string }).userId || (payload as { id?: string }).id || null;
}
