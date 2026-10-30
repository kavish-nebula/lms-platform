import { z } from "zod/v4";
import type { VideoSlide } from "@/data/types";
import { BLUEPRINT_STEPS, type BlueprintRun } from "./instructional-blueprint";
import { CODEX_MODULE_FLOW } from './course-delivery';
import type { SmeReviewEntry } from "./sme-review";
import { LongformPlan, VideoCheckpoint, ActivityQuestion, validatePlan, LONGFORM_MIN_WORDS, wordCount, type ProductionUnit, type ProductionFormat } from './longform-production';

export const PRODUCTION_PROMPT_VERSION = 1;
export const SLIDE_LAYOUTS = ["title", "definition", "comparison", "bullets", "worked_example", "recap"] as const;
const short = z.string().trim().max(180);
export const ProductionSlide = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,80}$/), step: z.enum([...BLUEPRINT_STEPS, 'quiz']), layout: z.enum(SLIDE_LAYOUTS),
  title: z.string().trim().min(1).max(80), subtitle: z.string().trim().max(200),
  content: z.array(short.min(1)).min(1).max(5), otherContent: z.array(short.min(1)).max(4),
  leftLabel: z.string().trim().max(60), rightLabel: z.string().trim().max(60), takeaway: z.string().trim().max(240),
  narration: z.string().trim().max(16000), pronunciationNotes: z.string().trim().max(1000), activityNotes: z.string().trim().max(2500),
  activityMinutes: z.number().min(0).max(60), objectiveIds: z.array(z.string()).min(1).max(60), sourceIds: z.array(z.string()).min(1).max(100), uncertainties: z.array(z.string().trim().min(1).max(1000)).max(10),
}).strict();
export const LessonVideo = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,80}$/), title: z.string().min(1).max(200), slideIds: z.array(z.string()).min(3).max(9), visualSeconds: z.number().min(0).max(60), checkpoint: VideoCheckpoint }).strict();
export const ProductionPackage = z.object({ title: z.string().trim().min(1).max(200), slides: z.array(ProductionSlide).max(30), reviewNotes: z.array(z.string().trim().min(1).max(2000)).max(20), plan: LongformPlan.optional(), checkpoint: VideoCheckpoint.optional(), lessonVideos: z.array(LessonVideo).min(3).max(4).optional(), moduleQuiz: z.object({ title: z.string().min(1), questions: z.array(ActivityQuestion).min(3).max(10) }).strict().optional() }).strict();
export type SlideDraft = z.infer<typeof ProductionSlide>;
export type ModulePackage = z.infer<typeof ProductionPackage>;
export type ProductionInput = { run: BlueprintRun; moduleId: string; approval: SmeReviewEntry; unit?: ProductionUnit };
export const ScriptChecks = z.object({ sourceAccuracy: z.boolean(), alignment: z.boolean(), pronunciation: z.boolean(), pacing: z.boolean() }).strict();
export const ScriptDecision = z.object({ jobId: z.uuid(), expectedRevision: z.number().int().positive(), expectedReviewVersion: z.number().int().nonnegative(), verdict: z.enum(["approved", "revision_requested"]), checklist: ScriptChecks, feedback: z.string().trim().max(6000) }).strict().superRefine((v, ctx) => {
  if (v.verdict === "approved" && !Object.values(v.checklist).every(Boolean)) ctx.addIssue({ code: "custom", message: "Confirm all four script-review checks before approval." });
  if (v.verdict === "revision_requested" && !v.feedback) ctx.addIssue({ code: "custom", message: "Revision feedback is required." });
});
export type ScriptReview = z.infer<typeof ScriptDecision> & { id: string; revisionId: string; version: number; reviewerId: string; reviewerName: string; createdAt: string };
export type ProductionRevision = { id: string; version: number; content: ModulePackage; narrationHashes: Record<string, string>; createdAt: string };
export type ProductionJob = { generatedSlides?: number; id: string; status: "running" | "ready" | "failed"; promptVersion: number; currentRevision: number; attempts: number; model: string | null; error: string | null; input: ProductionInput; outdated: boolean; createdAt: string; revisions: ProductionRevision[]; reviews: ScriptReview[] };
export type ProductionState = { eligible: boolean; reason: string; approval: SmeReviewEntry | null; jobs: ProductionJob[]; configured: boolean; format?: ProductionFormat };

