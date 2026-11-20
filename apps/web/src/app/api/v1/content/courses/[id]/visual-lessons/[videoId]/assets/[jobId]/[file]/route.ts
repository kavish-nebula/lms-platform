import { getSessionUser } from '@/server/auth';
import { handle } from '@/server/http';
import { serveVisualAsset } from '@/server/visual-lessons';
export const runtime='nodejs';
export const GET=handle(async(request:Request,{params}:{params:Promise<{id:string;videoId:string;jobId:string;file:string}>})=>{const p=await params;return serveVisualAsset((await getSessionUser()).id,p.id,p.videoId,p.jobId,p.file,request);});
export const HEAD=GET;
