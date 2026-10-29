import { getSessionUser } from '@/server/auth';
import { handle, body, ok } from '@/server/http';
import { setDeliveryStructure, SetDeliveryStructure } from '@/server/content-creator';
export const PATCH = handle(async (request: Request, context: { params: Promise<{ id: string }> }) => ok({ course: await setDeliveryStructure((await getSessionUser()).id, (await context.params).id, await body(request, SetDeliveryStructure)) }));
