import { z } from "zod/v4";
import type { BlueprintRun } from "./instructional-blueprint";

export const SME_CHECKS = [
  ["accuracy", "Content accuracy", "The proposed teaching is factually correct against the SME sources."],
  ["alignment", "Objective alignment", "The module supports its stated learning objectives."],
  ["sequence", "Sequence validity", "The prerequisites and teaching sequence are appropriate."],
  ["difficulty", "Difficulty calibration", "The tasks match the intended audience and support needs."],
  ["authenticity", "Workplace authenticity", "The scenarios and tasks reflect the supplied professional context."],
  ["completeness", "Content completeness", "No critical content needed for this module has been omitted."],
  ["assessment", "Assessment validity", "The proposed assessments measure the stated objectives."],
] as const;
export const SmeChecklist = z.object({ accuracy: z.boolean(), alignment: z.boolean(), sequence: z.boolean(), difficulty: z.boolean(), authenticity: z.boolean(), completeness: z.boolean(), assessment: z.boolean() }).strict();
export type ReviewChecklist = z.infer<typeof SmeChecklist>;
export const EMPTY_SME_CHECKLIST: ReviewChecklist = { accuracy: false, alignment: false, sequence: false, difficulty: false, authenticity: false, completeness: false, assessment: false };
export const SmeDecision = z.object({
  moduleId: z.string().trim().min(1).max(4000), expectedVersion: z.number().int().nonnegative().max(2147483646),
  verdict: z.enum(["approved", "revision_requested", "rejected"]), checklist: SmeChecklist,
  feedback: z.string().trim().max(6000), priority: z.enum(["Critical", "Recommended", "Optional"]),
}).strict().superRefine((value, ctx) => {
  if (value.verdict === "approved" && !Object.values(value.checklist).every(Boolean)) ctx.addIssue({ code: "custom", message: "Approval requires all seven SME checks to pass.", path: ["checklist"] });
  if (value.verdict !== "approved" && !value.feedback) ctx.addIssue({ code: "custom", message: "Explain the rejection or provide specific revision instructions.", path: ["feedback"] });
});
export type ReviewDecision = z.infer<typeof SmeDecision>;
export type SmeReviewEntry = { id: string; runId: string; moduleId: string; version: number; verdict: ReviewDecision["verdict"]; checklist: ReviewChecklist; feedback: string; priority: ReviewDecision["priority"]; reviewerId: string; reviewerName: string; createdAt: string };
export function reviewSummary(run: Pick<BlueprintRun, "outdated" | "output">, entries: SmeReviewEntry[]) {
  const byModule = new Map<string, SmeReviewEntry>();
  for (const entry of entries) if ((byModule.get(entry.moduleId)?.version ?? -1) < entry.version) byModule.set(entry.moduleId, entry);
  const latest: Record<string, SmeReviewEntry> = Object.fromEntries(byModule);
  const modules = run.output?.modules ?? [];
  const approved = modules.filter(m => latest[m.id]?.verdict === "approved" && Object.values(latest[m.id].checklist).every(Boolean)).length;
  const changesRequested = modules.filter(m => latest[m.id] && latest[m.id].verdict !== "approved").length;
  const pending = modules.length - approved - changesRequested;
  const gatePassed = !run.outdated && modules.length > 0 && approved === modules.length;
  return { latest, total: modules.length, approved, changesRequested, pending, gatePassed, status: run.outdated ? "outdated" : gatePassed ? "approved" : changesRequested ? "changes_requested" : "pending" };
}
export type SmeReviewState = { entries: SmeReviewEntry[]; summary: ReturnType<typeof reviewSummary>; writable: boolean };
