import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function Navbar() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🦚</span> Peacock
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/notes/new" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                New note
              </Link>
              <span className="text-[var(--muted)] hidden sm:inline">{user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Login
              </Link>
              <Link href="/register" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
