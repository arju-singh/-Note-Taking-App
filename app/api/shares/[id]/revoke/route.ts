import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId, json } from "@/lib/http";

// Force-invalidate a share link (owner only). Idempotent.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return res as Response;
  }
  const { id } = await params;

  // Only the creator can revoke; UPDATE ... RETURNING confirms ownership.
  const rows = await query<{ id: string; revoked: boolean }>(
    `UPDATE share_links
        SET revoked = TRUE
      WHERE id = $1 AND creator_id = $2
      RETURNING id, revoked`,
    [id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return json({ id: rows[0].id, revoked: rows[0].revoked });
}
