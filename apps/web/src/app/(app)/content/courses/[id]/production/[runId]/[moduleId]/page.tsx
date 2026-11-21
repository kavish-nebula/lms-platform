import { notFound } from "next/navigation";
import Link from 'next/link';
import { ProductionWorkspace } from "@/components/content/production-workspace";
import { getSessionUser } from "@/server/auth";
import { getReviewRun } from "@/server/creator-sme-review";
import { productionState } from "@/server/module-production";
import { ApiError } from "@/server/http";
import { Stage4VideoPanel } from '@/components/content/stage4-video-panel';
import { stage4VideoPanelState } from '@/server/stage4-visual-source';

export default async function ProductionPage({ params }: { params: Promise<{ id: string; runId: string; moduleId: string }> }) {
  const user = await getSessionUser(); const p = await params; let run, state;
  try { run = await getReviewRun(user.id, p.id, p.runId); state = await productionState(user.id, p.id, p.runId, p.moduleId); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  const video = state.eligible ? await stage4VideoPanelState(user.id,p.id,p.moduleId,p.runId) : null;
  return <div className="space-y-7">{video && (video.unavailableReason ? <section aria-label="Remotion source setup" className="space-y-3 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">Remotion source setup</h2><p className="text-sm text-ink-muted">{video.unavailableReason}</p><p className="text-sm">Saved lesson scripts and narration remain available below. New videos require current approved sources.</p><div className="flex flex-wrap gap-5 text-sm"><Link className="text-brand-ink underline" href={`/content/courses/${p.id}`}>Review module sources</Link><Link className="text-brand-ink underline" href={`/content/courses/${p.id}/blueprint/review/${p.runId}`}>Open Stage 3 review</Link></div></section> : <Stage4VideoPanel courseId={p.id} moduleId={p.moduleId} targets={video.targets.map(({videoId,title,kind})=>({videoId,title,kind}))}/>)}<ProductionWorkspace run={run} moduleId={p.moduleId} initialState={state} /></div>;
}
