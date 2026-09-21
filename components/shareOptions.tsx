"use client";
import { Input, Label, Select } from "./ui/input";
import { CopyField } from "./CopyField";

export type ShareType = "ONE_TIME" | "TIME_BASED";
export type AccessType = "PUBLIC" | "PASSWORD_PROTECTED";

// `new Date("")` is Invalid Date and .toISOString() throws — validate first.
export function toIsoOrNull(localValue: string): string | null {
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Default expiry: 1 hour from now, formatted for <input type="datetime-local">.
export function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// The share-type / access-type / expiry controls, shared by the new-note form
// and the add-another-link form.
export function ShareFields({
  shareType,
  accessType,
  expiresAt,
  onShareType,
  onAccessType,
  onExpiresAt,
}: {
  shareType: ShareType;
  accessType: AccessType;
  expiresAt: string;
  onShareType: (v: ShareType) => void;
  onAccessType: (v: AccessType) => void;
  onExpiresAt: (v: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="shareType">Share type</Label>
          <Select
            id="shareType"
            value={shareType}
            onChange={(e) => onShareType(e.target.value as ShareType)}
          >
            <option value="ONE_TIME">One-time (expires after first view)</option>
            <option value="TIME_BASED">Time-based (expires at a set time)</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accessType">Access type</Label>
          <Select
            id="accessType"
            value={accessType}
            onChange={(e) => onAccessType(e.target.value as AccessType)}
          >
            <option value="PUBLIC">Public (no password)</option>
            <option value="PASSWORD_PROTECTED">Password-protected (auto key)</option>
          </Select>
        </div>
      </div>

      {shareType === "TIME_BASED" && (
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">Expires at</Label>
          <Input
            id="expiresAt"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => onExpiresAt(e.target.value)}
            required
          />
        </div>
      )}

      {accessType === "PASSWORD_PROTECTED" && (
        <p className="text-xs text-[var(--muted)]">
          A random access key will be generated automatically and shown once
          after creation.
        </p>
      )}
    </>
  );
}

// The generated key is shown exactly once — it is only stored hashed.
export function AccessKeyNotice({ value }: { value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3">
      <CopyField label="Access key (shown only once!)" value={value} />
      <p className="mt-2 text-xs text-amber-700">
        Save this key now — it is hashed in the database and cannot be shown
        again. Share it with the recipient separately from the link.
      </p>
    </div>
  );
}
