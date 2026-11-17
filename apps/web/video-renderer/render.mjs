// Local compositor. Only allowlisted files are served to the renderer browser;
// learner data never enters public/ and no provider credentials are needed.
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill } from '@remotion/renderer';
import { motionWindows } from './timeline.mjs';

const exec = promisify(execFile), here = path.dirname(fileURLToPath(import.meta.url));
const manifestFile = path.resolve(process.argv[2]), dir = path.dirname(manifestFile);
const manifest = JSON.parse(await fs.readFile(manifestFile,'utf8'));
const aligned = JSON.parse(await fs.readFile(path.join(dir,'aligned.json'),'utf8'));
aligned.chapters.forEach((c,i)=>{if(c.kind==='decision')c.question=manifest.scenes[i].narration;});
const contract = JSON.parse(await fs.readFile(path.join(here,'contract.json'),'utf8'));
const atomic = async (file, value) => {
  const tmp=file+'.'+randomUUID()+'.tmp'; await fs.writeFile(tmp,JSON.stringify(value));
  // Windows scanners/readers can briefly hold the destination. Preserve atomic
  // replacement and retry the transient lock; never delete a live status file.
  for(let attempt=0;;attempt++)try{await fs.rename(tmp,file);return;}catch(error){if(attempt===9||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));}
};
const status = path.join(dir,'status.json');
const token=randomUUID(), asset='/'+token+'/manim.mp4', mediaFile=path.join(dir,'manim.mp4');
const server=http.createServer(async (req,res)=>{
  if(req.url!==asset || !['GET','HEAD'].includes(req.method)){res.writeHead(404).end();return;}
  const size=(await fs.stat(mediaFile)).size;
  const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
  res.writeHead(match?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,'Access-Control-Allow-Origin':'*',...(match?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  if(req.method==='HEAD')res.end();else createReadStream(mediaFile,{start,end}).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const sourceFiles=(await fs.readdir(here)).filter(f=>/\.(tsx?|json)$/.test(f)).sort();
  const hash=createHash('sha256');for(const name of sourceFiles)hash.update(await fs.readFile(path.join(here,name)));
  const out=path.resolve(here,'../.data/remotion-bundles',hash.digest('hex'));
  if(!existsSync(path.join(out,'index.html')))await bundle({entryPoint:path.join(here,'entry.tsx'),outDir:out,publicDir:null});
  const inputProps={...aligned,title:manifest.title,manim:`http://127.0.0.1:${server.address().port}${asset}`};
  const chrome=process.env.REMOTION_BROWSER_EXECUTABLE || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  const composition=await selectComposition({serveUrl:out,id:'PersonalizedLesson',inputProps,browserExecutable:chrome});
  await atomic(status,{status:'rendering',stage:'Compositing the narrated lesson'});
  const options={serveUrl:out,composition,inputProps,browserExecutable:chrome,logLevel:'error'};
  const started=Date.now();
  const partsDir=path.join(dir,'hybrid-parts');await fs.mkdir(partsDir,{recursive:true});
  const parts=[];
  if(!aligned.chapters.some(c=>contract.remotionKinds.includes(c.kind))) await fs.copyFile(mediaFile,path.join(dir,'hybrid-silent.mp4'));
  else {
    for(const [i,c] of aligned.chapters.entries()){
      const from=i===0?0:Math.floor(c.cues[0].seconds*contract.fps),to=i+1<aligned.chapters.length?Math.floor(aligned.chapters[i+1].cues[0].seconds*contract.fps):composition.durationInFrames;
      await atomic(status,{status:'rendering',stage:'Compositing the narrated lesson',section:i+1,sections:aligned.chapters.length});
      if(!contract.remotionKinds.includes(c.kind)){
        const part=path.join(partsDir,`${i}-manim.mp4`);
        await exec(manifest.ffmpeg,['-v','error','-ss',String(from/contract.fps),'-i',mediaFile,'-frames:v',String(to-from),'-an','-r',String(contract.fps),'-c:v','libx264','-pix_fmt','yuv420p','-video_track_timescale','90000','-y',part],{windowsHide:true,timeout:120000});parts.push(part);
      }else for(const [j,w] of motionWindows(c,from,to,contract.fps).entries()){
        const motion=path.join(partsDir,`${i}-${j}-motion.mp4`),part=path.join(partsDir,`${i}-${j}.mp4`);
        await renderMedia({...options,codec:'h264',outputLocation:motion,frameRange:[w.start,w.end-1],concurrency:2,crf:20,muted:true});
        await exec(manifest.ffmpeg,['-v','error','-i',motion,'-vf',`tpad=stop_mode=clone:stop_duration=${(w.holdUntil-w.end)/contract.fps+1}`,'-frames:v',String(w.holdUntil-w.start),'-an','-r',String(contract.fps),'-c:v','libx264','-pix_fmt','yuv420p','-video_track_timescale','90000','-y',part],{windowsHide:true,timeout:120000});parts.push(part);
      }
    }
    const list=path.join(partsDir,'concat.txt');await fs.writeFile(list,parts.map(p=>`file '${p.replaceAll('\\','/').replaceAll("'","'\\''")}'`).join('\n'));
    await exec(manifest.ffmpeg,['-v','error','-f','concat','-safe','0','-i',list,'-c','copy','-y',path.join(dir,'hybrid-silent.mp4')],{windowsHide:true,timeout:120000});
  }
  // Preserve the exact existing narration and duration; no voice generation.
  const temporary=path.join(dir,'final.tmp.mp4');
  await exec(manifest.ffmpeg,['-v','error','-i',path.join(dir,'hybrid-silent.mp4'),'-i',manifest.audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-t',String(aligned.durationSeconds),'-movflags','+faststart','-y',temporary],{windowsHide:true,timeout:120000});
  // Decode the complete output, not just its container header, before delivery.
  await exec(manifest.ffmpeg,['-v','error','-i',temporary,'-f','null','-'],{windowsHide:true,timeout:120000});
  await fs.rename(temporary,path.join(dir,'final.mp4'));
  await fs.mkdir(path.join(dir,'qa'),{recursive:true});
  for(const [i,c] of aligned.chapters.entries()){
    const seconds=Math.min(c.end-.25,c.cues.at(-1).seconds+2);
    await renderStill({...options,output:path.join(dir,'qa',`chapter-${i+1}.png`),frame:Math.floor(seconds*contract.fps)});
  }
  const quality=JSON.parse(await fs.readFile(path.join(dir,'visual-quality.json'),'utf8'));
  await atomic(path.join(dir,'visual-quality.json'),{...quality,renderer:contract.version,remotionChapters:aligned.chapters.filter(c=>contract.remotionKinds.includes(c.kind)).length,manimChapters:aligned.chapters.filter(c=>!contract.remotionKinds.includes(c.kind)).length,fullDecodePassed:true});
  await atomic(status,{status:'ready',durationSeconds:aligned.durationSeconds,renderSeconds:(Date.now()-started)/1000,renderer:contract.version});
} catch(error){await atomic(status,{status:'failed',stage:'composition'});throw error;}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
