import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { NewNoteForm } from "@/components/NewNoteForm";

export default async function NewNotePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <NewNoteForm />
      </main>
    </>
  );
}
