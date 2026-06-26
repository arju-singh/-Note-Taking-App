"use client";
import { useState } from "react";
import { Button } from "./ui/button";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard errors (e.g. insecure context)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      {label && (
        <div className="mb-1 text-xs font-medium text-[var(--muted)]">{label}</div>
      )}
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-zinc-50 px-3 py-2 text-sm">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
