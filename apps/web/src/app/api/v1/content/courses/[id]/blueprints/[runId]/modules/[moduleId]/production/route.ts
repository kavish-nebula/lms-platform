import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { ApiError, body, handle, ok } from "@/server/http";
import { productionState, startProduction, processProduction, saveProduction, StartProduction, SaveProduction } from "@/server/module-production";

export const maxDuration = 900;
type Context = { params: Promise<{ id: string; runId: string; moduleId: string }> };
export const GET = handle(async (_req: Request, { params }: Context) => { const p = await params; return ok(await productionState((await getSessionUser()).id, p.id, p.runId, p.moduleId)); });
export const POST = handle(async (req: Request, { params }: Context) => {
  const user = await getSessionUser(); const p = await params; const input = await body(req, StartProduction);
  const state = await productionState(user.id, p.id, p.runId, p.moduleId);
  if (!state.eligible) throw new ApiError(409, 'approval_required', state.reason);
  if (!state.configured) throw new ApiError(503, 'ai_unavailable', 'The server AI service is not configured.');
  const result = await startProduction(user, p.id, p.runId, p.moduleId, input.approvalId, input.unitKey);
  if (result.token) after(() => processProduction(result.id, result.token!, user.id));
  return ok({ jobId: result.id }, result.token ? 202 : 200);
});
export const PATCH = handle(async (req: Request, { params }: Context) => { const user = await getSessionUser(); const p = await params; return ok(await saveProduction(user, p.id, p.runId, p.moduleId, await body(req, SaveProduction))); });