/** Validate individual responses before checkpointing a long video. */
export function validateLongformSlide(raw: unknown, input: ProductionInput, expectedId: string): SlideDraft {
  if (input.unit?.kind !== 'video') throw new Error('A video outline is required.');
  // Video activities live in the reviewed plan; an omitted empty note is safe
  // to supply without inventing teaching content or changing source links.
  const slide = ProductionSlide.parse(raw && typeof raw === 'object' && !Array.isArray(raw) ? { activityNotes: '', ...raw } : raw);
  const outline = input.unit.outline.slides.find(s => s.id === expectedId);
  if (!outline || slide.id !== expectedId || slide.step !== 'concept' || slide.activityMinutes !== 0) throw new Error('Preserve the selected slide identity and concept stage.');
  if (wordCount(slide.narration) < LONGFORM_MIN_WORDS) throw new Error(`This slide has only ${wordCount(slide.narration)} words. Write 650–700 substantive words, keeping source-supported depth; the planning minimum is 600 and audio must measure 300–420 seconds.`);
  if (outline.objectiveIds.some(id => !slide.objectiveIds.includes(id)) || slide.objectiveIds.some(id => !outline.objectiveIds.includes(id))) throw new Error('Preserve reviewed objective links.');
  if (outline.sourceIds.some(id => !slide.sourceIds.includes(id)) || slide.sourceIds.some(id => !input.run.input.sources.some(s => s.id === id))) throw new Error('Preserve reviewed source links.');
  if (slide.layout === 'comparison' && (!slide.leftLabel || !slide.rightLabel || !slide.otherContent.length)) throw new Error('Comparison needs both labels and content columns.');
  if (/<\/?[a-z][^>]*>/i.test(JSON.stringify(slide))) throw new Error('Use plain text, not HTML.');
  return slide;
}

