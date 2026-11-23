import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { adaptedModule } from "@/server/adapt/service";
import { retryModuleHook } from '@/server/adapt/live';

type Ctx = { params: Promise<{ courseId: string; moduleId: string }> };
export const POST = handle(async (_req:Request,{params}:Ctx)=>{
  const {courseId,moduleId}=await params,user=await getSessionUser();
  await retryModuleHook(user,courseId,moduleId);
  return ok({adapted:await adaptedModule(user,courseId,moduleId,after,{},'hook')});
});

/**
 * GET: the pieces of this module rewritten for the learner (hook, concept
 * videos, worked examples) that are ready, with their narration clips, and
 * the state of the rest. Opening a module that isn't rewritten yet starts it
 * in the background; the player keeps the authored pieces until each is ready.
 */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { courseId, moduleId } = await params;
  const piece = new URL(req.url).searchParams.get("piece");
  return ok({ adapted: await adaptedModule(await getSessionUser(), courseId, moduleId, after, {}, piece === "hook" || piece === "worked" ? piece : undefined) });
});
