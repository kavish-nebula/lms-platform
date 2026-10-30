'use client';
import { useState } from 'react';
import type { ModulePackage } from '@/lib/module-production';
import type { ProductionAudioClip } from '@/lib/production-audio';
import { ProductionVideoPreview } from './production-video-preview';

export function ProductionLessonPreview({ content, clips, audioUrl, ready, disabled }: { content: ModulePackage; clips: ProductionAudioClip[]; audioUrl: string; ready: boolean; disabled: boolean }) {
  const stage = (kind: string, title: string) => ({id:`stage-${kind}`,title,slideIds:content.slides.filter(s=>s.step===kind).map(s=>s.id),visualSeconds:0,checkpoint:undefined});
  const sequences = [stage('hook','Problem Hook'), ...content.lessonVideos!, stage('worked_example','Worked Example'),stage('guided_practice','Guided Practice'),stage('scenario','Scenario Lab')];
  const [selected, setSelected] = useState('stage-hook');
  const sequence = sequences.find(v => v.id === selected)!;
  const stageSequence = selected.startsWith('stage-');
  const topicClips = clips.filter(c => sequence.slideIds.includes(c.slideId));
  const seconds = topicClips.reduce((n,c) => n + c.seconds, sequence.visualSeconds);
  return <div className="space-y-4"><label htmlFor="lesson-topic" className="block font-semibold">Teaching sequence</label><select id="lesson-topic" className="min-h-11 w-full rounded-lg border border-line bg-panel px-3" value={selected} onChange={e => setSelected(e.target.value)}>{sequences.map(v => <option key={v.id} value={v.id}>{v.title} · {v.slideIds.length} scenes</option>)}</select>
    <p className="text-sm text-ink-muted">{topicClips.length}/{sequence.slideIds.length} narrated scenes · {Math.round(seconds)} seconds{sequence.visualSeconds ? ' including planned visual pauses' : ' spoken'}. Learner activity time is separate. Concept videos stay within seven minutes.</p>
    <ProductionVideoPreview key={`${sequence.id}:${ready}`} shortVideo stageSequence={stageSequence} content={{ ...content, title: sequence.title, slides: content.slides.filter(s => sequence.slideIds.includes(s.id)), checkpoint: sequence.checkpoint }} clips={topicClips} audioUrl={audioUrl} ready={ready && topicClips.length === sequence.slideIds.length && (stageSequence || seconds <= 420)} disabled={disabled} />
    {content.moduleQuiz && <details><summary className="cursor-pointer font-semibold">Module-end quiz · after Scenario Lab</summary>{content.moduleQuiz.questions.map(q => <div key={q.id} className="mt-4 text-sm"><p>{q.prompt}</p><ol className="list-inside list-decimal">{q.choices.map(c => <li key={c}>{c}</li>)}</ol><details><summary>Creator answer and feedback</summary><p>{q.choices[q.correct]} · {q.explanation}</p></details></div>)}</details>}
  </div>;
}
