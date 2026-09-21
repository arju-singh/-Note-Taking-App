import { NextRequest } from "next/server";
import { query, type UserRow } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";
import { json, badRequest, tooManyRequests } from "@/lib/http";
import {
  rateLimit,
  rateLimitKey,
  clearRateLimit,
  getClientIp,
} from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid email or password.");
  const { email, password } = parsed.data;

  // Throttle login attempts per IP to slow credential stuffing. With no proxy
  // headers the bucket falls back to the submitted email, so one client can't
  // lock every other user out of signing in.
  const ip = getClientIp(req);
  const bucket = rateLimitKey("login", ip, email.toLowerCase());
  const rl = rateLimit(bucket, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return tooManyRequests(
      `Too many attempts. Try again in ${rl.retryAfterSec}s.`,
      rl.retryAfterSec
    );
  }

  const rows = await query<UserRow>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = rows[0];

  // Same generic error whether the email exists or not (no user enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return badRequest("Invalid email or password.");
  }

  // Successful sign-in: release the throttle so an active user is never
  // locked out by their own legitimate logins.
  clearRateLimit(bucket);
  await createSession(user.id);
  return json({ user: { id: user.id, email: user.email } });
}
