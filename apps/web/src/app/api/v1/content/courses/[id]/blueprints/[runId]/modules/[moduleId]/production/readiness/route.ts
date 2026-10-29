import { getSessionUser } from '@/server/auth';
import { handle, ok } from '@/server/http';
import { longformReadiness } from '@/server/longform-readiness';
export const GET = handle(async (_request: Request, context: { params: Promise<{ id: string; runId: string; moduleId: string }> }) => { const p = await context.params; return ok(await longformReadiness((await getSessionUser()).id, p.id, p.runId, p.moduleId)); });
