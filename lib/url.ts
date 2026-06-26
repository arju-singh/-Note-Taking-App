// Build absolute share URLs from a token.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL          (explicit, recommended in production)
//   2. VERCEL_PROJECT_PRODUCTION_URL (stable prod URL on Vercel)
//   3. VERCEL_URL                    (per-deployment URL on Vercel)
//   4. http://localhost:3000         (local dev default)
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function shareUrl(token: string): string {
  return `${appBaseUrl()}/share/${token}`;
}
