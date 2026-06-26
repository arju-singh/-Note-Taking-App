import { customAlphabet } from "nanoid";

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

export function generateToken(): string {
  return makeToken();
}

// Returns e.g. "K7QF-9XME-RT2D-WP4N" — grouped for readability.
export function generateAccessKey(): string {
  const raw = makeKey();
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

export type ShareStatus =
  | "ACTIVE"
  | "REVOKED"
  | "EXPIRED_TIME"
  | "USED"; // one-time link already consumed

export interface ShareLinkLike {
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
