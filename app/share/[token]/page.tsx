"use client";
import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/components/ui/card";

type Status = "ACTIVE" | "REVOKED" | "EXPIRED_TIME" | "USED";
interface Meta {
  found: boolean;
  accessType?: "PUBLIC" | "PASSWORD_PROTECTED";
  shareType?: "ONE_TIME" | "TIME_BASED";
  status?: Status;
  active?: boolean;
  message?: string | null;
}

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<{ title: string; content: string } | null>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/share/${token}/meta`, { cache: "no-store" });
    const data = await res.json().catch(() => ({ found: false }));
    setMeta(data);
  }, [token]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  async function attemptView(withPassword?: string) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/share/${token}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: withPassword ?? null }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      setNote(data.note);
      setViewCount(data.viewCount);
      return;
    }

    switch (data.reason) {
      case "WRONG_PASSWORD":
        setError("Incorrect access key. Please try again.");
        break;
      case "PASSWORD_REQUIRED":
        setError("This link requires an access key.");
        break;
      case "RATE_LIMITED":
        setError(
          `Too many attempts. Try again in ${data.retryAfterSec ?? 60}s.`
        );
        break;
      case "USED":
        setError(null);
        setMeta((m) => ({ ...(m ?? { found: true }), active: false, status: "USED", message: "This one-time link has already been used." }));
        break;
      case "EXPIRED":
        setMeta((m) => ({ ...(m ?? { found: true }), active: false, status: "EXPIRED_TIME", message: "This share link has expired." }));
        break;
      case "REVOKED":
        setMeta((m) => ({ ...(m ?? { found: true }), active: false, status: "REVOKED", message: "This share link has been revoked." }));
        break;
      default:
        setError("This share link is invalid.");
    }
  }

  // ---- render states ----
  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-12">
        <div className="w-full">{children}</div>
      </main>
    );
  }

  if (!meta) {
    return (
      <Shell>
        <p className="text-center text-[var(--muted)]">Loading…</p>
      </Shell>
    );
  }

  // Successfully viewed note
  if (note) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>{note.title}</CardTitle>
            <CardDescription>
              Shared via Peacock · {viewCount} total view{viewCount === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{note.content}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Invalid token
  if (!meta.found) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mb-2 text-3xl">🔗</div>
            <p className="font-medium">Invalid share link</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              This link doesn’t exist or was mistyped.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Found but not active (revoked / expired / used)
  if (!meta.active) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mb-2 text-3xl">⛔</div>
            <p className="font-medium">Link unavailable</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {meta.message ?? "This link is no longer available."}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Active + password protected → ask for key
  if (meta.accessType === "PASSWORD_PROTECTED") {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🔒 Protected note</CardTitle>
            <CardDescription>
              Enter the access key to view this note.
              {meta.shareType === "ONE_TIME" && (
                <>
                  {" "}
                  <Badge tone="primary">One-time</Badge>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                attemptView(password);
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="key">Access key</Label>
                <Input
                  id="key"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                />
              </div>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <Button type="submit" disabled={loading || !password}>
                {loading ? "Unlocking…" : "Unlock note"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Active + public → one click to view (counts the view)
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>You’ve received a note</CardTitle>
          <CardDescription>
            {meta.shareType === "ONE_TIME" ? (
              <>
                <Badge tone="warning">One-time link</Badge> — it expires after you
                open it.
              </>
            ) : (
              "Click below to view the shared note."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
          <Button onClick={() => attemptView()} disabled={loading}>
            {loading ? "Opening…" : "View note"}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}
