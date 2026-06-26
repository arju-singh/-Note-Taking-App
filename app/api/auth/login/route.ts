import { NextRequest } from "next/server";
import { query, type UserRow } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";
import { json, badRequest } from "@/lib/http";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Throttle login attempts per IP to slow credential stuffing.
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return badRequest(
      `Too many attempts. Try again in ${rl.retryAfterSec}s.`
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid email or password.");

  const { email, password } = parsed.data;
  const rows = await query<UserRow>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  const user = rows[0];

  // Same generic error whether the email exists or not (no user enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return badRequest("Invalid email or password.");
  }

  await createSession(user.id);
  return json({ user: { id: user.id, email: user.email } });
}
