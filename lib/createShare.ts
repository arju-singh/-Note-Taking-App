import "server-only";
import type { PoolClient } from "pg";
import { hashPassword } from "./auth";
import { generateToken, generateAccessKey } from "./share";
import type { ShareConfigInput } from "./validation";
import type { ShareLinkRow } from "./db";

export interface CreatedShare {
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
