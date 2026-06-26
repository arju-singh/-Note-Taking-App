"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input, Textarea, Label, Select } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "./ui/card";
import { CopyField } from "./CopyField";

type ShareType = "ONE_TIME" | "TIME_BASED";
type AccessType = "PUBLIC" | "PASSWORD_PROTECTED";

interface CreatedResult {
  noteId: string;
  url: string;
  accessKey: string | null;
  shareType: ShareType;
  accessType: AccessType;
}

// Default expiry: 1 hour from now, formatted for <input type="datetime-local">.
function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function NewNoteForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shareType, setShareType] = useState<ShareType>("ONE_TIME");
  const [accessType, setAccessType] = useState<AccessType>("PUBLIC");
  const [expiresAt, setExpiresAt] = useState(defaultExpiryLocal());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        shareType,
        accessType,
        expiresAt:
          shareType === "TIME_BASED" ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create note");
      return;
    }
    setResult({
      noteId: data.note.id,
      url: data.shareLink.url,
      accessKey: data.accessKey,
      shareType,
      accessType,
    });
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Share link created <span>✅</span>
          </CardTitle>
          <CardDescription>
            <Badge tone="primary">
              {result.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
            </Badge>{" "}
            <Badge tone={result.accessType === "PUBLIC" ? "neutral" : "warning"}>
              {result.accessType === "PUBLIC" ? "Public" : "Password-protected"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField label="Share link" value={result.url} />
          {result.accessKey && (
            <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3">
              <CopyField label="Access key (shown only once!)" value={result.accessKey} />
              <p className="mt-2 text-xs text-amber-700">
                Save this key now — it is hashed in the database and cannot be
                shown again. Share it with the recipient separately from the link.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={`/notes/${result.noteId}`}>
              <Button variant="secondary">Manage this note</Button>
            </Link>
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Open share link ↗</Button>
            </a>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setTitle("");
                setContent("");
              }}
            >
              Create another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New note</CardTitle>
        <CardDescription>
          A secure share link is generated as soon as you create the note.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting notes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" required value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note…" rows={6} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shareType">Share type</Label>
              <Select id="shareType" value={shareType} onChange={(e) => setShareType(e.target.value as ShareType)}>
                <option value="ONE_TIME">One-time (expires after first view)</option>
                <option value="TIME_BASED">Time-based (expires at a set time)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accessType">Access type</Label>
              <Select id="accessType" value={accessType} onChange={(e) => setAccessType(e.target.value as AccessType)}>
                <option value="PUBLIC">Public (no password)</option>
                <option value="PASSWORD_PROTECTED">Password-protected (auto key)</option>
              </Select>
            </div>
          </div>

          {shareType === "TIME_BASED" && (
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
            </div>
          )}

          {accessType === "PASSWORD_PROTECTED" && (
            <p className="text-xs text-[var(--muted)]">
              A random access key will be generated automatically and shown once
              after creation.
            </p>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create note & generate link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
