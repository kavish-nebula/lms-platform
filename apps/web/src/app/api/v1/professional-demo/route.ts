import {getSessionUser} from '@/server/auth';
import {body,handle,ok} from '@/server/http';
import {readWorkspace,workAction,WorkAction,requireProfessional} from '@/server/workplace/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handle(async()=>{requireProfessional();const user=await getSessionUser();return ok({workspace:await readWorkspace(user.id)});});
export const POST=handle(async(req:Request)=>{requireProfessional();const user=await getSessionUser();return ok(await workAction(user.id,await body(req,WorkAction)));});
