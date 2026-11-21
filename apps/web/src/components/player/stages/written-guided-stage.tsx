'use client';
import { useState } from 'react';
import type { GuidedBlock, ModuleContent } from '@/data/types';
import { StageShell } from '../stage-shell';
import { GuidedAnswerFields } from '../guided-answer-fields';

type Scenes = NonNullable<NonNullable<ModuleContent['narratedStages']>['guided']>;

/** Keep the released demonstration, but give its task an actual response area. */
export function WrittenGuidedStage({ block, slides, storageKey, onComplete, onPrev, done }: { block: GuidedBlock; slides: Scenes; storageKey?: string; onComplete: () => void; onPrev?: () => void; done?: boolean }) {
  const [ready, setReady] = useState(false);
  // Older packages repeat the complete task as their introduction and step.
  const intro = block.steps.some(step => step.body?.trim() === block.intro?.trim()) ? undefined : block.intro;
  return <StageShell stage="guided" title={block.title} intro={intro} minutes={block.duration_min} bloom={block.bloom} onComplete={onComplete} onPrev={onPrev} done={done} canComplete={ready || done} completeHint="Write and compare each practice answer to continue.">
    {block.situation && <details className="rounded-lg border border-line p-4"><summary className="cursor-pointer font-medium">Source situation</summary><p className="mt-3 whitespace-pre-wrap">{block.situation}</p></details>}
    <GuidedAnswerFields key={storageKey ?? 'preview'} storageKey={storageKey} steps={block.steps.map(step => ({ id: step.id, instruction: step.body || step.title, hint: step.tip, evidence: step.check }))} onReadyChange={setReady} />
    <details className="rounded-xl border border-line bg-panel p-5"><summary className="cursor-pointer font-medium">Listen to the guided demonstration · {slides.length} scenes</summary><div className="mt-4 space-y-5">{slides.map((scene, index) => <section key={scene.id} className="space-y-3"><h3 className="font-semibold">{index + 1}. {scene.title}</h3><ul className="list-disc space-y-2 pl-5">{scene.body.map((line, i) => <li key={i}>{line}</li>)}</ul><audio controls preload="none" className="w-full" src={scene.audio} aria-label={`Narration for ${scene.title}`} /><details><summary className="cursor-pointer text-sm">Read narration</summary><p className="mt-2 whitespace-pre-wrap text-sm">{scene.narration}</p></details></section>)}</div></details>
  </StageShell>;
}
