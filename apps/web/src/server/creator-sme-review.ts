import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { SmeDecision, reviewSummary, type ReviewDecision, type SmeReviewEntry } from "@/lib/sme-review";
import { supportedBlueprintPrompt } from "@/lib/instructional-blueprint";
import type { SessionUser } from "./auth";
import { listBlueprints } from "./creator-blueprints";
import { db } from "./db/client";
import { creatorBlueprints, creatorCourses, creatorSmeReviews } from "./db/schema";
import { ApiError } from "./http";
import { sameCourseBrief } from '@/lib/content-creator';

type Row = typeof creatorSmeReviews.$inferSelect;
const view = (row: Row): SmeReviewEntry => ({ ...row, createdAt: row.createdAt.toISOString() });

export async function getReviewRun(ownerId: string, courseId: string, runId: string) {
  if (!z.uuid().safeParse(runId).success) throw new ApiError(404, "not_found", "Blueprint not found.");
  const run = (await listBlueprints(ownerId, courseId)).find(r => r.id === runId);
  if (!run) throw new ApiError(404, "not_found", "Blueprint not found.");
  return run;
}

export async function getSmeReview(ownerId: string, courseId: string, runId: string) {
  const run = await getReviewRun(ownerId, courseId, runId);
  const entries = (await (await db()).select().from(creatorSmeReviews).where(eq(creatorSmeReviews.runId, runId)).orderBy(desc(creatorSmeReviews.createdAt), desc(creatorSmeReviews.version))).map(view);
  return { entries, summary: reviewSummary(run, entries), writable: run.status === "ready" && !!run.output && !run.outdated };
}

export async function saveSmeReview(user: SessionUser, courseId: string, runId: string, input: ReviewDecision) {
  await getReviewRun(user.id, courseId, runId);
  const decision = SmeDecision.parse(input);
  const database = await db();
  await database.transaction(async tx => {
    // Lock the authoring course: edits and concurrent decisions must not race approval.
    const [course] = await tx.select().from(creatorCourses).where(and(eq(creatorCourses.id, courseId), eq(creatorCourses.ownerId, user.id))).for("update");
    if (!course) throw new ApiError(404, "not_found", "Course draft not found.");
    const [run] = await tx.select().from(creatorBlueprints).where(and(eq(creatorBlueprints.id, runId), eq(creatorBlueprints.courseId, courseId)));
    if (!run || run.status !== "ready" || !run.output) throw new ApiError(409, "blueprint_not_ready", "Only a completed blueprint can be reviewed.");
    if (!sameCourseBrief(run.input.brief, course.brief) || !supportedBlueprintPrompt(run.promptVersion)) throw new ApiError(409, "outdated_blueprint", "This blueprint is outdated. Generate and review the latest saved SME input; historical decisions remain available.");
    if (!run.output.modules.some(m => m.id === decision.moduleId)) throw new ApiError(404, "module_not_found", "Module not found in this blueprint.");
    const [last] = await tx.select().from(creatorSmeReviews).where(and(eq(creatorSmeReviews.runId, runId), eq(creatorSmeReviews.moduleId, decision.moduleId))).orderBy(desc(creatorSmeReviews.version)).limit(1);
    if ((last?.version ?? 0) !== decision.expectedVersion) throw new ApiError(409, "review_conflict", "A newer review was saved in another tab. Your feedback is retained; reload the latest decisions before submitting again.");
    await tx.insert(creatorSmeReviews).values({ runId, moduleId: decision.moduleId, version: decision.expectedVersion + 1, verdict: decision.verdict, checklist: decision.checklist, feedback: decision.feedback, priority: decision.priority, reviewerId: user.id, reviewerName: user.name });
  });
  return getSmeReview(user.id, courseId, runId);
}
