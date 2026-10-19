import * as z from "zod/v4";
import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { publicJob, queueSlide } from "@/server/adapt/live";
type Context = { params: Promise<{ courseId: string; moduleId: string }> };
export const POST = handle(async (req: Request, ctx: Context) => {
  const { courseId, moduleId } = await ctx.params;
  const input = await body(req, z.object({ videoId: z.string().min(1).max(120), slide: z.number().int().min(0).max(200), trigger: z.enum(["initial", "simplify", "example", "wrong_answer"]), requestId: z.uuid(), baseRevision: z.uuid().optional() }));
  const user = await getSessionUser();
  const row = await queueSlide(user, courseId, moduleId, input.videoId, input.slide, input.trigger, input.requestId, input.baseRevision);
  return ok({ job: publicJob(row) }, 202);
});
