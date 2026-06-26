import { NextRequest } from "next/server";
import { query, type UserRow } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";
import { json, badRequest } from "@/lib/http";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return badRequest("Too many attempts, try again later.");

  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { email, password } = parsed.data;

  const existing = await query<UserRow>(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  if (existing.length > 0) {
    return badRequest("An account with that email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
    [email.toLowerCase(), passwordHash]
  );

  await createSession(rows[0].id);
  return json({ user: { id: rows[0].id, email: rows[0].email } }, 201);
}
