import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId, json, asAuthResponse } from "@/lib/http";

// Owner-only edits to one share link. Ownership is enforced by the
// `creator_id` predicate: no matching row means 404, not a silent no-op.

// Revoke (force-invalidate). Idempotent.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return asAuthResponse(res);
  }
  const { id } = await params;

  const rows = await query<{ id: string; revoked: boolean }>(
    `UPDATE share_links SET revoked = TRUE
      WHERE id = $1 AND creator_id = $2
      RETURNING id, revoked`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return json({ id: rows[0].id, revoked: rows[0].revoked });
}

// Permanently delete a share link. Cascades its view logs.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return asAuthResponse(res);
  }
  const { id } = await params;

  const rows = await query<{ id: string }>(
    `DELETE FROM share_links WHERE id = $1 AND creator_id = $2 RETURNING id`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return json({ id: rows[0].id, deleted: true });
}
