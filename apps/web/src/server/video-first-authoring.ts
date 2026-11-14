import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { AuthoredCoursePackage, validateAuthoredCourse, type AuthoredCoursePackageData } from '@/lib/authored-course';
import { moduleSourceIssues, courseSources } from '@/lib/source-library';
import { MODULE_CORE_PROMPT, MODULE_CORE_VERSION, MODULE_INSTRUCTIONS_VERSION, moduleAuthoringInput, moduleReadiness } from '@/lib/module-authoring';
import type { CourseBriefData } from '@/lib/content-creator';
import { courseAuthoringSystem } from '@/lib/course-authoring-prompt';
import { getCreatorDraft } from './content-creator';
import { assertVideoSources, readVideoTranscript } from './concept-videos';
import { llmHttp, llmModels, type LlmTransport } from './ai/llm';
import { appRoot } from './db/client';
import { ApiError } from './http';

type Unit = AuthoredCoursePackageData['modules'][number];
type ModuleDraft = { id: string; courseId: string; moduleId: string; briefRevision: number; createdAt: string; content: Unit;
  status?: 'needs_review'; provenance?: { corePromptVersion: string; moduleInstructionsVersion: number; inputHash: string; model: string; sourceRevisions: { id: string; revision: number; transcriptId?: string }[]; instructions: ReturnType<typeof moduleAuthoringInput>['moduleInstructions'] } };
const root = () => process.env.LMS_VIDEO_DIR ?? path.join(appRoot(), '.data', 'concept-videos');
const ModuleSchema = AuthoredCoursePackage.shape.modules.element;
export const moduleInputHash = (brief: CourseBriefData, moduleId: string) => createHash('sha256').update(JSON.stringify({ core: MODULE_CORE_PROMPT, version: MODULE_CORE_VERSION, input: moduleAuthoringInput(brief, moduleId) })).digest('hex');
export async function videoModuleDrafts(ownerId: string, courseId: string) {
  const draft = await getCreatorDraft(ownerId, courseId);
  const dir = path.join(root(), courseId, 'modules');
  const files = await fs.readdir(dir).catch(() => []);
  const entries: ModuleDraft[] = await Promise.all(files.filter(f => /^[a-f0-9-]{36}\.json$/.test(f)).map(async f => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))));
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(entry => ({ ...entry, outdated: !draft.brief.sourceLibrary?.modules.some(m => m.id === entry.moduleId) || (entry.provenance ? entry.provenance.inputHash !== moduleInputHash(draft.brief, entry.moduleId) : entry.briefRevision !== draft.revision) }));
}

