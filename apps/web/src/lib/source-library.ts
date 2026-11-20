import { z } from 'zod/v4';
import { UploadedConceptVideo } from './concept-video-source';
import { MiniProjectPlan, miniProjectPlanIssues } from './sme-mini-project';

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,29}$/);
export const SourcePurpose = z.enum(['problem-hook', 'worked-example', 'guided-practice', 'scenario-lab', 'module-quiz']);
const draftQuestion = z.object({
  id, prompt: z.string().max(12000), selectionType: z.enum(['single', 'multiple']),
  choices: z.array(z.string().max(12000)).min(2).max(5), correctIndices: z.array(z.number().int().nonnegative()).max(5),
  hint: z.string().max(12000), explanation: z.string().max(12000), objectiveIds: z.array(id).max(60),
}).strict();
export const ModuleInstructions = z.object({
  version: z.literal(1),
  objectiveIds: z.array(id).max(60),
  scope: z.string().max(12000), exclusions: z.string().max(12000),
  prerequisites: z.string().max(12000), dependsOn: z.array(id).max(12),
  teachingNotes: z.string().max(12000),
}).strict();
export const SourceLibrary = z.object({
  version: z.literal(1),
  miniProject: MiniProjectPlan.optional(),
  modules: z.array(z.object({ id, title: z.string().max(200), scenarioLabEnabled: z.boolean().optional(), instructions: ModuleInstructions.optional(), topics: z.array(z.object({ id, title: z.string().max(200) }).strict()).max(40) }).strict()).max(12),
  sources: z.array(z.object({
    id, revision: z.number().int().positive(), title: z.string().max(200),
    purpose: SourcePurpose.optional(),
    scope: z.enum(['course', 'module', 'topic']), moduleId: z.string().max(30), topicId: z.string().max(30),
    objectiveIds: z.array(id).max(60), text: z.string().max(100000), reference: z.string().max(2000),
    context: z.string().max(12000).optional(),
    supplementalText: z.string().max(100000).optional(),
    diagramText: z.string().max(12000).optional(),
    diagram: z.object({ assetId: z.uuid(), description: z.string().max(12000) }).strict().optional(),
    audio: z.object({ assetId: z.uuid(), durationSeconds: z.number().positive().max(1800), transcriptId: z.uuid().optional(), transcriptText: z.string().max(100000).optional() }).strict().optional(),
    video: UploadedConceptVideo.partial({ transcriptId: true, checkpointSeconds: true }).optional(),
    workedExample: z.object({ reasoning: z.array(z.string().max(12000)).max(20), result: z.string().max(12000) }).strict().optional(),
    practiceSteps: z.array(z.object({ id, instruction: z.string().max(12000), hint: z.string().max(12000), evidence: z.string().max(12000) }).strict()).max(30).optional(),
    scenarios: z.array(z.object({ id, title: z.string().max(200), situation: z.string().max(12000), challenge: z.string().max(12000), expectedEvidence: z.string().max(12000) }).strict()).max(20).optional(),
    quizQuestions: z.array(draftQuestion).max(100).optional(),
  }).strict()).max(100),
}).strict().superRefine((value, ctx) => {
  const ids = [...value.modules.map(m => m.id), ...value.modules.flatMap(m => m.topics.map(t => t.id)), ...value.sources.map(s => s.id), ...value.sources.flatMap(s => [...(s.practiceSteps ?? []).map(p => p.id), ...(s.scenarios ?? []).map(p => p.id), ...(s.quizQuestions ?? []).map(q => q.id)]), ...(value.miniProject?.tasks.map(t => t.id) ?? [])];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Module, topic and source IDs must be unique.', path: ['sources'] });
  const hooks = value.sources.filter(s => s.purpose === 'problem-hook');
  if (new Set(hooks.map(s => s.moduleId)).size !== hooks.length) ctx.addIssue({ code: 'custom', message: 'Supply only one problem hook source per module.', path: ['sources'] });
  for (const s of hooks) if (s.scope !== 'module' || s.topicId || s.video) ctx.addIssue({ code: 'custom', message: 'Problem hook content must be a module source without a concept video.', path: ['sources'] });
  for (const s of hooks) if (s.text.length > 12000) ctx.addIssue({ code: 'custom', message: 'Problem hook content cannot exceed 12,000 characters.', path: ['sources'] });
  for (const purpose of ['guided-practice', 'scenario-lab', 'module-quiz'] as const) {
    const records = value.sources.filter(s => s.purpose === purpose);
    if (new Set(records.map(s => s.moduleId)).size !== records.length) ctx.addIssue({ code: 'custom', message: `Supply only one ${purpose} source per module.`, path: ['sources'] });
  }
  for (const s of value.sources) {
    if (s.purpose && (s.scope !== 'module' || s.topicId || s.video)) ctx.addIssue({ code: 'custom', message: 'Activity inputs must be module sources without a concept video.', path: ['sources'] });
    if ((s.workedExample && s.purpose !== 'worked-example') || (s.practiceSteps && s.purpose !== 'guided-practice') || (s.scenarios && s.purpose !== 'scenario-lab') || (s.quizQuestions && s.purpose !== 'module-quiz')) ctx.addIssue({ code: 'custom', message: 'Activity fields must match their source purpose.', path: ['sources'] });
  }
  if (value.sources.reduce((n, s) => n + s.text.length + (s.supplementalText?.length ?? 0) + (s.context?.length ?? 0) + (s.diagramText?.length ?? 0) + (s.diagram?.description.length ?? 0) + (s.audio?.transcriptText?.length ?? 0) + JSON.stringify([s.workedExample, s.practiceSteps, s.scenarios, s.quizQuestions]).length, 0) + JSON.stringify(value.miniProject ?? {}).length > 1000000) ctx.addIssue({ code: 'custom', message: 'Source library exceeds 1,000,000 characters.', path: ['sources'] });
});
export type SourceLibraryData = z.infer<typeof SourceLibrary>;
export type SourceRecord = SourceLibraryData['sources'][number];
export const isConceptTeachingSource = (source: { purpose?: string }) => !source.purpose;

