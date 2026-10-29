import { notFound } from "next/navigation";
import { SmeReviewWorkspace } from "@/components/content/sme-review-workspace";
import { getSessionUser } from "@/server/auth";
import { getReviewRun, getSmeReview } from "@/server/creator-sme-review";
import { ApiError } from "@/server/http";

export default async function SmeReviewPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const user = await getSessionUser(); const { id, runId } = await params;
  let run, state;
  try { run = await getReviewRun(user.id, id, runId); state = await getSmeReview(user.id, id, runId); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <SmeReviewWorkspace key={run.id} run={run} initialState={state} />;
}
