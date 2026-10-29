import { notFound } from "next/navigation";
import { ProductionWorkspace } from "@/components/content/production-workspace";
import { getSessionUser } from "@/server/auth";
import { getReviewRun } from "@/server/creator-sme-review";
import { productionState } from "@/server/module-production";
import { ApiError } from "@/server/http";

export default async function ProductionPage({ params }: { params: Promise<{ id: string; runId: string; moduleId: string }> }) {
  const user = await getSessionUser(); const p = await params; let run, state;
  try { run = await getReviewRun(user.id, p.id, p.runId); state = await productionState(user.id, p.id, p.runId, p.moduleId); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  return <ProductionWorkspace run={run} moduleId={p.moduleId} initialState={state} />;
}
