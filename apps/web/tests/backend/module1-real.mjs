// Checks every current Module 1 revision against real text and speech services.
// Does not submit learning answers or completion events.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';

const base = process.env.MODULE1_TEST_URL || 'http://127.0.0.1:3002';
const out = path.resolve(process.env.MODULE1_TEST_OUTPUT || 'apps/web/.data/tests/mechanical-module1');
await fs.mkdir(out,{recursive:true});
async function api(url,body) {
  const r = await fetch(base+url,body ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)} : undefined);
  const data = await r.json(); assert(r.ok, JSON.stringify(data)); return data;
}
const prefix = '/api/v1/enrollments/ai-agent/modules/m1';
const before = {profile:await api('/api/v1/profile'), enrollment:(await api('/api/v1/enrollments/ai-agent')).enrollment};
assert.match(before.profile.profile.answers.studyFieldOther,/mechanical/i,'Use the current mechanical engineering profile');
await fs.writeFile(path.join(out,'before.json'),JSON.stringify(before,null,2));
const videos = JSON.parse(await fs.readFile('fixtures/videos-ai-agent.json','utf8')).videos.filter(v=>v.id.startsWith('m1-'));
const repairs = new Set((process.env.MODULE1_REPAIR_SLIDES || '').split(',').filter(Boolean));
let overrides = {};
try { overrides = JSON.parse(await fs.readFile(path.join(out,'reviewed-revisions.json'),'utf8')); } catch {}
const learnerHash=createHash('sha256').update(JSON.stringify({profile:before.profile,answers:before.enrollment.answers})).digest('hex');
if(overrides.learnerHash!==learnerHash)overrides={learnerHash,revisions:{}};
const targets = [];
for (const video of videos) for (const [slide,authored] of video.slides.entries()) {
  const key=`${video.id}:${slide}`;
  const {job:initial} = await api(prefix+'/adaptation-requests',{videoId:video.id,slide,trigger:'initial',requestId:randomUUID()});
  const job=repairs.has(key) ? (await api(prefix+'/adaptation-requests',{videoId:video.id,slide,trigger:'example',baseRevision:initial.id,requestId:randomUUID()})).job : overrides.revisions[key] || initial;
  if(repairs.has(key))overrides.revisions[key]=job;
  targets.push({videoId:video.id,lesson:video.title,slide,authored,jobId:job.id,job});
}
console.log(`Checking ${targets.length} slides in ${videos.length} lessons: ${targets.filter(t=>t.job.status==='ready').length} already ready`);
const controller = new AbortController();
const timer = setTimeout(()=>controller.abort(),900000);
const pending = new Map(targets.filter(t=>!['ready','failed'].includes(t.job.status)).map(t=>[t.jobId,t]));
try {
  if (pending.size) {
    const response = await fetch(base+prefix+'/adaptation-events',{signal:controller.signal});
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += new TextDecoder().decode(chunk);
      let end;
      while((end=buffer.indexOf('\n\n'))>=0) {
        const block=buffer.slice(0,end); buffer=buffer.slice(end+2);
        const line=block.split('\n').find(s=>s.startsWith('data: ')); if(!line) continue;
        const event=JSON.parse(line.slice(6)); const target=pending.get(event.id); if(!target) continue;
        target.job=event;
        if(['ready','failed','superseded'].includes(event.status)) {
          pending.delete(event.id);
          const key=`${target.videoId}:${target.slide}`;
          if(repairs.has(key))overrides.revisions[key]=event;
          console.log(`${target.videoId} slide ${target.slide+1}: ${event.status}; ${pending.size} remaining`);
        }
      }
      if(!pending.size) break;
    }
  }
} finally {clearTimeout(timer);controller.abort();}
await fs.writeFile(path.join(out,'reviewed-revisions.json'),JSON.stringify(overrides,null,2));
const locked=new Set(['id','kind','type','icon','role','tone','state','source','target','code','term','cue','correct']);
function structure(a,b,key='') {
  if(locked.has(key)||!(a && typeof a==='object') && typeof a!=='string') {assert.deepEqual(b,a,`Protected ${key}`);return;}
  if(Array.isArray(a)) {assert(Array.isArray(b));assert.equal(a.length,b.length);a.forEach((v,i)=>structure(v,b[i]));return;}
  if(a && typeof a==='object') {assert(b && typeof b==='object');for(const k of Object.keys(a))structure(a[k],b[k],k);return;}
  assert.equal(typeof b,'string');assert(b.trim()||!a.trim());assert(b.length<=Math.max(40,Math.round(a.length*1.8)+30),`Layout ${key}`);
}
const results=[];
for(const target of targets) {
  const {job,authored,videoId,slide,lesson}=target;
  const result={videoId,slide,lesson,jobId:job.id,status:job.status,authored,content:job.content,audio:job.audio,checks:[],issues:[]};
  try {
    assert.equal(job.status,'ready');assert(job.content&&job.audio);
    structure(authored,job.content);
    assert.equal(job.content.narration,job.content.sentences.join(' ').trim());
    result.checks.push('structure, protected fields, layout and sentence alignment');
    const r=await fetch(base+job.audio);assert(r.ok);const bytes=Buffer.from(await r.arrayBuffer());
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WAVE');assert(bytes.length>44);
    const file=`${videoId}-${slide+1}.wav`;await fs.writeFile(path.join(out,file),bytes);
    result.audioFile=file;result.audioBytes=bytes.length;result.audioHash=createHash('sha256').update(bytes).digest('hex');
    result.checks.push('real WAV available');
    result.narrationChanged=authored.narration!==job.content.narration;
    result.fieldPresent=/mechanical|stress.test|prototype|test.bench|design report|finite element|CAD\b|simulation|shaft|bearing|bracket/i.test(JSON.stringify(job.content));
    const original=JSON.stringify(job.content).match(/\b(?:Orbit|ORB-\d+|Trailhead|tents?)\b/gi)||[];
    if(original.length)result.issues.push('Original retail story remains: '+[...new Set(original)].join(', '));
  } catch(error) {result.issues.push(error.message);}
  results.push(result);
  await fs.writeFile(path.join(out,'slides.json'),JSON.stringify(results,null,2));
}
const after={profile:await api('/api/v1/profile'),enrollment:(await api('/api/v1/enrollments/ai-agent')).enrollment};
assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.enrollment.answers,before.enrollment.answers);assert.deepEqual(after.enrollment.progress,before.enrollment.progress);
const report={testedAt:new Date().toISOString(),base,field:before.profile.profile.answers.studyFieldOther,total:results.length,ready:results.filter(r=>r.status==='ready').length,passed:results.filter(r=>!r.issues.length).length,changedNarration:results.filter(r=>r.narrationChanged).length,explicitField:results.filter(r=>r.fieldPresent).length,originalRecordsUnchanged:true,results};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined},null,2));
if(report.passed!==report.total)process.exitCode=1;