export async function generateVideoModule(ownerId: string, courseId: string, moduleId: string, expectedRevision: number, transport: LlmTransport = llmHttp({ timeoutMs: 120000, retries: 0, backoffMs: 1000 })) {
  const draft = await getCreatorDraft(ownerId, courseId);
  if (draft.revision !== expectedRevision) throw new ApiError(409, 'brief_changed', 'Save and reload the latest course brief before generating activities.');
  const gaps = moduleReadiness(draft.brief, moduleId);
  if (gaps.length) throw new ApiError(422, 'source_coverage', gaps.join(' '));
  const unit = draft.brief.sourceLibrary?.modules.find(m => m.id === moduleId);
  if (!unit) throw new ApiError(404, 'module_not_found', 'Select a module in the source outline.');
  const sources = draft.brief.sourceLibrary!.sources.filter(s => s.scope === 'course' || s.moduleId === moduleId);
  await assertVideoSources(ownerId, courseId, { ...draft.brief, sourceLibrary: { ...draft.brief.sourceLibrary!, modules: [unit], sources } });
  const authoringInput = moduleAuthoringInput(draft.brief, moduleId);
  const videoSources = sources.filter(s => s.video && s.moduleId === moduleId).sort((a, b) => unit.topics.findIndex(t => t.id === a.topicId) - unit.topics.findIndex(t => t.id === b.topicId));
  if (!videoSources.length) throw new ApiError(422, 'video_required', 'Upload and review at least one concept video for this module.');
  for (const topic of unit.topics) if (!videoSources.some(s => s.topicId === topic.id)) throw new ApiError(422, 'video_required', `Upload and review a concept video for ${topic.title}.`);
  const videos = await Promise.all(videoSources.map(async source => {
    const video = source.video!; const transcript = await readVideoTranscript(courseId, video.assetId, video.transcriptId!);
    const key = video.assetId.replaceAll('-', '').slice(0, 20);
    const parts = [transcript.cues.filter(c => c.end <= transcript.checkpointSeconds), transcript.cues.filter(c => c.end > transcript.checkpointSeconds)];
    if (parts.some(p => !p.length)) throw new ApiError(422, 'transcript_gap', 'Review transcript cues on both sides of the video midpoint.');
    return { id: `V${key}`, title: source.title, plannedMinutes: video.durationSeconds / 60,
      uploadedVideo: { ...video, transcriptId: transcript.id, checkpointSeconds: transcript.checkpointSeconds },
      slides: parts.map((part, i) => ({ id: `SL${key}${i}`, title: `${source.title} · transcript part ${i + 1}`, body: [part.map(c => c.text).join(' ').slice(0, 900)], narration: part.map(c => c.text).join(' '), objectiveIds: source.objectiveIds, sourceIds: [source.id] })),
      midpointQuiz: { afterSlideId: `SL${key}0`, questions: [] },
    };
  }));
  const objectiveIds = authoringInput.objectives.map(o => o.id);
  const models = llmModels();
  let model = models[0];
  const messages = [{ role: 'system' as const, content: courseAuthoringSystem(MODULE_CORE_PROMPT, draft.brief) },
    { role: 'user' as const, content: JSON.stringify({ ...authoringInput, fixedVideos: videos, outputSchema: z.toJSONSchema(ModuleSchema), instruction: 'Module sourceIds must include all video evidence; objectiveIds must equal the supplied module objectives. Add concise, usable activities rather than slide narration.' }) }];
  let content: Unit | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply: Awaited<ReturnType<LlmTransport>> | undefined;
    // Provider failures do not spend the module's content-repair round.
    for (const candidate of models.slice(models.indexOf(model))) {
      model = candidate;
      try { reply = await transport({ model, messages, response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, max_tokens: 20000, temperature: 0.3 }); break; }
      catch { /* Try only configured fallback models, retaining the saved input. */ }
    }
    if (!reply) throw new ApiError(502, 'generation_unavailable', 'Activity generation is unavailable. Check the configured AI service and retry; your video and transcript are retained.');
    const raw = reply.choices?.[0]?.message?.content ?? '';
    try {
      if (reply.choices?.[0]?.finish_reason === 'length') throw new Error('Output truncated. Shorten prose.');
      const parsed = ModuleSchema.parse(JSON.parse(raw));
      if (parsed.id !== moduleId || parsed.objectiveIds.slice().sort().join(',') !== objectiveIds.slice().sort().join(',')) throw new Error('Preserve module ID and objective IDs.');
      if (parsed.conceptExplainer.videos.length !== videos.length) throw new Error('Preserve every supplied concept video.');
      parsed.conceptExplainer.videos = videos.map(video => {
        const generated = parsed.conceptExplainer.videos.find(v => v.id === video.id);
        if (!generated) throw new Error(`Missing video ${video.id}.`);
        return { ...video, midpointQuiz: { ...video.midpointQuiz, questions: generated.midpointQuiz.questions } };
      });
      delete parsed.narratedStages;
      if (!parsed.moduleQuiz) throw new Error('Supply the module-end quiz.');
      const scopeIssues = moduleSourceIssues(parsed, moduleId, courseSources(draft.brief));
      if (scopeIssues.length) throw new Error(scopeIssues.join(' '));
      // Use the real package validator for IDs, first-half checks and coverage.
      const sandboxPackage = { schemaVersion: 1, title: draft.brief.title, subject: draft.brief.subject, durationMinutes: parsed.durationMinutes, briefRevision: draft.revision,
        objectiveEvidence: objectiveIds.map(id => ({ objectiveId: id, objective: draft.brief.objectives[Number(id.slice(1)) - 1].text, sourceIds: sources.filter(s => s.objectiveIds.includes(id)).map(s => s.id) })),
        sources: sources.map(s => ({ id: s.id, kind: 'sme', title: s.title, reference: s.reference || `Source ${s.id} revision ${s.revision}` })), modules: [parsed],
        courseEnd: { miniProject: { title: 'Review placeholder', brief: 'Assembly supplies the real guided course project.', deliverable: 'Assembly required', rubric: ['Assembly required'], objectiveIds, sourceIds: parsed.sourceIds }, masteryGate: { ...parsed.moduleQuiz, passPercent: 80, questions: parsed.moduleQuiz.questions.map(q => ({ ...q, id: `Validation_${q.id}` })) }, reflection: { prompts: ['Assembly supplies the final reflection.'] } },
      };
      validateAuthoredCourse(sandboxPackage, { objectives: objectiveIds, smeSourceIds: sources.map(s => s.id), briefRevision: draft.revision });
      content = parsed; break;
    } catch (error) {
      messages.push({ role: 'user', content: `Repair once. Validation: ${error instanceof Error ? error.message.slice(0, 5000) : 'Invalid module'}. Return the entire module.` });
    }
  }
  if (!content) throw new ApiError(422, 'generation_validation', 'Generated activities did not pass validation. Your video and reviewed transcript are retained; retry generation.');
  if ((await getCreatorDraft(ownerId, courseId)).revision !== expectedRevision) throw new ApiError(409, 'brief_changed', 'The brief changed during generation; no outdated activities were saved.');
  const entry: ModuleDraft = { id: randomUUID(), courseId, moduleId, briefRevision: expectedRevision, createdAt: new Date().toISOString(), content, status: 'needs_review', provenance: {
    corePromptVersion: MODULE_CORE_VERSION, moduleInstructionsVersion: MODULE_INSTRUCTIONS_VERSION,
    inputHash: moduleInputHash(draft.brief, moduleId), model, instructions: authoringInput.moduleInstructions,
    sourceRevisions: sources.map(s => ({ id: s.id, revision: s.revision, ...(s.video?.transcriptId ? { transcriptId: s.video.transcriptId } : {}) })),
  } };
  const dir = path.join(root(), courseId, 'modules'); await fs.mkdir(dir, { recursive: true });
  const temporary = path.join(dir, `${entry.id}.tmp`);
  try {
    await fs.writeFile(temporary, JSON.stringify(entry), { flag: 'wx' });
    await fs.rename(temporary, path.join(dir, `${entry.id}.json`));
  } finally { await fs.unlink(temporary).catch(() => undefined); }
  return entry;
}
