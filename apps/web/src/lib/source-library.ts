import { z } from 'zod/v4';
import { UploadedConceptVideo } from './concept-video-source';

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,29}$/);
export const SourceLibrary = z.object({
  version: z.literal(1),
  modules: z.array(z.object({ id, title: z.string().max(200), topics: z.array(z.object({ id, title: z.string().max(200) }).strict()).max(40) }).strict()).max(12),
  sources: z.array(z.object({
    id, revision: z.number().int().positive(), title: z.string().max(200),
    scope: z.enum(['course', 'module', 'topic']), moduleId: z.string().max(30), topicId: z.string().max(30),
    objectiveIds: z.array(id).max(60), text: z.string().max(100000), reference: z.string().max(2000),
    video: UploadedConceptVideo.partial({ transcriptId: true, checkpointSeconds: true }).optional(),
  }).strict()).max(100),
}).strict().superRefine((value, ctx) => {
  const ids = [...value.modules.map(m => m.id), ...value.modules.flatMap(m => m.topics.map(t => t.id)), ...value.sources.map(s => s.id)];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Module, topic and source IDs must be unique.', path: ['sources'] });
  if (value.sources.reduce((n, s) => n + s.text.length, 0) > 1000000) ctx.addIssue({ code: 'custom', message: 'Source library exceeds 1,000,000 characters.', path: ['sources'] });
});
export type SourceLibraryData = z.infer<typeof SourceLibrary>;
type Brief = { sourceText: string; sourceLibrary?: SourceLibraryData; objectives: { text: string }[] };
const hasEvidence = (text: string) => !!text.replace(/https?:\/\/\S+/g, '').trim();

/** Legacy paragraph IDs remain unchanged until the creator explicitly migrates them. */
export function courseSources(brief: Brief): SourceLibraryData['sources'] {
  return brief.sourceLibrary?.sources ?? brief.sourceText.split(/\n\s*\n/).filter(s => s.trim()).map((text, i) => ({
    id: `S${i + 1}`, revision: 1, title: `SME source ${i + 1}`, scope: 'course' as const,
    moduleId: '', topicId: '', objectiveIds: [] as string[], text, reference: '',
  }));
}

export function migrateSourceLibrary(brief: Brief): SourceLibraryData {
  return { version: 1, modules: [], sources: courseSources(brief) };
}

/** Mapping checks establish declared coverage, never factual sufficiency or SME approval. */
export function sourceCoverage(brief: Brief) {
  if (!brief.sourceLibrary) return [];
  const { modules, sources } = brief.sourceLibrary;
  const issues: string[] = [];
  const objectives = new Set(brief.objectives.flatMap((o, i) => o.text.trim() ? [`O${i + 1}`] : []));
  const evidence = sources.filter(s => s.title.trim() && hasEvidence(s.text));
  if (!sources.length) issues.push('Add at least one source containing evidence, not only a URL.');
  for (const m of modules) {
    if (!m.title.trim()) issues.push(`${m.id}: add a module title.`);
    if (!evidence.some(s => s.moduleId === m.id && s.scope !== 'course')) issues.push(`${m.id}: add a module or topic source.`);
    for (const t of m.topics) {
      if (!t.title.trim()) issues.push(`${t.id}: add a topic title.`);
      if (!evidence.some(s => s.scope === 'topic' && s.moduleId === m.id && s.topicId === t.id)) issues.push(`${t.id}: add a topic source.`);
      if (sources.some(s => s.moduleId === m.id && s.video) && !evidence.some(s => s.moduleId === m.id && s.topicId === t.id && s.video?.transcriptId)) issues.push(`${t.id}: upload and review a concept video for this video-first module.`);
    }
  }
  for (const s of sources) {
    if (s.video && (!s.video.transcriptId || !s.video.checkpointSeconds)) issues.push(`${s.id}: review the timestamped video transcript before generation.`);
    if (s.video && s.scope === 'course') issues.push(`${s.id}: concept videos must target a module or topic.`);
    if (!s.title.trim() || !hasEvidence(s.text)) issues.push(`${s.id}: supply a title and source evidence; references alone are insufficient.`);
    if (!s.objectiveIds.length) issues.push(`${s.id}: map at least one objective.`);
    for (const o of s.objectiveIds) if (!objectives.has(o)) issues.push(`${s.id}: unknown objective ${o}; remap this source.`);
    const m = modules.find(m => m.id === s.moduleId);
    if (s.scope === 'course' && (s.moduleId || s.topicId)) issues.push(`${s.id}: course sources cannot target a module or topic.`);
    if (s.scope !== 'course' && !m) issues.push(`${s.id}: select an existing module.`);
    if (s.scope === 'module' && s.topicId) issues.push(`${s.id}: module sources cannot target a topic.`);
    if (s.scope === 'topic' && !m?.topics.some(t => t.id === s.topicId)) issues.push(`${s.id}: select a topic in its module.`);
  }
  for (const o of objectives) if (!evidence.some(s => s.objectiveIds.includes(o))) issues.push(`${o}: no source evidence mapped to this objective.`);
  if (modules.length && modules.every(m => sources.some(s => s.moduleId === m.id && s.video))) for (const o of objectives) {
    if (!evidence.some(s => s.video?.transcriptId && s.objectiveIds.includes(o))) issues.push(`${o}: no reviewed concept video mapped to this video-first course objective.`);
  }
  return issues;
}

/** Server owns revisions; reordered entries retain identity and unchanged revisions. */
export function reviseSourceLibrary(next: SourceLibraryData, previous?: SourceLibraryData): SourceLibraryData {
  return { ...next, sources: next.sources.map(source => {
    const old = previous?.sources.find(s => s.id === source.id);
    const content = (s: typeof source) => JSON.stringify([s.id, s.title, s.scope, s.moduleId, s.topicId, s.objectiveIds, s.text, s.reference, s.video]);
    return { ...source, revision: old ? old.revision + Number(content(source) !== content(old)) : 1 };
  }) };
}

/** Inspect all nested citations, including slides, practice and quiz questions. */
export function moduleSourceIssues(content: unknown, moduleId: string, sources: ReturnType<typeof courseSources>): string[] {
  const issues = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.sourceIds)) for (const id of record.sourceIds) {
      const source = sources.find(s => s.id === id);
      if (source && source.scope !== 'course' && source.moduleId !== moduleId) issues.add(`${moduleId}: source ${source.id} belongs to another module.`);
    }
    Object.values(record).forEach(visit);
  };
  visit(content);
  return [...issues];
}
