"use client";
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Maximize, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PackageState } from '@/lib/imported-courses';

export function ImportedModulePlayer({ courseId, moduleId, courseTitle, moduleTitle, html, initial }: {
  courseId: string; moduleId: string; courseTitle: string; moduleTitle: string; html: string; initial: PackageState;
}) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const token = React.useId();
  const latest = React.useRef(initial);
  const pending = React.useRef<PackageState | null>(null);
  const saving = React.useRef(false);
  const [message, setMessage] = React.useState('Progress saves automatically');
  const [completed, setCompleted] = React.useState(initial.cmi['cmi.completion_status'] === 'completed');
  const endpoint = `/api/v1/imported-courses/${courseId}/${moduleId}/progress`;
  const save = React.useCallback(async (state: PackageState) => {
    pending.current = state;
    if (saving.current) return;
    saving.current = true;
    try {
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        await api(endpoint, { method: 'PUT', body: next });
      }
      setMessage('Progress saved');
    } catch { setMessage('Could not save progress. Use Save progress to retry.'); }
    finally { saving.current = false; }
  }, [endpoint]);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.protocol !== 'lms-scorm-v1' || event.data.token !== token) return;
      const state = event.data.state as PackageState;
      if (state?.version !== 1 || !state.cmi || !state.storage || typeof state.cmi !== 'object' || typeof state.storage !== 'object') return;
      latest.current = state;
      setCompleted(state.cmi['cmi.completion_status'] === 'completed');
      clearTimeout(timer);
      timer = setTimeout(() => void save(state), 400);
    };
    const flush = () => { void fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(latest.current), keepalive: true }); };
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(timer); window.removeEventListener('message', receive); window.removeEventListener('pagehide', flush); void save(latest.current); };
  }, [token, save, endpoint]);
  const document = React.useMemo(() => {
    const boot = JSON.stringify({ token, state: initial }).replace(/</g, '\\u003c');
    const policy = "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob: https://scorm-builder-gcs.b-cdn.net; connect-src 'self' https://scorm-builder-gcs.b-cdn.net; frame-src https://drive.google.com; form-action 'none'; base-uri 'self'";
    const injection = `<meta http-equiv="Content-Security-Policy" content="${policy}"><link rel="stylesheet" href="/course-packages/import-adapter.css"><base href="/course-packages/${courseId}/${moduleId}/"><script>window.__LMS_SCORM_BOOTSTRAP__=${boot};</script><script src="/course-packages/scorm-runtime.js"></script>`;
    return html.replace('<head>', '<head>' + injection);
  }, [html, courseId, moduleId, initial, token]);
  return <main className="flex h-dvh min-h-0 flex-col bg-bg">
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-3 pr-20">
      <Button asChild variant="ghost" size="icon"><Link href={`/learn/courses/${courseId}`} aria-label="Back to course"><ArrowLeft /></Link></Button>
      <div className="min-w-0 flex-1"><p className="text-xs text-ink-muted">{courseTitle} · Module {moduleId.replace(/^M/i, "")}</p><h1 className="text-base font-semibold">{moduleTitle}</h1></div>
      <span role="status" className="text-xs text-ink-muted">{completed ? 'Module completed · ' : ''}{message}</span>
      <Button variant="outline" size="sm" onClick={() => { frame.current?.contentWindow?.postMessage({ protocol: 'lms-scorm-save', token }, '*'); void save(latest.current); }}><Save />Save progress</Button>
      <Button variant="ghost" size="icon" aria-label="Full screen module" onClick={() => void frame.current?.requestFullscreen()}><Maximize /></Button>
    </header>
    <iframe ref={frame} title={`${moduleTitle} — learning module`} className="min-h-0 w-full flex-1 border-0 bg-panel" sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox" allow="autoplay; fullscreen" srcDoc={document} />
  </main>;
}
