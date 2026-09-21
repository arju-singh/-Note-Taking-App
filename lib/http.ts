import { NextResponse } from "next/server";
import { getSessionUserId } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

// 429 with a machine-readable Retry-After, for throttled endpoints.
export function tooManyRequests(message: string, retryAfterSec: number) {
  return NextResponse.json(
    { error: message, retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

// Returns the current user id or throws a Response to short-circuit.
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw unauthorized();
  return userId;
}

// Re-throw anything that is not the short-circuit Response, so a genuine
// failure surfaces as a 500 instead of being returned as a bogus "response".
export function asAuthResponse(thrown: unknown): Response {
  if (thrown instanceof Response) return thrown;
  throw thrown;
}
