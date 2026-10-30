import { z } from "zod/v4";
import { MODULE_FLOW, COURSE_END_FLOW, CODEX_MODULE_FLOW, CODEX_COURSE_END_FLOW, type DeliveryStructure } from './course-delivery';
import { BLOOM_LEVELS, type CourseBriefData } from "./content-creator";

const text = z.string().trim().min(1).max(4000);
const lines = z.array(text).max(30);
const ids = z.array(z.string().min(1).max(30)).min(1).max(60);
const moduleLink = { moduleId: z.string().min(1).max(30), objectiveIds: ids };
export const BLUEPRINT_PROMPT_VERSION = 2;
export const SIX_STAGE_BLUEPRINT_PROMPT_VERSION = 3;
export const CODEX_ILD_BLUEPRINT_PROMPT_VERSION = 4;
export const supportedBlueprintPrompt = (version: number) => [BLUEPRINT_PROMPT_VERSION, SIX_STAGE_BLUEPRINT_PROMPT_VERSION, CODEX_ILD_BLUEPRINT_PROMPT_VERSION].includes(version);
export const BLUEPRINT_STEPS = ["hook", "concept", "worked_example", "guided_practice", "scenario", "project_contribution", "mastery_gate", "reflection", "spaced_review"] as const;
export const InstructionalBlueprint = z.object({
  recommendations: z.object({
    summary: text, gaps: lines, risks: lines, assumptions: lines, smeQuestions: lines,
    objectives: z.array(z.object({ objectiveId: text, bloom: z.enum(BLOOM_LEVELS), knowledgeType: z.enum(["Factual", "Conceptual", "Procedural", "Metacognitive"]), alignment: text, sourceIds: ids }).strict()).min(1).max(60),
    cognitiveLoad: z.array(z.object({ topic: text, level: z.enum(["Low", "Medium", "High"]), scaffolding: lines.min(1), extraneousRisks: lines, sourceIds: ids }).strict()).min(1).max(30),
    theoryBlend: z.array(z.object({ theory: text, rationale: text, application: text }).strict()).min(2).max(3),
    psychomotor: z.object({ applicable: z.boolean(), feasibility: text, requirements: lines }).strict(),
  }).strict(),
  modules: z.array(z.object({ id: text, title: text, objectiveIds: ids, sourceIds: ids, prerequisites: z.array(text).max(20), minutes: z.number().positive().max(600),
    steps: z.array(z.object({ kind: z.enum([...BLUEPRINT_STEPS, 'quiz']), activity: text, minutes: z.number().nonnegative().max(600) }).strict()).min(5).max(9),
  }).strict()).min(1).max(12),
  tasks: z.array(z.object({ ...moduleLink, tier: z.enum(["Practice", "Application", "Extension"]), title: text, instructions: text, deliverable: text, feedback: text, sourceIds: ids }).strict()).min(1).max(60),
  assessments: z.array(z.object({ ...moduleLink, layer: z.enum(["L1", "L2", "L3", "L4", "L5"]), bloom: z.enum(BLOOM_LEVELS), solo: z.enum(["Unistructural", "Multistructural", "Relational", "Extended abstract"]), timing: text, prompt: text, evidence: text, successCriteria: lines.min(1), misconceptions: lines, remediation: text }).strict()).min(4).max(80),
  motivation: z.array(z.object({ moduleId: text, attention: text, relevance: text, confidence: text, satisfaction: text, autonomy: text, competence: text, relatedness: text, dipSupport: text, spacedReview: text }).strict()).min(1).max(12),
  tools: z.array(z.object({ moduleId: text, name: text, purpose: text, template: z.enum(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"]), rationale: text }).strict()).min(1).max(40),
  accessibility: z.array(z.object({ moduleId: text, requirements: lines.min(1), verification: text }).strict()).min(1).max(12),
  courseEnd: z.array(z.object({ kind: z.enum([...COURSE_END_FLOW, ...CODEX_COURSE_END_FLOW]), afterModuleId: text, activity: text, minutes: z.number().nonnegative().max(600) }).strict()).length(3).optional(),
  finalDeliverable: z.object({ brief: text, criteria: lines.min(1), minutes: z.number().nonnegative().max(600) }).strict(),
}).strict();
export type Blueprint = z.infer<typeof InstructionalBlueprint>;
export type BlueprintInput = { deliveryStructure?: DeliveryStructure; existingModules?: { id: string; title: string; objectiveIds: string[] }[]; brief: CourseBriefData; objectives: { id: string; text: string; bloom: string }[]; sources: { id: string; text: string }[] };
export type BlueprintRun = { id: string; courseId: string; inputRevision: number; promptVersion: number; status: "running" | "ready" | "failed"; attempts: number; model: string | null; error: string | null; output: Blueprint | null; input: BlueprintInput; createdAt: string; updatedAt: string; outdated: boolean; deliveryStructure?: DeliveryStructure };

export function blueprintInput(brief: CourseBriefData, deliveryStructure?: DeliveryStructure): BlueprintInput {
  return { ...(deliveryStructure && deliveryStructure !== 'legacy' ? { deliveryStructure } : {}), brief, objectives: brief.objectives.map((o, i) => ({ id: `O${i + 1}`, ...o })).filter(o => o.text.trim()),
    sources: brief.sourceText.split(/\n\s*\n/).filter(t => t.trim()).map((text, i) => ({ id: `S${i + 1}`, text })) };
}

/** Structure and traceability checks are not a factual or instructional-quality approval. */
export function validateBlueprint(raw: unknown, input: BlueprintInput): Blueprint {
  const result = InstructionalBlueprint.parse(raw);
  const errors: string[] = [];
  const objectives = new Set(input.objectives.map(o => o.id));
  const sources = new Set(input.sources.map(s => s.id));
  const modules = new Set(result.modules.map(m => m.id));
  const checkIds = (values: string[], allowed: Set<string>, label: string) => { for (const id of values) if (!allowed.has(id)) errors.push(`${label}: unknown ${id}`); };
  if (modules.size !== result.modules.length) errors.push("Module IDs must be unique");
  const classified = result.recommendations.objectives.map(o => o.objectiveId);
  checkIds(classified, objectives, "Objective classification");
  if (classified.length !== objectives.size || new Set(classified).size !== objectives.size) errors.push("Classify every supplied objective exactly once");
  for (const o of result.recommendations.objectives) checkIds(o.sourceIds, sources, "Objective sources");
  for (const load of result.recommendations.cognitiveLoad) checkIds(load.sourceIds, sources, "Load audit sources");
  const prior = new Set<string>();
  for (const unit of result.modules) {
    checkIds(unit.objectiveIds, objectives, "Module objectives"); checkIds(unit.sourceIds, sources, "Module sources");
    checkIds(unit.prerequisites, prior, "Prerequisites must precede the module"); prior.add(unit.id);
    const expected = input.deliveryStructure === 'six-stage-v1' ? MODULE_FLOW : input.deliveryStructure === 'codex-ild-v2' ? CODEX_MODULE_FLOW : BLUEPRINT_STEPS;
    if (unit.steps.length !== expected.length || unit.steps.some((step, i) => step.kind !== expected[i])) errors.push(`${unit.id}: preserve the required teaching steps in order`);
    if (Math.abs(unit.steps.reduce((n, s) => n + s.minutes, 0) - unit.minutes) > 0.1) errors.push(`${unit.id}: step durations must sum to module minutes`);
  }
  for (const item of [...result.tasks, ...result.assessments]) { checkIds([item.moduleId], modules, "Activity module"); checkIds(item.objectiveIds, objectives, "Activity objectives"); if (!(['six-stage-v1', 'codex-ild-v2'].includes(input.deliveryStructure ?? '') && 'layer' in item && item.layer === 'L4')) checkIds(item.objectiveIds, new Set(result.modules.find(m => m.id === item.moduleId)?.objectiveIds ?? []), "Activity objectives must be taught in their module"); }
  for (const task of result.tasks) checkIds(task.sourceIds, sources, "Task sources");
  for (const group of [result.motivation, result.tools, result.accessibility]) {
    checkIds(group.map(g => g.moduleId), modules, "Module support");
    for (const id of modules) if (!group.some(g => g.moduleId === id)) errors.push(`Provide support for module ${id}`);
  }
  for (const group of [result.motivation, result.accessibility]) if (new Set(group.map(g => g.moduleId)).size !== group.length) errors.push("Provide one motivation/accessibility record per module");
  for (const id of modules) {
    for (const tier of ["Practice", "Application", "Extension"]) if (!result.tasks.some(t => t.moduleId === id && t.tier === tier)) errors.push(`${id}: needs a ${tier} task`);
    if (!result.assessments.some(a => a.moduleId === id)) errors.push(`${id}: needs an assessment`);
  }
  for (const id of objectives) {
    if (!result.modules.some(m => m.objectiveIds.includes(id)) || !result.tasks.some(t => t.objectiveIds.includes(id)) || !result.assessments.some(a => a.objectiveIds.includes(id))) errors.push(`${id}: must be taught, practised and assessed`);
  }
  for (const layer of ["L1", "L2", "L3", "L4"]) if (!result.assessments.some(a => a.layer === layer)) errors.push(`Missing assessment layer ${layer}`);
  if (result.recommendations.psychomotor.applicable !== input.brief.physicalSkills) errors.push("Psychomotor applicability must match SME input");
  if (input.brief.physicalSkills && !result.assessments.some(a => a.layer === "L5")) errors.push("Physical-skill objectives require an L5 assessment specification");
  if (!input.brief.physicalSkills && (result.assessments.some(a => a.layer === "L5") || result.tools.some(t => t.template === "T9" || t.template === "T10"))) errors.push("Physical-skill assessment/templates are not applicable to this course");
  if (input.deliveryStructure === 'six-stage-v1' || input.deliveryStructure === 'codex-ild-v2') {
    const isCodex = input.deliveryStructure === 'codex-ild-v2';
    const endFlow = isCodex ? CODEX_COURSE_END_FLOW : COURSE_END_FLOW;
    if (input.existingModules && result.modules.map(m => m.id).join(',') !== input.existingModules.map(m => m.id).join(',')) errors.push('Preserve the existing course module IDs and order.');
    const last = result.modules.at(-1)!.id;
    if (!result.courseEnd || result.courseEnd.some((s, i) => s.kind !== endFlow[i] || s.afterModuleId !== last)) errors.push(isCodex ? 'Mini Project, Mastery Gate and Reflection must follow the final module in order.' : 'Mastery Gate, Reflection and Spaced Review must follow the final module in order.');
    if (!isCodex) for (const id of modules) if (!result.assessments.some(a => a.moduleId === id && a.layer === 'L1')) errors.push(`${id}: needs a local concept quiz.`);
    for (const id of objectives) if (!result.assessments.some(a => a.layer === 'L4' && a.objectiveIds.includes(id))) errors.push(`Course-end mastery must cover ${id}.`);
    if (isCodex) {
      if (result.finalDeliverable.minutes <= 0 || !result.courseEnd?.some(s => s.kind === 'mini_project')) errors.push('Add one course-wide Mini Project after the final module.');
      // L1 checks belong to their teaching module, including modules before the last.
      // The shared activity checks above already validate module and objective links.
    } else if (result.finalDeliverable.minutes !== 0 || result.tools.some(t => t.template === 'T8')) errors.push('No mini-project or project template is allowed.');
    if (result.assessments.some(a => a.layer === 'L4' && a.moduleId !== last)) errors.push('Course-wide mastery belongs after the final module.');
    if (result.tools.some(t => (isCodex ? ['T5', 'T6', 'T8'] : ['T5', 'T6', 'T7']).includes(t.template) && t.moduleId !== last)) errors.push('Course-end templates belong after the final module.');
  }
  if (errors.length) throw new Error(errors.slice(0, 30).join("; "));
  return result;
}
