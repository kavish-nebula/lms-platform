'use client';
import { Textarea } from '@/components/ui/textarea';
import type { CourseBriefData } from '@/lib/content-creator';
import type { SourceLibraryData } from '@/lib/source-library';

type Unit = SourceLibraryData['modules'][number];
export function ModuleInstructionsEditor({ unit, modules, objectives, onChange }: { unit: Unit; modules: Unit[]; objectives: CourseBriefData['objectives']; onChange: (unit: Unit) => void }) {
  const instructions = unit.instructions ?? { version: 1 as const, objectiveIds: [], scope: '', exclusions: '', prerequisites: '', dependsOn: [], teachingNotes: '' };
  const set = (patch: Partial<typeof instructions>) => onChange({ ...unit, instructions: { ...instructions, ...patch } });
  return <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer font-medium">Module instructions and objectives</summary>
    <p className="text-sm text-ink-muted">These instructions apply only to this module. Shared teaching and review rules apply to every module. Keep SME explanations and video transcripts in evidence records below.</p>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Module objectives</legend><p className="text-xs text-ink-muted">If none are selected, objectives come from this module’s mapped sources. Every selected objective needs reviewed concept-video evidence.</p>
      {objectives.map((o, i) => <label key={i} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={instructions.objectiveIds.includes(`O${i + 1}`)} onChange={e => set({ objectiveIds: e.target.checked ? [...instructions.objectiveIds, `O${i + 1}`] : instructions.objectiveIds.filter(id => id !== `O${i + 1}`) })} />O{i + 1}: {o.text || 'Untitled objective'}</label>)}
    </fieldset>
    {([['scope', 'Include in this module'], ['exclusions', 'Leave for other modules / out of scope'], ['prerequisites', 'What learners should already know'], ['teachingNotes', 'Teaching preferences and clarification notes']] as const).map(([key, label]) => <div key={key} className="space-y-2"><label htmlFor={`${unit.id}-${key}`} className="block text-sm font-medium">{label}</label><Textarea id={`${unit.id}-${key}`} rows={3} maxLength={12000} value={instructions[key]} onChange={e => set({ [key]: e.target.value })} /></div>)}
    {modules.findIndex(m => m.id === unit.id) > 0 && <fieldset className="space-y-2"><legend className="text-sm font-medium">Required earlier modules</legend>{modules.slice(0, modules.findIndex(m => m.id === unit.id)).map(m => <label key={m.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={instructions.dependsOn.includes(m.id)} onChange={e => set({ dependsOn: e.target.checked ? [...instructions.dependsOn, m.id] : instructions.dependsOn.filter(id => id !== m.id) })} />{m.title || m.id}</label>)}</fieldset>}
  </details>;
}
