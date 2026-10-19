import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { requireEnrollment, summarize } from "@/server/adapt/live";
import { getModule } from "@/data";
import { ApiError } from "@/server/http";
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ courseId: string; moduleId: string }> }) => {
  const { courseId, moduleId } = await ctx.params;
  const e = await requireEnrollment(await getSessionUser(), courseId);
  if (!await getModule(courseId, moduleId)) throw new ApiError(404, "unknown_module", "Module not found.");
  const r = await summarize(e.id, moduleId);
  return ok({ version: r.version, summary: r.summary });
});
