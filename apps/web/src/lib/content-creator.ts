import { z } from "zod/v4";

export const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;
const note = z.string().max(12000);
export const CourseBrief = z.object({
  title: z.string().max(200), subject: z.string().max(300), audience: note,
  prerequisites: note, outcomes: note, duration: z.string().max(100),
  delivery: z.enum(["", "Self-paced", "Instructor-led", "Blended", "Cohort-based"]),
  sourceText: z.string().max(100000), references: note, dependencies: note,
  contexts: note, difficulties: note,
  objectives: z.array(z.object({ text: z.string().max(1000), bloom: z.enum(BLOOM_LEVELS) }).strict()).max(60),
  physicalSkills: z.boolean(), physicalNotes: note,
}).strict();
export type CourseBriefData = z.infer<typeof CourseBrief>;
/** Compare every validated field, including source text, objectives and constraints.
 * Revision counters can advance after legacy no-op saves; fuzzy matching is unsafe. */
export function sameCourseBrief(a: unknown, b: unknown): boolean {
  const left = CourseBrief.safeParse(a); const right = CourseBrief.safeParse(b);
  return left.success && right.success && JSON.stringify(left.data) === JSON.stringify(right.data);
}
export type CreatorDraft = { id: string; brief: CourseBriefData; revision: number; createdAt: string; updatedAt: string; productionFormat?: 'pilot' | 'longform-v1'; deliveryStructure?: 'legacy' | 'six-stage-v1' | 'codex-ild-v2' };
export const EMPTY_BRIEF: CourseBriefData = {
  title: "", subject: "", audience: "", prerequisites: "", outcomes: "", duration: "", delivery: "",
  sourceText: "", references: "", dependencies: "", contexts: "", difficulties: "", objectives: [], physicalSkills: false, physicalNotes: "",
};

/** Presence checks help an SME prepare input; they never certify accuracy or measurability. */
export function briefReadiness(brief: CourseBriefData) {
  const objectives = brief.objectives.filter(o => o.text.trim());
  return [
    { label: "Course title, subject and audience supplied", ready: !!(brief.title.trim() && brief.subject.trim() && brief.audience.trim()) },
    { label: "Objectives supplied — SME must verify measurable outcomes", ready: objectives.length > 0 },
    { label: "At least three Bloom’s levels represented", ready: new Set(objectives.map(o => o.bloom)).size >= 3 },
    { label: "Raw content and intended outcomes supplied", ready: !!(brief.sourceText.trim() && brief.outcomes.trim()) },
    { label: "Topic sequence and dependencies documented", ready: !!brief.dependencies.trim() },
    { label: "Authentic workplace contexts supplied", ready: !!brief.contexts.trim() },
    { label: "Known difficulty areas documented", ready: !!brief.difficulties.trim() },
    { label: "Physical practice requirements documented, if applicable", ready: !brief.physicalSkills || !!brief.physicalNotes.trim() },
  ];
}

export const ILD_STAGES = [
  ["SME Input", "Define the audience, objectives, source material and workplace context."],
  ["AI Instructional Design", "Seven analysis operations produce an instructional blueprint."],
  ["SME Quality Control", "Review accuracy, alignment and authentic scenarios."],
  ["Content Creation", "Build slides, narration, activities and assessments."],
  ["ILD Quality Control", "Evaluate instructional quality with the nine-dimension rubric."],
  ["Final SME Sign-off", "Approve a specific assembled version for pilot testing."],
  ["Learner Pilot", "Validate usability, assessment clarity and accessibility."],
  ["Monitoring & Iteration", "Use learning evidence to guide reviewed improvements."],
] as const;
export const CREATOR_ROADMAP = [
  ["Next: Extended asset production", "Advanced voice controls, interactive activities, final assessment authoring and additional visual/media formats."],
  ["Then: Asset quality and pilot", "SME review of created tasks, the ILD quality rubric, final release sign-off and learner pilot feedback."],
  ["Then: Publishing and improvement", "Approved for pilot → Pilot passed → Published. Versioned LMS publishing, rollback and objective-level analytics. Original reading content stays separate from adaptive variants."],
] as const;
