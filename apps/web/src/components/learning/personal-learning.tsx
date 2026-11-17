'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api, refreshEnrollments } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { LearningState } from '@/server/learning/service';
import type { KnowledgeQuestion } from '@/server/learning/pilot-policy';

type Attempt = { attemptId: string; title: string; kind: 'diagnostic' | 'review'; questions: (Omit<KnowledgeQuestion, 'correct'> & { multiple: boolean })[] };
export function PersonalLearning({ courseId, initialTopic = '' }: { courseId: string; initialTopic?: string }) {
  const base = `/api/v1/enrollments/${courseId}/learning`;
  const { data, error, mutate } = useSWR(base, (url: string) => api<LearningState & { enabled: boolean }>(url), { revalidateOnFocus: true });
  const [selected, setSelected] = useState(initialTopic), [attempt, setAttempt] = useState<Attempt | null>(null), [responses, setResponses] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const topic = data?.topics?.find(t => t.id === selected) ?? data?.topics?.[0];
  async function action(input: Record<string, unknown>) {
    setBusy(true); setMessage('');
    try {
      if (input.action === 'start') { setAttempt(await api<Attempt>(base, { method: 'POST', body: input })); setResponses({}); }
      else {
        const result = await api<{ passed: boolean | null }>(base, { method: 'POST', body: input });
        setAttempt(null); setResponses({}); setMessage(result.passed === true ? 'Check complete. Your learning path has been updated.' : result.passed === false ? 'Study the suggested review, then try its fresh practice questions.' : 'Check left without awarding knowledge credit. You can study the topic normally.');
        await mutate(); await refreshEnrollments();
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  if (error) return <p role="alert">Your learning path could not load. Enroll in the course, then try again.</p>;
  if (!data) return <p role="status">Loading your learning path…</p>;
  if (!data.enabled) return <p>This edition does not have a knowledge-based learning policy. You can follow the original course.</p>;
  return <div className="space-y-6">
    <p>Check what you already know, get help where you need it, and keep the original lessons available. Module quizzes, the project and the final assessment remain required.</p>
    {message && <p role="status" className="rounded-xl border border-line bg-panel-2 p-4">{message}</p>}
    {attempt ? <section aria-label="Independent knowledge check" className="space-y-5 rounded-xl border border-line bg-panel p-5">
      <h2 className="text-xl font-semibold">{attempt.kind === 'diagnostic' ? 'Check what I already know' : 'Targeted review practice'}: {attempt.title}</h2>
      <p>{attempt.kind === 'diagnostic' ? 'Answer independently, without hints. Both questions must be correct to demonstrate this topic. You get one diagnostic attempt for this edition.' : 'These fresh questions check the ideas you just reviewed. Review practice does not skip the original topic.'}</p>
      {attempt.questions.map(q => <fieldset key={q.id} className="space-y-2"><legend className="mb-2 font-medium">{q.prompt}</legend>{q.options.map((option, i) => <label key={i} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3"><input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} checked={(responses[q.id] ?? []).includes(i)} onChange={() => setResponses(old => ({ ...old, [q.id]: q.multiple ? (old[q.id] ?? []).includes(i) ? old[q.id].filter(n => n !== i) : [...(old[q.id] ?? []), i] : [i] }))} />{option}</label>)}</fieldset>)}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || attempt.questions.some(q => !(responses[q.id]?.length))} onClick={() => void action({ action: 'submit', attemptId: attempt.attemptId, responses })}>Submit check</Button><Button variant="outline" disabled={busy} onClick={() => void action({ action: 'cancel', attemptId: attempt.attemptId })}>Leave check and study</Button></div>
    </section> : <>
      <section aria-label="Your topic path" className="grid gap-4 md:grid-cols-2">{data.topics.map(t => <article key={t.id} className="space-y-3 rounded-xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">{t.title}</h2><p className="text-sm text-ink-muted">{t.disposition === 'demonstrated' ? 'Knowledge demonstrated — playback is optional.' : t.disposition === 'completed' ? 'Topic completed.' : 'Ready to study.'}</p>
        <div className="flex flex-wrap gap-2">{!t.diagnosticTaken && <Button variant="outline" disabled={busy} onClick={() => { setSelected(t.id); void action({ action: 'start', topicId: t.id, kind: 'diagnostic' }); }}>{t.openAttempt ? 'Resume knowledge check' : 'Check what I know'}</Button>}
          <Button variant="outline" asChild><Link href={t.href}>{t.disposition ? 'Review original topic' : 'Study this topic'}</Link></Button><Button variant="ghost" onClick={() => setSelected(t.id)}>Tutor and review</Button></div>
      </article>)}</section>
      {topic && <section aria-label="Targeted review" className="space-y-4 rounded-xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold">Support for {topic.title}</h2>
        {topic.review && <><p>{topic.review.reason}</p><p>{topic.review.explanation}</p><p className="rounded-lg bg-panel-2 p-4">Worked example: {topic.review.example}</p>{topic.review.completed ? <p>Review practice completed. The original attempt and grade are preserved.</p> : <Button disabled={busy} onClick={() => void action({ action: 'start', topicId: topic.id, kind: 'review' })}>Practise this review</Button>}</>}
        <LearningTutor key={topic.id} base={base} topicId={topic.id} />
      </section>}
    </>}
    <div className="flex flex-wrap gap-4"><Link className="text-brand-ink underline" href={`/learn/courses/${courseId}`}>Back to course</Link><Link className="text-brand-ink underline" href="/learn/recommended">Recommendations based on my progress</Link></div>
  </div>;
}

export function LearningTutor({ base, topicId }: { base: string; topicId: string }) {
  type Message = { role: string; text: string; source?: { title: string; href: string }; mode?: string };
  const { data, mutate } = useSWR(`${base}/tutor?topicId=${encodeURIComponent(topicId)}`, (url: string) => api<{ messages: Message[] }>(url));
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function ask(action: string) {
    setBusy(true); setError('');
    try { const response = await api<{ messages: Message[] }>(`${base}/tutor`, { method: 'POST', body: { topicId, action, message } }); await mutate(response, false); setMessage(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'The tutor could not respond.'); } finally { setBusy(false); }
  }
  return <section aria-label="Your AI tutor" className="space-y-4"><h3 className="font-semibold">Your AI tutor</h3><p className="text-sm text-ink-muted">Course-grounded help. Conversation and tutor practice do not award knowledge credit.</p>
    <div className="flex flex-wrap gap-2">{[['simple', 'Explain simply'], ['example', 'Example from my field'], ['reason', 'Reason together'], ['practice', 'Give me practice']].map(([action, label]) => <Button key={action} variant="outline" disabled={busy} onClick={() => void ask(action)}>{label}</Button>)}</div>
    <div className="space-y-3" role="log" aria-label="Tutor conversation">{data?.messages.map((m, i) => <div key={i} className="rounded-lg border border-line p-4"><strong>{m.role === 'user' ? 'You' : 'Tutor'}</strong><p className="mt-2 whitespace-pre-wrap">{m.text}</p>{m.source && <Link className="mt-2 block text-sm text-brand-ink underline" href={m.source.href}>Source: {m.source.title}</Link>}{m.mode === 'basic' && <span className="text-xs text-ink-muted">Showing course reference support.</span>}</div>)}</div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void ask('ask'); }}><label className="sr-only" htmlFor="learning-tutor-question">Ask about this topic</label><input id="learning-tutor-question" className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 p-3" value={message} disabled={busy} maxLength={600} onChange={e => setMessage(e.target.value)} placeholder="Ask about this topic" /><Button disabled={busy || !message.trim()} type="submit">Ask tutor</Button></form>
    {busy && <p role="status">The tutor is checking your course material. You can keep studying; the response will be saved here.</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
