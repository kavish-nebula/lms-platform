import { getCourse } from "@/data";
import { getSessionUser } from "@/server/auth";
import { handle, ApiError } from "@/server/http";
import { jobsFor, liveEnabled, publicJob, queueModule, requireEnrollment, currentLearnerContextKey, matchesLearnerContext } from "@/server/adapt/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request, ctx: { params: Promise<{ courseId: string; moduleId: string }> }) => {
  const { courseId, moduleId } = await ctx.params;
  if (!liveEnabled(courseId)) throw new ApiError(409, "disabled", "Live adaptation is disabled.");
  const user = await getSessionUser();
  const e = await requireEnrollment(user, courseId);
  await queueModule(user, courseId, moduleId);
  const encoder = new TextEncoder();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Map<string, string>();
  const stream = new ReadableStream({
    start(controller) {
      const close = () => { stopped = true; clearTimeout(timer); try { controller.close(); } catch {} };
      req.signal.addEventListener("abort", close, { once: true });
      // Send a fresh snapshot on reconnect; IDs let clients deduplicate. This also recovers missed ready events.
      const poll = async () => {
        if (stopped) return;
        try {
          const rows = await jobsFor(e.id, moduleId);
          const course = await getCourse(courseId);
          const current = course?.authoredRevisionId ? await currentLearnerContextKey(user.id, courseId) : null;
          for (const r of rows) {
            if (current && !matchesLearnerContext(r.input.context, current)) continue;
            const stamp = `${r.status}:${r.updatedAt.getTime()}`;
            if (seen.get(r.id) === stamp) continue;
            seen.set(r.id, stamp);
            if (stopped) return;
            controller.enqueue(encoder.encode(`id: ${r.id}:${r.updatedAt.getTime()}\nevent: revision\ndata: ${JSON.stringify(publicJob(r))}\n\n`));
          }
          if (!stopped) controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch { close(); }
        if (!stopped) timer = setTimeout(poll, 1000);
      };
      void poll();
    },
    cancel() { stopped = true; clearTimeout(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
});