/** Unconfigured older modules keep their labs; new modules explicitly opt out. */
export const moduleHasScenarioLab = (brief: { sourceLibrary?: SourceLibraryData }, moduleId: string) => brief.sourceLibrary?.modules.find(m => m.id === moduleId)?.scenarioLabEnabled !== false;
export const isActiveSource = (brief: { sourceLibrary?: SourceLibraryData }, source: SourceRecord) => source.purpose !== 'scenario-lab' || moduleHasScenarioLab(brief, source.moduleId);

/** Binary attachments alone cannot establish teaching coverage. Context is framing. */
export function sourceTeachingText(source: SourceRecord) {
  return [...new Set([source.text, source.supplementalText, source.audio?.transcriptId ? source.audio.transcriptText : '', source.diagramText, source.diagram?.description, ...(source.workedExample?.reasoning ?? []), source.workedExample?.result, ...(source.practiceSteps ?? []).flatMap(s => [s.instruction, s.hint, s.evidence]), ...(source.scenarios ?? []).flatMap(s => [s.title, s.situation, s.challenge, s.expectedEvidence])].filter(value => value?.trim()))].join('\n\n');
}

/** Apply async media results to the latest record, preserving SME text. */
export function patchSourceRecord(source: SourceRecord, patch: Partial<SourceRecord>): SourceRecord {
  return { ...source, ...patch, ...(!source.video && patch.video && source.text.trim() && !source.supplementalText ? { supplementalText: source.text } : {}) };
}
type Brief = { sourceText: string; sourceLibrary?: SourceLibraryData; objectives: { text: string }[] };
const hasEvidence = (text: string) => !!text.replace(/https?:\/\/\S+/g, '').trim();

/** Legacy paragraph IDs remain unchanged until the creator explicitly migrates them. */
export function courseSources(brief: Brief): SourceLibraryData['sources'] {
  return brief.sourceLibrary?.sources.filter(source => isActiveSource(brief, source)) ?? brief.sourceText.split(/\n\s*\n/).filter(s => s.trim()).map((text, i) => ({
    id: `S${i + 1}`, revision: 1, title: `SME source ${i + 1}`, scope: 'course' as const,
    moduleId: '', topicId: '', objectiveIds: [] as string[], text, reference: '',
  }));
}

export function migrateSourceLibrary(brief: Brief): SourceLibraryData {
  return { version: 1, modules: [], sources: courseSources(brief) };
}

