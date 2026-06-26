import "server-only";
import { withTransaction } from "./db";
import { verifyPassword } from "./auth";
import type { ShareLinkRow, NoteRow } from "./db";

// Brute-force policy for password-protected links.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export type AccessOutcome =
  | { ok: true; note: { title: string; content: string }; viewCount: number }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "REVOKED"
        | "EXPIRED"
        | "USED"
        | "PASSWORD_REQUIRED"
        | "WRONG_PASSWORD"
        | "RATE_LIMITED";
      retryAfterSec?: number;
      // for PASSWORD_REQUIRED on a GET (link is valid, just needs a key)
      meta?: { accessType: "PUBLIC" | "PASSWORD_PROTECTED" };
    };

interface AccessInput {
  token: string;
  password?: string | null;
  ipHash?: string | null;
}

/**
 * Attempt to view a note behind a share link.
 *
 * Concurrency-safe: the entire decision (validity check, one-time consumption,
 * view-count increment, audit log) happens inside ONE transaction that takes a
 * `SELECT ... FOR UPDATE` row lock on the share_link. Two simultaneous requests
 * for the same one-time link are serialized by the lock; the first commits
 * `used_at` and wins, the second sees `used_at` set and loses.
 */
export async function accessNote(input: AccessInput): Promise<AccessOutcome> {
  const { token, password, ipHash } = input;

  return withTransaction(async (client) => {
    const now = new Date();

    // Lock the row for the duration of the transaction.
    const { rows } = await client.query<ShareLinkRow>(
      `SELECT * FROM share_links WHERE token = $1 FOR UPDATE`,
      [token]
    );
    const link = rows[0];
    if (!link) return { ok: false, reason: "NOT_FOUND" };

    // ---- lifecycle checks (these never increment the counter) ----
    if (link.revoked) return { ok: false, reason: "REVOKED" };

    if (link.share_type === "ONE_TIME" && link.used_at) {
      return { ok: false, reason: "USED" };
    }

    if (
      link.share_type === "TIME_BASED" &&
      link.expires_at &&
      link.expires_at.getTime() <= now.getTime()
    ) {
      return { ok: false, reason: "EXPIRED" };
    }

    // ---- password / access checks ----
    if (link.access_type === "PASSWORD_PROTECTED") {
      // brute-force lockout
      if (link.locked_until && link.locked_until.getTime() > now.getTime()) {
        return {
          ok: false,
          reason: "RATE_LIMITED",
          retryAfterSec: Math.ceil(
            (link.locked_until.getTime() - now.getTime()) / 1000
          ),
        };
      }

      if (!password) {
        return {
          ok: false,
          reason: "PASSWORD_REQUIRED",
          meta: { accessType: "PASSWORD_PROTECTED" },
        };
      }

      const valid =
        !!link.password_hash &&
        (await verifyPassword(password, link.password_hash));

      if (!valid) {
        // Wrong password → increment failed attempts, maybe lock. No view count.
        const newFailed = link.failed_attempts + 1;
        const lock =
          newFailed >= MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + LOCKOUT_MS)
            : null;
        await client.query(
          `UPDATE share_links
             SET failed_attempts = $2, locked_until = $3
           WHERE id = $1`,
          [link.id, lock ? 0 : newFailed, lock]
        );
        if (lock) {
          return {
            ok: false,
            reason: "RATE_LIMITED",
            retryAfterSec: Math.ceil(LOCKOUT_MS / 1000),
          };
        }
        return { ok: false, reason: "WRONG_PASSWORD" };
      }

      // Correct password → clear the throttle counters.
      if (link.failed_attempts !== 0 || link.locked_until) {
        await client.query(
          `UPDATE share_links SET failed_attempts = 0, locked_until = NULL WHERE id = $1`,
          [link.id]
        );
      }
    }

    // ---- SUCCESS: this is a counted view ----
    // For ONE_TIME links, stamp used_at now (within the same locked tx).
    const newViewCount = link.view_count + 1;
    await client.query(
      `UPDATE share_links
         SET view_count = $2,
             used_at = CASE WHEN share_type = 'ONE_TIME' AND used_at IS NULL
                            THEN now() ELSE used_at END
       WHERE id = $1`,
      [link.id, newViewCount]
    );

    await client.query(
      `INSERT INTO view_logs (share_link_id, ip_hash) VALUES ($1, $2)`,
      [link.id, ipHash ?? null]
    );

    const noteRows = await client.query<Pick<NoteRow, "title" | "content">>(
      `SELECT title, content FROM notes WHERE id = $1`,
      [link.note_id]
    );
    const note = noteRows.rows[0];

    return {
      ok: true,
      note: { title: note.title, content: note.content },
      viewCount: newViewCount,
    };
  });
}
