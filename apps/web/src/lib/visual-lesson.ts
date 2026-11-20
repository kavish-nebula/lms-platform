import { z } from 'zod/v4';

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
export const VISUAL_KINDS = ['comparison', 'rule-flow', 'pattern-model', 'exception', 'hybrid', 'recap', 'document', 'workspace', 'journey', 'network', 'decision'] as const;
export const VISUAL_FPS = 24;
export const VISUAL_RENDER_VERSION = 'visual-lesson-v2';
export const VisualLesson = z.object({
  title: z.string().trim().min(1).max(100),
  style: z.enum(['classic', 'reference-cinema']).optional(),
  scenes: z.array(z.object({
    id, title: z.string().trim().min(1).max(80), kind: z.enum(VISUAL_KINDS),
    sourceIds: z.array(id).min(1).max(20), evidence: z.string().trim().min(12).max(1200),
    holdSeconds: z.number().min(1).max(5),
    beats: z.array(z.object({ id, label: z.string().trim().min(1).max(65), narration: z.string().trim().min(8).max(420), visual: z.object({ heading: z.string().trim().min(1).max(45), detail: z.string().trim().min(1).max(120), icon: z.enum(['document','message','check','question','person','model','shield','table']).default('document'), status: z.enum(['neutral','warning','success']).default('neutral') }).strict().optional() }).strict()).min(1).max(4),
  }).strict()).min(2).max(12),
}).strict().superRefine((lesson, ctx) => {
  const ids = lesson.scenes.flatMap(s => [s.id, ...s.beats.map(b => b.id)]);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Scene and narration beat IDs must be unique.' });
  const words = lesson.scenes.flatMap(s => s.beats).reduce((n, b) => n + b.narration.split(/\s+/).length, 0);
  if (words > 850) ctx.addIssue({ code: 'custom', message: 'Keep this topic under 850 spoken words; measured playback must stay below seven minutes.' });
});
export type VisualLessonData = z.infer<typeof VisualLesson>;
export type VisualClip = { beatId: string; key: string; seconds: number };
export type VisualJobOutput = { clips?: VisualClip[]; durationSeconds?: number; frames?: number; completed?: number; total?: number; voice?: import('./production-audio').ProductionVoice };
export type VisualTimedScene = Omit<VisualLessonData['scenes'][number], 'beats'> & { from: number; durationInFrames: number; beats: (VisualLessonData['scenes'][number]['beats'][number] & { from: number; durationInFrames: number; audio?: string })[] };
export type VisualPlaybackProps = { title: string; style?: VisualLessonData['style']; scenes: VisualTimedScene[]; durationInFrames: number; captions: boolean; reducedMotion: boolean };

/** The same timeline drives the live Player and exported MP4. No guessed speech cues. */
export function visualTimeline(lesson: VisualLessonData, clips: VisualClip[] = [], audioUrl?: (key: string) => string): VisualPlaybackProps {
  let cursor = 0;
  const scenes = lesson.scenes.map(scene => {
    const from = cursor;
    const beats = scene.beats.map(beat => {
      const clip = clips.find(c => c.beatId === beat.id);
      const durationInFrames = Math.ceil((clip?.seconds ?? Math.max(4, beat.narration.split(/\s+/).length / 140 * 60)) * VISUAL_FPS);
      const result = { ...beat, from: cursor, durationInFrames, ...(clip && audioUrl ? { audio: audioUrl(clip.key) } : {}) };
      cursor += durationInFrames;
      return result;
    });
    cursor += Math.ceil(scene.holdSeconds * VISUAL_FPS);
    return { ...scene, from, durationInFrames: cursor - from, beats };
  });
  return { title: lesson.title, style: lesson.style, scenes, durationInFrames: cursor, captions: true, reducedMotion: false };
}
export function visualEvidenceIssues(lesson: VisualLessonData, source: { sourceIds: string[]; text: string }) {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  return lesson.scenes.flatMap(scene => [
    ...(scene.sourceIds.some(id => !source.sourceIds.includes(id)) ? [`${scene.id}: use this topic's source IDs.`] : []),
    ...(!normalize(source.text).includes(normalize(scene.evidence)) ? [`${scene.id}: evidence must quote this topic's supplied teaching.`] : []),
  ]);
}
export function automationVisualSeed(sourceIds: string[], text: string): VisualLessonData {
  const evidence = text.replace(/\s+/g, ' ').trim().slice(0, 180);
  const definitions: { title: string; kind: typeof VISUAL_KINDS[number]; beats: [string, string][] }[] = [
    { title: 'A fast machine is not automatically AI', kind: 'comparison', beats: [
      ['A production input', 'A machine can move quickly and precisely without using artificial intelligence. Speed alone does not tell us how its decisions are made.'],
      ['Fixed instructions', 'For this comparison, automation follows instructions and decision rules written in advance.'],
      ['Learned patterns', 'AI uses a model trained on data to recognize patterns and produce an estimate or response. Look at the decision mechanism, not how impressive the machine appears.'],
    ] },
    { title: 'Automation: follow the programmed rule', kind: 'rule-flow', beats: [
      ['Read the sensor', 'Consider the supplied sensor example. The system reads a part measurement.'],
      ['Check the fixed threshold', 'A programmed rule compares that measurement with a fixed threshold. The same condition leads to the same configured action.'],
      ['Take the configured action', 'The controller carries out the action specified by the rule. This is automation; it has not learned that rule from the readings.'],
    ] },
    { title: 'AI: use patterns learned from data', kind: 'pattern-model', beats: [
      ['Historical examples', 'Now consider a model trained on historical examples. Training finds relationships in the supplied data.'],
      ['Apply the trained model', 'When a new reading arrives, the model applies those learned relationships rather than relying only on a single hand-written threshold.'],
      ['Review an estimate', 'Its result may be a score, prediction or suggested classification. That result can be wrong, so evaluate it before using it for an important decision.'],
    ] },
    { title: 'An unfamiliar input reveals the difference', kind: 'exception', beats: [
      ['Unexpected input', 'Suppose a part differs from the inputs anticipated by the programmed sequence.'],
      ['Check exception handling', 'A rule-based system follows its configured exception behavior. It does not automatically learn a new rule just because the input changed.'],
      ['Keep human oversight', 'An AI model may still produce an estimate for a new input, but that estimate is not a guarantee of a safe or correct action. Human oversight remains important.'],
    ] },
    { title: 'AI and automation can work together', kind: 'hybrid', beats: [
      ['Model suggests', 'These approaches are not mutually exclusive. A model can supply an estimate inside a larger automated workflow.'],
      ['Rules constrain actions', 'Explicit rules can then control what action is permitted and when an exception needs review.'],
      ['A person reviews exceptions', 'The workflow combines learned pattern recognition with defined actions and human responsibility. AI does not remove the need for controls.'],
    ] },
    { title: 'Ask how the decision is produced', kind: 'recap', beats: [
      ['Automation: programmed rules', 'If the decision comes from conditions written in advance, identify the fixed-rule automation.'],
      ['AI: learned relationships', 'If a trained model uses learned relationships to produce an estimate, identify the AI component.'],
      ['A combined workflow', 'A real system can contain both. Explain which part uses fixed rules, which part uses a trained model, and how the result is checked.'],
    ] },
  ];
  return VisualLesson.parse({ title: 'Automation vs AI', scenes: definitions.map((s, i) => ({ id: `Scene${i+1}`, title: s.title, kind: s.kind, sourceIds, evidence, holdSeconds: 2, beats: s.beats.map(([label, narration], n) => ({ id: `Scene${i+1}Beat${n+1}`, label, narration })) })) });
}
