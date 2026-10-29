import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { UpdateDraft, getCreatorDraft, updateCreatorDraft } from "@/server/content-creator";

type Context = { params: Promise<{ id: string }> };
export const GET = handle(async (_req: Request, { params }: Context) => ok({ course: await getCreatorDraft((await getSessionUser()).id, (await params).id) }));
export const PATCH = handle(async (req: Request, { params }: Context) => {
  const user = await getSessionUser();
  return ok({ course: await updateCreatorDraft(user.id, (await params).id, await body(req, UpdateDraft)) });
});
