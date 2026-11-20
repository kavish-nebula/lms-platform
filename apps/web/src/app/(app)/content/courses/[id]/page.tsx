import { notFound } from "next/navigation";
import { CourseBriefEditor } from "@/components/content/course-brief-editor";
import { getSessionUser } from "@/server/auth";
import { getCreatorDraft } from "@/server/content-creator";
import { ApiError } from "@/server/http";

export default async function CourseBriefPage({ params }: { params: Promise<{ id: string }> }) {
  let draft;
  try {
    draft = await getCreatorDraft((await getSessionUser()).id, (await params).id);
  } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <CourseBriefEditor key={draft.id} draft={draft} />;
}
