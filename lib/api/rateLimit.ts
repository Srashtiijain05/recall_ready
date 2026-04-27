import { NextRequest } from "next/server";

const rateLimitStore = new Map<string, { count: number; expiresAt: number }>();

export function getRateLimitKey(req: NextRequest, userId: string) {
  return `${userId}:${req.nextUrl.pathname}`;
}

export function checkRateLimit(
  key: string,
  options: { windowMs?: number; maxRequests?: number } = {}
) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 120;

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || record.expiresAt <= now) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}
