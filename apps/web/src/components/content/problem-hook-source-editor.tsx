'use client';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { CourseBriefData } from '@/lib/content-creator';
import type { SourceLibraryData } from '@/lib/source-library';

export function ProblemHookSourceEditor({ unit, library, objectives, onChange }: {
  unit: SourceLibraryData['modules'][number]; library: SourceLibraryData;
  objectives: CourseBriefData['objectives']; onChange: (library: SourceLibraryData) => void;
}) {
  const source = library.sources.find(s => s.purpose === 'problem-hook' && s.moduleId === unit.id);
  const full = !source && library.sources.length >= 100;
  const field = `hook-content-${unit.id}`;
  function update(patch: Partial<SourceLibraryData['sources'][number]>) {
    const text = patch.text ?? source?.text ?? '';
    const title = patch.title ?? source?.title ?? '';
    if (!text.trim() && !title.trim()) { onChange({ ...library, sources: library.sources.filter(s => s.id !== source?.id) }); return; }
    const mapped = unit.instructions?.objectiveIds.length ? unit.instructions.objectiveIds : [...new Set(library.sources.filter(s => s.moduleId === unit.id && s.purpose !== 'problem-hook').flatMap(s => s.objectiveIds))];
    const next: SourceLibraryData['sources'][number] = source ? { ...source, ...patch } : {
      id: `S${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`, revision: 1,
      title, purpose: 'problem-hook',
      scope: 'module', moduleId: unit.id, topicId: '', objectiveIds: mapped, text, reference: 'SME-supplied opening situation', ...patch,
    };
    onChange({ ...library, sources: source ? library.sources.map(s => s.id === source.id ? next : s) : [...library.sources, next] });
  }
  return <section aria-label={`Problem hook for ${unit.title || unit.id}`} className="space-y-3 rounded-lg border border-line bg-panel-2 p-4">
    <h4 className="font-semibold">1. Problem hook</h4>
    <label htmlFor={`${field}-name`} className="block text-sm font-medium">Problem hook name</label>
    <Input id={`${field}-name`} maxLength={200} disabled={full} value={source?.title ?? ''} onChange={e => update({ title: e.target.value })} />
    <label htmlFor={field} className="block text-sm font-medium">Problem hook content (optional)</label>
    <Textarea id={field} rows={5} maxLength={12000} disabled={full} value={source?.text ?? ''} onChange={e => update({ text: e.target.value })} />
    {full && <p className="text-sm text-ink-muted">The source library is full. Remove an unused source before adding problem hook content.</p>}
    {source && <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">Hook source details and objectives</summary>
      <p className="text-xs text-ink-muted">Source {source.id}. Choose Save draft to store this content. Editing it requires regenerating and reviewing the affected module. It does not change a published course.</p>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Problem hook objectives</legend>
        {objectives.map((o, i) => <label key={i} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={source.objectiveIds.includes(`O${i + 1}`)} onChange={e => update({ objectiveIds: e.target.checked ? [...source.objectiveIds, `O${i + 1}`] : source.objectiveIds.filter(id => id !== `O${i + 1}`) })} />O{i + 1}: {o.text || 'Untitled objective'}</label>)}
        {!source.objectiveIds.length && <p className="text-sm text-ink-muted">Select the module objectives introduced by this situation. Concept videos must still teach these objectives.</p>}
      </fieldset>
    </details>}
  </section>;
}
