import { NextResponse } from "next/server";
import { query, type ShareLinkRow } from "@/lib/db";
import { computeStatus, statusMessage } from "@/lib/share";

// Lightweight, read-only lookup so the /share page can render the right UI.
// Does NOT increment the view count and does NOT consume one-time links.
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
