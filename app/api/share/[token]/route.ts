import { NextRequest, NextResponse } from "next/server";
import { query, type ShareLinkRow } from "@/lib/db";
import { accessNote } from "@/lib/access";
import { computeStatus, statusMessage } from "@/lib/shares";
import { getClientIp, hashIp } from "@/lib/ratelimit";

// GET: lightweight, read-only lookup so the /share page can render the right
// UI. Does NOT increment the view count and does NOT consume one-time links.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const rows = await query<ShareLinkRow>(
    "SELECT * FROM share_links WHERE token = $1",
    [token]
  );
  const link = rows[0];
  if (!link) {
    return NextResponse.json(
      { found: false, message: "This share link is invalid." },
      { status: 404 }
    );
  }

  const status = computeStatus({
    shareType: link.share_type,
    revoked: link.revoked,
    usedAt: link.used_at,
    expiresAt: link.expires_at,
  });

  return NextResponse.json({
    found: true,
    accessType: link.access_type,
    shareType: link.share_type,
    status,
    active: status === "ACTIVE",
    message: status === "ACTIVE" ? null : statusMessage(status),
  });
}

// POST: attempt to view the note. This is the ONLY entry point that increments
// the view count and consumes one-time links — atomically (see lib/access.ts).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : null;

  const outcome = await accessNote({
    token,
    password,
    ipHash: hashIp(getClientIp(req)),
  });

  if (outcome.ok) {
    return NextResponse.json({
      ok: true,
      note: outcome.note,
      viewCount: outcome.viewCount,
    });
  }

  const statusByReason: Record<string, number> = {
    NOT_FOUND: 404,
    REVOKED: 410,
    EXPIRED: 410,
    USED: 410,
    PASSWORD_REQUIRED: 401,
    WRONG_PASSWORD: 401,
    RATE_LIMITED: 429,
  };
  const status = statusByReason[outcome.reason] ?? 400;

  return NextResponse.json(
    {
      ok: false,
      reason: outcome.reason,
      retryAfterSec: outcome.retryAfterSec,
      accessType: outcome.meta?.accessType,
    },
    {
      status,
      headers:
        status === 429 && outcome.retryAfterSec
          ? { "Retry-After": String(outcome.retryAfterSec) }
          : undefined,
    }
  );
}
