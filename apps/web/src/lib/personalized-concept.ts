import type { ConceptVideo } from '@/data/types';

export type ConceptSource = { transcriptId: string; parts: { id: string; narration: string; sourceIds: string[]; objectiveIds: string[] }[]; checkpointAfterPart: number };
export type ConceptScene = { id: string; phase: 'before' | 'after'; visual: 'automation' | 'healthcare' | 'language' | 'retrieval' | 'prompt' | 'deployment'; title: string; points: string[]; narration: string; bridge: string; sourceIds: string[]; objectiveIds: string[] };
export type PersonalizedConcept = { scenes: ConceptScene[] };

const family = (title: string): ConceptScene['visual'] => /automation/i.test(title) ? 'automation' : /local|cloud|privacy/i.test(title) ? 'deployment' : /RAG|retriev|index|citation/i.test(title) ? 'retrieval' : /prompt|refine/i.test(title) ? 'prompt' : 'language';
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const plain = (text: string) => text.replace(/#{1,6}\s+/g, '').replace(/\*\*|__/g, '');
export const conceptNarration = (scene: ConceptScene) => `${scene.narration} ${scene.bridge}`;

/** Scene boundaries never cross the reviewed first-half/second-half boundary. */
export function conceptTemplate(video: ConceptVideo): PersonalizedConcept {
  const source = video.personalizationSource;
  if (!source) throw new Error('A reviewed transcript is required.');
  return { scenes: source.parts.flatMap((part, partIndex) => {
    const sentences = plain(part.narration).split(/(?<=[.!?])\s+(?=[A-Z“"'])/).map(s => s.trim()).filter(Boolean);
    const chunks: string[] = [];
    for (const sentence of sentences) {
      // A long source sentence still needs a bounded speech clip.
      const tokens = words(sentence);
      for (let offset = 0; offset < tokens.length; offset += 105) {
        const text = tokens.slice(offset, offset + 105).join(' ');
        if (chunks.length && words(chunks.at(-1)! + ' ' + text).length <= 105) chunks[chunks.length - 1] += ' ' + text;
        else chunks.push(text);
      }
    }
    return chunks.map((narration, i) => {
      return { id: `${part.id}-concept-${i}`, phase: partIndex <= source.checkpointAfterPart ? 'before' as const : 'after' as const, visual: family(video.title), title: video.title,
        points: ['Review the concept in the source explanation.', 'Connect the idea to an appropriate task.'], narration, bridge: 'Connect this idea to a familiar task before selecting the tool you would use.', sourceIds: part.sourceIds, objectiveIds: part.objectiveIds };
    });
  }) };
}

const numbers = (text: string) => [...new Set(text.match(/(?<![\w])\d+(?:[.,]\d+)*(?![\w])/g) ?? [])].sort();
/** Reject lost teaching, moved checkpoint content and scripts that cannot fit. */
export function validatePersonalizedConcept(source: PersonalizedConcept, candidate: PersonalizedConcept) {
  if (!candidate?.scenes || candidate.scenes.length !== source.scenes.length) throw new Error('Concept scene structure changed.');
  for (let i = 0; i < source.scenes.length; i++) {
    const a = source.scenes[i], b = candidate.scenes[i];
    if (a.id !== b.id || a.phase !== b.phase || a.visual !== b.visual || JSON.stringify(a.sourceIds) !== JSON.stringify(b.sourceIds) || JSON.stringify(a.objectiveIds) !== JSON.stringify(b.objectiveIds)) throw new Error('Concept source or checkpoint mapping changed.');
    if (b.narration !== a.narration) throw new Error('Reviewed concept teaching must remain unchanged.');
    if (!b.bridge || words(b.bridge).length < 8 || words(b.bridge).length > 18) throw new Error('Use a brief concrete learner-context explanation.');
    if (!b.title?.trim() || b.title.length > 150 || b.points.length !== 2 || b.points.some(p => !p.trim() || p.length > 180 || words(p).length > 24)) throw new Error('Concept visual text is too long.');
  }
  if (candidate.scenes.filter((s, i) => s.bridge !== source.scenes[i].bridge).length < Math.ceil(source.scenes.length * .6)) throw new Error('Personalise the contextual explanation in most scenes, not just the opening title.');
  for (const phase of ['before', 'after']) {
    const text = (x: PersonalizedConcept) => x.scenes.filter(s => s.phase === phase).map(s => `${s.title} ${s.points.join(' ')} ${conceptNarration(s)}`).join(' ');
    if (JSON.stringify(numbers(text(source))) !== JSON.stringify(numbers(text(candidate)))) throw new Error('Numerical facts moved across the checkpoint or changed.');
  }
  if (words(candidate.scenes.map(conceptNarration).join(' ')).length > 910) throw new Error('Concept narration exceeds the seven-minute planning budget.');
  return candidate;
}

export function conceptCanSeek(scenes: ConceptScene[], target: number, checkpointDone: boolean) {
  return Number.isInteger(target) && target >= 0 && target < scenes.length && (checkpointDone || scenes[target].phase === 'before');
}
