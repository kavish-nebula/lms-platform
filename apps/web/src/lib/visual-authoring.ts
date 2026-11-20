import type { VisualLessonData } from './visual-lesson';

export const REFERENCE_VIDEO_DIRECTION = `Use the supplied reference's dark rose cinematic direction: a restrained ambient background, progressive document inspection, app/workspace demonstrations, journey paths, selective highlights and generous negative space. Teach through visible changes to relevant artifacts, not bullet slides. Keep the scene's explicit visual fields synchronized with its own narration beat. Use at least three distinct layouts across a concept lesson; never reuse the same diagram with only its title changed. Allow 2.4-second transitions and 3-second reading holds. Preserve technical facts, exact source IDs and evidence quotations. Use only supplied or locally available assets. Do not copy the reference's healthcare claims, branding, people or product screens into unrelated courses. Keep narration concise and beginner-friendly, at most seven measured minutes including holds. This is an editable creator draft, not human approval or publication.`;

/** An honest source-only starting point for any topic, without unrelated AI
 * examples. Codex or the creator can replace it with a deliberate storyboard. */
export function sourceVisualSeed(source:{title:string;text:string;sourceIds:string[]}):VisualLessonData {
  const text=source.text.replace(/\s+/g,' ').trim();
  const parts=text.split(/(?<=[.!?])\s+/).filter(s=>s.length>=12).slice(0,4).map(s=>s.slice(0,400));
  while(parts.length<4)parts.push(parts[0]??text.slice(0,400));
  return {title:source.title.slice(0,100),style:'reference-cinema',scenes:[0,1].map((n)=>({id:`Scene${n+1}`,title:n?'Inspect the evidence':'Start with the source',kind:n?'document':'workspace',sourceIds:source.sourceIds,evidence:text.slice(0,180),holdSeconds:3,beats:parts.slice(n*2,n*2+2).map((narration,i)=>({id:`Scene${n+1}Beat${i+1}`,label:i?'Compare with the source':'Read the supplied situation',narration,visual:{heading:i?'Check the claim':'Source material',detail:narration.slice(0,115),icon:i?'check':'document',status:'neutral'}}))}))};
}