export function narrationSentences(text: string) { return text.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean); }
export function productionWarnings(content: ModulePackage, input?: ProductionInput) {
  if (input && !input.unit && input.run.input.deliveryStructure === 'codex-ild-v2') {
    try { validateProduction(content, input); } catch (e) { return [e instanceof Error ? e.message : 'Lesson content does not meet the teaching contract.', ...content.reviewNotes]; }
  }
  return [...content.reviewNotes, ...content.slides.flatMap(s => [...s.uncertainties.map(u => `${s.title}: ${u}`), ...(!s.narration.trim() ? [`${s.title}: narration is missing.`] : []), ...(input?.unit?.kind === 'video' && wordCount(s.narration) < LONGFORM_MIN_WORDS ? [`${s.title}: at least ${LONGFORM_MIN_WORDS} words are required before script approval; audio must still measure 300–420 seconds.`] : [])])];
}
export function validateProduction(raw: unknown, input: ProductionInput, generated = false): ModulePackage {
  const content = ProductionPackage.parse(raw);
  const unit = input.run.output!.modules.find(m => m.id === input.moduleId)!;
  const objectives = new Set(unit.objectiveIds); const sources = new Set(input.run.input.sources.map(s => s.id));
  const errors: string[] = [];
  const lessonMode = !input.unit && input.run.input.deliveryStructure === 'codex-ild-v2';
  if (input.unit?.kind === 'plan') {
    if (content.slides.length || !content.plan) throw new Error('A plan package requires a plan and no narration slides.');
    validatePlan(content.plan, unit.objectiveIds, [...sources], !!input.unit.checkpointPolicy);
    const minimumMinutes = content.plan.videos.reduce((n, v) => n + v.slides.length * 5, 0) + content.plan.activities.activityMinutes;
    if (minimumMinutes > unit.minutes) throw new Error(`The video minimum plus activities requires ${minimumMinutes} minutes; the blueprint budget is ${unit.minutes}. Revise the plan or blueprint budget.`);
    return content;
  }
  if (content.plan) errors.push('Only a plan package can contain the module plan.');
  if (input.unit?.kind === 'video') {
    const expectedCheckpoint = input.unit.outline.checkpoint ? VideoCheckpoint.parse(input.unit.outline.checkpoint) : undefined;
    if (JSON.stringify(content.checkpoint) !== JSON.stringify(expectedCheckpoint)) errors.push('Preserve the reviewed midpoint quiz; edit and reapprove the module plan to change questions.');
    if (content.slides.length < 7 || content.slides.length > 9) errors.push('Each video requires 7–9 slides.');
    const planned = input.unit.outline.slides.map(s => s.id);
    if (content.slides.map(s => s.id).join(',') !== planned.join(',')) errors.push('Preserve the approved video outline slide IDs and order.');
  } else {
    if (content.checkpoint) errors.push('Mid-video checkpoints belong to long-form video packages only.');
    if (content.slides.length < 9) errors.push('A pilot package requires at least nine slides.');
    if (generated && !lessonMode && content.slides.length !== 12) errors.push("Generate exactly 12 slides for this pilot.");
  }
  if (new Set(content.slides.map(s => s.id)).size !== content.slides.length) errors.push("Slide IDs must be unique and stable.");
  let previousStep = -1;
  for (const slide of content.slides) {
    const stageOrder: readonly string[] = lessonMode ? CODEX_MODULE_FLOW : BLUEPRINT_STEPS;
    const step = stageOrder.indexOf(slide.step);
    if (!input.unit && (step < 0 || step < previousStep)) errors.push("Keep the required teaching stages in blueprint order; course-end activities belong after all modules."); previousStep = step;
    if (input.unit?.kind === 'video' && slide.step !== 'concept') errors.push(`${slide.id}: video slides use the concept stage; activities are separate.`);
    if (input.unit?.kind === 'video' && slide.activityMinutes !== 0) errors.push(`${slide.id}: activity time belongs to the module plan.`);
    if (slide.objectiveIds.some(id => !objectives.has(id))) errors.push(`${slide.id}: unknown module objective.`);
    if (slide.sourceIds.some(id => !sources.has(id))) errors.push(`${slide.id}: unknown SME source.`);
    if (input.unit?.kind === 'video') {
      const outline = input.unit.outline.slides.find(s => s.id === slide.id);
      if (outline && (outline.objectiveIds.some(id => !slide.objectiveIds.includes(id)) || slide.objectiveIds.some(id => !outline.objectiveIds.includes(id)))) errors.push(`${slide.id}: preserve the reviewed outline objective links.`);
      if (outline?.sourceIds.some(id => !slide.sourceIds.includes(id))) errors.push(`${slide.id}: retain the reviewed outline source links.`);
    }
    if (slide.layout === 'comparison' && (!slide.leftLabel || !slide.rightLabel || !slide.otherContent.length)) errors.push(`${slide.id}: comparison requires both labels and both content columns.`);
    if (generated && !slide.narration) errors.push(`${slide.id}: generated narration is missing.`);
    if (input.unit?.kind === 'video' && generated && wordCount(slide.narration) < LONGFORM_MIN_WORDS) errors.push(`${slide.id}: write at least ${LONGFORM_MIN_WORDS} substantive narration words for a five-minute minimum.`);
    if (!input.unit && slide.narration.length > 4000) errors.push(`${slide.id}: pilot narration exceeds 4000 characters.`);
    if (/<\/?[a-z][^>]*>/i.test(JSON.stringify(slide))) errors.push(`${slide.id}: use plain text, not HTML.`);
    if (narrationSentences(slide.narration).join(' ') !== slide.narration.trim().replace(/\s+/g, ' ')) errors.push(`${slide.id}: narration sentence alignment failed.`);
  }
  if (!input.unit) {
    for (const step of lessonMode ? CODEX_MODULE_FLOW : BLUEPRINT_STEPS) if (!content.slides.some(s => s.step === step)) errors.push(`Missing teaching stage: ${step}`);
    for (const id of objectives) if (!content.slides.some(s => s.objectiveIds.includes(id))) errors.push(`Missing objective coverage: ${id}`);
  }
  if (lessonMode) {
    for (const kind of ['hook','worked_example','guided_practice','scenario']) if (content.slides.filter(s=>s.step===kind).length < 2) errors.push(`${kind}: provide a meaningful multi-scene teaching sequence, not one static card.`);
    if (!content.lessonVideos || !content.moduleQuiz) errors.push('Provide 3–4 concept videos with midpoint checks and a module quiz.');
    const concepts = content.slides.filter(s => s.step === 'concept');
    if (content.lessonVideos?.flatMap(v => v.slideIds).join(',') !== concepts.map(s => s.id).join(',')) errors.push('Each concept slide must belong to exactly one video, in teaching order.');
    const questionIds: string[] = [];
    if (new Set(content.lessonVideos?.map(v => v.id)).size !== content.lessonVideos?.length) errors.push('Video IDs must be unique.');
    for (const video of content.lessonVideos ?? []) {
      if (/^(?:distinct concept )?topic\s*\d+$/i.test(video.title.trim())) errors.push(`${video.id}: use a specific topic title, not a placeholder.`);
      const slides = video.slideIds.map(id => content.slides.find(s => s.id === id)).filter((s): s is SlideDraft => !!s);
      if (video.checkpoint.afterSlideId !== video.slideIds[Math.ceil(video.slideIds.length / 2) - 1]) errors.push(`${video.id}: place two questions after the midpoint slide.`);
      for (const slide of slides) if (wordCount(slide.narration) < 100) errors.push(`${video.id}/${slide.id}: narration has ${wordCount(slide.narration)} words; write at least 100 substantive words for this slide.`);
      if (slides.reduce((n,s) => n + wordCount(s.narration) / 130 * 60, video.visualSeconds) > 420) errors.push(`${video.id}: narration plus visual time exceeds seven minutes.`);
      const firstHalf = slides.slice(0, Math.ceil(slides.length / 2));
      for (const q of video.checkpoint.questions) if (q.objectiveIds.some(id => !firstHalf.some(s => s.objectiveIds.includes(id))) || q.sourceIds.some(id => !firstHalf.some(s => s.sourceIds.includes(id)))) errors.push(`${video.id}: checkpoint must assess first-half teaching.`);
    }
    for (const q of [...(content.lessonVideos ?? []).flatMap(v => v.checkpoint.questions), ...(content.moduleQuiz?.questions ?? [])]) {
      questionIds.push(q.id);
      if (q.objectiveIds.some(id => !objectives.has(id)) || q.sourceIds.some(id => !sources.has(id))) errors.push(`${q.id}: unknown question source/objective.`);
    }
    if (new Set(questionIds).size !== questionIds.length) errors.push('Question IDs must be unique.');
    for (const id of objectives) if (!content.moduleQuiz?.questions.some(q => q.objectiveIds.includes(id))) errors.push(`Module quiz must cover ${id}.`);
    const totalMinutes = content.slides.reduce((n,s) => n + wordCount(s.narration) / 130 + s.activityMinutes, 0) + (content.lessonVideos ?? []).reduce((n,v) => n + v.visualSeconds / 60, 0);
    if (totalMinutes > unit.minutes) errors.push(`Narration, visuals and activities need ${Math.ceil(totalMinutes)} minutes; module budget is ${unit.minutes}.`);
  }
  if (errors.length) throw new Error(errors.slice(0, 20).join(' '));
  return content;
}

