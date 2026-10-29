"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ActivityQuestionData } from '@/lib/longform-production';
import { QuizPreview } from './activity-preview';

export function VideoMidpointCheck({ questions, onContinue }: { questions: ActivityQuestionData[]; onContinue: () => void }) {
  const [complete, setComplete] = useState(false); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="space-y-4 rounded-xl border border-brand-line bg-brand-soft p-5" aria-labelledby="mid-video-check-title">
    <h4 ref={heading} tabIndex={-1} id="mid-video-check-title" className="font-semibold focus-visible:outline-2 focus-visible:outline-ring">Mid-video knowledge check</h4>
    <p className="text-sm">Narration is paused. Answer both questions to continue. A wrong answer shows a hint and keeps you on that question; previous correct answers are retained. Quiz time is separate from spoken narration.</p>
    <QuizPreview questions={questions} onComplete={() => setComplete(true)} />
    <Button disabled={!complete} onClick={onContinue}>Continue video</Button>
  </section>;
}
