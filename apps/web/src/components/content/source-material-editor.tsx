'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VideoSourceEditor } from './video-source-editor';
import { SourceMediaEditor } from './source-media-editor';
import Link from 'next/link';
import type { SourceRecord } from '@/lib/source-library';
import type { CourseBriefData } from '@/lib/content-creator';

export function SourceMaterialEditor({ source, objectives, courseId, onChange, onRemove, scopeControls, concept = false }: {
  source: SourceRecord; objectives: CourseBriefData['objectives']; courseId?: string;
  onChange: (patch: Partial<SourceRecord>) => void; onRemove: () => void; scopeControls?: React.ReactNode;
  concept?: boolean;
}) {
  const s = source;
  const context = <><label className="block text-sm font-medium" htmlFor={`source-context-${s.id}`}>{concept ? 'Context' : 'Topic context'}</label><Textarea id={`source-context-${s.id}`} rows={3} maxLength={12000} value={s.context ?? ''} onChange={e => onChange({ context: e.target.value })} /></>;
  const metadata = <>
    <label className="block text-sm" htmlFor={`source-title-${s.id}`}>Source title</label><Input id={`source-title-${s.id}`} maxLength={200} value={s.title} onChange={e => onChange({ title: e.target.value })} />
    {scopeControls}
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Supported objectives</legend>{objectives.map((o, n) => <label key={n} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-brand" checked={s.objectiveIds.includes(`O${n + 1}`)} onChange={e => onChange({ objectiveIds: e.target.checked ? [...s.objectiveIds, `O${n + 1}`] : s.objectiveIds.filter(id => id !== `O${n + 1}`) })} />O{n + 1}: {o.text || 'Untitled objective'}</label>)}</fieldset>
    <label className="block text-sm font-medium" htmlFor={`source-ref-${s.id}`}>Source reference or URL</label><p className="text-xs text-ink-muted">Name the document, author or approved source. URLs are stored as references and are not fetched.</p><Input id={`source-ref-${s.id}`} maxLength={2000} value={s.reference} onChange={e => onChange({ reference: e.target.value })} />
    <label className="block text-sm font-medium" htmlFor={`source-text-${s.id}`}>{s.video ? 'Additional teaching / source text' : 'Teaching / source text'}</label><Textarea id={`source-text-${s.id}`} rows={5} maxLength={100000} value={s.video ? s.supplementalText ?? '' : s.text} onChange={e => onChange(s.video ? { supplementalText: e.target.value } : { text: e.target.value })} />
    {s.video && <p className="text-xs text-ink-muted">These notes are separate from the reviewed video transcript. Review that transcript inside Concept video below.</p>}
  </>;
  const media = <>
    {courseId && /automation.*(?:\bai\b|artificial)/i.test(s.title) && <Button asChild type="button" variant="outline"><Link href={`/content/courses/${courseId}/visual-lessons?sourceId=${encodeURIComponent(s.id)}`}>Create text-to-visual lesson</Link></Button>}
    <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer font-medium">Concept video{s.video ? ' · attached' : ''}</summary><div className="mt-3"><VideoSourceEditor source={s} courseId={courseId} onChange={onChange} /></div></details>
    <SourceMediaEditor source={s} courseId={courseId} onChange={onChange} />
  </>;
  if (concept) return <div className="space-y-3">
    {context}{media}
    <details className="space-y-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">Source details and objectives</summary><p className="text-xs text-ink-muted">{s.id} · revision {s.revision}</p>{metadata}<Button type="button" variant="outline" onClick={onRemove}>Remove material: {s.title || s.id}</Button></details>
  </div>;
  return <details open className="space-y-3 rounded-lg border border-line bg-panel p-4"><summary className="cursor-pointer font-medium">{s.title || 'Topic material'} · {s.id} · revision {s.revision}</summary>
    {metadata}{context}{media}
    <Button type="button" variant="outline" onClick={onRemove}>Remove material: {s.title || s.id}</Button>
  </details>;
}
