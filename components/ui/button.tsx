import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
  secondary: "bg-zinc-900 text-white hover:bg-zinc-800",
  outline:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-zinc-50",
  ghost: "text-[var(--foreground)] hover:bg-zinc-100",
  danger: "bg-[var(--danger)] text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
