import { getSessionUser } from "@/server/auth";
import { after } from "next/server";
import { adaptFirstModule } from "@/server/adapt/service";
import { liveEnabled } from "@/server/adapt/live";
import { listEnrollments } from "@/server/repo";
import { body, handle, ok } from "@/server/http";
import { getProfile } from "@/server/repo";
import { finishProfile } from "@/server/profiling/service";
import { ProfileIn } from "@/server/validators";

const view = (p: NonNullable<Awaited<ReturnType<typeof getProfile>>>) => ({ answers: p.answers, needs: p.needs, derived: p.derived ?? null, at: p.updatedAt.toISOString() });

/** The profile answers, asked once ("About you") and reused by every course, with what the model worked out from a typed field. */
export const GET = handle(async () => {
  const p = await getProfile((await getSessionUser()).id);
  return ok({ profile: p ? view(p) : null });
});

export const PUT = handle(async (req: Request) => {
  const user = await getSessionUser();
  const { answers, needs } = await body(req, ProfileIn);
  // finishing "About you": the draft becomes the profile
  const profile = await finishProfile(user.id, { answers, needs });
  after(async () => {
    for (const enrollment of await listEnrollments(user.id)) {
      if (liveEnabled(enrollment.courseId)) await adaptFirstModule(user, enrollment.courseId, after).catch((err) => console.warn("[adapt] profile refresh", err instanceof Error ? err.name : "Error"));
    }
  });
  return ok({ profile: view(profile) });
});
