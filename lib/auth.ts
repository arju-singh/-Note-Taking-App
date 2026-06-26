import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query, type UserRow } from "./db";

const COOKIE_NAME = "peacock_session";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set it in .env)");
  }
  return new TextEncoder().encode(s);
}

// ---- password hashing ----
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---- session JWT (httpOnly cookie) ----
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Fetch the current authenticated user (or null).
export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const rows = await query<Pick<UserRow, "id" | "email" | "created_at">>(
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [userId]
  );
  return rows[0] ?? null;
}
