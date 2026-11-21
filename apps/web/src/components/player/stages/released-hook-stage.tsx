'use client';
import { useState } from 'react';
import type { ModuleContent } from '@/data/types';
import { StageShell } from '../stage-shell';
import { ReleasedVisualLesson } from '../video/released-visual-lesson';

/** Finishing the film unlocks an explicit action; it never removes navigation. */
export function ReleasedHookStage({ module, nextLabel, onComplete, onPrev, done }: { module: ModuleContent; nextLabel: string; onComplete: () => void; onPrev?: () => void; done?: boolean }) {
  const [ready, setReady] = useState(false);
  return <StageShell stage="hook" title={module.title} onPrev={onPrev} onComplete={onComplete} done={done} canComplete={ready || !!done} completeLabel={nextLabel} completeHint="Finish the opening video, or use the outline to explore a concept.">
    <ReleasedVisualLesson endpoint={module.remotionHook!.endpoint} video={{ id: `${module.course_id}-${module.module_id}-hook`, module: module.module_id, lesson: 'hook', midQuiz: [], endQuiz: [] }} onComplete={() => setReady(true)} />
  </StageShell>;
}
