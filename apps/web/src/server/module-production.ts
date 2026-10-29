import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { supportedBlueprintPrompt, type BlueprintRun } from "@/lib/instructional-blueprint";
import { PRODUCTION_PROMPT_VERSION, ProductionPackage, ScriptDecision, productionWarnings, validateProduction, type ModulePackage, type ProductionInput, type ProductionState } from "@/lib/module-production";
import type { SmeReviewEntry } from "@/lib/sme-review";
import { db, type DB } from "./db/client";
import { creatorCourses, creatorSmeReviews, creatorProductionJobs as jobs, creatorProductionRevisions as revisions, creatorScriptReviews as reviews } from "./db/schema";
import { getReviewRun } from "./creator-sme-review";
import { ApiError } from "./http";
import { aiConfigured, type LlmTransport } from "./ai/llm";
import { generateProduction } from "./production-ai";
import type { SessionUser } from "./auth";
import type { ProductionUnit } from '@/lib/longform-production';
import { generateLongform } from './longform-ai';
import { sameCourseBrief } from '@/lib/content-creator';

export const StartProduction = z.object({ approvalId: z.uuid(), unitKey: z.enum(['module', 'plan', 'v1', 'v2', 'v3', 'v4', 'v5']).optional() }).strict();
export const SaveProduction = z.object({ jobId: z.uuid(), expectedRevision: z.number().int().positive().max(2147483646), content: ProductionPackage }).strict();
const hashNarration = (content: ModulePackage) => Object.fromEntries(content.slides.map(s => [s.id, createHash('sha256').update(s.narration.trim().replace(/\s+/g, ' ')).digest('hex')]));
type Scope = { userId: string; courseId: string; run: BlueprintRun; moduleId: string };
async function source(database: Pick<DB, 'select'>, scope: Scope, lock = false) {
  const q = database.select().from(creatorCourses).where(and(eq(creatorCourses.id, scope.courseId), eq(creatorCourses.ownerId, scope.userId)));
  const [course] = await (lock ? q.for('update') : q);
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  if (!scope.run.output?.modules.some(m => m.id === scope.moduleId)) throw new ApiError(404, 'module_not_found', 'Module not found in this blueprint.');
  const [row] = await database.select().from(creatorSmeReviews).where(and(eq(creatorSmeReviews.runId, scope.run.id), eq(creatorSmeReviews.moduleId, scope.moduleId))).orderBy(desc(creatorSmeReviews.version)).limit(1);
  const approval: SmeReviewEntry | null = row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  const current = scope.run.status === 'ready' && sameCourseBrief(scope.run.input.brief, course.brief) && supportedBlueprintPrompt(scope.run.promptVersion);
  const eligible = current && approval?.verdict === 'approved' && Object.values(approval.checklist).every(Boolean);
  return { eligible: !!eligible, approval, format: course.productionFormat, reason: !current ? 'The blueprint is not current and ready. Generate and review the latest SME input.' : !eligible ? 'Approve this module with all seven checks in Stage 3 before generating production content.' : 'This module is approved for authoring. The course as a whole is not released.' };
}
async function scopeFor(userId: string, courseId: string, runId: string, moduleId: string): Promise<Scope> { return { userId, courseId, moduleId, run: await getReviewRun(userId, courseId, runId) }; }
async function currentJob(database: Pick<DB, 'select'>, job: typeof jobs.$inferSelect, context: Awaited<ReturnType<typeof source>>) {
  if (!context.eligible || job.approvalId !== context.approval?.id || job.promptVersion !== PRODUCTION_PROMPT_VERSION || (!!job.input.unit !== (context.format === 'longform-v1'))) return false;
  const unit = job.input.unit;
  if (unit?.kind !== 'video') return true;
  const [plan] = await database.select().from(jobs).where(eq(jobs.id, unit.planJobId));
  const [head] = plan ? await database.select().from(revisions).where(and(eq(revisions.jobId, plan.id), eq(revisions.version, plan.currentRevision))) : [];
  const [decision] = head ? await database.select().from(reviews).where(and(eq(reviews.jobId, plan.id), eq(reviews.revisionId, head.id))).orderBy(desc(reviews.version)).limit(1) : [];
  return !!(plan?.status === 'ready' && plan.approvalId === job.approvalId && head?.id === unit.planRevisionId && decision?.id === unit.planReviewId && decision.verdict === 'approved');
}
export async function assertCurrentProduction(database: Pick<DB, 'select'>, job: typeof jobs.$inferSelect, userId: string, courseId: string, moduleId: string) {
  const context = await source(database, { userId, courseId, moduleId, run: job.input.run });
  if (!(await currentJob(database, job, context))) throw new ApiError(409, 'outdated_production', 'The production source or plan approval changed.');
}

