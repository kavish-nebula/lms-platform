'use client';
import * as React from 'react';
import { ConnectedScormImporter } from './connected-scorm-importer';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/kit/surface';

type ImportRow = { courseId: string; id: string; topicId: string; title: string; version: number; status: string; active: boolean; fingerprint: string };
type Preview = { topicId: string; title: string; version: number; status: string; objectives: string[]; concepts: number; lessons: number };
type Structure = { modules: { num: number; topics: { topicId: string; title: string; status: string }[] }[] };
export function ScormImporter() { return <><ConnectedScormImporter /><details className="mt-8"><summary>Legacy topic pilot importer</summary><LegacyScormImporter /></details></>; }
function LegacyScormImporter() {
  const [courses, setCourses] = React.useState<{ name: string }[]>([]);
  const [imports, setImports] = React.useState<ImportRow[]>([]);
  const [course, setCourse] = React.useState(''); const [topic, setTopic] = React.useState('');
  const [structure, setStructure] = React.useState<Structure | null>(null); const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState(''); const [message, setMessage] = React.useState('');
  const requestId = React.useRef(0);
  async function library() {
    const result = await api<{ library: { courses: { name: string }[] }; imports: ImportRow[] }>('/api/v1/scorm-builder');
    setCourses(result.library.courses); setImports(result.imports);
  }
  React.useEffect(() => {
    let alive = true;
    void api<{ library: { courses: { name: string }[] }; imports: ImportRow[] }>('/api/v1/scorm-builder').then(result => {
      if (alive) { setCourses(result.library.courses); setImports(result.imports); }
    }).catch(() => { if (alive) setError('Unable to connect. Check the SCORM Builder MCP login and try again.'); });
    return () => { alive = false; };
  }, []);
  async function selectCourse(value: string) {
    const id = ++requestId.current; setCourse(value); setTopic(''); setPreview(null); setStructure(null); setError('');
    if (!value) return; setBusy(true);
    try { const result = await api<{ structure: Structure }>(`/api/v1/scorm-builder?courseName=${encodeURIComponent(value)}`); if (id === requestId.current) setStructure(result.structure); }
    catch { if (id === requestId.current) setError('Could not load this course.'); } finally { if (id === requestId.current) setBusy(false); }
  }
  async function selectTopic(value: string) {
    const id = ++requestId.current; setTopic(value); setPreview(null); setError(''); if (!value) return; setBusy(true);
    try { const result = await api<{ preview: Preview }>(`/api/v1/scorm-builder?courseName=${encodeURIComponent(course)}&topicId=${encodeURIComponent(value)}`); if (id === requestId.current) setPreview(result.preview); }
    catch { if (id === requestId.current) setError('Could not read this topic.'); } finally { if (id === requestId.current) setBusy(false); }
  }
  async function action(payload: object) {
    setBusy(true); setError(''); setMessage('');
    try { await api('/api/v1/scorm-builder', { method: 'POST', body: payload }); await library(); setMessage('Saved. Source content and existing learner progress were preserved.'); }
    catch { setError('Could not complete this action. Refresh the source preview if its version changed.'); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><Link href="/content" className="text-brand-ink hover:underline">← Creator workspace</Link><header className="space-y-2"><h1 className="text-3xl font-semibold">Import from SCORM Builder</h1><p className="text-ink-muted">Select source teaching, review its version, then enable a learner pilot. A pilot does not approve or publish the source course.</p></header>
    <Surface pad="lg" className="space-y-5">
      <label className="block space-y-2"><span>Course</span><select className="w-full rounded-lg border border-line bg-panel p-3 text-ink" value={course} onChange={e => void selectCourse(e.target.value)}><option value="">Choose a course</option>{courses.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
      <label className="block space-y-2"><span>Module and topic</span><select disabled={!structure || busy} className="w-full rounded-lg border border-line bg-panel p-3 text-ink" value={topic} onChange={e => void selectTopic(e.target.value)}><option value="">Choose a topic</option>{structure?.modules.map(m => <optgroup key={m.num} label={`Module ${m.num}`}>{m.topics.map(t => <option key={t.topicId} value={t.topicId}>{t.topicId} · {t.title} · {t.status}</option>)}</optgroup>)}</select></label>
      {preview && <section className="space-y-3"><h2 className="text-xl font-semibold">{preview.title}</h2><p>Source version {preview.version} · {preview.status} · {preview.concepts} concepts · {preview.lessons} lessons</p><ul className="list-disc space-y-2 pl-5">{preview.objectives.map(o => <li key={o}>{o}</li>)}</ul><p className="text-sm text-ink-muted">Original text, transcripts and assessments are retained. External tasks need review; new midpoint checks and a course-wide final are not invented by import.</p><Button disabled={busy} onClick={() => void action({ action: 'import', courseName: course, topicId: topic, expectedVersion: preview.version })}>Import this revision</Button></section>}
      {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </Surface>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Imported revisions</h2>{imports.map(row => <Surface key={row.id} pad="lg" className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">{row.title}</h3><p className="text-sm text-ink-muted">{row.topicId} · Source v{row.version} · {row.status}{row.active ? ' · Learner pilot enabled' : ''}</p>{row.active && <Link className="text-brand-ink underline" href={`/learn/courses/${row.courseId}`}>Open learner course</Link>}</div><Button disabled={busy || row.active} onClick={() => void action({ action: 'activate', importId: row.id, fingerprint: row.fingerprint })}>{row.active ? 'Pilot enabled' : 'Enable learner pilot'}</Button></Surface>)}</section>
  </div>;
}