/** Adapt the restricted authoring model to the existing renderer; no generated styling/code. */
export function productionPreview(s: SlideDraft): VideoSlide {
  const base = { title: s.title, narration: s.narration, sentences: narrationSentences(s.narration) };
  if (s.layout === 'title') return { ...base, kind: 'title', icon: 'BookOpen', kicker: s.subtitle, sub: s.content.join(' ') };
  if (s.layout === 'definition') return { ...base, kind: 'define', term: s.title, definition: s.content[0], parts: s.content.slice(1).map(text => ({ text, cue: 0 })), analogy: { label: s.subtitle || 'Context', text: s.takeaway } };
  if (s.layout === 'comparison') return { ...base, kind: 'compare', left: { label: s.leftLabel, tone: 'info', points: s.content, cue: 0 }, right: { label: s.rightLabel, tone: 'info', points: s.otherContent, cue: 0 } };
  if (s.layout === 'worked_example') return { ...base, kind: 'example', scenario: s.subtitle, steps: s.content.map((text, i) => ({ text, time: String(i + 1), icon: 'FileText', cue: 0 })), result: { text: s.takeaway, cue: 0 } };
  if (s.layout === 'recap') return { ...base, kind: 'recap', points: s.content.map(text => ({ text, cue: 0 })) };
  return { ...base, kind: 'bullets', lead: s.subtitle, bullets: s.content.map(text => ({ text, icon: 'Check', cue: 0 })), aside: { label: 'Takeaway', text: s.takeaway, icon: 'Lightbulb', cue: 0 } };
}