export async function productionState(userId: string, courseId: string, runId: string, moduleId: string): Promise<ProductionState> {
  const scope = await scopeFor(userId, courseId, runId, moduleId); const database = await db(); const context = await source(database, scope);
  const filter = and(eq(jobs.courseId, courseId), eq(jobs.runId, runId), eq(jobs.moduleId, moduleId));
  await database.update(jobs).set({ status: 'failed', error: 'Processing was interrupted or timed out. Retry explicitly.', updatedAt: new Date() }).where(and(filter, eq(jobs.status, 'running'), lt(jobs.leaseUntil, new Date())));
  const rows = await database.select().from(jobs).where(filter).orderBy(desc(jobs.createdAt));
  const output = await Promise.all(rows.map(async job => {
    const saved = await database.select().from(revisions).where(eq(revisions.jobId, job.id)).orderBy(desc(revisions.version));
    const decisions = await database.select().from(reviews).where(eq(reviews.jobId, job.id)).orderBy(desc(reviews.version));
    return { generatedSlides: job.partialSlides.length, id: job.id, status: job.status as 'running' | 'ready' | 'failed', promptVersion: job.promptVersion, currentRevision: job.currentRevision, attempts: job.attempts, model: job.model, error: job.error, input: job.input, outdated: !(await currentJob(database, job, context)), createdAt: job.createdAt.toISOString(),
      revisions: saved.map(r => ({ id: r.id, version: r.version, content: r.content, narrationHashes: r.narrationHashes, createdAt: r.createdAt.toISOString() })),
      reviews: decisions.map(r => ({ ...r, expectedRevision: saved.find(s => s.id === r.revisionId)!.version, expectedReviewVersion: r.version - 1, createdAt: r.createdAt.toISOString() })) };
  }));
  return { ...context, jobs: output, configured: aiConfigured() };
}

