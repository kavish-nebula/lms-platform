import type { VisualLessonData } from './visual-lesson';

export const REFERENCE_VIDEO_DIRECTION = `For every new Stage 4 topic, use style topic-animation. Start with a beginner explanation, then work through one source-supported example. Design the action around this particular subject: name the moving object, what causes its change and the visible result. Author scene.motion tracks for that demonstration on the 1000 by 360 canvas. Each object has a local SVG path or label, a tone and keys with zero-based beat, fractional at, x and y. Repeat a pose to hold it; move, trace, rotate, scale or reveal evidence when the narration explains the change. Different topics need different objects, staging and actions. Use a document scene without motion when reading an exact source line helps explain the decision; put that line in visual.detail. Aim for 3–4 minutes per concept with relaxed Heart narration, short clauses and thinking time after questions. Hooks may be shorter. Keep the existing 420-second maximum, source IDs and evidence quotations.`;

/** An honest source-only starting point for any topic, without unrelated AI
 * examples. Codex or the creator can replace it with a deliberate storyboard. */
export function sourceVisualSeed(source:{title:string;text:string;sourceIds:string[]}):VisualLessonData {
  const text=source.text.replace(/\s+/g,' ').trim();
  const parts=text.split(/(?<=[.!?])\s+/).filter(s=>s.length>=12).slice(0,4).map(s=>s.slice(0,400));
  while(parts.length<4)parts.push(parts[0]??text.slice(0,400));
  return {title:source.title.slice(0,100),style:'reference-cinema',scenes:[0,1].map((n)=>({id:`Scene${n+1}`,title:n?'Inspect the evidence':'Start with the source',kind:n?'document':'workspace',sourceIds:source.sourceIds,evidence:text.slice(0,180),holdSeconds:3,beats:parts.slice(n*2,n*2+2).map((narration,i)=>({id:`Scene${n+1}Beat${i+1}`,label:i?'Compare with the source':'Read the supplied situation',narration,visual:{heading:i?'Check the claim':'Source material',detail:narration.slice(0,115),icon:i?'check':'document',status:'neutral'}}))}))};
}
