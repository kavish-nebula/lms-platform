import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { ApiError, body, handle, ok } from "@/server/http";
import { aiConfigured } from "@/server/ai/llm";
import { getCreatorDraft } from "@/server/content-creator";
import { listBlueprints, processBlueprint, startBlueprint, StartBlueprint } from "@/server/creator-blueprints";

export const maxDuration = 420;
type Context = { params: Promise<{ id: string }> };
export const GET = handle(async (_req: Request, { params }: Context) => ok({ runs: await listBlueprints((await getSessionUser()).id, (await params).id), configured: aiConfigured() }));
export const POST = handle(async (req: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id } = await params;
  await getCreatorDraft(user.id, id);
  const input = await body(req, StartBlueprint);
  if (!aiConfigured()) throw new ApiError(503, "ai_unavailable", "Configure the server AI service before generating a blueprint. Your SME input remains saved.");
  const { run, token } = await startBlueprint(user.id, id, input.revision);
  if (token) after(() => processBlueprint(run.id, token));
  return ok({ run }, run.status === "running" ? 202 : 200);
});
