'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CourseWorkflowNav } from './course-workflow-nav';
import { Player, type PlayerRef } from '@remotion/player';
import { useReducedMotion } from 'motion/react';
import { VisualLessonComposition } from '@/components/video/visual-lesson-composition';
import { VisualLesson, VISUAL_KINDS, VISUAL_FPS, automationVisualSeed, visualTimeline, type VisualLessonData } from '@/lib/visual-lesson';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
import { formatIst } from '@/lib/display-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { visualLessonState } from '@/server/visual-lessons';
import { sourceVisualSeed, REFERENCE_VIDEO_DIRECTION } from '@/lib/visual-authoring';

type State=Awaited<ReturnType<typeof visualLessonState>>;
const newId=()=>`V${crypto.randomUUID().replaceAll('-','').slice(0,20)}`;
export function VisualLessonWorkspace({initial}:{initial:State}){
  const starter=initial.source.origin==='stage4'?sourceVisualSeed(initial.source):automationVisualSeed(initial.source.sourceIds,initial.source.text);
  const [state,setState]=useState(initial),[loaded,setLoaded]=useState(initial.revisions[0]);
  const [content,setContent]=useState<VisualLessonData>(initial.revisions[0]?.content??starter);
  const [baseline,setBaseline]=useState(JSON.stringify(initial.revisions[0]?.content??starter));
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[instructions,setInstructions]=useState(REFERENCE_VIDEO_DIRECTION);
  const [captions,setCaptions]=useState(true),[motionOverride,setMotionOverride]=useState<boolean|null>(null),[previewVersion,setPreviewVersion]=useState(0);
  const [largePreview,setLargePreview]=useState(false);
  const systemReducedMotion=useReducedMotion(),reducedMotion=motionOverride??!!systemReducedMotion;
  const player=useRef<PlayerRef>(null),dirty=JSON.stringify(content)!==baseline;
  useUnsavedGuard(dirty);
  const endpoint=`/api/v1/content/courses/${state.source.courseId}/visual-lessons/${state.source.videoId}`;
  const audio=state.jobs.find(j=>j.revisionId===loaded?.id&&j.kind==='audio');
  const matchingAudio=!dirty&&audio?.status==='ready'?audio:undefined;
  const exported=state.jobs.find(j=>j.revisionId===loaded?.id&&j.kind==='export'&&j.dependencyId===audio?.id);
  const current=!!loaded&&loaded.id===state.revisions[0]?.id&&loaded.sourceIdentity===state.source.identity;
  const playback=useMemo(()=>({...visualTimeline(content,matchingAudio?.output.clips,key=>`${endpoint}/assets/${matchingAudio!.id}/${key}.wav`),captions,reducedMotion}),[content,matchingAudio,endpoint,captions,reducedMotion]);
  const pending=state.jobs.some(j=>j.status==='queued'||j.status==='running');
  useEffect(()=>{
    if(!pending)return;
    let disposed=false;
    const timer=setInterval(()=>void fetch(endpoint,{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error?.message??'Could not refresh preparation.');if(!disposed)setState(data);}).catch(e=>{if(!disposed)setError(e.message);}),2500);
    return()=>{disposed=true;clearInterval(timer);};
  },[endpoint,pending]);
  function edit(next:VisualLessonData){player.current?.pause();setContent(next);setPreviewVersion(v=>v+1);setNotice('');}
  function sceneEdit(index:number,patch:Partial<VisualLessonData['scenes'][number]>){edit({...content,scenes:content.scenes.map((s,i)=>i===index?{...s,...patch}:s)});}
  function beatVisualEdit(index:number,n:number,patch:Partial<NonNullable<VisualLessonData['scenes'][number]['beats'][number]['visual']>>){sceneEdit(index,{beats:content.scenes[index].beats.map((beat,j)=>j!==n?beat:{...beat,visual:{...(beat.visual??{heading:beat.label.slice(0,45),detail:beat.label,icon:'document' as const,status:'neutral' as const}),...patch}})});}
  async function action(kind:'seed'|'save'|'generate'|'audio'|'export'){
    setBusy(kind);setError('');setNotice('');player.current?.pause();
    const revision={expectedVersion:loaded?.version??0,expectedBriefRevision:state.source.briefRevision,sourceIdentity:state.source.identity};
    const payload=kind==='save'?{action:kind,...revision,content}:kind==='generate'?{action:kind,...revision,instructions}:kind==='seed'?{action:kind,expectedVersion:0}:{action:kind,revisionId:loaded!.id,retry:true};
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),next=await response.json();
      if(!response.ok)throw Error(next.error?.message??'The action did not complete.');
      setState(next);
      if(['seed','save','generate'].includes(kind)){const head=next.revisions[0];setLoaded(head);setContent(head.content);setBaseline(JSON.stringify(head.content));setPreviewVersion(v=>v+1);}
      setNotice(kind==='audio'?'Narration is preparing in the background. The visual preview remains available.':kind==='export'?'MP4 export is queued. You can keep reviewing while it renders.':'Saved a creator-only visual draft. Human review is still required.');
    }catch(e){setError(e instanceof Error?e.message:'Could not complete the action.');}finally{setBusy('');}
  }
  async function reload(){
    if(dirty&&!window.confirm('Reload the saved script and discard your unsaved test edits?'))return;
    try{const response=await fetch(endpoint,{cache:'no-store'}),next=await response.json();if(!response.ok)throw Error(next.error?.message??'Reload failed.');setState(next);if(next.revisions[0]){setLoaded(next.revisions[0]);setContent(next.revisions[0].content);setBaseline(JSON.stringify(next.revisions[0].content));setPreviewVersion(v=>v+1);}setError('');}catch(e){setError(e instanceof Error?e.message:'Reload failed.');}
  }
  const valid=VisualLesson.safeParse(content);
  return <div className="creator-stage"><CourseWorkflowNav courseId={state.source.courseId} step={4} />
    <header className="space-y-3"><Link className="text-sm text-brand-ink underline" href={`/content/courses/${state.source.courseId}`}>← Course brief and sources</Link><p className="text-sm text-brand-ink">{state.source.courseTitle} · {state.source.moduleId}</p><h1 className="text-3xl font-semibold">Text-to-visual lesson</h1><p className="text-lg">{state.source.title}</p><p className="max-w-3xl text-sm text-ink-muted">Review the script, play its animated explanation, prepare matching narration and export an MP4. This creator draft does not replace the published lesson or recording.</p></header>
    <Button type="button" variant="outline" aria-pressed={largePreview} onClick={()=>setLargePreview(v=>!v)}>{largePreview?'Show video beside the script':'Large video preview'}</Button>
    <div className={largePreview?'grid items-start gap-6':'grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]'}>
      <section className={largePreview?'space-y-4':'space-y-4 xl:sticky xl:top-20'} aria-label="Animated lesson preview">
        <div className="overflow-hidden rounded-xl border border-line bg-panel"><Player key={`${loaded?.id??'starter'}:${previewVersion}:${matchingAudio?.id??'silent'}`} ref={player} component={VisualLessonComposition} inputProps={playback} compositionWidth={1280} compositionHeight={720} fps={VISUAL_FPS} durationInFrames={Math.max(1,playback.durationInFrames)} controls showVolumeControls showPlaybackRateControl={[.75,1,1.25,1.5]} style={{width:'100%'}}/></div>
        <p role="status" className="rounded-lg border border-line bg-panel p-3 text-sm">{matchingAudio?`Matching narration ready · ${(playback.durationInFrames/VISUAL_FPS).toFixed(1)} seconds, including visual holds.`:dirty?'Script changed: visual-only preview. Save and prepare matching narration.':'Visual-only preview · prepare narration for synchronized speech.'}</p>
        <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={captions} onChange={e=>setCaptions(e.target.checked)}/>Captions</label><label className="flex items-center gap-2"><input type="checkbox" checked={reducedMotion} onChange={e=>setMotionOverride(e.target.checked)}/>Reduced motion</label></div>
        <nav aria-label="Visual lesson sections" className="flex flex-wrap gap-2">{playback.scenes.map((s,i)=><Button type="button" variant="outline" key={s.id} onClick={()=>player.current?.seekTo(s.from)}>{i+1}. {s.title}</Button>)}</nav>
        <div className="space-y-3 rounded-xl border border-line bg-panel p-4"><h2 className="font-semibold">Narration and MP4</h2><p className="text-sm text-ink-muted">Narration uses local Kokoro. Visual changes follow the measured start of each spoken beat. An MP4 export runs separately and includes the same saved script and audio.</p><div className="flex flex-wrap gap-3"><Button disabled={!!busy||dirty||!current||audio?.status==='running'||audio?.status==='queued'} onClick={()=>void action('audio')}>{audio?.status==='failed'?'Retry narration':'Prepare narration'}</Button><Button variant="outline" disabled={!!busy||dirty||!current||!matchingAudio||exported?.status==='running'||exported?.status==='queued'} onClick={()=>void action('export')}>{exported?.status==='failed'?'Retry MP4 export':'Export MP4 in background'}</Button></div>
          {audio&&<p className="text-sm">Narration: {audio.status}{audio.output.total?` · ${audio.output.completed??0}/${audio.output.total} clips`:''}</p>}{audio?.error&&<p className="text-sm text-destructive">{audio.error}</p>}
          {exported&&<p className="text-sm">MP4: {exported.status}</p>}{exported?.error&&<p className="text-sm text-destructive">{exported.error}</p>}
          {exported?.status==='ready'&&!dirty&&<Button asChild variant="outline"><a href={`${endpoint}/assets/${exported.id}/lesson.mp4?download=1`}>Download MP4 · revision {loaded?.version}</a></Button>}
        </div>
        <details className="rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer font-medium">Reviewed teaching sources</summary><p className="mt-3 text-xs text-ink-muted">Source IDs: {state.source.sourceIds.join(', ')} · brief revision {state.source.briefRevision}. Evidence quotations establish traceability; a creator must review factual and visual alignment.</p><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">{state.source.text}</pre></details>
      </section>
      <section className="space-y-4" aria-label="Editable lesson script">
        <div className="space-y-3 rounded-xl border border-line bg-panel p-4"><h2 className="text-xl font-semibold">Script and visual direction</h2><p className="text-sm text-ink-muted">{loaded?`Saved revision ${loaded.version} · ${formatIst(loaded.createdAt)}`:'Source-linked starter · not saved'}{dirty?' · Unsaved changes':''}</p><label htmlFor="visual-title" className="block text-sm font-medium">Lesson title</label><Input id="visual-title" disabled={!!busy} value={content.title} maxLength={100} onChange={e=>edit({...content,title:e.target.value})}/>
          <div className="flex flex-wrap gap-3">{!loaded&&<Button disabled={!!busy||dirty} onClick={()=>void action('seed')}>Create source-linked draft</Button>}<Button disabled={!!busy||!valid.success||!dirty} onClick={()=>void action('save')}>{busy==='save'?'Saving…':'Save script revision'}</Button><Button variant="outline" disabled={!!busy} onClick={()=>void reload()}>Reload saved script</Button></div>
          {!current&&loaded&&<p className="text-sm text-destructive">This script is based on an older revision or source. Reload and reconcile before preparing new media.</p>}
          {!valid.success&&<p className="text-sm text-destructive">{valid.error.issues.map(i=>i.message).join(' ')}</p>}
        </div>
        <fieldset disabled={!!busy} className="space-y-4">{content.scenes.map((scene,index)=><details key={scene.id} open={index===0} className="space-y-4 rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer font-semibold">Section {index+1}: {scene.title}</summary>
          <label htmlFor={`${scene.id}-title`} className="block text-sm font-medium">Section title</label><Input id={`${scene.id}-title`} maxLength={80} value={scene.title} onChange={e=>sceneEdit(index,{title:e.target.value})}/>
          <label htmlFor={`${scene.id}-kind`} className="block text-sm font-medium">Visualization</label><select id={`${scene.id}-kind`} className="min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm" value={scene.kind} onChange={e=>sceneEdit(index,{kind:e.target.value as typeof scene.kind})}>{VISUAL_KINDS.map(k=><option key={k}>{k}</option>)}</select>
          {scene.beats.map((beat,n)=><div key={beat.id} className="space-y-2 rounded-lg border border-line p-3"><label htmlFor={`${beat.id}-text`} className="block text-sm font-medium">Narration {n+1}</label><Textarea id={`${beat.id}-text`} rows={3} maxLength={420} value={beat.narration} onChange={e=>sceneEdit(index,{beats:scene.beats.map((b,j)=>j===n?{...b,narration:e.target.value}:b)})}/><label htmlFor={`${beat.id}-label`} className="block text-sm font-medium">Visible label {n+1}</label><Input id={`${beat.id}-label`} maxLength={65} value={beat.label} onChange={e=>sceneEdit(index,{beats:scene.beats.map((b,j)=>j===n?{...b,label:e.target.value}:b)})}/><Button type="button" variant="outline" disabled={scene.beats.length<=1} onClick={()=>sceneEdit(index,{beats:scene.beats.filter((_,j)=>j!==n)})}>Remove narration {n+1}</Button></div>)}
          {scene.beats.map((beat,n)=><div key={`visual-${beat.id}`} className="space-y-2 rounded-lg border border-line p-3"><p className="text-sm font-medium">Visual shown during narration {n+1}</p><label htmlFor={`${beat.id}-heading`} className="block text-sm">Artifact heading</label><Input id={`${beat.id}-heading`} maxLength={45} value={beat.visual?.heading??beat.label.slice(0,45)} onChange={e=>beatVisualEdit(index,n,{heading:e.target.value})}/><label htmlFor={`${beat.id}-detail`} className="block text-sm">Document or screen content</label><Textarea id={`${beat.id}-detail`} maxLength={120} value={beat.visual?.detail??beat.label} onChange={e=>beatVisualEdit(index,n,{detail:e.target.value})}/></div>)}
          <Button type="button" variant="outline" disabled={scene.beats.length>=4} onClick={()=>sceneEdit(index,{beats:[...scene.beats,{id:newId(),label:'New visual step',narration:'Explain the source-supported visual step here.'}]})}>Add narration beat</Button>
          <details className="space-y-2 text-sm"><summary className="cursor-pointer">Source evidence</summary><p>{scene.sourceIds.join(', ')}</p><Textarea aria-label={`Evidence for section ${index+1}`} value={scene.evidence} maxLength={1200} onChange={e=>sceneEdit(index,{evidence:e.target.value})}/></details>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={index===0} onClick={()=>{const scenes=[...content.scenes];[scenes[index-1],scenes[index]]=[scenes[index],scenes[index-1]];edit({...content,scenes});}}>Move section up</Button><Button type="button" variant="outline" disabled={content.scenes.length<=2} onClick={()=>edit({...content,scenes:content.scenes.filter((_,i)=>i!==index)})}>Remove section</Button></div>
        </details>)}</fieldset>
        <Button type="button" variant="outline" disabled={!!busy||content.scenes.length>=12} onClick={()=>edit({...content,scenes:[...content.scenes,{...content.scenes[0],id:newId(),title:'New source-linked section',beats:[{id:newId(),label:'Source evidence',narration:'Explain this idea using the reviewed teaching source.'}]}]})}>Add visual section</Button>
        <details className="space-y-3 rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer font-medium">Draft or revise with AI</summary><label htmlFor="visual-instructions" className="block text-sm">Revision instructions</label><Textarea id="visual-instructions" maxLength={3000} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/><p className="text-xs text-ink-muted">Sends this topic’s teaching and your instructions to the configured text model. The result must pass structure and source checks and still needs creator review.</p><Button disabled={!!busy||dirty||!state.aiConfigured||!instructions.trim()} onClick={()=>void action('generate')}>{busy==='generate'?'Drafting…':'Generate visual draft with AI'}</Button></details>
        <details className="rounded-xl border border-line bg-panel p-4"><summary className="cursor-pointer text-sm font-medium">Revision history ({state.revisions.length})</summary><ol className="mt-3 space-y-2 text-sm">{state.revisions.map(r=><li key={r.id}>Revision {r.version} · {formatIst(r.createdAt)}</li>)}</ol></details>
      </section>
    </div>
    {notice&&<p role="status" className="rounded-lg border border-line bg-panel p-4 text-sm text-brand-ink">{notice}</p>}{error&&<p role="alert" className="rounded-lg border border-line bg-panel p-4 text-sm text-destructive">{error}</p>}
  </div>;
}
