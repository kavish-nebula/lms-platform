'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLocalString, writeLocal } from '@/lib/local-store';
import { comparePracticeAnswer, practiceResponsesReady, readPracticeResponses, updatePracticeAnswer, type PracticeResponses } from '@/lib/guided-responses';

export type WrittenPracticeStep = { id: string; instruction: string; hint?: string; evidence: string };

export function GuidedAnswerFields({ steps, storageKey, onReadyChange }: { steps: WrittenPracticeStep[]; storageKey?: string; onReadyChange: (ready: boolean) => void }) {
  const prefix = useId();
  const raw = useLocalString(storageKey ?? 'lms-preview-guided-answer');
  const saved = useMemo(() => readPracticeResponses(storageKey ? raw : null, steps.map(step => step.id)), [raw, storageKey, steps]);
  // Keep typing usable when browser storage is blocked; do not promise server sync.
  const [draft, setDraft] = useState<PracticeResponses | null>(null);
  const responses = draft ?? saved;
  const ready = practiceResponsesReady(responses, steps.map(step => step.id));
  useEffect(() => onReadyChange(ready), [ready, onReadyChange]);
  function update(next: PracticeResponses) {
    setDraft(next);
    if (storageKey) writeLocal(storageKey, JSON.stringify({ version: 1, responses: next }));
  }
  return <section className="space-y-5" aria-label="Guided practice answers">
    <div><h2 className="text-xl font-semibold">Your practice answers</h2><p className="mt-2 text-sm text-ink-muted">Write an attempt, then compare it with the supplied evidence. This is self-review, not an automatic grade.</p><p className="mt-1 text-sm text-ink-muted">{storageKey ? 'Answers are saved in this browser when local storage is available. They stay separate from your quiz grades.' : 'Preview answers stay on this page. Enroll to keep a practice draft in this browser.'}</p></div>
    {steps.map((step, index) => {
      const item = responses[step.id];
      const compared = !!item?.answer.trim() && item.comparedAnswer === item.answer.trim();
      const fieldId = `${prefix}-${index}`;
      return <section key={step.id} className="space-y-4 rounded-xl border border-line bg-panel p-5" aria-labelledby={`${fieldId}-title`}>
        <h3 id={`${fieldId}-title`} className="font-semibold">Step {index + 1}</h3>
        <p className="whitespace-pre-wrap leading-relaxed">{step.instruction}</p>
        <label htmlFor={fieldId} className="block text-sm font-medium">Your attempt for step {index + 1}</label>
        <Textarea id={fieldId} rows={5} maxLength={6000} value={item?.answer ?? ''} className="min-h-36 field-sizing-fixed" onChange={event => update(updatePracticeAnswer(responses, step.id, event.target.value))} />
        {step.hint && <details><summary className="cursor-pointer text-sm text-brand-ink">Show a hint</summary><p className="mt-2 text-sm">{step.hint}</p></details>}
        <Button type="button" variant="outline" disabled={!item?.answer.trim()} onClick={() => update(comparePracticeAnswer(responses, step.id))}>Compare my attempt</Button>
        {compared && <div role="status" className="space-y-2 rounded-lg border border-brand-line bg-brand-soft p-4"><h4 className="font-semibold">Expected evidence</h4><p className="whitespace-pre-wrap">{step.evidence}</p><p className="text-sm text-ink-muted">Check what your answer includes or misses. Editing your answer clears this comparison so you can review it again.</p></div>}
      </section>;
    })}
  </section>;
}
