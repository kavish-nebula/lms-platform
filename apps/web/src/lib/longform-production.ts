import { z } from 'zod/v4';

export const LONGFORM_VERSION = 1;
export const LONGFORM_MIN_SECONDS = 300;
export const LONGFORM_MAX_SECONDS = 420;
export const LONGFORM_NARRATION_POLICY_VERSION = 2;
// A planning guard only: the saved audio must independently meet 300–420s.
export const LONGFORM_MIN_WORDS = 600;
export const narrationDurationValid = (seconds: number) => Number.isFinite(seconds) && seconds >= LONGFORM_MIN_SECONDS && seconds <= LONGFORM_MAX_SECONDS;
export const crossesVideoCheckpoint = (current: number, next: number, boundary: number, completed: boolean) => boundary >= 0 && !completed && current <= boundary && next > boundary;
export const PRODUCTION_FORMATS = ['pilot', 'longform-v1'] as const;
export type ProductionFormat = typeof PRODUCTION_FORMATS[number];
const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/);
const text = z.string().trim().min(1).max(4000);
const links = { objectiveIds: z.array(id).min(1).max(60), sourceIds: z.array(id).min(1).max(100) };
export const SlideOutline = z.object({ id, title: z.string().trim().min(1).max(80), brief: text, ...links }).strict();
export const ActivityQuestion = z.object({ id, prompt: text, choices: z.array(z.string().trim().min(1).max(1000)).min(2).max(5), correct: z.number().int().nonnegative(), hint: text, explanation: text, ...links }).strict().superRefine((q, ctx) => { if (q.correct >= q.choices.length) ctx.addIssue({ code: 'custom', message: 'Correct choice must exist.' }); });
export const VideoCheckpoint = z.object({ afterSlideId: id, questions: z.array(ActivityQuestion).length(2) }).strict();
export const VideoOutline = z.object({ id: z.enum(['v1', 'v2', 'v3', 'v4', 'v5']), title: z.string().trim().min(1).max(200), slides: z.array(SlideOutline).min(7).max(9), checkpoint: VideoCheckpoint.optional() }).strict();
export const ModuleActivities = z.object({
  hook: z.object({ title: text, situation: text, question: ActivityQuestion }).strict(),
  worked: z.array(z.object({ id, title: text, situation: text, steps: z.array(text).min(2).max(8), result: text, ...links }).strict()).min(2).max(3),
  guided: z.object({ title: text, situation: text, steps: z.array(z.object({ id, title: text, instruction: text, hint: text, evidence: text, ...links }).strict()).min(6).max(8) }).strict(),
  lab: z.object({ title: text, scenarios: z.array(z.object({ situation: text, question: ActivityQuestion }).strict()).length(3) }).strict(),
  quiz: z.object({ title: text, questions: z.array(ActivityQuestion).min(5).max(10) }).strict(),
  activityMinutes: z.number().min(1).max(300),
}).strict();
export const LongformPlan = z.object({ videos: z.array(VideoOutline).length(5), activities: ModuleActivities }).strict();
export type ModuleActivitiesData = z.infer<typeof ModuleActivities>;
export type LongformPlanData = z.infer<typeof LongformPlan>;
export type VideoOutlineData = z.infer<typeof VideoOutline>;
export type ActivityQuestionData = z.infer<typeof ActivityQuestion>;
export type ProductionUnit = { kind: 'plan'; key: 'plan'; checkpointPolicy?: 'two-question-midpoint-v1' } | { kind: 'video'; key: string; planJobId: string; planRevisionId: string; planReviewId: string; outline: VideoOutlineData; minSeconds: 300; maxSeconds?: 420; narrationPolicyVersion?: 2 };
export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function validatePlan(plan: LongformPlanData, objectiveIds: string[], sourceIds: string[], requireCheckpoints = false) {
  const errors: string[] = [];
  if (plan.videos.map(v => v.id).join(',') !== 'v1,v2,v3,v4,v5') errors.push('Use five videos in order: v1 through v5.');
  if (new Set(plan.videos.map(v => v.title.toLowerCase())).size !== 5) errors.push('Give each video a distinct topic/title.');
  const slideIds = plan.videos.flatMap(v => v.slides.map(s => s.id));
  if (new Set(slideIds).size !== slideIds.length) errors.push('Slide IDs must be unique across all five videos.');
  const check = (item: { objectiveIds: string[]; sourceIds: string[] }) => {
    if (item.objectiveIds.some(o => !objectiveIds.includes(o))) errors.push('Unknown module objective.');
    if (item.sourceIds.some(s => !sourceIds.includes(s))) errors.push('Unknown source block.');
  };
  plan.videos.forEach(v => v.slides.forEach(check));
  const checkpointIds: string[] = [];
  for (const video of plan.videos) {
    const midpoint = Math.ceil(video.slides.length / 2) - 1;
    if (requireCheckpoints && !video.checkpoint) errors.push(`${video.id}: add exactly two midpoint quiz questions.`);
    if (!video.checkpoint) continue;
    if (video.checkpoint.afterSlideId !== video.slides[midpoint].id) errors.push(`${video.id}: quiz must follow the midpoint slide.`);
    const taught = video.slides.slice(0, midpoint + 1);
    for (const q of video.checkpoint.questions) {
      check(q); checkpointIds.push(q.id);
      if (q.objectiveIds.some(o => !taught.some(s => s.objectiveIds.includes(o))) || q.sourceIds.some(id => !taught.some(s => s.sourceIds.includes(id)))) errors.push(`${video.id}: quiz questions must use concepts and sources taught before the checkpoint.`);
    }
  }
  if (new Set(checkpointIds).size !== checkpointIds.length) errors.push('Mid-video question IDs must be unique across videos.');
  const a = plan.activities; check(a.hook.question); a.worked.forEach(check); a.guided.steps.forEach(check); a.lab.scenarios.forEach(s => check(s.question)); a.quiz.questions.forEach(check);
  for (const items of [a.worked, a.guided.steps, a.lab.scenarios.map(s => s.question), a.quiz.questions]) if (new Set(items.map(i => i.id)).size !== items.length) errors.push('Activity IDs must be unique within their stage.');
  for (const o of objectiveIds) {
    if (!plan.videos.some(v => v.slides.some(s => s.objectiveIds.includes(o)))) errors.push(`Teach ${o} in a video.`);
    if (!a.quiz.questions.some(q => q.objectiveIds.includes(o))) errors.push(`Assess ${o} in the quiz.`);
  }
  if (/<\/?[a-z][^>]*>/i.test(JSON.stringify(plan))) errors.push('Use plain text, not HTML.');
  if (errors.length) throw new Error([...new Set(errors)].join(' '));
}
