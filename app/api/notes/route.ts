import { NextRequest } from "next/server";
import { withTransaction, type NoteRow } from "@/lib/db";
import { requireUserId, json, badRequest, asAuthResponse } from "@/lib/http";
import { createNoteSchema } from "@/lib/validation";
import { createShareLink } from "@/lib/shares";
import { shareUrl } from "@/lib/shares";

// Create a note and its first share link atomically.
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return asAuthResponse(res);
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
