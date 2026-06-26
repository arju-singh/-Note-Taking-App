import { query, type NoteRow, type ShareLinkRow } from "@/lib/db";
import { requireUserId, json } from "@/lib/http";
import { NextResponse } from "next/server";
import { computeStatus } from "@/lib/share";
import { shareUrl } from "@/lib/url";

// Owner-only: fetch a note with all of its share links (status + view counts).
export async function GET(
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

  const notes = await query<NoteRow>(
    "SELECT * FROM notes WHERE id = $1 AND author_id = $2",
    [id, userId]
  );
  const note = notes[0];
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const links = await query<ShareLinkRow>(
    "SELECT * FROM share_links WHERE note_id = $1 ORDER BY created_at DESC",
    [id]
  );

  return json({
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.created_at,
    },
    links: links.map((l) => ({
      id: l.id,
      token: l.token,
      url: shareUrl(l.token),
      shareType: l.share_type,
      accessType: l.access_type,
      expiresAt: l.expires_at,
      revoked: l.revoked,
      usedAt: l.used_at,
      viewCount: l.view_count,
      createdAt: l.created_at,
      status: computeStatus({
        shareType: l.share_type,
        revoked: l.revoked,
        usedAt: l.used_at,
        expiresAt: l.expires_at,
      }),
    })),
  });
}

// Owner-only: permanently delete a note and all its share links + view logs.
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
    `DELETE FROM notes WHERE id = $1 AND author_id = $2 RETURNING id`,
    [id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  return json({ id: rows[0].id, deleted: true });
}
