"use client";

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { api } from '@/lib/api';

import { Button } from '@/components/ui/button';

import { Surface } from '@/components/kit/surface';

import type { AuthoredCoursePackageData } from '@/lib/authored-course';
import type { CreatorDraft } from '@/lib/content-creator';

import type { ObjectiveMapping } from '@/server/scorm-preparation';

type Selection={topicId:string;kind:'draft'|'release';version?:string};

type Preview={fingerprint:string;snapshots:{selection:Selection;source:{topicId:string;title:string;objectives:string[]}}[];coverage:Record<string,number>;warnings:string[]};

type Connection={id:string;sourceCourseId:string;targetCourseId:string;sourceCourseName:string};

type Run={id:string;connectionId:string;status:string;error:string|null;output:Record<string,unknown>;input:{snapshots:{source:{topicId:string;objectives:string[]}}[]}};

const endpoint='/api/v1/scorm-builder/connected';

export function ConnectedScormImporter(){

 const [library,setLibrary]=useState<{id:string;name:string}[]>([]),[targets,setTargets]=useState<CreatorDraft[]>([]);

 const [source,setSource]=useState(''),[target,setTarget]=useState(''),[topics,setTopics]=useState<{topicId:string;title:string}[]>([]),[selections,setSelections]=useState<Selection[]>([]),[releases,setReleases]=useState<Record<string,{version:string}[]>>({});

 const [preview,setPreview]=useState<Preview|null>(null),[connections,setConnections]=useState<Connection[]>([]),[runs,setRuns]=useState<Run[]>([]),[selectedRun,setSelectedRun]=useState(''),[objectives,setObjectives]=useState<ObjectiveMapping[]>([]),[accepted,setAccepted]=useState(false);

 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[updates,setUpdates]=useState<unknown>(null),[resolutions,setResolutions]=useState<Record<string,'local'|'incoming'>>({});

 const refresh=async()=>{const state=await api<{connections:Connection[];runs:Run[]}>(endpoint);setConnections(state.connections);setRuns(state.runs);};

 useEffect(()=>{void Promise.all([api<{library:{courses:{id:string;name:string}[]}}>('/api/v1/scorm-builder'),api<{courses:CreatorDraft[]}>('/api/v1/content/courses'),api<{connections:Connection[];runs:Run[]}>(endpoint)]).then(([l,c,s])=>{setLibrary(l.library.courses);setTargets(c.courses);setConnections(s.connections);setRuns(s.runs);const found=c.courses.find(x=>x.id==='affcb1b6-5539-431c-9a95-cce2bdb26b51');if(found)setTarget(found.id);}).catch(e=>setError(e.message));},[]);

 const run=runs.find(r=>r.id===selectedRun);const connection=connections.find(c=>c.id===run?.connectionId);const currentTarget=targets.find(c=>c.id===(connection?.targetCourseId??target));

 async function perform(fn:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'This step failed. Saved work is retained.');}finally{setBusy(false);}}

 async function chooseCourse(id:string){setSource(id);setPreview(null);setTopics([]);setSelections([]);setReleases({});const c=library.find(c=>c.id===id);if(!c)return;

  const r=await api<{structure:{modules:{topics:{topicId:string;title:string}[]}[]}}>(`/api/v1/scorm-builder?courseName=${encodeURIComponent(c.name)}`);const next=r.structure.modules.flatMap(m=>m.topics);setTopics(next);setSelections(next.map(t=>({topicId:t.topicId,kind:'draft'})));

  const versions=await Promise.all(next.map(async t=>{const r=await api<{releases:{releases:{version:string}[]}}>(`${endpoint}?topicId=${encodeURIComponent(t.topicId)}`);return[t.topicId,r.releases.releases??[]] as const;}));setReleases(Object.fromEntries(versions));

 }

 function chooseRun(r:Run){const linked=connections.find(c=>c.id===r.connectionId);if(linked){setSource(linked.sourceCourseId);setTarget(linked.targetCourseId);}setPreview(null);setSelectedRun(r.id);const original=r.input.snapshots.flatMap(s=>s.source.objectives);setObjectives((r.output.objectiveMappings as ObjectiveMapping[]|undefined)??original.map(original=>({original,text:original,bloom:'Understand'})));setAccepted(false);}

 return <div className="space-y-6"><Link href="/content" className="text-brand-ink underline">Creator workspace</Link><header className="space-y-2"><h1 className="text-3xl font-semibold">Connect SCORM Builder courses</h1><p className="text-ink-muted">Import reviewed source snapshots into your existing course. Source edits do not automatically change the learner edition.</p></header>

 <ol className="flex flex-wrap gap-3 text-sm" aria-label="Connected import workflow">{['Select source','Preview coverage','Import','Prepare activities','Review','Publish'].map((s,i)=><li key={s} className="rounded-full border border-line bg-panel px-3 py-2">{i+1}. {s}</li>)}</ol>

 <Surface pad="lg" className="space-y-5"><h2 className="text-xl font-semibold">Source and destination</h2><label className="block">SCORM Builder course<select aria-label="SCORM Builder course" className="mt-2 w-full rounded-lg border border-line bg-panel p-3" value={source} disabled={busy} onChange={e=>void perform(()=>chooseCourse(e.target.value))}><option value="">Choose a source course</option>{library.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>

 <label className="block">Existing LMS course<select aria-label="Existing LMS course" className="mt-2 w-full rounded-lg border border-line bg-panel p-3" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose destination</option>{targets.map(c=><option key={c.id} value={c.id}>{c.brief.title}</option>)}</select></label>

 {topics.length>0&&<fieldset className="space-y-3"><legend className="font-semibold">Select topics and exact source versions</legend>{topics.map(t=>{const selected=selections.find(s=>s.topicId===t.topicId);return <div key={t.topicId} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><label className="flex flex-1 items-center gap-2"><input type="checkbox" checked={!!selected} onChange={e=>{setPreview(null);setSelections(e.target.checked?[...selections,{topicId:t.topicId,kind:'draft'}]:selections.filter(s=>s.topicId!==t.topicId));}}/>{t.title}</label><select aria-label={`Source revision for ${t.title}`} disabled={!selected} value={selected?.kind==='release'?selected.version:'draft'} onChange={e=>{setPreview(null);setSelections(selections.map(s=>s.topicId===t.topicId?{topicId:t.topicId,kind:e.target.value==='draft'?'draft':'release',...(e.target.value!=='draft'?{version:e.target.value}:{})}:s));}} className="rounded-lg border border-line bg-panel p-2"><option value="draft">Current draft — LMS review required</option>{(releases[t.topicId]??[]).map(r=><option key={r.version} value={r.version}>Published release {r.version}</option>)}</select></div>;})}</fieldset>}

 <Button disabled={busy||!source||!target||!selections.length} onClick={()=>void perform(async()=>{const r=await api<{preview:Preview}>(endpoint,{method:'POST',body:{action:'preview',sourceCourseId:source,selections}});setPreview(r.preview);})}>Preview source coverage</Button>

 {preview&&<section className="space-y-3"><h3 className="font-semibold">Coverage preview</h3><dl className="flex flex-wrap gap-5">{Object.entries(preview.coverage).map(([k,v])=><div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-xl font-semibold">{v}</dd></div>)}</dl><p className="text-sm text-ink-muted">Source objectives and answer keys are preserved. External-tool tasks require mapped LMS outcomes. Draft import does not approve or publish anything.</p><Button disabled={busy} onClick={()=>void perform(async()=>{const c=await api<{connection:Connection}>(endpoint,{method:'POST',body:{action:'connect',sourceCourseId:source,targetCourseId:target}});const r=await api<{run:Run}>(endpoint,{method:'POST',body:{action:'import',connectionId:c.connection.id,selections,expectedFingerprint:preview.fingerprint}});chooseRun(r.run);await refresh();setMessage('Source snapshot staged. Resume import to cache and validate every topic.');})}>Stage connected import</Button></section>}

 </Surface>

 <Surface pad="lg" className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Saved imports</h2><Button variant="outline" size="sm" disabled={busy} onClick={()=>void perform(refresh)}>Refresh status</Button></div><label className="block">Import run<select aria-label="Import run" className="mt-2 w-full rounded-lg border border-line bg-panel p-3" value={selectedRun} onChange={e=>{const r=runs.find(r=>r.id===e.target.value);if(r)chooseRun(r);}}><option value="">Choose a saved run</option>{runs.map(r=><option key={r.id} value={r.id}>{connections.find(c=>c.id===r.connectionId)?.sourceCourseName} · {r.status} · {r.id.slice(0,8)}</option>)}</select></label>

 {run&&<><p className="text-sm text-ink-muted">{String((run.output.coverage as Record<string,number>|undefined)?.subtopics??0)} source subtopics · {Object.values((run.output.topics??{}) as Record<string,{media:unknown[]}>).reduce((n,t)=>n+t.media.length,0)} cached assets</p><p role="status">{run.status} · {Object.keys((run.output.topics??{}) as object).length}/{run.input.snapshots.length} source topics cached · {Object.keys((run.output.modules??{}) as object).length} modules prepared</p>{run.error&&<p role="alert">{run.error}</p>}

 <div className="flex flex-wrap gap-3"><Button disabled={busy||!['queued','importing','failed'].includes(run.status)} onClick={()=>void perform(async()=>{let next=run;while(['queued','importing','failed'].includes(next.status)){next=(await api<{run:Run}>(endpoint,{method:'POST',body:{action:'advance',runId:run.id}})).run;setRuns(rows=>rows.map(r=>r.id===next.id?next:r));if(next.status==='failed')break;}await refresh();setMessage('Source import completed. Review the objective mappings next.');})}>Resume source import</Button>

 <Button disabled={busy||run.status!=='imported'||!!run.output.objectiveMappings} onClick={()=>void perform(async()=>{const r=await api<{run:Run}>(endpoint,{method:'POST',body:{action:'propose',runId:run.id}});chooseRun(r.run);await refresh();setMessage('Objective mappings and audience brief proposed for review. The live course and its approved objectives are unchanged.');})}>Propose course plan and outcomes</Button>
 <Button variant="outline" disabled={busy} onClick={()=>void perform(async()=>{setUpdates(await api(endpoint,{method:'POST',body:{action:'updates',connectionId:run.connectionId}}));})}>Check for source updates</Button></div>

 {Array.isArray(run.output.conflicts)&&run.output.conflicts.length>0&&<section className="space-y-3"><h3 className="font-semibold">Resolve source and creator conflicts</h3><p>Choose which content to keep for each conflicting field. Other edits are preserved.</p>{(run.output.conflicts as string[]).map(path=><label key={path} className="block">{path}<select value={resolutions[path]??''} onChange={e=>setResolutions({...resolutions,[path]:e.target.value as 'local'|'incoming'})}><option value="">Choose a resolution</option><option value="local">Keep creator content</option><option value="incoming">Use imported content</option></select></label>)}<Button disabled={busy||(run.output.conflicts as string[]).some(p=>!resolutions[p])} onClick={()=>void perform(async()=>{await api(endpoint,{method:'POST',body:{action:'resolve',runId:run.id,expectedBriefRevision:run.output.conflictBriefRevision,decisions:resolutions}});await refresh();setMessage('Resolutions saved. Retry the apply or assembly step.');})}>Save conflict resolutions</Button></section>}
 {updates!==null&&<details open><summary>Source update report</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-4 text-xs">{JSON.stringify({changes:(updates as {changes:unknown}).changes,removed:(updates as {removed:unknown}).removed,coverage:(updates as {preview:Preview}).preview.coverage},null,2)}</pre><Button disabled={busy} onClick={()=>void perform(async()=>{const checked=updates as {preview:Preview & {snapshots:{selection:Selection;source:{topicId:string;title:string;objectives:string[]}}[]}};const r=await api<{run:Run}>(endpoint,{method:'POST',body:{action:'import',connectionId:run.connectionId,selections:checked.preview.snapshots.map(s=>s.selection),expectedFingerprint:checked.preview.fingerprint}});chooseRun(r.run);await refresh();setUpdates(null);setMessage('Update staged as a separate import draft. Published editions were preserved.');})}>Stage source updates as a new draft</Button></details>}

 {['imported','preparing','prepared','preparation_failed','review_blocked','applied'].includes(run.status)&&<section className="space-y-4"><details><summary className="font-semibold">Review source-to-LMS outcomes ({objectives.length})</summary><div className="mt-4 space-y-4"><p className="text-sm text-ink-muted">The original objectives remain immutable. Replace external-tool building or execution claims with outcomes learners can demonstrate by running and explaining the supplied workflow.</p>{objectives.map((o,i)=><div key={i} className="space-y-2 rounded-lg border border-line p-3"><p className="text-sm text-ink-muted">Source: {o.original}</p><label className="block">LMS outcome {i+1}<textarea className="mt-1 min-h-20 w-full rounded-lg border border-line bg-panel p-2" value={o.text} onChange={e=>{setAccepted(false);setObjectives(objectives.map((x,n)=>n===i?{...x,text:e.target.value}:x));}}/></label><select aria-label={`Bloom level for outcome ${i+1}`} value={o.bloom} onChange={e=>setObjectives(objectives.map((x,n)=>n===i?{...x,bloom:e.target.value as ObjectiveMapping['bloom']}:x))}>{['Remember','Understand','Apply','Analyze','Evaluate','Create'].map(b=><option key={b}>{b}</option>)}</select></div>)}<label className="flex items-center gap-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>I reviewed these mappings and the change from external tool work to guided exploration.</label><Button disabled={busy||!accepted||!currentTarget} onClick={()=>void perform(async()=>{const r=await api<{course:CreatorDraft;message:string}>(endpoint,{method:'POST',body:{action:'applyBrief',runId:run.id,expectedBriefRevision:currentTarget!.revision,objectives,acceptObjectiveChanges:true}});setTargets(rows=>rows.map(c=>c.id===r.course.id?r.course:c));await refresh();setMessage(r.message);})}>Save mapped brief and source library</Button></div></details>

 <div className="flex flex-wrap gap-3"><Button disabled={busy||!run.output.briefRevision||(run.status==='applied'||run.status==='prepared')} onClick={()=>void perform(async()=>{const r=await api<{run:Run}>(endpoint,{method:'POST',body:{action:'prepare',runId:run.id}});await refresh();setMessage(r.run.status==='prepared'?'Preparation complete; ready for human review.':'Saved the next preparation step. Continue to prepare remaining modules, project and quality review.');})}>Prepare next course step</Button><Button variant="outline" disabled={busy||run.status!=='prepared'||!run.output.objectiveReviewed} onClick={()=>void perform(async()=>{const r=await api<{message:string}>(endpoint,{method:'POST',body:{action:'assemble',runId:run.id}});await refresh();setMessage(r.message);})}>Assemble validated draft</Button></div>

 {!run.output.objectiveReviewed&&<p className="text-sm text-ink-muted">Next: review the 21 source-to-LMS outcomes above, then save the mapped brief. Blueprint review and final approval follow before publication.</p>}
 <details className="rounded-lg border border-line p-4"><summary>Preview prepared learning content — unapproved draft</summary><div className="mt-4 space-y-4">{Object.values((run.output.modules??{}) as Record<string,AuthoredCoursePackageData['modules'][number]>).map(m=><details key={m.id}><summary>{m.id}: {m.title}</summary><div className="mt-3 space-y-3 text-sm"><h4 className="font-semibold">Problem hook</h4><p>{m.problemHook.situation}</p><p>{m.problemHook.question}</p><h4 className="font-semibold">Concept lessons</h4>{m.conceptExplainer.videos.map(v=><details key={v.id}><summary>{v.title}</summary>{v.sourceMedia?.video?<video controls preload="metadata" aria-label={`Source video: ${v.title}`} src={v.sourceMedia.video} className="my-3 w-full max-w-2xl"/>:v.sourceMedia?.audio?<audio controls preload="metadata" aria-label={`Source narration: ${v.title}`} src={v.sourceMedia.audio} className="my-3 w-full"/>:null}{v.slides.map(s=><p key={s.id} className="my-3 leading-relaxed">{s.narration}</p>)}</details>)}<h4 className="font-semibold">Worked examples</h4>{m.workedExamples.map(e=><div key={e.id}><p>{e.problem}</p><ol className="list-decimal pl-5">{e.reasoning.map((r,i)=><li key={i}>{r}</li>)}</ol><p>{e.result}</p></div>)}<h4 className="font-semibold">Guided practice</h4><p>{m.guidedPractice.instructions}</p><h4 className="font-semibold">Scenario lab</h4>{m.scenarioLab.scenarios.map(s=><p key={s.id}>{s.situation} {s.challenge}</p>)}<h4 className="font-semibold">Module quiz</h4>{m.moduleQuiz?.questions.map(q=><details key={q.id}><summary>{q.prompt}</summary><ul>{q.choices.map((c,i)=><li key={i}>{c}</li>)}</ul><p>{q.explanation}</p></details>)}</div></details>)}{run.output.courseEnd!==undefined&&run.output.courseEnd!==null&&<details><summary>Guided project, final assessment and reflection</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(run.output.courseEnd,null,2)}</pre></details>}</div></details>
 {run.output.quality!==undefined&&<pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-4 text-sm">{JSON.stringify(run.output.quality,null,2)}</pre>}

 {connection&&<div className="flex flex-wrap gap-4 text-sm"><Link className="text-brand-ink underline" href={`/content/courses/${connection.targetCourseId}/blueprint`}>Review blueprint modules</Link><Link className="text-brand-ink underline" href={`/content/courses/${connection.targetCourseId}/authoring`}>Final review and publication</Link></div>}

 </section>}

 </>}

 </Surface>{busy&&<p role="status">Processing the current step. Completed work is saved between requests.</p>}{error&&<p role="alert" className="text-danger">{error}</p>}{message&&<p role="status">{message}</p>}

 </div>;

}
