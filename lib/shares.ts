import "server-only";
import { customAlphabet } from "nanoid";
import type { PoolClient } from "pg";
import { hashPassword } from "./auth";
import type { ShareLinkRow } from "./db";
import type { ShareConfigInput } from "./validation";

// Everything about a share link: its token, its public URL, its lifecycle
// status, and how one gets created.

// ---- tokens & keys ----
// URL-safe, unguessable token for the public share URL (/share/[token]).
// 24 chars from a 64-symbol alphabet ≈ 144 bits of entropy.
const tokenAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const makeToken = customAlphabet(tokenAlphabet, 24);

// Human-friendly access key for password-protected links.
// Excludes ambiguous characters (0/O, 1/I/l) for readability.
// 16 chars from a 32-symbol alphabet ≈ 80 bits of entropy.
const keyAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeKey = customAlphabet(keyAlphabet, 16);

function generateToken(): string {
  return makeToken();
}

// Returns e.g. "K7QF-9XME-RT2D-WP4N" — grouped for readability.
function generateAccessKey(): string {
  const raw = makeKey();
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

// ---- lifecycle status ----
type ShareStatus =
  | "ACTIVE"
  | "REVOKED"
  | "EXPIRED_TIME"
  | "USED"; // one-time link already consumed

interface ShareLinkLike {
  shareType: "ONE_TIME" | "TIME_BASED";
  revoked: boolean;
  usedAt: Date | null;
  expiresAt: Date | null;
}

// Pure status check used for display and as a fast pre-check before the
// atomic DB update. The DB update is still the source of truth for races.
export function computeStatus(link: ShareLinkLike, now = new Date()): ShareStatus {
  if (link.revoked) return "REVOKED";
  if (link.shareType === "ONE_TIME" && link.usedAt) return "USED";
  if (
    link.shareType === "TIME_BASED" &&
    link.expiresAt &&
    link.expiresAt.getTime() <= now.getTime()
  ) {
    return "EXPIRED_TIME";
  }
  return "ACTIVE";
}

export function statusMessage(status: ShareStatus): string {
  switch (status) {
    case "REVOKED":
      return "This share link has been revoked by its owner.";
    case "EXPIRED_TIME":
      return "This share link has expired.";
    case "USED":
      return "This one-time link has already been used.";
    default:
      return "This link is active.";
  }
}

// ---- public URLs ----
function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function shareUrl(token: string): string {
  return `${appBaseUrl()}/share/${token}`;
}

// ---- creation ----
interface CreatedShare {
  link: ShareLinkRow;
  // Plaintext access key — returned ONCE, never stored in plaintext.
  accessKey: string | null;
}

/**
 * Insert a share link for a note inside an existing transaction/client.
 * Generates a unique token; for PASSWORD_PROTECTED links generates a one-time
 * access key and stores only its bcrypt hash.
 */
export async function createShareLink(
  client: PoolClient,
  params: {
    noteId: string;
    creatorId: string;
    config: ShareConfigInput;
  }
): Promise<CreatedShare> {
  const { noteId, creatorId, config } = params;

  let accessKey: string | null = null;
  let passwordHash: string | null = null;
  if (config.accessType === "PASSWORD_PROTECTED") {
    accessKey = generateAccessKey();
    passwordHash = await hashPassword(accessKey);
  }

  const expiresAt =
    config.shareType === "TIME_BASED" && config.expiresAt
      ? new Date(config.expiresAt)
      : null;

  // Retry a couple of times on the (astronomically unlikely) token collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateToken();
    try {
      const { rows } = await client.query<ShareLinkRow>(
        `INSERT INTO share_links
           (token, note_id, creator_id, share_type, access_type, password_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          token,
          noteId,
          creatorId,
          config.shareType,
          config.accessType,
          passwordHash,
          expiresAt,
        ]
      );
      return { link: rows[0], accessKey };
    } catch (err: unknown) {
      // 23505 = unique_violation (token clash) → try a new token
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "23505" &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique share token");
}
