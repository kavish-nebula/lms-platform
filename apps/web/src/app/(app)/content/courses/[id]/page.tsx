import { listBlueprints } from '@/server/creator-blueprints';
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
  const runs = await listBlueprints((await getSessionUser()).id, draft.id);
  const last = runs.find(r => !r.outdated && r.status === 'ready')?.output?.modules.at(-1)?.id;
  return <CourseBriefEditor key={draft.id} draft={draft} lastModule={last} />;
}
