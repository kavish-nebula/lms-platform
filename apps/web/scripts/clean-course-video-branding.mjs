// Correct existing display copies locally. Approved source MP4s, narration,
// editions and learner records are never overwritten or republished.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { NEUTRAL_VIDEO_VERSION } from '../src/lib/lesson-presentation.ts';

const exec = promisify(execFile);
process.loadEnvFile('.env.local');
const reportFile = path.resolve(`../../outputs/course-video-brand-corrections${process.argv.includes('--originals-only')?'-originals':''}.json`);
const audit = JSON.parse(await fs.readFile(path.resolve('../../outputs/course-media-brand-audit.json'), 'utf8'));
const contract = JSON.parse(await fs.readFile('video-renderer/contract.json', 'utf8'));
const visualRoot = process.env.LMS_VISUAL_LESSON_DIR ?? path.resolve('.data/visual-lessons');
const fontDir = path.resolve('.data/media-presentation');
await fs.mkdir(fontDir, { recursive:true });
const font = [process.env.COURSE_VIDEO_FONT, 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].filter(Boolean);
let fontSource;
for (const candidate of font) try { await fs.access(candidate); fontSource=candidate; break; } catch { /* Try the next installed font. */ }
if (!fontSource) throw Error('Set COURSE_VIDEO_FONT to an installed readable font.');
try { await fs.access(path.join(fontDir, 'label.ttf')); }
catch { await fs.copyFile(fontSource, path.join(fontDir, 'label.ttf')); }
const work = [], skipped = [];
const originalFiles = new Set();
for (const video of audit.originalMedia ?? []) {
  if (video.uploadedVideo) originalFiles.add(path.resolve(process.env.LMS_VIDEO_DIR ?? '.data/concept-videos',video.courseId,video.uploadedVideo.assetId,'video'));
  if (video.sourceMedia?.video?.startsWith('/api/v1/scorm-builder/connected/')) originalFiles.add(path.resolve('.data/connected-scorm-media',video.sourceMedia.video.split('/').at(-1)));
}
for (const file of originalFiles) work.push({file,kind:'original',title:'Source recording'});
for (const job of audit.visualExports) {
  const directory = path.join(visualRoot, job.id);
  try {
    const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
    work.push({file:path.join(directory,'final.mp4'),kind:manifest.props.style==='reference-cinema'?'reference':'classic',jobId:job.id,courseId:job.course_id,videoId:job.video_id});
  } catch (error) { skipped.push({directory,reason:String(error)}); }
}
for (const enrollment of await fs.readdir('.data/chalkboard-video',{withFileTypes:true})) {
  if (!enrollment.isDirectory()) continue;
  const base=path.join('.data/chalkboard-video',enrollment.name);
  for (const module of await fs.readdir(base,{withFileTypes:true})) {
    if (!module.isDirectory()) continue;
    const unit=path.join(base,module.name);
    for (const cache of await fs.readdir(unit,{withFileTypes:true})) {
      if (!cache.isDirectory()) continue;
      const directory=path.join(unit,cache.name);
      let status;
      try { status=JSON.parse(await fs.readFile(path.join(directory,'status.json'),'utf8')); } catch { continue; }
      if (status.status!=='ready') continue;
      try {
        const aligned=JSON.parse(await fs.readFile(path.join(directory,'aligned.json'),'utf8'));
        const ranges=aligned.chapters.flatMap((chapter,index)=>contract.remotionKinds.includes(chapter.kind)?[[index===0?0:Math.floor(chapter.cues[0].seconds*contract.fps)/contract.fps,index+1<aligned.chapters.length?(Math.floor(aligned.chapters[index+1].cues[0].seconds*contract.fps)-1)/contract.fps:aligned.durationSeconds]]:[]);
        if(ranges.length)work.push({file:path.join(directory,'final.mp4'),kind:'hybrid',ranges,enrollment:enrollment.name,module:module.name});
        else skipped.push({directory,reason:'Manim-only lesson: no company header in its renderer.'});
      } catch (error) {
        if (status.renderer?.startsWith('chalkboard-directed') || status.renderer?.startsWith('nicglazkov-')) skipped.push({directory,reason:'Earlier Manim-only renderer: no company header.'});
        else skipped.push({directory,reason:String(error)});
      }
    }
  }
}
const selected=process.argv.includes('--originals-only')?work.filter(w=>w.kind==='original'):process.argv.includes('--pilot')?work.filter(w=>w.videoId==='draft_M1_hook'&&w.courseId==='f3332e82-2ac7-44cd-8fa2-69f9278e99df').slice(-1):work;
console.log(JSON.stringify({candidates:work.length,selected:selected.length,unchangedOrUnavailable:skipped.length}));
const results=[];
const audioHash=async file=>{
  const {stdout}=await exec(ffmpeg,['-v','error','-i',file,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],{windowsHide:true,timeout:120000,maxBuffer:100000});
  return stdout.trim();
};
async function correct(item) {
  const source=path.resolve(item.file), corrected=/\.mp4$/i.test(source)?source.replace(/\.mp4$/i,`.${NEUTRAL_VIDEO_VERSION}.mp4`):`${source}.${NEUTRAL_VIDEO_VERSION}.mp4`, before=await fs.stat(source);
  try {
    const meta=JSON.parse(await fs.readFile(corrected+'.json','utf8'));
    if(meta.version===NEUTRAL_VIDEO_VERSION&&meta.sourceBytes===before.size&&meta.sourceModified===before.mtimeMs&&meta.audioUnchanged){await fs.access(corrected);return {...item,status:'ready',reused:true};}
  } catch { /* Missing/stale derivative is rebuilt without modifying its source. */ }
  const reference=item.kind==='reference', top=reference?24:30, boxHeight=reference?28:38;
  const bg=reference?'0x0c090b':'0x0d0c10', color=reference?'0xeda3b7':'0x8bd9c3';
  const label=reference?'LEARNING IN FOCUS':item.kind==='hybrid'?'VISUAL EXPLAINER':'VISUAL LESSON';
  const enable=item.ranges?`:enable='${item.ranges.map(([start,end])=>`between(t,${start},${end})`).join('+')}'`:'';
  const filter=item.kind==='original'?"drawbox=x=iw*0.887:y=ih*0.927:w=iw*0.11:h=ih*0.07:color=0x0d0c10:t=fill,drawtext=fontfile=.data/media-presentation/label.ttf:text='CASE STUDY':x=w*0.9:y=h*0.949:fontsize=h*0.017:fontcolor=0xd7d7df":`drawbox=x=iw*50/1280:y=ih*${top}/720:w=iw*720/1280:h=ih*${boxHeight}/720:color=${bg}:t=fill${enable},drawtext=fontfile=.data/media-presentation/label.ttf:text='${label}':x=w*60/1280:y=h*${reference?30:40}/720:fontsize=h*${reference?14:15}/720:fontcolor=${color}${enable}`;
  const temporary=corrected+'.'+randomUUID()+'.tmp.mp4', started=Date.now();
  await exec(ffmpeg,['-v','error','-i',source,'-map','0:v:0','-map','0:a:0','-vf',filter,'-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-threads','4','-c:a','copy','-movflags','+faststart','-y',temporary],{windowsHide:true,timeout:600000,maxBuffer:1000000});
  const [originalAudio,correctedAudio]=await Promise.all([audioHash(source),audioHash(temporary)]);
  if(originalAudio!==correctedAudio)throw Error('Audio packets changed; corrected copy was not activated.');
  await exec(ffmpeg,['-v','error','-i',temporary,'-f','null','-'],{windowsHide:true,timeout:240000,maxBuffer:1000000});
  const after=await fs.stat(source);
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('Source changed during correction; retry this asset.');
  await fs.rename(temporary,corrected);
  const metadata={version:NEUTRAL_VIDEO_VERSION,sourceBytes:before.size,sourceModified:before.mtimeMs,audioUnchanged:true,audioHash:originalAudio,kind:item.kind,label,ranges:item.ranges,correctedAt:new Date().toISOString()};
  const metadataTemp=corrected+'.json.'+randomUUID()+'.tmp';await fs.writeFile(metadataTemp,JSON.stringify(metadata,null,2));await fs.rename(metadataTemp,corrected+'.json');
  return {...item,status:'ready',secondsToPrepare:(Date.now()-started)/1000};
}
for (const item of selected) {
  let result;
  try { result=await correct(item); } catch(error) { result={...item,status:'failed',error:String(error)}; }
  results.push(result); console.log(JSON.stringify({completed:results.length,total:selected.length,...result}));
  await fs.mkdir(path.dirname(reportFile),{recursive:true});await fs.writeFile(reportFile,JSON.stringify({results,skipped},null,2));
}
if (results.some(row=>row.status!=='ready'))process.exitCode=1;