export async function startProduction(user: SessionUser, courseId: string, runId: string, moduleId: string, approvalId: string, requestedUnit = 'module') {
  const scope = await scopeFor(user.id, courseId, runId, moduleId); const database = await db();
  await productionState(user.id, courseId, runId, moduleId);
  const work = await database.transaction(async tx => {
    const context = await source(tx, scope, true);
    if (!context.eligible || context.approval?.id !== approvalId) throw new ApiError(409, 'approval_required', 'A current Stage 3 approval is required. Reload after reviewing the module.');
    let unit: ProductionUnit | undefined; let unitKey = requestedUnit;
    if (context.format === 'longform-v1') {
      if (requestedUnit === 'plan') unit = { kind: 'plan', key: 'plan', checkpointPolicy: 'two-question-midpoint-v1' };
      else if (/^v[1-5]$/.test(requestedUnit)) {
        const [plan] = await tx.select().from(jobs).where(and(eq(jobs.runId, runId), eq(jobs.moduleId, moduleId), eq(jobs.approvalId, approvalId), eq(jobs.unitKey, 'plan'), eq(jobs.promptVersion, PRODUCTION_PROMPT_VERSION)));
        const [head] = plan ? await tx.select().from(revisions).where(and(eq(revisions.jobId, plan.id), eq(revisions.version, plan.currentRevision))) : [];
        const [decision] = head ? await tx.select().from(reviews).where(and(eq(reviews.jobId, plan!.id), eq(reviews.revisionId, head.id))).orderBy(desc(reviews.version)).limit(1) : [];
        const outline = head?.content.plan?.videos.find(v => v.id === requestedUnit);
        if (plan?.status !== 'ready' || !head || decision?.verdict !== 'approved' || !outline) throw new ApiError(409, 'plan_approval_required', 'Save and approve the module production plan and activities before generating videos.');
        unit = { kind: 'video', key: requestedUnit, planJobId: plan.id, planRevisionId: head.id, planReviewId: decision.id, outline, minSeconds: 300, maxSeconds: 420, narrationPolicyVersion: 2 };
        unitKey = `${requestedUnit}:${head.id}:${decision.id}`;
      } else throw new ApiError(400, 'unit_required', 'Choose the module plan or one of its five videos.');
    } else if (requestedUnit !== 'module') throw new ApiError(409, 'format_required', 'Enable the long-form format in course settings before creating video units.');
    const token = randomUUID(); const input: ProductionInput = { run: scope.run, moduleId, approval: context.approval, ...(unit ? { unit } : {}) };
    const [inserted] = await tx.insert(jobs).values({ courseId, runId, moduleId, approvalId, unitKey, promptVersion: PRODUCTION_PROMPT_VERSION, input, token, leaseUntil: new Date(Date.now() + (unit ? 960000 : 480000)) }).onConflictDoNothing().returning();
    if (inserted) return { id: inserted.id, token };
    const [existing] = await tx.select().from(jobs).where(and(eq(jobs.runId, runId), eq(jobs.moduleId, moduleId), eq(jobs.approvalId, approvalId), eq(jobs.promptVersion, PRODUCTION_PROMPT_VERSION), eq(jobs.unitKey, unitKey)));
    if (existing.status !== 'failed') return { id: existing.id, token: null };
    await tx.update(jobs).set({ status: 'running', token, leaseUntil: new Date(Date.now() + (unit ? 960000 : 480000)), attempts: sql`${jobs.attempts} + 1`, error: null, updatedAt: new Date() }).where(eq(jobs.id, existing.id));
    return { id: existing.id, token };
  });
  return work;
}
export async function processProduction(id: string, token: string, userId: string, transport?: LlmTransport) {
  const database = await db(); const [job] = await database.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.token, token), eq(jobs.status, 'running'))); if (!job) return;
  try {
    const generated = job.input.unit ? await generateLongform(job.input, transport, { partial: job.partialSlides, onSlide: async slides => {
      const updated = await database.update(jobs).set({ partialSlides: slides, updatedAt: new Date() }).where(and(eq(jobs.id, id), eq(jobs.token, token), eq(jobs.status, 'running'))).returning({ id: jobs.id });
      if (!updated.length) throw new Error('Generation lease changed.');
    } }) : await generateProduction(job.input, transport);
    await database.transaction(async tx => {
      const [active] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.token, token), eq(jobs.status, 'running'))).for('update'); if (!active) return;
      await tx.insert(revisions).values({ jobId: id, version: 1, content: generated.content, narrationHashes: hashNarration(generated.content), createdBy: userId });
      await tx.update(jobs).set({ status: 'ready', currentRevision: 1, model: generated.model, usage: generated.usage, error: null, updatedAt: new Date() }).where(eq(jobs.id, id));
    });
  } catch (error) {
    // Keep provider bodies and source text out of logs; record only the failed
    // boundary so operators can distinguish capacity issues from bad content.
    const detail = error instanceof Error ? error.message : '';
    const boundary = detail.match(/^Could not generate valid slide ([A-Za-z0-9-]+):/);
    console.warn('Creator production failed', { jobId: id, slideId: boundary?.[1], reason: /Provider busy\./.test(detail) ? 'provider_busy' : /Provider model\./.test(detail) ? 'provider_model' : 'validation_or_processing' });
    await database.update(jobs).set({ status: 'failed', error: 'Generation failed or did not pass validation. The approved blueprint is unchanged; retry when ready.', updatedAt: new Date() }).where(and(eq(jobs.id, id), eq(jobs.token, token), eq(jobs.status, 'running')));
  }
}
export async function saveProduction(user: SessionUser, courseId: string, runId: string, moduleId: string, raw: z.infer<typeof SaveProduction>) {
  const scope = await scopeFor(user.id, courseId, runId, moduleId); const input = SaveProduction.parse(raw); const database = await db();
  await database.transaction(async tx => {
    const context = await source(tx, scope, true);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.courseId, courseId), eq(jobs.runId, runId), eq(jobs.moduleId, moduleId))).for('update');
    if (!job) throw new ApiError(404, 'not_found', 'Production package not found.');
    if (!(await currentJob(tx, job, context)) || job.status !== 'ready') throw new ApiError(409, 'outdated_production', 'This production source or plan is outdated or not ready. Recheck its approval.');
    if (job.currentRevision !== input.expectedRevision) throw new ApiError(409, 'revision_conflict', 'Another tab saved a newer revision. Your edits are retained; copy them before loading the latest version.');
    let content: ModulePackage;
    try { content = validateProduction(input.content, job.input); } catch (e) { throw new ApiError(400, 'invalid_content', e instanceof Error ? e.message : 'Invalid production package.'); }
    await tx.insert(revisions).values({ jobId: job.id, version: job.currentRevision + 1, content, narrationHashes: hashNarration(content), createdBy: user.id });
    await tx.update(jobs).set({ currentRevision: job.currentRevision + 1, updatedAt: new Date() }).where(eq(jobs.id, job.id));
  });
  return productionState(user.id, courseId, runId, moduleId);
}
export async function reviewScripts(user: SessionUser, courseId: string, runId: string, moduleId: string, raw: z.infer<typeof ScriptDecision>) {
  const scope = await scopeFor(user.id, courseId, runId, moduleId); const input = ScriptDecision.parse(raw); const database = await db();
  await database.transaction(async tx => {
    const context = await source(tx, scope, true);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.courseId, courseId), eq(jobs.runId, runId), eq(jobs.moduleId, moduleId))).for('update');
    if (!job) throw new ApiError(404, 'not_found', 'Production package not found.');
    if (!(await currentJob(tx, job, context)) || job.status !== 'ready') throw new ApiError(409, 'outdated_production', 'The source or plan approval changed or this package is not ready.');
    if (job.currentRevision !== input.expectedRevision) throw new ApiError(409, 'revision_conflict', 'Review the latest saved production revision before deciding.');
    const [revision] = await tx.select().from(revisions).where(and(eq(revisions.jobId, job.id), eq(revisions.version, job.currentRevision)));
    const [last] = await tx.select().from(reviews).where(eq(reviews.jobId, job.id)).orderBy(desc(reviews.version)).limit(1);
    if ((last?.version ?? 0) !== input.expectedReviewVersion) throw new ApiError(409, 'review_conflict', 'A newer script decision exists. Reload the latest record; your feedback is retained.');
    if (input.verdict === 'approved' && productionWarnings(revision.content, job.input).length) throw new ApiError(409, 'unresolved_content', 'Resolve short or missing narration and all uncertainty/review flags before approval.');
    await tx.insert(reviews).values({ jobId: job.id, revisionId: revision.id, version: input.expectedReviewVersion + 1, verdict: input.verdict, checklist: input.checklist, feedback: input.feedback, reviewerId: user.id, reviewerName: user.name });
  });
  return productionState(user.id, courseId, runId, moduleId);
}