/** Mapping checks establish declared coverage, never factual sufficiency or SME approval. */
export function sourceCoverage(brief: Brief, moduleId?: string) {
  if (!brief.sourceLibrary) return [];
  const modules = brief.sourceLibrary.modules.filter(m => !moduleId || m.id === moduleId);
  const sources = brief.sourceLibrary.sources.filter(s => isActiveSource(brief, s) && (!moduleId || s.scope === 'course' || s.moduleId === moduleId));
  const issues: string[] = [];
  const objectives = new Set(brief.objectives.flatMap((o, i) => o.text.trim() ? [`O${i + 1}`] : []));
  const targetObjectives = moduleId ? new Set(modules[0]?.instructions?.objectiveIds.length ? modules[0].instructions.objectiveIds : sources.filter(s => s.scope !== 'course').flatMap(s => s.objectiveIds)) : objectives;
  if (moduleId && !modules.length) issues.push('Select an existing module.');
  if (moduleId && !targetObjectives.size) issues.push(`${moduleId}: map module objectives to its teaching sources.`);
  // An opening situation introduces a problem; it cannot fill a teaching gap.
  const evidence = sources.filter(s => isConceptTeachingSource(s) && s.title.trim() && hasEvidence(sourceTeachingText(s)));
  if (!sources.length) issues.push('Add at least one source containing evidence, not only a URL.');
  for (const m of modules) {
    for (const o of m.instructions?.objectiveIds ?? []) if (!objectives.has(o)) issues.push(`${m.id}: unknown objective ${o}; remap module instructions.`);
    const index = brief.sourceLibrary.modules.findIndex(unit => unit.id === m.id);
    for (const dependency of m.instructions?.dependsOn ?? []) if (!brief.sourceLibrary.modules.slice(0, index).some(unit => unit.id === dependency)) issues.push(`${m.id}: prerequisite ${dependency} must be an earlier module in the outline.`);
    if (!m.title.trim()) issues.push(`${m.id}: add a module title.`);
    if (!evidence.some(s => s.moduleId === m.id && s.scope !== 'course')) issues.push(`${m.id}: add a module or topic source.`);
    for (const t of m.topics) {
      if (!t.title.trim()) issues.push(`${t.id}: add a topic title.`);
      if (!evidence.some(s => s.scope === 'topic' && s.moduleId === m.id && s.topicId === t.id)) issues.push(`${t.id}: add a topic source.`);
      if (sources.some(s => s.moduleId === m.id && s.video) && !evidence.some(s => s.moduleId === m.id && s.topicId === t.id && s.video?.transcriptId)) issues.push(`${t.id}: upload and review a concept video for this video-first module.`);
    }
  }
  for (const s of sources) {
    if (s.purpose === 'worked-example' && (!s.text.trim() || !s.workedExample?.reasoning.length || s.workedExample.reasoning.some(r => !r.trim()) || !s.workedExample.result.trim())) issues.push(`${s.id}: complete the worked example problem, reasoning steps and result.`);
    if (s.purpose === 'guided-practice' && (!s.text.trim() || !s.practiceSteps?.length || s.practiceSteps.some(p => !p.instruction.trim() || !p.hint.trim() || !p.evidence.trim()))) issues.push(`${s.id}: complete the guided practice instructions, steps, hints and expected evidence.`);
    if (s.purpose === 'scenario-lab' && (!s.text.trim() || !s.scenarios?.length || s.scenarios.some(p => !p.title.trim() || !p.situation.trim() || !p.challenge.trim() || !p.expectedEvidence.trim()))) issues.push(`${s.id}: complete the scenario lab instructions, situation, challenge and expected evidence.`);
    if (s.purpose === 'module-quiz') {
      if (!s.text.trim() || !s.quizQuestions?.length) issues.push(`${s.id}: add quiz instructions and at least one question.`);
      for (const q of s.quizQuestions ?? []) {
        if (!q.prompt.trim() || q.choices.some(c => !c.trim()) || new Set(q.choices.map(c => c.trim().toLowerCase())).size !== q.choices.length || !q.hint.trim() || !q.explanation.trim()) issues.push(`${q.id}: complete the question, distinct options, hint and explanation.`);
        if (new Set(q.correctIndices).size !== q.correctIndices.length || q.correctIndices.some(i => i >= q.choices.length) || (q.selectionType === 'single' ? q.correctIndices.length !== 1 : q.correctIndices.length < 2 || q.correctIndices.length >= q.choices.length)) issues.push(`${q.id}: select one correct answer, or at least two correct answers and one distractor for select-all.`);
        if (!q.objectiveIds.length || q.objectiveIds.some(o => !s.objectiveIds.includes(o))) issues.push(`${q.id}: map the question to objectives assigned to its quiz source.`);
      }
    }
    if (s.audio && (!s.audio.transcriptId || !s.audio.transcriptText?.trim())) issues.push(`${s.id}: review the audio transcript before generation.`);
    if (s.diagram && !s.diagram.description.trim()) issues.push(`${s.id}: describe the diagram’s essential labels, relationships and meaning.`);
    if (s.purpose) {
      const selected = modules.find(m => m.id === s.moduleId)?.instructions?.objectiveIds;
      if (selected?.length && s.objectiveIds.some(o => !selected.includes(o))) issues.push(`${s.id}: map activity content only to this module’s objectives.`);
    }
    if (s.video && (!s.video.transcriptId || !s.video.checkpointSeconds)) issues.push(`${s.id}: review the timestamped video transcript before generation.`);
    if (s.video && s.scope === 'course') issues.push(`${s.id}: concept videos must target a module or topic.`);
    if (!s.title.trim() || !hasEvidence(sourceTeachingText(s))) issues.push(`${s.id}: supply a title and source evidence; references alone are insufficient.`);
    if (!s.objectiveIds.length) issues.push(`${s.id}: map at least one objective.`);
    for (const o of s.objectiveIds) if (!objectives.has(o)) issues.push(`${s.id}: unknown objective ${o}; remap this source.`);
    const m = modules.find(m => m.id === s.moduleId);
    if (s.scope === 'course' && (s.moduleId || s.topicId)) issues.push(`${s.id}: course sources cannot target a module or topic.`);
    if (s.scope !== 'course' && !m) issues.push(`${s.id}: select an existing module.`);
    if (s.scope === 'module' && s.topicId) issues.push(`${s.id}: module sources cannot target a topic.`);
    if (s.scope === 'topic' && !m?.topics.some(t => t.id === s.topicId)) issues.push(`${s.id}: select a topic in its module.`);
  }
  for (const o of targetObjectives) if (!evidence.some(s => s.objectiveIds.includes(o))) issues.push(`${o}: no source evidence mapped to this objective.`);
  if (modules.length && modules.every(m => sources.some(s => s.moduleId === m.id && s.video))) for (const o of targetObjectives) {
    if (!evidence.some(s => s.video?.transcriptId && s.objectiveIds.includes(o))) issues.push(`${o}: no reviewed concept video mapped to this video-first course objective.`);
  }
  if (!moduleId) issues.push(...miniProjectPlanIssues(brief));
  return issues;
}

