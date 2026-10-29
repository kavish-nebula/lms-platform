import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { briefReadiness, sameCourseBrief, type CourseBriefData } from "@/lib/content-creator";
import { BLUEPRINT_PROMPT_VERSION, SIX_STAGE_BLUEPRINT_PROMPT_VERSION, CODEX_ILD_BLUEPRINT_PROMPT_VERSION, supportedBlueprintPrompt, blueprintInput, type BlueprintRun } from "@/lib/instructional-blueprint";
import { getCreatorDraft } from "./content-creator";
import { db } from "./db/client";
import { creatorBlueprints } from "./db/schema";
import { ApiError } from "./http";
import { generateBlueprint } from "./blueprint-ai";
import type { LlmTransport } from "./ai/llm";

export const StartBlueprint = z.object({ revision: z.number().int().positive().max(2147483646) }).strict();
type Row = typeof creatorBlueprints.$inferSelect;
const view = (row: Row, brief: CourseBriefData, deliveryStructure?: 'legacy' | 'six-stage-v1' | 'codex-ild-v2'): BlueprintRun => ({ deliveryStructure, id: row.id, courseId: row.courseId, inputRevision: row.inputRevision, promptVersion: row.promptVersion, status: row.status as BlueprintRun["status"], attempts: row.attempts, model: row.model, error: row.error, output: row.output, input: row.input, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), outdated: !sameCourseBrief(row.input.brief, brief) || !supportedBlueprintPrompt(row.promptVersion) });
const LEASE_MS = 8 * 60_000;

export async function listBlueprints(ownerId: string, courseId: string) {
  const draft = await getCreatorDraft(ownerId, courseId);
  const database = await db();
  // A stopped server cannot silently leave a course running forever. Retry is explicit.
  await database.update(creatorBlueprints).set({ status: "failed", error: "Processing was interrupted or timed out. Retry to process the saved SME input.", updatedAt: new Date() }).where(and(eq(creatorBlueprints.courseId, courseId), eq(creatorBlueprints.status, "running"), lt(creatorBlueprints.leaseUntil, new Date())));
  return (await database.select().from(creatorBlueprints).where(eq(creatorBlueprints.courseId, courseId)).orderBy(desc(creatorBlueprints.createdAt))).map(row => view(row, draft.brief, draft.deliveryStructure));
}

export async function startBlueprint(ownerId: string, courseId: string, revision: number) {
  const draft = await getCreatorDraft(ownerId, courseId);
  if (draft.revision !== revision) throw new ApiError(409, "draft_conflict", "The SME input has changed. Reload the saved brief before processing.");
  const missing = briefReadiness(draft.brief).filter(c => !c.ready);
  if (missing.length) throw new ApiError(422, "incomplete_input", `Complete the Stage 1 inputs first: ${missing.map(c => c.label).join("; ")}`);
  const promptVersion = draft.deliveryStructure === 'codex-ild-v2' ? CODEX_ILD_BLUEPRINT_PROMPT_VERSION : draft.deliveryStructure === 'six-stage-v1' ? SIX_STAGE_BLUEPRINT_PROMPT_VERSION : BLUEPRINT_PROMPT_VERSION;
  const history = await listBlueprints(ownerId, courseId);
  const matching = history.find(r => !r.outdated && r.status === "ready" && r.promptVersion === promptVersion);
  if (matching) return { run: matching, token: null };
  const database = await db();
  const token = randomUUID();
  const existingModules = draft.deliveryStructure !== 'legacy' ? history.find(r => !r.outdated && r.status === 'ready')?.output?.modules.map(({ id, title, objectiveIds }) => ({ id, title, objectiveIds })) : undefined;
  const input = { ...blueprintInput(draft.brief, draft.deliveryStructure), ...(existingModules ? { existingModules } : {}) };
  const [inserted] = await database.insert(creatorBlueprints).values({ courseId, inputRevision: revision, promptVersion, input, token, leaseUntil: new Date(Date.now() + LEASE_MS) }).onConflictDoNothing().returning();
  if (inserted) return { run: view(inserted, draft.brief, draft.deliveryStructure), token };
  const [existing] = await database.select().from(creatorBlueprints).where(and(eq(creatorBlueprints.courseId, courseId), eq(creatorBlueprints.inputRevision, revision), eq(creatorBlueprints.promptVersion, promptVersion)));
  if (existing.status !== "failed") return { run: view(existing, draft.brief, draft.deliveryStructure), token: null };
  const [retried] = await database.update(creatorBlueprints).set({ status: "running", error: null, token, attempts: sql`${creatorBlueprints.attempts} + 1`, leaseUntil: new Date(Date.now() + LEASE_MS), updatedAt: new Date() })
    .where(and(eq(creatorBlueprints.id, existing.id), eq(creatorBlueprints.status, "failed"))).returning();
  if (!retried) return { run: (await listBlueprints(ownerId, courseId)).find(r => r.id === existing.id)!, token: null };
  return { run: view(retried, draft.brief, draft.deliveryStructure), token };
}

export async function processBlueprint(id: string, token: string, transport?: LlmTransport) {
  const database = await db();
  const [row] = await database.select().from(creatorBlueprints).where(and(eq(creatorBlueprints.id, id), eq(creatorBlueprints.token, token), eq(creatorBlueprints.status, "running")));
  if (!row) return;
  const ownedAttempt = and(eq(creatorBlueprints.id, id), eq(creatorBlueprints.token, token), eq(creatorBlueprints.status, "running"));
  try {
    const result = await generateBlueprint(row.input, transport);
    await database.update(creatorBlueprints).set({ ...result, status: "ready", error: null, updatedAt: new Date() }).where(ownedAttempt);
  } catch {
    // Provider errors may contain URLs or request details; keep them out of the authoring UI.
    await database.update(creatorBlueprints).set({ status: "failed", error: "AI processing did not complete. The provider may be unavailable or the output did not pass structural checks. Your SME input is unchanged. Retry when ready.", updatedAt: new Date() }).where(ownedAttempt);
  }
}
