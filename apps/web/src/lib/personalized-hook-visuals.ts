import type { HookBlock } from '@/data/types';

/** Repair legacy visual-only template labels using the already voiced case.
 * Spoken text, timing, facts and interactions remain unchanged. Originals never
 * pass through this adapter; it is only used for ready learner derivatives.
 */
export function personalizedHookVisuals<T extends HookBlock>(hook: T): T {
  const narration = [hook.title, hook.narration, ...(hook.film?.shots.map(s => s.say) ?? [])].join(' ');
  const domain = /finance|audit|payable|invoice/i.test(narration) ? 'finance'
    : /healthcare|clinic|patient|medical/i.test(narration) ? 'healthcare' : null;
  if (!domain || !hook.film) return hook;
  const artifact = domain === 'finance' ? 'Finance and audit records' : 'Patient record requests';
  return { ...hook, film: { ...hook.film, shots: hook.film.shots.map(shot => {
    if (shot.type !== 'site-chat' || !/orbitoutdoor|trailhead|tent|order|shipping/i.test([shot.url, shot.product, ...shot.asks].join(' '))) return shot;
    const asks = domain === 'finance'
      ? ['Where is my audit report?', 'Can you check the report status?', 'Which records support that status?']
      : ['Where is the requested record?', 'Can you check the request status?', 'Which records support that status?'];
    return { ...shot, url: `case-study.example/${domain}-support`, product: artifact,
      asks: shot.asks.map((_, i) => asks[i % asks.length]), label: `${domain === 'finance' ? 'Finance' : 'Clinical'} support case` };
  }) } };
}
