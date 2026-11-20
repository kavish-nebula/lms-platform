import {getSessionUser} from '@/server/auth';
import {handle,ok} from '@/server/http';
import {releasedVisual} from '@/server/released-visual';
export const GET=handle(async(request:Request,{params}:{params:Promise<{courseId:string;revisionId:string}>})=>{const {courseId,revisionId}=await params;const result=await releasedVisual((await getSessionUser()).id,courseId,revisionId,request);return result instanceof Response?result:ok(result);});
