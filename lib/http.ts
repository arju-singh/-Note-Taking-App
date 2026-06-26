import { NextResponse } from "next/server";
import { getSessionUserId } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

// Returns the current user id or throws a Response to short-circuit.
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw unauthorized();
  return userId;
}
