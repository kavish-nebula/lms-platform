import fs from 'node:fs/promises';
import pg from 'pg';
import {prepareChalkboard,boardRoot} from '@/server/adapt/chalkboard';
import {continuousNarration} from '@/server/adapt/continuous-audio';
import {hookScenes,hookTeachingScene} from '@/lib/video-first-hook';
import {getModule} from '@/data';
import {getSessionUser} from '@/server/auth';
import {closeDb} from '@/server/db/client';
process.loadEnvFile('.env.local');
const p=new pg.Pool({connectionString:process.env.DATABASE_URL});
const rows=(await p.query("select distinct on(enrollment_id,module_id,video_id) id,enrollment_id,module_id,video_id,status,content,input,(select user_id from enrollments e where e.id=adaptation_jobs.enrollment_id) as user_id from adaptation_jobs where video_id like 'concept:%' or video_id='activity:hook' order by enrollment_id,module_id,video_id,updated_at desc")).rows;
await p.end();
const list=rows.filter(r=>r.status==='ready');
if(!process.argv.includes('--run')&&!process.argv.includes('--pilot')){console.log(JSON.stringify({readyForVisualRegeneration:list.length,unprepared:rows.length-list.length}));await closeDb();process.exit(0);}
const pilot=process.argv.includes('--pilot');
const inventory='.data/reference-regeneration-inventory.json';
let ids:string[]=list.map(r=>r.id);
if(!pilot){
 if(process.argv.includes('--refresh-inventory'))await fs.writeFile(inventory,JSON.stringify(ids));
 else try{ids=JSON.parse(await fs.readFile(inventory,'utf8'));}catch{await fs.writeFile(inventory,JSON.stringify(ids));}
}
const currentUser=pilot?await getSessionUser():null;
const selected=pilot?list.filter(r=>r.user_id===currentUser!.id&&r.input.courseId==='dd1fec93-8c51-4f2d-9e0c-943823062c76'&&r.video_id.endsWith('-V8f0b7aadcdce49b88168')):list.filter(r=>ids.includes(r.id));
if(!selected.length)throw Error('No prepared videos match this run. Complete narration preparation before rendering.');
console.log('READY LESSONS',list.length,'UNPREPARED',rows.filter(r=>r.status!=='ready').length,'SELECTED',selected.length);
const results=[];
for(const r of selected){
 try{
 const hook=r.video_id==='activity:hook',v=r.content;
 const scenes=hook?hookScenes(v.problemHook).map(s=>({...hookTeachingScene(s,v.problemHook.title),sourceIds:v.problemHook.sourceIds,objectiveIds:v.problemHook.objectiveIds})):v.scenes;
 const playback=await continuousNarration({enrollmentId:r.enrollment_id,moduleId:r.module_id,revisionId:r.id,scenes,audio:v.audio});
 const mod=hook?null:await getModule(r.input.courseId,r.module_id,r.user_id);
 const video=mod?.blocks.flatMap(b=>'videos' in b?b.videos ?? []:[]).find(v=>v.id===r.video_id.replace(/^concept:/,''));
 if(!hook&&!video)throw Error('The topic no longer belongs to this enrollment edition.');
 const title=hook?v.problemHook.title:video!.title;
 const field=r.input.context?.answers?.field ?? r.input.context?.derived?.field ?? '';
 const board=await prepareChalkboard({enrollmentId:r.enrollment_id,moduleId:r.module_id,revisionId:r.id,title,field,scenes,playback,retry:true});
 await (globalThis as unknown as {__chalkboardQueue?:Promise<void>}).__chalkboardQueue;
 const state=JSON.parse(await fs.readFile(`${boardRoot()}/${r.enrollment_id}/${r.module_id}/${board.key}/status.json`,'utf8'));
 results.push({revision:r.id,enrollment:r.enrollment_id,module:r.module_id,piece:r.video_id,key:board.key,duration:playback.durationSeconds,...state});
 console.log(JSON.stringify(results.at(-1)));
 }catch(e){results.push({revision:r.id,status:'failed',error:String(e)});console.log('FAILED',r.id,String(e).slice(-600));}
 await fs.writeFile(pilot?'.data/reference-pilot-results.json':'.data/reference-regeneration-results.json',JSON.stringify(results,null,2));
}
await closeDb();
if(results.some(result=>result.status!=='ready'))process.exitCode=1;
