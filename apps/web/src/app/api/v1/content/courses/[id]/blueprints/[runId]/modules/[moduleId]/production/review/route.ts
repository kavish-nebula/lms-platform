import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { ScriptDecision } from "@/lib/module-production";
import { reviewScripts } from "@/server/module-production";
type Context = { params: Promise<{ id: string; runId: string; moduleId: string }> };
export const POST = handle(async (req: Request, { params }: Context) => { const user = await getSessionUser(); const p = await params; return ok(await reviewScripts(user, p.id, p.runId, p.moduleId, await body(req, ScriptDecision)), 201); });
