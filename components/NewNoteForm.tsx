"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input, Textarea, Label } from "./ui/input";
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

interface CreatedResult {
  noteId: string;
  url: string;
  accessKey: string | null;
  shareType: ShareType;
  accessType: AccessType;
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

    const expiry = shareType === "TIME_BASED" ? toIsoOrNull(expiresAt) : null;
    if (shareType === "TIME_BASED" && !expiry) {
      setError("Enter a valid expiry date and time.");
      return;
    }

    setLoading(true);
    let res: Response;
    try {
      res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, shareType, accessType, expiresAt: expiry }),
      });
    } catch {
      setLoading(false);
      setError("Network error — could not reach the server.");
      return;
    }
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
          {result.accessKey && <AccessKeyNotice value={result.accessKey} />}
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

          <ShareFields
            shareType={shareType}
            accessType={accessType}
            expiresAt={expiresAt}
            onShareType={setShareType}
            onAccessType={setAccessType}
            onExpiresAt={setExpiresAt}
          />

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create note & generate link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
