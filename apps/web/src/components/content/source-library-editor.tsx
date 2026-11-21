'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ModuleInstructionsEditor } from './module-instructions-editor';
import { ProblemHookSourceEditor } from './problem-hook-source-editor';
import { SourceMaterialEditor } from './source-material-editor';
import { ModuleActivitySourceEditor } from './module-activity-source-editor';
import { MiniProjectSourceEditor } from './mini-project-source-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { migrateSourceLibrary, type SourceLibraryData, type SourceRecord } from '@/lib/source-library';
import type { CourseBriefData } from '@/lib/content-creator';

const newId = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';
export function SourceLibraryEditor({ brief, onChange, onSourceChange, onMiniProjectChange, courseId }: {
  courseId?: string; brief: CourseBriefData; onChange: (library: SourceLibraryData) => void;
  onSourceChange: (sourceId: string, patch: Partial<SourceRecord>) => void;
  onMiniProjectChange?: (plan: SourceLibraryData['miniProject']) => void;
}) {
  const [activeModule, setActiveModule] = useState('');
  const library = brief.sourceLibrary;
  if (!library) return <section className="space-y-3 rounded-xl border border-line bg-panel p-5"><h2 className="text-lg font-semibold">Source library</h2><p className="text-sm text-ink-muted">This course uses legacy SME notes. Convert them to editable source records with the same source IDs. Existing published lessons remain unchanged. Map objectives before generating new content.</p><Button type="button" variant="outline" onClick={() => onChange(migrateSourceLibrary(brief))}>Convert notes to source library</Button></section>;
  const material = (moduleId = '', topicId = ''): SourceRecord => ({ id: newId('S'), revision: 1, title: topicId ? 'Topic teaching material' : '', scope: topicId ? 'topic' : 'course', moduleId, topicId, objectiveIds: library.modules.find(m => m.id === moduleId)?.instructions?.objectiveIds ?? [], text: '', reference: '' });
  const validTopicSource = (s: SourceRecord) => s.scope === 'topic' && library.modules.some(m => m.id === s.moduleId && m.topics.some(t => t.id === s.topicId));
  const editor = (s: SourceRecord, scopeControls?: React.ReactNode, concept = false) => <SourceMaterialEditor key={s.id} source={s} courseId={courseId} objectives={brief.objectives} scopeControls={scopeControls} concept={concept} onChange={patch => onSourceChange(s.id, patch)} onRemove={() => onChange({ ...library, sources: library.sources.filter(item => item.id !== s.id) })} />;
  return <fieldset className="min-w-0 space-y-5 rounded-xl border border-line bg-panel p-5 md:p-7"><legend className="px-2 text-lg font-semibold">Source library</legend>
    <label className="block text-sm font-medium" htmlFor="active-sme-module">Module workspace</label><select id="active-sme-module" className="min-h-11 rounded-lg border border-input bg-panel px-3" value={activeModule} onChange={e=>setActiveModule(e.target.value)}><option value="">Show all modules</option>{library.modules.map((m,i)=><option key={m.id} value={m.id}>Module {i+1}: {m.title || 'Untitled'}</option>)}</select><p className="text-sm text-ink-muted">Create, review and produce one module, then return here to add the next. The course is published only after every module, the mini project and final quiz are complete.</p>
    <p className="text-sm text-ink-muted">Start each module with a problem hook, add up to five concept topics, then supply worked examples, guided practice and a module quiz.</p>
    <h3 className="font-semibold">Module and topic outline</h3>
    <p className="text-sm text-ink-muted">Prepare one module at a time. Source IDs, mappings and revisions stay unchanged when existing material is shown under its topic.</p>
    {library.modules.map((m, i) => <section key={m.id} hidden={!!activeModule && activeModule !== m.id} className="space-y-4 rounded-lg border border-line p-3">
      <label className="block text-sm" htmlFor={`module-${m.id}`}>Module {i + 1} title · {m.id}</label><Input id={`module-${m.id}`} maxLength={200} value={m.title} onChange={e => onChange({ ...library, modules: library.modules.map(item => item.id === m.id ? { ...item, title: e.target.value } : item) })} />
      <ProblemHookSourceEditor unit={m} library={library} objectives={brief.objectives} onChange={onChange} />
      <h4 className="font-semibold">2. Concepts</h4>
      <p className="text-sm text-ink-muted">{m.topics.length <= 5 ? m.topics.length + ' of 5 topics' : m.topics.length + ' existing topics'}</p>
      {m.topics.map((t, n) => {
        const sources = library.sources.filter(s => s.scope === 'topic' && s.moduleId === m.id && s.topicId === t.id);
        return <section key={t.id} aria-label={'Topic materials: ' + (t.title || t.id)} className="space-y-4 rounded-xl border border-line bg-panel-2 p-4">
          <h5 className="font-semibold">Topic {n + 1}</h5>
          <label className="block text-sm font-medium" htmlFor={'topic-' + t.id}>Topic {n + 1} name</label><Input id={'topic-' + t.id} maxLength={200} value={t.title} onChange={e => onChange({ ...library, modules: library.modules.map(item => item.id === m.id ? { ...item, topics: item.topics.map(topic => topic.id === t.id ? { ...topic, title: e.target.value } : topic) } : item), sources: library.sources.map(s => s.scope === 'topic' && s.moduleId === m.id && s.topicId === t.id && (!s.title || s.title === 'Topic teaching material' || s.title === t.title) ? { ...s, title: e.target.value } : s) })} />
          {sources[0] ? editor(sources[0], undefined, true) : <Button type="button" variant="outline" disabled={library.sources.length >= 100} onClick={() => onChange({ ...library, sources: [...library.sources, material(m.id, t.id)] })}>Add concept materials</Button>}
          {sources.length > 0 && <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">Additional materials{sources.length > 1 ? ' (' + (sources.length - 1) + ')' : ''}</summary>
            {sources.slice(1).map(s => editor(s))}
            <Button type="button" variant="outline" disabled={library.sources.length >= 100} onClick={() => onChange({ ...library, sources: [...library.sources, material(m.id, t.id)] })}>Add material to {t.title || 'topic ' + (n + 1)}</Button>
          </details>}
          <Button type="button" variant="outline" onClick={() => onChange({ ...library, modules: library.modules.map(item => item.id === m.id ? { ...item, topics: item.topics.filter(topic => topic.id !== t.id) } : item) })}>Remove topic {n + 1}</Button>
        </section>;
      })}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={m.topics.length >= 5 || library.sources.length >= 100} onClick={() => {
        if (m.topics.length >= 5 || library.sources.length >= 100) return;
        const topic = { id: newId('T'), title: '' };
        onChange({ ...library, modules: library.modules.map(item => item.id === m.id ? { ...item, topics: [...item.topics, topic] } : item), sources: [...library.sources, material(m.id, topic.id)] });
      }}>Add topic to module {i + 1}</Button><Button type="button" variant="outline" onClick={() => onChange({ ...library, modules: library.modules.filter(item => item.id !== m.id) })}>Remove module {i + 1}</Button></div>
      <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => setActiveModule(m.id)}>Work on this module only</Button>{courseId && <Link className="text-sm text-brand-ink underline" href={`/content/courses/${courseId}/blueprint?moduleId=${m.id}`}>Save draft, then continue this module to Stage 2 →</Link>}</div><ModuleActivitySourceEditor unit={m} library={library} objectives={brief.objectives} onChange={onChange} />
      <ModuleInstructionsEditor unit={m} modules={library.modules} objectives={brief.objectives} onChange={unit => onChange({ ...library, modules: library.modules.map(item => item.id === unit.id ? unit : item) })} />
    </section>)}
    <Button type="button" variant="outline" disabled={library.modules.length >= 12 || library.sources.length >= 100} onClick={() => { const moduleId = newId('M'), topicId = newId('T'); onChange({ ...library, modules: [...library.modules, { id: moduleId, title: '', scenarioLabEnabled: false, topics: [{ id: topicId, title: '' }] }], sources: [...library.sources, material(moduleId, topicId)] }); }}>Add module</Button>
    <MiniProjectSourceEditor courseId={courseId} library={library} objectives={brief.objectives} onChange={plan => onMiniProjectChange ? onMiniProjectChange(plan) : onChange({ ...library, miniProject: plan })} />
    <h3 className="font-semibold">Shared course/module materials and unassigned sources</h3>
    <p className="text-sm text-ink-muted">Topic sources appear above. If an outline item is removed, its evidence stays here so you can reassign it without losing content.</p>
    {library.sources.filter(s => !validTopicSource(s) && (!s.purpose || !library.modules.some(m => m.id === s.moduleId))).map(s => editor(s, <>
      <label className="block text-sm" htmlFor={`source-scope-${s.id}`}>Scope</label><select id={`source-scope-${s.id}`} disabled={!!s.purpose} className={selectClass} value={s.scope} onChange={e => onSourceChange(s.id, { scope: e.target.value as typeof s.scope, moduleId: '', topicId: '' })}><option value="course">Entire course</option><option value="module">One module</option><option value="topic">One topic</option></select>
      {s.scope !== 'course' && <><label className="block text-sm" htmlFor={`source-module-${s.id}`}>Module</label><select id={`source-module-${s.id}`} className={selectClass} value={s.moduleId} onChange={e => onSourceChange(s.id, { moduleId: e.target.value, topicId: '' })}><option value="">Select module</option>{library.modules.map(m => <option key={m.id} value={m.id}>{m.title || m.id}</option>)}</select></>}
      {s.scope === 'topic' && <><label className="block text-sm" htmlFor={`source-topic-${s.id}`}>Topic</label><select id={`source-topic-${s.id}`} className={selectClass} value={s.topicId} onChange={e => onSourceChange(s.id, { topicId: e.target.value })}><option value="">Select topic</option>{library.modules.find(m => m.id === s.moduleId)?.topics.map(t => <option key={t.id} value={t.id}>{t.title || t.id}</option>)}</select></>}
    </>))}
    <Button type="button" variant="outline" disabled={library.sources.length >= 100} onClick={() => onChange({ ...library, sources: [...library.sources, material()] })}>Add shared source</Button>
  </fieldset>;
}
