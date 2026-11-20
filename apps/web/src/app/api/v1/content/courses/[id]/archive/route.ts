import { getSessionUser } from '@/server/auth';
import { body, handle, ok } from '@/server/http';
import { SetDraftArchive, setCreatorDraftArchived } from '@/server/content-creator';

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getSessionUser();
  return ok(await setCreatorDraftArchived(user.id, (await params).id, await body(req, SetDraftArchive)));
});
