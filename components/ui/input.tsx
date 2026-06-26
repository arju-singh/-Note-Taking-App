import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm",
      "placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-28 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm",
      "placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium text-[var(--foreground)]", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
