"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

// Login and registration differ only in copy and endpoint.
const MODES = {
  login: {
    endpoint: "/api/auth/login",
    title: "Welcome back",
    description: "Log in to create and manage your notes.",
    submit: "Log in",
    pending: "Logging in…",
    failure: "Login failed",
    passwordAutoComplete: "current-password",
    minPasswordLength: undefined as number | undefined,
    hint: null as string | null,
    footer: { text: "No account?", href: "/register", link: "Register" },
  },
  register: {
    endpoint: "/api/auth/register",
    title: "Create your account",
    description: "Start sharing notes with secure links.",
    submit: "Create account",
    pending: "Creating…",
    failure: "Registration failed",
    passwordAutoComplete: "new-password",
    minPasswordLength: 8,
    hint: "At least 8 characters.",
    footer: { text: "Already have an account?", href: "/login", link: "Log in" },
  },
} as const;

export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const copy = MODES[mode];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let res: Response;
    try {
      res = await fetch(copy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setLoading(false);
      setError("Network error — could not reach the server.");
      return;
    }
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? copy.failure);
      return;
    }
    router.push("/notes/new");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={copy.passwordAutoComplete}
                required
                minLength={copy.minPasswordLength}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {copy.hint && <p className="text-xs text-[var(--muted)]">{copy.hint}</p>}
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? copy.pending : copy.submit}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            {copy.footer.text}{" "}
            <Link href={copy.footer.href} className="font-medium text-[var(--primary)]">
              {copy.footer.link}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
