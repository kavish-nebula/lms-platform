import type { VideoHook } from './video-first-hook';

/** Presentation alias for a fictional machine; preserve the approved source snapshot. */
export function neutralProductionHook(hook: VideoHook, courseId: string, moduleId: string): VideoHook {
  if (courseId !== 'affcb1b6-5539-431c-9a95-cce2bdb26b51' || moduleId !== 'M1') return hook;
  const alias = (text: string) => text.replace(/\bNebula\s+NK[\s\u2010-\u2015-]*V500\b/gi, 'CNC Model V500');
  const title = alias(hook.title), situation = alias(hook.situation), question = alias(hook.question);
  return title === hook.title && situation === hook.situation && question === hook.question ? hook : { ...hook, title, situation, question };
}

/** Fictional transfer cases; never replacement transcripts or source documents. */
export function profileProductionHook(hook: VideoHook, courseId: string, context?: unknown): VideoHook {
  if (!['dd1fec93-8c51-4f2d-9e0c-943823062c76', 'affcb1b6-5539-431c-9a95-cce2bdb26b51'].includes(courseId)
    || !hook.sourceIds.includes('M1S1') || !/cooler|coolant/i.test(hook.situation)) return hook;
  const c = context as { profile?: Record<string, unknown>; answers?: Record<string, unknown> } | undefined;
  const a = { ...c?.profile, ...c?.answers };
  const field = [a.field, a.domain, a.domainOther, a.studyField, a.studyFieldOther].filter(v => typeof v === 'string').join(' ');
  const finance = /finance|accounts|accounting|audit/i.test(field);
  const healthcare = /healthcare|health care|medical/i.test(field);
  if (!finance && !healthcare) return hook;
  const title = finance ? 'The payables rule stays the same. Can you trust the AI explanation?' : 'The clinic queue rule stays the same. Can you trust the AI explanation?';
  const situation = finance
    ? 'Fictional finance and audit case: you review accounts-payable requests in a spreadsheet. A fixed rule routes a request to the same review queue whenever its required fields are complete. The queue has become busier, but the rule has not changed.\nA colleague asks an AI assistant why the queue is growing. The assistant confidently blames duplicate supplier requests. The supplied spreadsheet shows queue entries, but contains no duplicate-check result. Its explanation sounds useful; you still need to inspect what supports it.\nThis is a payables analogy for the supplied production lesson, not a real payment decision. In the original recording, coolant has aged but the cooler still switches on at its programmed 70-degree threshold. That equipment threshold belongs only to the source example. Here you inspect administrative rules and an unsupported explanation; you do not approve payments or change equipment.'
    : 'Fictional healthcare administration case: you review appointment requests in a reception queue. A fixed rule routes a request to the same staff-review queue whenever its required fields are complete. The queue has become busier, but the rule has not changed.\nA colleague asks an AI assistant why the queue is growing. The assistant confidently blames duplicate appointment requests. The supplied queue sheet shows entries, but contains no duplicate-check result. Its explanation sounds useful; you still need to inspect what supports it.\nThis is an administrative analogy for the supplied production lesson, not a clinical decision. In the original recording, coolant has aged but the cooler still switches on at its programmed 70-degree threshold. That equipment threshold is never a patient measurement. Here you inspect administrative rules and an unsupported explanation; you do not change appointments, care or equipment.';
  return { ...hook, title, situation, question: finance
    ? 'What would you check first in the payables sheet before accepting the AI explanation, and what tells you whether the routing rule changed?'
    : 'What would you check first in the reception sheet before accepting the AI explanation, and what tells you whether the routing rule changed?' };
}

/** Reject a rewrite that loses the transfer case or blurs it with source facts. */
export function validateProfileProductionHook(authored: VideoHook, candidate: VideoHook) {
  if (/CNC Model V500/.test(authored.situation) && (!/CNC Model V500/.test(candidate.situation) || /\bNebula\b/i.test([candidate.title, candidate.situation, candidate.question].join(' ')))) {
    throw new Error('Keep the neutral fictional machine name CNC Model V500 in the problem hook.');
  }
  const finance = authored.situation.startsWith('Fictional finance and audit case:');
  const healthcare = authored.situation.startsWith('Fictional healthcare administration case:');
  if (!finance && !healthcare) return;
  const marker = finance ? /payables|payable|finance/i : /clinic|reception|healthcare/i;
  if (![candidate.title, candidate.situation.split('\n')[0], candidate.question].every(text => marker.test(text))
    || !/fictional/i.test(candidate.situation) || !/original recording/i.test(candidate.situation)
    || !/70.degree threshold/i.test(candidate.situation)) throw new Error('Retain the profile case and its labelled source comparison.');
}
