import { getSessionUser } from '@/server/auth';
import { handle } from '@/server/http';
import { serveSourceMedia } from '@/server/source-media';
export const runtime = 'nodejs';
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) => { const { id, assetId } = await params; return serveSourceMedia((await getSessionUser()).id, id, assetId, req); });
export const HEAD = GET;
