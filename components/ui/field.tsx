import { Label } from "@/components/ui/input";

// Small labelled-field wrapper used across the auth and note forms.
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

// Inline error/notice banner.
export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const color =
    kind === "error"
      ? "border-[var(--danger)] text-[var(--danger)]"
      : kind === "success"
      ? "border-[var(--success)] text-[var(--success)]"
      : "border-[var(--border)] text-[var(--foreground)]";
  return (
    <div className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${color}`}>
      {children}
    </div>
  );
}
