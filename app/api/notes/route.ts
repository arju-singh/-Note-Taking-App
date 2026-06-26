import { NextRequest } from "next/server";
import { withTransaction, query, type NoteRow } from "@/lib/db";
import { requireUserId, json, badRequest } from "@/lib/http";
import { createNoteSchema } from "@/lib/validation";
import { createShareLink } from "@/lib/createShare";
import { shareUrl } from "@/lib/url";

// Create a note and its first share link atomically.
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return res as Response;
  }

  const body = await req.json().catch(() => null);
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { title, content, shareType, accessType, expiresAt } = parsed.data;

  const result = await withTransaction(async (client) => {
    const noteRes = await client.query<NoteRow>(
      `INSERT INTO notes (title, content, author_id) VALUES ($1, $2, $3) RETURNING *`,
      [title, content, userId]
    );
    const note = noteRes.rows[0];
    const share = await createShareLink(client, {
      noteId: note.id,
      creatorId: userId,
      config: { shareType, accessType, expiresAt },
    });
    return { note, share };
  });

  return json(
    {
      note: { id: result.note.id, title: result.note.title },
      shareLink: {
        token: result.share.link.token,
        url: shareUrl(result.share.link.token),
      },
      // Plaintext key shown exactly once.
      accessKey: result.share.accessKey,
    },
    201
  );
}

// List the current user's notes.
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return res as Response;
  }

  const notes = await query<NoteRow & { link_count: number }>(
    `SELECT n.*, COUNT(s.id)::int AS link_count
       FROM notes n
       LEFT JOIN share_links s ON s.note_id = n.id
      WHERE n.author_id = $1
      GROUP BY n.id
      ORDER BY n.created_at DESC`,
    [userId]
  );

  return json({
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      createdAt: n.created_at,
      linkCount: n.link_count,
    })),
  });
}
