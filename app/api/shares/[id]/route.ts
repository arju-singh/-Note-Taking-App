import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId, json } from "@/lib/http";

// Permanently delete a share link (owner only). Cascades its view logs.
export async function DELETE(
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

  const rows = await query<{ id: string }>(
    `DELETE FROM share_links WHERE id = $1 AND creator_id = $2 RETURNING id`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return json({ id: rows[0].id, deleted: true });
}
