"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Select, Label, Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "./ui/card";
import { CopyField } from "./CopyField";

type ShareType = "ONE_TIME" | "TIME_BASED";
type AccessType = "PUBLIC" | "PASSWORD_PROTECTED";
type Status = "ACTIVE" | "REVOKED" | "EXPIRED_TIME" | "USED";

interface LinkDto {
  id: string;
  token: string;
  url: string;
  shareType: ShareType;
  accessType: AccessType;
  expiresAt: string | null;
  revoked: boolean;
  usedAt: string | null;
  viewCount: number;
  createdAt: string;
  status: Status;
}
interface NoteDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const statusTone: Record<Status, "success" | "danger" | "warning" | "neutral"> = {
  ACTIVE: "success",
  REVOKED: "danger",
  EXPIRED_TIME: "warning",
  USED: "neutral",
};
const statusLabel: Record<Status, string> = {
  ACTIVE: "Active",
  REVOKED: "Revoked",
  EXPIRED_TIME: "Expired",
  USED: "Used",
};

function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NoteManager({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [note, setNote] = useState<NoteDto | null>(null);
  const [links, setLinks] = useState<LinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // new-link form state
  const [shareType, setShareType] = useState<ShareType>("ONE_TIME");
  const [accessType, setAccessType] = useState<AccessType>("PUBLIC");
  const [expiresAt, setExpiresAt] = useState(defaultExpiryLocal());
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}`, { cache: "no-store" });
    if (res.status === 404 || res.status === 401) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setNote(data.note);
    setLinks(data.links);
    setLoading(false);
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string) {
    await fetch(`/api/shares/${id}/revoke`, { method: "POST" });
    load();
  }

  async function deleteLink(id: string) {
    if (!window.confirm("Delete this share link permanently? This cannot be undone."))
      return;
    await fetch(`/api/shares/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteNote() {
    if (
      !window.confirm(
        "Delete this note and ALL of its share links permanently? This cannot be undone."
      )
    )
      return;
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setNewKey(null);
    const res = await fetch(`/api/notes/${noteId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareType,
        accessType,
        expiresAt: shareType === "TIME_BASED" ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setCreating(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.accessKey) setNewKey(data.accessKey);
    load();
  }

  if (loading) return <p className="text-[var(--muted)]">Loading…</p>;
  if (notFound)
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-[var(--muted)]">Note not found.</p>
          <Link href="/notes/new" className="mt-3 inline-block">
            <Button variant="outline">Create a note</Button>
          </Link>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{note?.title}</CardTitle>
              <CardDescription>
                Created {note && new Date(note.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            <Button variant="danger" size="sm" onClick={deleteNote}>
              Delete note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{note?.content}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Share links ({links.length})
        </h2>
        <div className="space-y-3">
          {links.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>
                  <Badge tone="primary">
                    {l.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
                  </Badge>
                  <Badge tone={l.accessType === "PUBLIC" ? "neutral" : "warning"}>
                    {l.accessType === "PUBLIC" ? "Public" : "Password"}
                  </Badge>
                  <span className="ml-auto text-sm font-medium">
                    👁 {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                  </span>
                </div>
                <CopyField value={l.url} />
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>
                    {l.expiresAt
                      ? `Expires ${new Date(l.expiresAt).toLocaleString()}`
                      : l.shareType === "ONE_TIME"
                      ? l.usedAt
                        ? `Used ${new Date(l.usedAt).toLocaleString()}`
                        : "Not used yet"
                      : "No expiry"}
                  </span>
                  <div className="flex items-center gap-2">
                    {l.status === "ACTIVE" && (
                      <Button variant="outline" size="sm" onClick={() => revoke(l.id)}>
                        Revoke
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => deleteLink(l.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add another share link</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addLink} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st">Share type</Label>
                <Select id="st" value={shareType} onChange={(e) => setShareType(e.target.value as ShareType)}>
                  <option value="ONE_TIME">One-time</option>
                  <option value="TIME_BASED">Time-based</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at">Access type</Label>
                <Select id="at" value={accessType} onChange={(e) => setAccessType(e.target.value as AccessType)}>
                  <option value="PUBLIC">Public</option>
                  <option value="PASSWORD_PROTECTED">Password-protected</option>
                </Select>
              </div>
            </div>
            {shareType === "TIME_BASED" && (
              <div className="space-y-1.5">
                <Label htmlFor="ea">Expires at</Label>
                <Input id="ea" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
              </div>
            )}
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Generate link"}
            </Button>
          </form>
          {newKey && (
            <div className="mt-4 rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3">
              <CopyField label="Access key (shown only once!)" value={newKey} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