/** Server owns revisions; reordered entries retain identity and unchanged revisions. */
export function reviseSourceLibrary(next: SourceLibraryData, previous?: SourceLibraryData): SourceLibraryData {
  return { ...next, sources: next.sources.map(source => {
    const old = previous?.sources.find(s => s.id === source.id);
    const content = (s: typeof source) => JSON.stringify([s.id, s.title, s.scope, s.moduleId, s.topicId, s.objectiveIds, s.text, s.reference, s.video, s.purpose, s.context, s.supplementalText, s.diagramText, s.diagram, s.audio, s.workedExample ? [s.workedExample.reasoning, s.workedExample.result] : null, s.practiceSteps?.map(p => [p.id, p.instruction, p.hint, p.evidence]), s.scenarios?.map(p => [p.id, p.title, p.situation, p.challenge, p.expectedEvidence]), s.quizQuestions?.map(q => [q.id, q.prompt, q.selectionType, q.choices, q.correctIndices, q.hint, q.explanation, q.objectiveIds])]);
    return { ...source, revision: old ? old.revision + Number(content(source) !== content(old)) : 1 };
  }) };
}

/** Inspect all nested citations, including slides, practice and quiz questions. */
export function moduleSourceIssues(content: unknown, moduleId: string, sources: ReturnType<typeof courseSources>): string[] {
  const issues = new Set<string>();
  const visit = (value: unknown, midpoint = false) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, midpoint)); return; }
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.sourceIds)) for (const id of record.sourceIds) {
      const source = sources.find(s => s.id === id);
      if (source && source.scope !== 'course' && source.moduleId !== moduleId) issues.add(`${moduleId}: source ${source.id} belongs to another module.`);
      if (source?.purpose && midpoint) issues.add(`${moduleId}: midpoint questions must cite concept teaching, not activity source ${source.id}.`);
    }
    Object.entries(record).forEach(([key, item]) => visit(item, midpoint || key === 'midpointQuiz'));
  };
  visit(content);
  return [...issues];
}
