import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { audioRoot } from './tts';
import { ApiError } from '@/server/http';
import type { ConceptScene } from '@/lib/personalized-concept';
import type { ContinuousPlayback } from '@/lib/continuous-concept';

/** Read real RIFF chunks, including WAV files with metadata before their PCM. */
export function pcmWav(bytes: Buffer) {
  if(bytes.length<44 || bytes.toString('ascii',0,4)!=='RIFF' || bytes.toString('ascii',8,12)!=='WAVE') throw new Error('Invalid WAV');
  let format: { codec:number; channels:number; rate:number; bits:number } | undefined, data: Buffer | undefined;
  for(let offset=12;offset+8<=bytes.length;){
    const size=bytes.readUInt32LE(offset+4), start=offset+8, end=start+size;
    if(end>bytes.length) throw new Error('Truncated WAV');
    const kind=bytes.toString('ascii',offset,offset+4);
    if(kind==='fmt ' && size>=16) format={codec:bytes.readUInt16LE(start),channels:bytes.readUInt16LE(start+2),rate:bytes.readUInt32LE(start+4),bits:bytes.readUInt16LE(start+14)};
    if(kind==='data') data=bytes.subarray(start,end);
    offset=end+(size%2);
  }
  if(!format || !data?.length || format.codec!==1 || format.channels!==1 || format.rate!==24000 || format.bits!==16 || data.length%2) throw new Error('Normalize WAV format');
  return {data,seconds:data.length/48000};
}
export function combinePcm(parts: Buffer[]) {
  const pcm=Buffer.concat(parts), head=Buffer.alloc(44);
  head.write('RIFF');head.writeUInt32LE(pcm.length+36,4);head.write('WAVE',8);head.write('fmt ',12);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);head.writeUInt32LE(24000,24);head.writeUInt32LE(48000,28);head.writeUInt16LE(2,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(pcm.length,40);
  return Buffer.concat([head,pcm]);
}
const pending = new Map<string,Promise<void>>();
async function normalized(file: string, original: Buffer) {
  try{return pcmWav(original);}catch{/* Decode existing audio; never request speech again. */}
  if(!ffmpeg)throw new Error('Audio decoder unavailable');
  const temporary=file+`.${randomUUID()}.normalized.wav`;
  try {
    await new Promise<void>((resolve,reject)=>{const child=spawn(ffmpeg!,['-v','error','-i',file,'-ac','1','-ar','24000','-c:a','pcm_s16le','-y',temporary],{windowsHide:true,stdio:'ignore',timeout:30_000});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Audio normalization failed')));});
    return pcmWav(await fs.readFile(temporary));
  } finally {await fs.rm(temporary,{force:true});}
}
export async function continuousNarration(input: { enrollmentId:string;moduleId:string;revisionId:string;scenes:ConceptScene[];audio:Record<string,string>;root?:string }):Promise<ContinuousPlayback> {
  try {
    if(!input.scenes.length || !/^[\w-]+$/.test(input.enrollmentId) || !/^[\w-]+$/.test(input.moduleId))throw new Error('Invalid audio scope');
    const prefix=`/api/v1/adapted-audio/${input.enrollmentId}/${input.moduleId}/clips/`;
    const dir=path.join(input.root??audioRoot(),input.enrollmentId,input.moduleId,'clips');
    const clips=[];
    for(let i=0;i<input.scenes.length;i++){
      const url=input.audio[`scene${i}`];
      if(!url?.startsWith(prefix)||!/^[a-f0-9]{64}\.wav$/.test(url.slice(prefix.length)))throw new Error('Invalid source clip');
      const file=path.join(dir,url.slice(prefix.length)), bytes=await fs.readFile(file);
      clips.push({file,bytes,hash:createHash('sha256').update(bytes).digest('hex')});
    }
    const key=createHash('sha256').update(JSON.stringify({version:1,enrollment:input.enrollmentId,revision:input.revisionId,clips:clips.map(c=>c.hash)})).digest('hex');
    const destination=path.join(dir,`${key}.wav`), manifest=destination+'.json';
    if(!pending.has(destination)) {
      const task=(async()=>{
        try {const saved=JSON.parse(await fs.readFile(manifest,'utf8')) as ContinuousPlayback;const file=pcmWav(await fs.readFile(destination));if(saved.kind==='continuous'&&saved.segments.length===input.scenes.length&&Math.abs(file.seconds-saved.durationSeconds)<.001)return;}catch{/* Recover a missing or interrupted derivative. */}
        const parts: ReturnType<typeof pcmWav>[]=[];for(const c of clips)parts.push(await normalized(c.file,c.bytes));
        let position=0;const segments=input.scenes.map((scene,i)=>{const start=position;position+=parts[i].seconds;return{sceneId:scene.id,startSeconds:start,endSeconds:position};});
        if(position>420.05)throw new Error('Combined lesson exceeds playback budget');
        const after=input.scenes.findIndex(s=>s.phase==='after');
        const playback:ContinuousPlayback={kind:'continuous',audio:prefix+key+'.wav',durationSeconds:position,checkpointSeconds:after<0?null:segments[after].startSeconds,segments};
        const temp=destination+'.'+randomUUID()+'.tmp';
        try {await fs.writeFile(temp,combinePcm(parts.map(p=>p.data)));await fs.rename(temp,destination);await fs.writeFile(temp,JSON.stringify(playback));await fs.rename(temp,manifest);}finally{await fs.rm(temp,{force:true});}
      })();
      pending.set(destination,task);
      void task.finally(()=>{if(pending.get(destination)===task)pending.delete(destination);}).catch(()=>{});
    }
    await pending.get(destination);
    return JSON.parse(await fs.readFile(manifest,'utf8')) as ContinuousPlayback;
  }catch{throw new ApiError(503,'continuous_audio_unavailable','The combined lesson narration could not be prepared. Retry or choose the original lesson.');}
}
