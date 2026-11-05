import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { scormConnections, scormImportRuns } from '@/server/db/schema';
import { mediaRoot, type Media } from '@/server/connected-scorm';
import { getPublishedAuthoredCourse } from '@/server/authored-publication';
import { findEnrollment } from '@/server/repo';
import { ApiError, handle } from '@/server/http';
export const GET=handle(async(req:Request,{params}:{params:Promise<{connectionId:string;hash:string}>})=>{
 const {connectionId,hash}=await params;if(!/^[a-f0-9]{64}$/.test(hash)||!/^[a-f0-9-]{36}$/.test(connectionId))throw new ApiError(404,'not_found','Media not found.');
 const d=await db();const user=await getSessionUser();const [connection]=await d.select().from(scormConnections).where(eq(scormConnections.id,connectionId));if(!connection)throw new ApiError(404,'not_found','Media not found.');
 if(connection.ownerId!==user.id){const enrollment=await findEnrollment(user.id,connection.targetCourseId);const release=enrollment?await getPublishedAuthoredCourse(connection.targetCourseId,user.id):undefined;if(!release||!JSON.stringify(release.content).includes(`/connected/${connectionId}/assets/${hash}`))throw new ApiError(403,'forbidden','This media is not part of your enrolled edition.');}
 const runs=await d.select().from(scormImportRuns).where(eq(scormImportRuns.connectionId,connectionId));let asset:Media|undefined;
 for(const run of runs)for(const topic of Object.values(run.output.topics??{}) as {media:Media[]}[])asset??=topic.media.find(m=>m.hash===hash);
 if(!asset)throw new ApiError(404,'not_found','Media not found.');const file=path.join(mediaRoot(),hash);const {size}=await fs.stat(file);let start=0,end=size-1;const range=req.headers.get('range');
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}else start=Math.max(0,size-Number(m[2]));if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});}
 return new Response(Readable.toWeb(createReadStream(file,{start,end})) as ReadableStream,{status:range?206:200,headers:{'Content-Type':asset.mime,'Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})}});
});
