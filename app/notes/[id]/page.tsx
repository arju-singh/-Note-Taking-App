import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { NoteManager } from "@/components/NoteManager";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <NoteManager noteId={id} />
      </main>
    </>
  );
}
