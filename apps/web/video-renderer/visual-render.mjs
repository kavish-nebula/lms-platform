// Private, data-only composition. The child receives no model/API credentials.
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia, renderStill, openBrowser } from '@remotion/renderer';
import { visualWindows, alignedVisualWav } from './visual-timeline.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),manifestFile=path.resolve(process.argv[2]),directory=path.dirname(manifestFile);
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8')),token=randomUUID();
const files=new Map(manifest.files.map(f=>[f.key,f.file]));
const server=http.createServer(async(req,res)=>{
  const match=new RegExp(`^/${token}/([a-f0-9]{64})\\.wav$`).exec(req.url??'');
  if(!match||!files.has(match[1])||!['GET','HEAD'].includes(req.method)){res.writeHead(404).end();return;}
  try{const file=files.get(match[1]),size=(await fs.stat(file)).size;res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':size,'Access-Control-Allow-Origin':'*'});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  const props=manifest.props;
  const windows=visualWindows(props,24),buffers=new Map(await Promise.all([...files].map(async([key,file])=>[key,await fs.readFile(file)])));
  await fs.writeFile(path.join(directory,'narration.wav'),alignedVisualWav(windows,buffers,24));
  for(const scene of props.scenes)for(const beat of scene.beats){const key=beat.audio?.replace(/^asset:/,'');if(!key||!files.has(key))throw Error('Missing approved narration clip');beat.audio=`http://127.0.0.1:${server.address().port}/${token}/${key}.wav`;}
  const fingerprint=createHash('sha256');for(const name of ['visual-entry.tsx','../src/components/video/visual-lesson-composition.tsx','../src/components/video/reference-visual-scene.tsx','../src/lib/visual-lesson.ts','../public/video-style/reference-ambient.jpg'])fingerprint.update(await fs.readFile(path.join(here,name)));
  const bundleDir=path.resolve(here,'../.data/visual-lesson-bundles',fingerprint.digest('hex'));
  const publicDir=path.resolve(here,'../.data/visual-style-public');await fs.mkdir(path.join(publicDir,'video-style'),{recursive:true});await fs.copyFile(path.resolve(here,'../public/video-style/reference-ambient.jpg'),path.join(publicDir,'video-style/reference-ambient.jpg'));
  if(!existsSync(path.join(bundleDir,'index.html')))await bundle({entryPoint:path.join(here,'visual-entry.tsx'),outDir:bundleDir,publicDir});
  const browserExecutable=process.env.REMOTION_BROWSER_EXECUTABLE||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  browser=await openBrowser('chrome',{browserExecutable,logLevel:'error'});
  const composition=await selectComposition({serveUrl:bundleDir,id:'TextToVisualLesson',inputProps:props,browserExecutable,puppeteerInstance:browser});
  const output=path.join(directory,'final.tmp.mp4'),options={serveUrl:bundleDir,composition,inputProps:props,browserExecutable,puppeteerInstance:browser,logLevel:'error'};
  const exec=promisify(execFile),parts=[];
  for(const [index,w] of windows.entries()){
    await fs.writeFile(path.join(directory,'progress.json'),JSON.stringify({section:index+1,sections:windows.length}));
    const motion=path.join(directory,`motion-${index}.mp4`),part=path.join(directory,`part-${index}.mp4`);
    await renderMedia({...options,codec:'h264',outputLocation:motion,frameRange:[w.start,w.end-1],concurrency:2,crf:20,muted:true});
    await exec(manifest.ffmpeg,['-v','error','-i',motion,'-vf',`tpad=stop_mode=clone:stop_duration=${(w.until-w.end)/composition.fps+1}`,'-frames:v',String(w.until-w.start),'-an','-r',String(composition.fps),'-c:v','libx264','-pix_fmt','yuv420p','-video_track_timescale','90000','-y',part],{windowsHide:true,timeout:120000});
    parts.push(part);
  }
  const list=path.join(directory,'concat.txt');await fs.writeFile(list,parts.map(p=>`file '${p.replaceAll('\\','/').replaceAll("'","'\\''")}'`).join('\n'));
  await exec(manifest.ffmpeg,['-v','error','-f','concat','-safe','0','-i',list,'-i',path.join(directory,'narration.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-t',String(props.durationInFrames/composition.fps),'-movflags','+faststart','-y',output],{windowsHide:true,timeout:120000});
  await exec(manifest.ffmpeg,['-v','error','-i',output,'-f','null','-'],{windowsHide:true,timeout:180000});
  await fs.rename(output,path.join(directory,'final.mp4'));
  await renderStill({...options,output:path.join(directory,'preview.png'),frame:Math.min(props.durationInFrames-1,Math.floor(composition.fps*8))});
}finally{await browser?.close({silent:true});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
