import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-2", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-[var(--muted)]", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "danger" | "warning" | "primary";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-700",
    success: "bg-green-100 text-green-700",
    danger: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    primary: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
