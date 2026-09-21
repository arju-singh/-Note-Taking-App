import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { query, type NoteRow } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";

export default async function HomePage() {
  // The layout already redirected anonymous visitors.
  const user = (await getCurrentUser())!;

  const notes = await query<NoteRow & { link_count: number }>(
    `SELECT n.*, COUNT(s.id)::int AS link_count
       FROM notes n
       LEFT JOIN share_links s ON s.note_id = n.id
      WHERE n.author_id = $1
      GROUP BY n.id
      ORDER BY n.created_at DESC`,
    [user.id]
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your notes</h1>
        <Link href="/notes/new">
          <Button>+ New note</Button>
        </Link>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[var(--muted)]">You don’t have any notes yet.</p>
            <Link href="/notes/new" className="mt-4 inline-block">
              <Button>Create your first note</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`}>
              <Card className="transition-colors hover:border-[var(--ring)]">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone="primary">
                    {n.link_count} link{n.link_count === 1 ? "" : "s"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
