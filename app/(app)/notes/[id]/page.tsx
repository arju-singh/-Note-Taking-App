import { NoteManager } from "@/components/NoteManager";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoteManager noteId={id} />;
}
