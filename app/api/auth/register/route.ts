import { NextRequest } from "next/server";
import { query, type UserRow } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";
import { json, badRequest, tooManyRequests } from "@/lib/http";
import { rateLimit, rateLimitKey, getClientIp } from "@/lib/ratelimit";

const EMAIL_TAKEN = "An account with that email already exists.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { email, password } = parsed.data;

  const ip = getClientIp(req);
  const rl = rateLimit(
    rateLimitKey("register", ip, email.toLowerCase()),
    10,
    60 * 60 * 1000
  );
  if (!rl.allowed) {
    return tooManyRequests("Too many attempts, try again later.", rl.retryAfterSec);
  }

  const existing = await query<UserRow>(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  if (existing.length > 0) {
    return badRequest(EMAIL_TAKEN);
  }

  const passwordHash = await hashPassword(password);
  let rows: Pick<UserRow, "id" | "email">[];
  try {
    rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email.toLowerCase(), passwordHash]
    );
  } catch (err: unknown) {
    // 23505 = unique_violation: two concurrent signups for the same address
    // both passed the check above. Report it like any other taken email.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return badRequest(EMAIL_TAKEN);
    }
    throw err;
  }

  await createSession(rows[0].id);
  return json({ user: { id: rows[0].id, email: rows[0].email } }, 201);
}
