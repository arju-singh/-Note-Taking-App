import { NextRequest, NextResponse } from "next/server";
import { accessNote } from "@/lib/access";
import { getClientIp, hashIp } from "@/lib/ratelimit";

// Attempt to view a note behind a share link. This is the ONLY endpoint that
// increments the view count and consumes one-time links — and it does so
// atomically (see lib/access.ts).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const password =
    typeof body?.password === "string" ? body.password : null;

  const ipHash = hashIp(getClientIp(req));
  const outcome = await accessNote({ token, password, ipHash });

  if (outcome.ok) {
    return NextResponse.json({
      ok: true,
      note: outcome.note,
      viewCount: outcome.viewCount,
    });
  }

  // Map failure reasons to HTTP status codes.
  const statusByReason: Record<string, number> = {
    NOT_FOUND: 404,
    REVOKED: 410,
    EXPIRED: 410,
    USED: 410,
    PASSWORD_REQUIRED: 401,
    WRONG_PASSWORD: 401,
    RATE_LIMITED: 429,
  };

  return NextResponse.json(
    {
      ok: false,
      reason: outcome.reason,
      retryAfterSec: outcome.retryAfterSec,
      accessType: outcome.meta?.accessType,
    },
    { status: statusByReason[outcome.reason] ?? 400 }
  );
}
