import { notFound } from "next/navigation";
import { BlueprintWorkspace } from "@/components/content/blueprint-workspace";
import { getSessionUser } from "@/server/auth";
import { getCreatorDraft } from "@/server/content-creator";
import { listBlueprints } from "@/server/creator-blueprints";
import { aiConfigured } from "@/server/ai/llm";
import { ApiError } from "@/server/http";

export default async function BlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = (await getSessionUser()).id; const { id } = await params;
  let draft, runs;
  try { draft = await getCreatorDraft(ownerId, id); runs = await listBlueprints(ownerId, id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <BlueprintWorkspace draft={draft} initialRuns={runs} configured={aiConfigured()} />;
}
