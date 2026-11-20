'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CourseBriefData } from '@/lib/content-creator';
import type { SourceLibraryData, SourceRecord } from '@/lib/source-library';

const newId = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
const newScenario = () => ({ id: newId('SC'), title: '', situation: '', challenge: '', expectedEvidence: '' });

export function ScenarioLabSourceEditor({ unit, library, objectives, onChange }: {
  unit: SourceLibraryData['modules'][number]; library: SourceLibraryData;
  objectives: CourseBriefData['objectives']; onChange: (value: SourceLibraryData) => void;
}) {
  const enabled = unit.scenarioLabEnabled !== false;
  const source = library.sources.find(s => s.moduleId === unit.id && s.purpose === 'scenario-lab');
  const update = (patch: Partial<SourceRecord>) => onChange({ ...library, sources: library.sources.map(s => s.id === source?.id ? { ...s, ...patch } : s) });
  const add = () => {
    const mapped = unit.instructions?.objectiveIds.length ? unit.instructions.objectiveIds : [...new Set(library.sources.filter(s => s.moduleId === unit.id && !s.purpose).flatMap(s => s.objectiveIds))];
    onChange({ ...library, sources: [...library.sources, { id: newId('S'), revision: 1, purpose: 'scenario-lab', scope: 'module', moduleId: unit.id, topicId: '', title: '', text: '', reference: '', objectiveIds: mapped, scenarios: [newScenario()] }] });
  };
  return <section aria-label={`Scenario Lab for ${unit.title || unit.id}`} className="space-y-4 rounded-xl border border-line bg-panel-2 p-4">
    <h4 className="font-semibold">5. Scenario Lab · optional</h4>
    <label className="flex items-center gap-3 text-sm font-medium" htmlFor={`${unit.id}-scenario-enabled`}><input id={`${unit.id}-scenario-enabled`} type="checkbox" className="size-4 accent-brand" checked={enabled} aria-describedby={`${unit.id}-scenario-help`} aria-controls={`${unit.id}-scenario-content`} onChange={e => onChange({ ...library, modules: library.modules.map(m => m.id === unit.id ? { ...m, scenarioLabEnabled: e.target.checked } : m) })} />Include a Scenario Lab in this module</label>
    <p id={`${unit.id}-scenario-help`} className="text-sm text-ink-muted">{enabled ? 'Learners apply the concepts to a new situation after guided practice. Add your own scenarios below, or leave the content empty to generate a lab from this module’s teaching.' : 'This module will continue from guided practice to the module quiz. Saved lab content is retained if you enable it later.'}</p>
    <div id={`${unit.id}-scenario-content`} hidden={!enabled} className="space-y-4">
      {source ? <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
        <label className="block text-sm font-medium" htmlFor={`${source.id}-title`}>Scenario Lab name</label><Input id={`${source.id}-title`} maxLength={200} value={source.title} onChange={e => update({ title: e.target.value })} />
        <label className="block text-sm font-medium" htmlFor={`${source.id}-text`}>Lab instructions</label><Textarea id={`${source.id}-text`} rows={3} maxLength={12000} value={source.text} onChange={e => update({ text: e.target.value })} />
        {(source.scenarios ?? []).map((scenario, index) => <fieldset key={scenario.id} className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Scenario {index + 1}</legend>
          {(['title', 'situation', 'challenge', 'expectedEvidence'] as const).map(field => <div key={field} className="space-y-2"><label className="block text-sm" htmlFor={`${scenario.id}-${field}`}>{field === 'title' ? 'Scenario name' : field === 'situation' ? 'Situation / context' : field === 'challenge' ? 'Learner task / decision' : 'Expected evidence / feedback'}</label><Textarea id={`${scenario.id}-${field}`} rows={field === 'title' ? 1 : 3} maxLength={field === 'title' ? 200 : 12000} value={scenario[field]} onChange={e => update({ scenarios: source.scenarios!.map(s => s.id === scenario.id ? { ...s, [field]: e.target.value } : s) })} /></div>)}
          <Button type="button" variant="outline" disabled={source.scenarios!.length <= 1} onClick={() => update({ scenarios: source.scenarios!.filter(s => s.id !== scenario.id) })}>Remove scenario {index + 1}</Button>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={(source.scenarios?.length ?? 0) >= 20} onClick={() => update({ scenarios: [...(source.scenarios ?? []), newScenario()] })}>Add scenario</Button>
        <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">Source reference and objectives</summary>
          <label className="block text-sm" htmlFor={`${source.id}-reference`}>Source reference</label><Input id={`${source.id}-reference`} maxLength={2000} value={source.reference} onChange={e => update({ reference: e.target.value })} />
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Scenario Lab objectives</legend>{objectives.map((objective, index) => { const id = `O${index + 1}`; return <label key={id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={source.objectiveIds.includes(id)} onChange={e => update({ objectiveIds: e.target.checked ? [...source.objectiveIds, id] : source.objectiveIds.filter(o => o !== id) })} />{id}: {objective.text || 'Untitled objective'}</label>; })}</fieldset>
        </details>
        <Button type="button" variant="outline" onClick={() => onChange({ ...library, sources: library.sources.filter(s => s.id !== source.id) })}>Remove custom lab content</Button>
        <p className="text-xs text-ink-muted">Removing custom content keeps the lab enabled for generation. Turn off the module switch to omit the lab.</p>
      </div> : <Button type="button" variant="outline" disabled={library.sources.length >= 100} onClick={add}>Add Scenario Lab content</Button>}
    </div>
  </section>;
}
