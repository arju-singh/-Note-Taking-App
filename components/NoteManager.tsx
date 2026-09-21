"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "./ui/card";
import { CopyField } from "./CopyField";
import {
  AccessKeyNotice,
  ShareFields,
  defaultExpiryLocal,
  toIsoOrNull,
  type AccessType,
  type ShareType,
} from "./shareOptions";

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

export function NoteManager({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [note, setNote] = useState<NoteDto | null>(null);
  const [links, setLinks] = useState<LinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // new-link form state
  const [shareType, setShareType] = useState<ShareType>("ONE_TIME");
  const [accessType, setAccessType] = useState<AccessType>("PUBLIC");
  const [expiresAt, setExpiresAt] = useState(defaultExpiryLocal());
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { cache: "no-store" });
      if (res.status === 404 || res.status === 401) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load this note. Please retry.");
        return;
      }
      const data = await res.json();
      setNote(data.note);
      setLinks(data.links);
      setError(null);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Every mutation goes through here so a failed request is reported instead
  // of silently leaving the UI showing stale state.
  async function mutate(
    input: RequestInfo,
    init: RequestInit,
    failureMessage: string
  ): Promise<Response | null> {
    setError(null);
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? failureMessage);
        return null;
      }
      return res;
    } catch {
      setError("Network error — could not reach the server.");
      return null;
    }
  }

  async function revoke(id: string) {
    await mutate(
      `/api/shares/${id}`,
      { method: "PATCH" },
      "Could not revoke this link."
    );
    load();
  }

  async function deleteLink(id: string) {
    if (!window.confirm("Delete this share link permanently? This cannot be undone."))
      return;
    await mutate(
      `/api/shares/${id}`,
      { method: "DELETE" },
      "Could not delete this link."
    );
    load();
  }

  async function deleteNote() {
    if (
      !window.confirm(
        "Delete this note and ALL of its share links permanently? This cannot be undone."
      )
    )
      return;
    const res = await mutate(
      `/api/notes/${noteId}`,
      { method: "DELETE" },
      "Could not delete this note."
    );
    if (!res) return;
    router.push("/");
    router.refresh();
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setNewKey(null);

    const expiry = shareType === "TIME_BASED" ? toIsoOrNull(expiresAt) : null;
    if (shareType === "TIME_BASED" && !expiry) {
      setError("Enter a valid expiry date and time.");
      return;
    }

    setCreating(true);
    const res = await mutate(
      `/api/notes/${noteId}/shares`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareType, accessType, expiresAt: expiry }),
      },
      "Could not create the share link."
    );
    setCreating(false);
    if (!res) return;

    const data = await res.json().catch(() => ({}));
    if (data.accessKey) setNewKey(data.accessKey);
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
      {error && (
        <p className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
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
            <ShareFields
              shareType={shareType}
              accessType={accessType}
              expiresAt={expiresAt}
              onShareType={setShareType}
              onAccessType={setAccessType}
              onExpiresAt={setExpiresAt}
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Generate link"}
            </Button>
          </form>
          {newKey && (
            <div className="mt-4">
              <AccessKeyNotice value={newKey} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
