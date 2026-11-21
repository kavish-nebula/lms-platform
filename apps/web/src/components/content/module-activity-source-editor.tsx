'use client';
import { Fragment } from 'react';
import { ScenarioLabSourceEditor } from './scenario-lab-source-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CourseBriefData } from '@/lib/content-creator';
import type { SourceLibraryData, SourceRecord } from '@/lib/source-library';

const newId = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
type Purpose = 'worked-example' | 'guided-practice' | 'module-quiz';
const blankQuestion = (id: string, objectiveIds: string[]): NonNullable<SourceRecord['quizQuestions']>[number] => ({ id, prompt: '', selectionType: 'single', choices: ['', '', '', ''], correctIndices: [], hint: '', explanation: '', objectiveIds });
// Older empty quizzes show an editable first question without making a clean
// brief dirty on load. The first question edit persists this stable placeholder.
const questionsFor = (source: SourceRecord) => source.quizQuestions?.length ? source.quizQuestions : [blankQuestion(`Q_${source.id.slice(0, 27)}`, source.objectiveIds)];

export function ModuleActivitySourceEditor({ unit, library, objectives, onChange }: {
  unit: SourceLibraryData['modules'][number]; library: SourceLibraryData;
  objectives: CourseBriefData['objectives']; onChange: (value: SourceLibraryData) => void;
}) {
  const mapped = unit.instructions?.objectiveIds.length ? unit.instructions.objectiveIds : [...new Set(library.sources.filter(s => s.moduleId === unit.id && !s.purpose).flatMap(s => s.objectiveIds))];
  const update = (source: SourceRecord, patch: Partial<SourceRecord>) => onChange({ ...library, sources: library.sources.map(s => s.id === source.id ? { ...s, ...patch } : s) });
  const remove = (source: SourceRecord) => onChange({ ...library, sources: library.sources.filter(s => s.id !== source.id) });
  const add = (purpose: Purpose) => {
    if (library.sources.length >= 100) return;
    const source: SourceRecord = { id: newId('S'), revision: 1, purpose, scope: 'module', moduleId: unit.id, topicId: '', title: '', text: '', reference: '', objectiveIds: mapped,
      ...(purpose === 'worked-example' ? { workedExample: { reasoning: [''], result: '' } } : purpose === 'guided-practice' ? { practiceSteps: [{ id: newId('P'), instruction: '', hint: '', evidence: '' }] } : { quizQuestions: [blankQuestion(newId('Q'), mapped)] }) };
    onChange({ ...library, sources: [...library.sources, source] });
  };
  const common = (source: SourceRecord, title: string, content: string) => <>
    <label className="block text-sm font-medium" htmlFor={`${source.id}-title`}>{title} name</label>
    <Input id={`${source.id}-title`} maxLength={200} value={source.title} onChange={e => update(source, { title: e.target.value })} />
    <label className="block text-sm font-medium" htmlFor={`${source.id}-text`}>{content}</label>
    <Textarea id={`${source.id}-text`} rows={4} maxLength={12000} value={source.text} onChange={e => update(source, { text: e.target.value })} />
  </>;
  const mapping = (source: SourceRecord) => <details className="space-y-3 rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-sm font-medium">Source reference and objectives</summary>
    <p className="text-xs text-ink-muted">{source.id} · revision {source.revision}. Save the draft to store your changes.</p>
    <label className="block text-sm font-medium" htmlFor={`${source.id}-reference`}>Source reference</label><Input id={`${source.id}-reference`} maxLength={2000} value={source.reference} onChange={e => update(source, { reference: e.target.value })} />
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Activity objectives</legend>{objectives.map((o, i) => <label key={i} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={source.objectiveIds.includes(`O${i + 1}`)} onChange={e => update(source, { objectiveIds: e.target.checked ? [...source.objectiveIds, `O${i + 1}`] : source.objectiveIds.filter(id => id !== `O${i + 1}`) })} />O{i + 1}: {o.text || 'Untitled objective'}</label>)}</fieldset>
  </details>;
  const sections: { purpose: Purpose; heading: string; addLabel: string; description: string }[] = [
    { purpose: 'worked-example', heading: '3. Worked examples', addLabel: 'Add worked example', description: 'Show a complete example with the problem, reasoning and result.' },
    { purpose: 'guided-practice', heading: '4. Guided practice', addLabel: 'Add guided practice', description: 'Give learners a task to attempt, with steps, hints and expected evidence.' },
    { purpose: 'module-quiz', heading: '6. Module quiz', addLabel: 'Add module quiz', description: 'Add questions taught by this module, with options, correct answers and feedback. This is the module-end quiz; video midpoint checks remain separate.' },
  ];
  return <div className="space-y-5">{sections.map(section => {
    const records = library.sources.filter(s => s.moduleId === unit.id && s.purpose === section.purpose);
    return <Fragment key={section.purpose}>{section.purpose === 'module-quiz' && <ScenarioLabSourceEditor unit={unit} library={library} objectives={objectives} onChange={onChange} />}<section aria-label={`${section.heading.slice(3)} for ${unit.title || unit.id}`} className="space-y-4 rounded-xl border border-line bg-panel-2 p-4">
      <h4 className="font-semibold">{section.heading}</h4><p className="text-sm text-ink-muted">{section.description} Optional: leave this section empty to generate it from the module teaching.</p>
      {records.map(source => <div key={source.id} className="space-y-4 rounded-lg border border-line bg-panel p-4">
        {common(source, section.purpose === 'worked-example' ? 'Worked example' : section.purpose === 'guided-practice' ? 'Guided practice' : 'Quiz', section.purpose === 'worked-example' ? 'Problem / starting situation' : section.purpose === 'guided-practice' ? 'Practice instructions' : 'Quiz instructions')}
        {section.purpose === 'worked-example' && <>
          <fieldset className="space-y-3"><legend className="text-sm font-medium">Reasoning steps</legend>{(source.workedExample?.reasoning ?? []).map((reason, i) => <div key={i} className="space-y-2"><label className="block text-sm" htmlFor={`${source.id}-reason-${i}`}>Reasoning step {i + 1}</label><Textarea id={`${source.id}-reason-${i}`} rows={2} maxLength={12000} value={reason} onChange={e => update(source, { workedExample: { result: source.workedExample?.result ?? '', reasoning: source.workedExample!.reasoning.map((r, n) => n === i ? e.target.value : r) } })} /><Button type="button" variant="outline" disabled={source.workedExample!.reasoning.length <= 1} onClick={() => update(source, { workedExample: { ...source.workedExample!, reasoning: source.workedExample!.reasoning.filter((_, n) => n !== i) } })}>Remove reasoning step {i + 1}</Button></div>)}</fieldset>
          <Button type="button" variant="outline" disabled={(source.workedExample?.reasoning.length ?? 0) >= 20} onClick={() => update(source, { workedExample: { result: source.workedExample?.result ?? '', reasoning: [...(source.workedExample?.reasoning ?? []), ''] } })}>Add reasoning step</Button>
          <label className="block text-sm font-medium" htmlFor={`${source.id}-result`}>Worked result</label><Textarea id={`${source.id}-result`} rows={3} maxLength={12000} value={source.workedExample?.result ?? ''} onChange={e => update(source, { workedExample: { reasoning: source.workedExample?.reasoning ?? [], result: e.target.value } })} />
        </>}
        {section.purpose === 'guided-practice' && <>
          {(source.practiceSteps ?? []).map((step, i) => <fieldset key={step.id} className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Practice step {i + 1}</legend>
            {(['instruction', 'hint', 'evidence'] as const).map(field => <div key={field} className="space-y-2"><label className="block text-sm" htmlFor={`${step.id}-${field}`}>{field === 'instruction' ? 'Task to attempt' : field === 'hint' ? 'Hint' : 'Expected evidence / feedback'}</label><Textarea id={`${step.id}-${field}`} rows={2} maxLength={12000} value={step[field]} onChange={e => update(source, { practiceSteps: source.practiceSteps!.map(p => p.id === step.id ? { ...p, [field]: e.target.value } : p) })} /></div>)}
            <Button type="button" variant="outline" disabled={source.practiceSteps!.length <= 1} onClick={() => update(source, { practiceSteps: source.practiceSteps!.filter(p => p.id !== step.id) })}>Remove practice step {i + 1}</Button>
          </fieldset>)}
          <Button type="button" variant="outline" disabled={(source.practiceSteps?.length ?? 0) >= 30} onClick={() => update(source, { practiceSteps: [...(source.practiceSteps ?? []), { id: newId('P'), instruction: '', hint: '', evidence: '' }] })}>Add practice step</Button>
        </>}
        {section.purpose === 'module-quiz' && <>
          <h5 className="font-semibold">Questions, options and correct answers</h5>
          <p className="text-sm text-ink-muted">Enter your question and options, then mark the right answer beside its option. For more than one right answer, choose Select all correct answers. Keep option lengths similar.</p>
          {questionsFor(source).map((q, i) => {
            const edit = (patch: Partial<typeof q>) => update(source, { quizQuestions: questionsFor(source).map(item => item.id === q.id ? { ...item, ...patch } : item) });
            return <fieldset key={q.id} className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 font-medium">Question {i + 1}</legend>
              <label className="block text-sm" htmlFor={`${q.id}-prompt`}>Question text</label><Textarea id={`${q.id}-prompt`} rows={3} maxLength={12000} value={q.prompt} onChange={e => edit({ prompt: e.target.value })} />
              <label className="block text-sm" htmlFor={`${q.id}-type`}>Answer type</label><select id={`${q.id}-type`} className="min-h-11 w-full rounded-lg border border-input bg-panel px-3 text-sm" value={q.selectionType} onChange={e => edit({ selectionType: e.target.value as typeof q.selectionType, correctIndices: e.target.value === 'single' ? q.correctIndices.slice(0, 1) : q.correctIndices })}><option value="single">Select one answer</option><option value="multiple">Select all correct answers</option></select>
              {q.choices.map((choice, n) => <div key={n} className="space-y-2 rounded-lg border border-line p-3"><label className="block text-sm" htmlFor={`${q.id}-option-${n}`}>Option {n + 1}</label><Input id={`${q.id}-option-${n}`} maxLength={12000} value={choice} onChange={e => edit({ choices: q.choices.map((c, index) => n === index ? e.target.value : c) })} /><label className="flex items-center gap-2 text-sm"><input type={q.selectionType === 'single' ? 'radio' : 'checkbox'} name={`${q.id}-correct`} checked={q.correctIndices.includes(n)} onChange={e => edit({ correctIndices: q.selectionType === 'single' ? [n] : e.target.checked ? [...q.correctIndices, n].sort((a, b) => a - b) : q.correctIndices.filter(index => index !== n) })} />Option {n + 1} is correct</label><Button type="button" variant="outline" disabled={q.choices.length <= 2} onClick={() => edit({ choices: q.choices.filter((_, index) => index !== n), correctIndices: q.correctIndices.filter(index => index !== n).map(index => index > n ? index - 1 : index) })}>Remove option {n + 1}</Button></div>)}
              <Button type="button" variant="outline" disabled={q.choices.length >= 5} onClick={() => edit({ choices: [...q.choices, ''] })}>Add option</Button>
              <p className="text-xs text-ink-muted">{q.selectionType === 'multiple' ? 'Select at least two correct options and leave at least one incorrect option. Learners must select the exact set.' : 'Select exactly one correct option.'}</p>
              {(['hint', 'explanation'] as const).map(field => <div key={field} className="space-y-2"><label className="block text-sm" htmlFor={`${q.id}-${field}`}>{field === 'hint' ? 'Question hint' : 'Answer explanation'}</label><Textarea id={`${q.id}-${field}`} rows={2} maxLength={12000} value={q[field]} onChange={e => edit({ [field]: e.target.value })} /></div>)}
              <fieldset className="space-y-2"><legend className="text-sm">Question objectives</legend>{source.objectiveIds.map(id => <label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={q.objectiveIds.includes(id)} onChange={e => edit({ objectiveIds: e.target.checked ? [...q.objectiveIds, id] : q.objectiveIds.filter(o => o !== id) })} />{id}: {objectives[Number(id.slice(1)) - 1]?.text}</label>)}</fieldset>
              <Button type="button" variant="outline" disabled={questionsFor(source).length <= 1} onClick={() => update(source, { quizQuestions: questionsFor(source).filter(item => item.id !== q.id) })}>Remove question {i + 1}</Button>
            </fieldset>;
          })}
          <Button type="button" variant="outline" disabled={questionsFor(source).length >= 100} onClick={() => update(source, { quizQuestions: [...questionsFor(source), blankQuestion(newId('Q'), source.objectiveIds)] })}>Add another question</Button>
        </>}
        {mapping(source)}<Button type="button" variant="outline" onClick={() => remove(source)}>Remove {section.purpose === 'worked-example' ? 'worked example' : section.purpose === 'guided-practice' ? 'guided practice' : 'module quiz'}</Button>
      </div>)}
      {(section.purpose === 'worked-example' || !records.length) && <Button type="button" variant="outline" disabled={library.sources.length >= 100 || (section.purpose === 'worked-example' && records.length >= 20)} onClick={() => add(section.purpose)}>{section.addLabel}</Button>}
    </section></Fragment>;
  })}</div>;
}
