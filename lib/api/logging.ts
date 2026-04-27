import { NextRequest } from "next/server";

export function logAPIRequest(
  req: NextRequest,
  status: number,
  durationMs: number,
  userId?: string,
  message?: string
) {
  console.log(
    `[API] ${req.method} ${req.url} status=${status} user=${userId || "anonymous"} duration=${durationMs}ms ${message || ""}`
  );
}
