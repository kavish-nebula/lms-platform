import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { getSmeReview, saveSmeReview } from "@/server/creator-sme-review";
import { SmeDecision } from "@/lib/sme-review";

type Context = { params: Promise<{ id: string; runId: string }> };
export const GET = handle(async (_req: Request, { params }: Context) => {
  const { id, runId } = await params;
  return ok(await getSmeReview((await getSessionUser()).id, id, runId));
});
export const POST = handle(async (req: Request, { params }: Context) => {
  const user = await getSessionUser(); const { id, runId } = await params;
  return ok(await saveSmeReview(user, id, runId, await body(req, SmeDecision)), 201);
});
