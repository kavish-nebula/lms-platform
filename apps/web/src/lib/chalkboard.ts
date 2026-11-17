import type { ConceptScene } from './personalized-concept';
import { conceptNarration } from './personalized-concept';
import type { ContinuousPlayback } from './continuous-concept';

export const CHALKBOARD_VERSION = 'nicglazkov-4d7d62d-lms-3';
export type BoardKind = 'rule' | 'patterns' | 'language' | 'retrieval' | 'verify' | 'deployment';
export type BoardBeat = { start: number; end: number; kind: BoardKind; domain: string; caption: string; labels: string[]; sourceIds: string[]; sceneId: string };
export type ChalkboardView = { status: 'queued' | 'rendering' | 'ready' | 'failed'; key: string; video?: string; captions?: { start: number; end: number; caption: string }[]; message?: string };
export type TopicRoute = { status: 'foundation' | 'recommended' | 'ready'; reason: string; prerequisites: { title: string; href: string; demonstrated: boolean }[] };

/** Approved words select a bounded visual grammar. No model-generated Python,
 * HTML or commands are executed. Sentences remain in source/checkpoint order. */
export function chalkboardPlan(scenes: ConceptScene[], playback: ContinuousPlayback, field: string) {
  if (scenes.length !== playback.segments.length || !scenes.length) throw Error('Missing narration timing');
  const profileDomain = /health|clinic|medic/i.test(field) ? 'healthcare' : /financ|account|audit/i.test(field) ? 'finance' : 'production';
  const beats: BoardBeat[] = [];
  scenes.forEach((scene, i) => {
    const segment = playback.segments[i];
    if (scene.id !== segment.sceneId || segment.endSeconds <= segment.startSeconds) throw Error('Invalid narration timing');
    const sentences = conceptNarration(scene).split(/(?<=[.!?])\s+(?=[A-Z“"'])/).map(s => s.trim()).filter(Boolean);
    const total = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
    let position = segment.startSeconds;
    sentences.forEach((caption, j) => {
      const end = j === sentences.length - 1 ? segment.endSeconds : position + (segment.endSeconds - segment.startSeconds) * caption.split(/\s+/).length / total;
      const kind: BoardKind = /\b(verif\w*|checks?|checking|evidence|hallucin\w*|false|guarantee\w*|uncertain\w*|review\w*)\b/i.test(caption) ? 'verify'
        : /\b(retriev\w*|documents?|manuals?|SOP|search\w*|RAG|database)\b/i.test(caption) ? 'retrieval'
        : /\b(local|cloud|on-prem\w*|privacy|secure\w*)\b/i.test(caption) ? 'deployment'
        : /\b(language|tokens?|text|sentences?|LLMs?|words?|prompts?)\b/i.test(caption) ? 'language'
        : /\b(learns?|learned|learning|patterns?|training|trained|predicts?|predictions?|estimat\w*|history|historical)\b/i.test(caption) ? 'patterns' : 'rule';
      // Literal source examples take precedence over the learner's profession.
      const domain = /cool|temperature|fan|machine|factory|manufactur/i.test(caption) ? 'production' : /patient|clinic|health/i.test(caption) ? 'healthcare' : /invoice|payable|financ|audit/i.test(caption) ? 'finance' : profileDomain;
      const labels = kind === 'rule' ? domain === 'healthcare' ? ['Request form', 'Required fields?', 'Admin queue'] : domain === 'finance' ? ['Invoice', 'Required fields?', 'Payables queue'] : /cool|temperature|fan/i.test(caption) ? ['Sensor input', 'Fixed condition', 'Cooling fan'] : ['Input', 'Fixed condition', 'Action']
        : kind === 'patterns' ? ['Past examples', 'Learned pattern', 'Estimate', 'Human review']
        : kind === 'language' ? ['Supplied context', 'Language model', 'Next token', 'Check the claim']
        : kind === 'retrieval' ? ['Question', 'Relevant documents', 'Source passage', 'Grounded response']
        : kind === 'verify' ? ['Generated claim', 'Source evidence', 'Supported', 'Not established']
        : ['Local system', 'Cloud service', 'Data boundary', 'Review access'];
      beats.push({ start: position, end, kind, domain, caption, labels, sourceIds: scene.sourceIds, sceneId: scene.id }); position = end;
    });
  });
  if (!beats.length || beats.some(b => b.end <= b.start)) throw Error('Empty visual plan');
  return { version: CHALKBOARD_VERSION, domain: profileDomain, duration: playback.durationSeconds, timing: 'measured clip boundaries; estimated sentence cues', beats };
}

/** Explicit Module 1 teaching dependency. Unknown knowledge is never inferred
 * from a profession or self-reported experience. It recommends, never awards. */
export function conceptRoute(title: string, prior: { title: string; href: string; demonstrated: boolean }[]): TopicRoute {
  if (!/large language|\bLLM/i.test(title) || !prior.some(p => /automation/i.test(p.title))) return { status: 'foundation', reason: 'Start with the source lesson. No earlier topic is required for this introduction.', prerequisites: [] };
  const prerequisites = prior.filter(p => /automation/i.test(p.title));
  return { status: prerequisites.every(p => p.demonstrated) ? 'ready' : 'recommended', reason: prerequisites.every(p => p.demonstrated) ? 'Your recorded topic evidence covers the earlier AI-versus-rules foundation.' : 'Review how fixed rules differ from learned patterns before studying language models. You can also use the knowledge check to demonstrate that foundation.', prerequisites };
}
