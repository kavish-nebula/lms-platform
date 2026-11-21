'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SourceLibraryData } from '@/lib/source-library';
import type { CourseBriefData } from '@/lib/content-creator';
import type { MiniProjectPlanData } from '@/lib/sme-mini-project';
import type { AuthoredCoursePackageData } from '@/lib/authored-course';

const taskId = () => `PT${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
export function MiniProjectSourceEditor({ courseId, library, objectives, onChange }: {
  courseId?: string; library: SourceLibraryData; objectives: CourseBriefData['objectives']; onChange: (plan: MiniProjectPlanData | undefined) => void;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const plan = library.miniProject;
  const teaching = library.sources.filter(s => !s.purpose);
  const blankTask = () => ({ id: taskId(), title: '', instruction: '', expectedEvidence: '', criterion: '', moduleIds: library.modules.map(m => m.id), objectiveIds: objectives.flatMap((o, i) => o.text.trim() ? [`O${i + 1}`] : []), sourceIds: teaching.slice(0, 60).map(s => s.id) });
  const edit = (patch: Partial<MiniProjectPlanData>) => { onChange({ ...plan!, ...patch }); setMessage(''); };
  async function importExisting() {
    if (!courseId) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/content/courses/${courseId}/authoring`, { cache: 'no-store' }), state = await response.json();
      if (!response.ok) throw Error(state.error?.message ?? 'Could not read the existing project.');
      const content: AuthoredCoursePackageData | undefined = state.revisions?.[0]?.content;
      if (!content) throw Error('There is no assembled project yet. Add a new project workspace below.');
      const project = content.courseEnd.miniProject;
      const tasks = project.tasks ?? project.rubric.map((criterion, i) => {
        const definition = project.sandbox?.criteria.find(c => c.rubricIndex === i);
        const prompt = project.sandbox?.guided?.prompts.find(p => p.criterionId === definition?.id);
        const moduleIds = content.modules.filter(m => m.conceptExplainer.videos.some(v => definition?.videoIds.includes(v.id))).map(m => m.id);
        return { id: taskId(), title: (prompt?.label ?? `Task ${i + 1}`).slice(0, 200), instruction: prompt?.label ?? criterion, expectedEvidence: criterion, criterion,
          moduleIds: moduleIds.length ? moduleIds : library.modules.map(m => m.id), objectiveIds: definition?.objectiveIds ?? project.objectiveIds, sourceIds: (definition?.sourceIds ?? project.sourceIds).filter(id => teaching.some(s => s.id === id)) };
      });
      onChange({ title: project.title, brief: project.brief, deliverable: project.deliverable, tasks });
      setMessage('Copied the existing project into your editable SME plan. Save draft to keep it. Its runnable workflow remains in the assembled course for review.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not copy the project.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Course-end mini project workspace" className="space-y-4 rounded-xl border border-line bg-panel-2 p-5">
    <p className="text-sm font-medium text-brand-ink">After all {library.modules.length} modules</p>
    <h3 className="text-xl font-semibold">Mini project workspace</h3>
    <p className="text-sm text-ink-muted">Define one integrated project for learners to explore, run and explain inside the course. Add the tasks they must accomplish, the final deliverable and the success criteria. It appears before the final assessment and reflection.</p>
    {!plan && <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={!library.modules.length || busy} onClick={() => onChange({ title: '', brief: '', deliverable: '', tasks: [blankTask()] })}>Add mini project workspace</Button>{courseId && <Button type="button" variant="outline" disabled={busy} onClick={() => void importExisting()}>{busy ? 'Reading project…' : 'Use existing course project'}</Button>}</div>}
    {plan && <fieldset disabled={busy} className="space-y-5">
      <label className="block text-sm font-medium" htmlFor="mini-project-title">Mini project name</label><Input id="mini-project-title" maxLength={200} value={plan.title} onChange={e => edit({ title: e.target.value })} />
      <label className="block text-sm font-medium" htmlFor="mini-project-brief">Project challenge / task brief</label><Textarea id="mini-project-brief" rows={4} maxLength={12000} value={plan.brief} onChange={e => edit({ brief: e.target.value })} />
      <label className="block text-sm font-medium" htmlFor="mini-project-deliverable">Final deliverable to submit</label><Textarea id="mini-project-deliverable" rows={3} maxLength={12000} value={plan.deliverable} onChange={e => edit({ deliverable: e.target.value })} />
      <h4 className="font-semibold">Tasks to accomplish</h4>
      {plan.tasks.map((task, index) => {
        const change = (patch: Partial<typeof task>) => edit({ tasks: plan.tasks.map(t => t.id === task.id ? { ...t, ...patch } : t) });
        return <fieldset key={task.id} className="space-y-3 rounded-lg border border-line bg-panel p-4"><legend className="px-1 font-medium">Task {index + 1}</legend>
          <label className="block text-sm" htmlFor={`${task.id}-title`}>Task name</label><Input id={`${task.id}-title`} maxLength={200} value={task.title} onChange={e => change({ title: e.target.value })} />
          {(['instruction', 'expectedEvidence', 'criterion'] as const).map(field => <div key={field} className="space-y-2"><label className="block text-sm" htmlFor={`${task.id}-${field}`}>{field === 'instruction' ? 'What the learner must do' : field === 'expectedEvidence' ? 'Expected evidence / output' : 'Success criterion'}</label><Textarea id={`${task.id}-${field}`} rows={3} maxLength={12000} value={task[field]} onChange={e => change({ [field]: e.target.value })} /></div>)}
          <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">Module, objective and source coverage</summary>
            <p className="text-xs text-ink-muted">These are declared mappings. Review whether the task actually applies each selected concept.</p>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Modules used</legend>{library.modules.map(m => <label key={m.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={task.moduleIds.includes(m.id)} onChange={e => change({ moduleIds: e.target.checked ? [...task.moduleIds, m.id] : task.moduleIds.filter(id => id !== m.id) })} />{m.title || m.id}</label>)}</fieldset>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Objectives applied</legend>{objectives.map((o, i) => <label key={i} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={task.objectiveIds.includes(`O${i + 1}`)} onChange={e => change({ objectiveIds: e.target.checked ? [...task.objectiveIds, `O${i + 1}`] : task.objectiveIds.filter(id => id !== `O${i + 1}`) })} />O{i + 1}: {o.text || 'Untitled objective'}</label>)}</fieldset>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Teaching sources</legend>{teaching.map(s => <label key={s.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={task.sourceIds.includes(s.id)} onChange={e => change({ sourceIds: e.target.checked ? [...task.sourceIds, s.id] : task.sourceIds.filter(id => id !== s.id) })} />{s.title || s.id}</label>)}</fieldset>
          </details>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={index === 0} onClick={() => { const tasks = [...plan.tasks]; [tasks[index - 1], tasks[index]] = [tasks[index], tasks[index - 1]]; edit({ tasks }); }}>Move task up</Button><Button type="button" variant="outline" disabled={plan.tasks.length <= 1} onClick={() => edit({ tasks: plan.tasks.filter(t => t.id !== task.id) })}>Remove task {index + 1}</Button></div>
        </fieldset>;
      })}
      <Button type="button" variant="outline" disabled={plan.tasks.length >= 30} onClick={() => edit({ tasks: [...plan.tasks, blankTask()] })}>Add project task</Button>
      <p className="text-sm text-ink-muted">Save draft to store this plan. Stage 5 assembles and reviews the ready-made workflow, sample cases and explanation grading. A task brief alone does not create or publish a runnable workspace.</p>
      <div className="flex flex-wrap gap-3">{courseId && <Button type="button" variant="outline" asChild><Link href={`/content/courses/${courseId}/authoring`}>Review project in Stage 5</Link></Button>}<Button type="button" variant="outline" onClick={() => onChange(undefined)}>Remove mini project plan</Button></div>
    </fieldset>}
    {message && <p role="status" className="text-sm text-brand-ink">{message}</p>}
  </section>;
}
