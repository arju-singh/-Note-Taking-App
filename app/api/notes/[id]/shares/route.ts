import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireUserId, json, badRequest } from "@/lib/http";
import { shareConfigSchema } from "@/lib/validation";
import { createShareLink } from "@/lib/createShare";
import { shareUrl } from "@/lib/url";

// Create an ADDITIONAL share link for an existing (owned) note.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (res) {
    return res as Response;
  }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = shareConfigSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  try {
    const share = await withTransaction(async (client) => {
      // Verify ownership inside the tx.
      const owned = await client.query(
        "SELECT id FROM notes WHERE id = $1 AND author_id = $2",
        [id, userId]
      );
      if (owned.rowCount === 0) throw new Error("NOT_OWNER");

      return createShareLink(client, {
        noteId: id,
        creatorId: userId,
        config: parsed.data,
      });
    });

    return json(
      {
        shareLink: {
          token: share.link.token,
          url: shareUrl(share.link.token),
        },
        accessKey: share.accessKey,
      },
      201
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_OWNER") {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    throw e;
  }
}
