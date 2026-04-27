import { NextRequest, NextResponse } from "next/server";

const idempotencyStore = new Map<string, { response: NextResponse; createdAt: number }>();

export function generateIdempotencyKey(req: NextRequest) {
  return req.headers.get("idempotency-key") || null;
}

export async function handleIdempotency(req: NextRequest, userId: string) {
  const key = generateIdempotencyKey(req);
  if (!key) {
    return null;
  }

  const compositeKey = `${userId}:${key}`;
  const existing = idempotencyStore.get(compositeKey);
  if (existing) {
    return { response: existing.response };
  }

  return null;
}

export function storeIdempotentResponse(
  userId: string,
  key: string,
  responseData: unknown,
  statusCode: number
) {
  const compositeKey = `${userId}:${key}`;
  const response = NextResponse.json(responseData, { status: statusCode });
  idempotencyStore.set(compositeKey, { response, createdAt: Date.now() });
}
