import { getSessionUser } from '@/server/auth';
import { handle } from '@/server/http';
import { serveConceptVideo } from '@/server/concept-videos';

export const runtime = 'nodejs';
type Context = { params: Promise<{ courseId: string; assetId: string }> };
export const GET = handle(async (req: Request, { params }: Context) => {
  const { courseId, assetId } = await params;
  return serveConceptVideo((await getSessionUser()).id, courseId, assetId, req);
});
export const HEAD = GET;
