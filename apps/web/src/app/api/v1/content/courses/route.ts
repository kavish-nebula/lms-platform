import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { CreateDraft, createCreatorDraft, listCreatorDrafts } from "@/server/content-creator";

export const GET = handle(async () => ok({ courses: await listCreatorDrafts((await getSessionUser()).id) }));
export const POST = handle(async (req: Request) => {
  const user = await getSessionUser();
  return ok({ course: await createCreatorDraft(user.id, await body(req, CreateDraft)) }, 201);
});
