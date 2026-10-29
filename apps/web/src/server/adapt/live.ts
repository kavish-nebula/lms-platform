import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { and, asc, desc, eq, lt, ne, or } from "drizzle-orm";
import { getCourse, getModule } from "@/data";
import { getBlock } from "@/data/client";
import type { VideoSlide } from "@/data/types";
import { gradeGate } from "@/data/mock-grader";
import { correctChoiceIndices, exactChoices } from '@/lib/assessment-answers';
import { gradeAuthoredAssessment } from '@/server/authored-assessment';
import { learnerAnswers, normalizeAnswers } from "@/lib/setup";
import type { SessionUser } from "@/server/auth";
import { db } from "@/server/db/client";
import { adaptationJobs, moduleEvidence, signals } from "@/server/db/schema";
import * as repo from "@/server/repo";
import { ApiError } from "@/server/http";
import { mergeShape } from "./shape";
import { audioRoot, defaultVoicer, type Voicer } from "./tts";
import { piecesOf } from "./pieces";

export const liveEnabled = (courseId: string) => process.env.ADAPTIVE_PYTHON_ENABLED === "true" && courseId === "ai-agent";
export const ADAPTIVE_PROMPT_VERSION = 4;
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
// Keep the full evidence snapshot for audit, but do not rewrite a module every
// time its prerequisite's playback timer advances. Only teaching inputs matter.
function teachingContext(context: Awaited<ReturnType<typeof contextOf>>["context"]) {
  return { ...context, evidence: context.evidence.map((r) => ({ moduleId: r.moduleId, summary: {
    concepts: r.summary.concepts, weakLessons: r.summary.weakLessons,
    insufficientEvidence: r.summary.insufficientEvidence, supportRequests: r.summary.supportRequests,
  } })) };
}
const voiceSettings = () => ({ provider: process.env.AUDIO_PROVIDER, model: process.env.AUDIO_MODEL, voice: process.env.AUDIO_VOICE, style: process.env.AUDIO_STYLE, kokoroVoice: process.env.KOKORO_VOICE });
const clipKey = (text: string) => hash({ text, voice: voiceSettings() });
type Job = typeof adaptationJobs.$inferSelect;
export type Trigger = "initial" | "simplify" | "example" | "wrong_answer";

export function internalAuth(req: Request) {
  const secret = process.env.ADAPTIVE_INTERNAL_TOKEN ?? "";
  const supplied = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (secret.length < 24 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw new ApiError(401, "unauthorized", "Invalid service credential.");
}

export async function requireEnrollment(user: SessionUser, courseId: string) {
  const e = await repo.findEnrollment(user.id, courseId);
  if (!e) throw new ApiError(404, "not_enrolled", "Enrollment not found.");
  return e;
}

async function videosOf(courseId: string, moduleId: string) {
  const mod = await getModule(courseId, moduleId);
  if (!mod) throw new ApiError(404, "unknown_module", "Module not found.");
  return { mod, videos: getBlock(mod, "explainer")?.videos ?? [] };
}

/** Scores only identifiable responses against authored keys, never client correctness flags. */
export async function verifiedSignals(courseId: string, list: repo.NewSignal[]) {
  const result: repo.NewSignal[] = [];
  for (const s of list) {
    const payload = { ...s.payload };
    delete payload.verified;
    if (s.kind === "video_check" && s.moduleId) {
      const { videos } = await videosOf(courseId, s.moduleId);
      const v = videos.find((v) => v.id === payload.videoId);
      const qs = payload.section === "mid" ? v?.midQuiz : payload.section === "end" ? v?.endQuiz : undefined;
      const index = Number(payload.question);
      const q = Number.isInteger(index) && index >= 0 ? qs?.[index] : undefined;
      const response = payload.response;
      const selections = Array.isArray(response) ? response : [response];
      if (!q || (q.selectionType === 'multiple') !== Array.isArray(response) || new Set(selections).size !== selections.length || selections.some(value => !Number.isInteger(value) || Number(value) < 0 || Number(value) >= q.options.length))
        throw new ApiError(400, "invalid_answer", "Unknown video question or option.");
      payload.correct = exactChoices(selections as number[], correctChoiceIndices(q));
      payload.verified = true;
      s.lesson = v!.lesson;
    } else if (s.kind === "module_check" && s.moduleId && payload.responses) {
      const { mod } = await videosOf(courseId, s.moduleId);
      const gate = getBlock(mod, "gate");
      if (!gate || !payload.responses || typeof payload.responses !== "object" || Array.isArray(payload.responses))
        throw new ApiError(400, "invalid_answer", "Invalid module answers.");
      const responses = payload.responses as Record<string, string | string[]>;
      if (Object.values(responses).some((v) => typeof v !== "string" && !(Array.isArray(v) && v.every((x) => typeof x === "string"))))
        throw new ApiError(400, "invalid_answer", "Invalid module answer values.");
      const r = gate.authoredAssessment
        ? await gradeAuthoredAssessment(courseId, { revisionId: gate.authoredAssessment.revisionId, moduleId: gate.authoredAssessment.moduleId, responses })
        : await gradeGate(`gate-${s.moduleId}`, gate, responses);
      Object.assign(payload, { ...r, verified: true });
      payload.missedLessons = mod.metadata.objectives.filter((o) => r.failedObjectives.includes(o.id)).map((o) => o.lesson);
    } else if (s.kind === "scenario_answer" && s.moduleId && typeof payload.response === "string") {
      const { mod } = await videosOf(courseId, s.moduleId);
      const scenario = getBlock(mod, "lab")?.scenarios.find((v) => v.question.step_id === payload.stepId);
      const option = scenario?.question.options.find((o) => o.id === payload.response);
      if (!option) throw new ApiError(400, "invalid_answer", "Unknown scenario answer.");
      payload.correct = !!option.correct; payload.verified = true; s.lesson = scenario!.lesson;
    } else if (s.kind === "recall_answer" && s.moduleId && typeof payload.response === "string") {
      const { mod } = await videosOf(courseId, s.moduleId);
      const question = getBlock(mod, "review")?.variants.find((v) => v.id === payload.variantId);
      const option = question?.options.find((o) => o.id === payload.response);
      if (!option) throw new ApiError(400, "invalid_answer", "Unknown recall answer.");
      payload.correct = !!option.correct; payload.verified = true;
    } else if (s.kind === "slide_activity") {
      if (!s.moduleId || !Number.isFinite(payload.activeMs) || Number(payload.activeMs) < 0 || Number(payload.activeMs) > 60_000 ||
          !Number.isInteger(payload.replays) || Number(payload.replays) < 0 || Number(payload.replays) > 100)
        throw new ApiError(400, "invalid_activity", "Invalid playback activity.");
    }
    result.push({ ...s, payload });
  }
  return result;
}

/** All historical evidence is considered, including signals already consumed by the planner. */
export async function summarize(enrollmentId: string, moduleId: string) {
  const d = await db();
  const rows = await d.select().from(signals).where(and(eq(signals.enrollmentId, enrollmentId), eq(signals.moduleId, moduleId))).orderBy(asc(signals.createdAt), asc(signals.id));
  const fingerprint = hash(rows.map((s) => s.id));
  return d.transaction(async (tx) => {
    const last = (await tx.select().from(moduleEvidence).where(and(eq(moduleEvidence.enrollmentId, enrollmentId), eq(moduleEvidence.moduleId, moduleId))).orderBy(desc(moduleEvidence.version)).limit(1))[0];
    if (last?.fingerprint === fingerprint) return last;
    const concepts: Record<string, { attempts: number; correct: number; misses: number }> = {};
    let activeMs = 0, replays = 0, requests = 0;
    const weak = new Set<string>();
    for (const s of rows) {
      if (s.payload.verified && ["video_check", "scenario_answer", "recall_answer"].includes(s.kind) && s.lesson) {
        const c = concepts[s.lesson] ??= { attempts: 0, correct: 0, misses: 0 };
        c.attempts++; c.correct += s.payload.correct === true ? 1 : 0; c.misses += s.payload.correct === false ? 1 : 0;
        if (c.misses >= 2) weak.add(s.lesson);
      }
      if (s.payload.verified && s.kind === "module_check" && s.payload.passed === false)
        for (const l of (s.payload.missedLessons ?? []) as string[]) weak.add(l);
      if (s.kind === "support_request") requests++;
      if (s.kind === "slide_activity") { activeMs += Number(s.payload.activeMs) || 0; replays += Number(s.payload.replays) || 0; }
    }
    const summary = { concepts, weakLessons: [...weak].sort(), activeMs, replays, supportRequests: requests, insufficientEvidence: !Object.keys(concepts).length && !rows.some((s) => s.kind === "module_check" && s.payload.verified) };
    const [row] = await tx.insert(moduleEvidence).values({ enrollmentId, moduleId, version: (last?.version ?? 0) + 1, fingerprint, summary }).returning();
    return row!;
  });
}

/** Authored prerequisite links: fundamentals from m1 underpin the agent loop in m2. */
export const PREREQUISITES: Record<string, string[]> = { m2: ["1.1", "1.2", "1.3", "1.4", "1.5"] };

async function contextOf(user: SessionUser, courseId: string, moduleId: string) {
  const e = await requireEnrollment(user, courseId);
  const profile = await repo.getProfile(user.id);
  e.answers = normalizeAnswers(learnerAnswers(profile?.answers, e.answers), profile?.derived);
  const course = await getCourse(courseId);
  const index = course?.modules.findIndex((m) => m.module_id === moduleId) ?? -1;
  const evidence = [];
  for (const m of course?.modules.slice(0, Math.max(0, index)) ?? []) evidence.push(await summarize(e.id, m.module_id));
  const plan = (await repo.plansFor(e.id)).find((p) => p.status === "ready");
  const weak = evidence.flatMap((r) => (r.summary.weakLessons ?? []) as string[]).filter((l) => (PREREQUISITES[moduleId] ?? []).includes(l));
  // Lesson IDs alone cannot tell an editor what to reteach. Supply authored
  // definitions, without assessment keys, so reminders stay grounded.
  const prerequisiteTeaching = [];
  for (const m of course?.modules.slice(0, Math.max(0, index)) ?? []) {
    const prior = await getModule(courseId, m.module_id);
    for (const v of prior ? getBlock(prior, "explainer")?.videos ?? [] : []) {
      if (weak.includes(v.lesson)) prerequisiteTeaching.push({ lessonId: v.lesson, title: v.title, keyIdeas: v.notes });
    }
  }
  return { e, context: { profile: profile?.answers, derived: profile?.derived, answers: e.answers, precheck: e.precheck?.lessons, supportOverride: e.supportOverride, plan: plan?.plan, planVersion: plan?.version ?? 0, courseVersion: course?.version, voice: voiceSettings(), evidence: evidence.map((r) => ({ moduleId: r.moduleId, version: r.version, summary: r.summary })), prerequisiteReminders: weak, prerequisiteTeaching, promptVersion: ADAPTIVE_PROMPT_VERSION, world: "Harbour Works is the fictional organisation; adapt its activities to the learner's field. Retain the agent name Scout." } };
}

export async function queueSlide(user: SessionUser, courseId: string, moduleId: string, videoId: string, slide: number, trigger: Trigger, requestId?: string, baseRevision?: string) {
  if (!liveEnabled(courseId)) throw new ApiError(409, "disabled", "Live adaptation is disabled.");
  const { videos } = await videosOf(courseId, moduleId);
  const video = videos.find((v) => v.id === videoId);
  const authored = video?.slides[slide];
  if (!authored) throw new ApiError(400, "unknown_slide", "Slide not found.");
  const { e, context } = await contextOf(user, courseId, moduleId);
  const d = await db();
  let source = authored;
  if (baseRevision) {
    const base = (await d.select().from(adaptationJobs).where(and(eq(adaptationJobs.id, baseRevision), eq(adaptationJobs.enrollmentId, e.id), eq(adaptationJobs.moduleId, moduleId), eq(adaptationJobs.videoId, videoId), eq(adaptationJobs.slide, slide), eq(adaptationJobs.status, "ready"))).limit(1))[0];
    if (!base?.content) throw new ApiError(409, "invalid_revision", "The slide revision is no longer available.");
    source = base.content as VideoSlide;
  }
  const fingerprint = trigger === "initial"
    ? hash({ enrollment: e.id, moduleId, videoId, slide, authored, context: teachingContext(context), trigger })
    : hash({ enrollment: e.id, requestId });
  const inserted = await d.insert(adaptationJobs).values({ enrollmentId: e.id, moduleId, videoId, slide, fingerprint, trigger, priority: trigger === "initial" ? 0 : 10, input: { authored, source, context, lesson: video!.lesson, trigger, baseRevision, requestId } }).onConflictDoNothing().returning();
  if (inserted.length && trigger === "initial") {
    await d.update(adaptationJobs).set({ status: "superseded", updatedAt: new Date() }).where(and(eq(adaptationJobs.enrollmentId, e.id), eq(adaptationJobs.moduleId, moduleId), eq(adaptationJobs.videoId, videoId), eq(adaptationJobs.slide, slide), eq(adaptationJobs.trigger, "initial"), or(eq(adaptationJobs.status, "queued"), eq(adaptationJobs.status, "running")), ne(adaptationJobs.fingerprint, fingerprint), lt(adaptationJobs.createdAt, inserted[0]!.createdAt)));
  }
  // The open slide should not wait behind an entire older module. It remains
  // background work so explicit learner requests retain their reserved lane.
  if (trigger === "initial" && requestId) await d.update(adaptationJobs).set({ priority: 2 }).where(and(eq(adaptationJobs.fingerprint, fingerprint), eq(adaptationJobs.status, "queued")));
  return (await d.select().from(adaptationJobs).where(eq(adaptationJobs.fingerprint, fingerprint)))[0]!;
}

export async function queueModule(user: SessionUser, courseId: string, moduleId: string, openPiece?: "hook" | "worked") {
  const { videos, mod } = await videosOf(courseId, moduleId);
  const { e, context } = await contextOf(user, courseId, moduleId);
  const d = await db();
  const queuePiece = async (piece: "hook" | "worked") => {
    const def = piecesOf(mod).find((p) => p.piece === piece);
    if (!def) return null;
    const textMapVersion = piece === "hook" ? 7 : undefined;
    const fingerprint = hash({ enrollment: e.id, moduleId, piece, textMapVersion, authored: def.authored, context: teachingContext(context) });
    const inserted = await d.insert(adaptationJobs).values({ enrollmentId: e.id, moduleId, videoId: piece, slide: 0, fingerprint, trigger: "initial", priority: piece === "hook" ? 1 : 0, input: { authored: def.authored, source: def.authored, context, trigger: "initial", piece, courseId, textMapVersion } }).onConflictDoNothing().returning();
    if (inserted.length) await d.update(adaptationJobs).set({ status: "superseded", updatedAt: new Date() }).where(and(eq(adaptationJobs.enrollmentId, e.id), eq(adaptationJobs.moduleId, moduleId), eq(adaptationJobs.videoId, piece), or(eq(adaptationJobs.status, "queued"), eq(adaptationJobs.status, "running")), ne(adaptationJobs.fingerprint, fingerprint), lt(adaptationJobs.createdAt, inserted[0]!.createdAt)));
    if (openPiece === piece) await d.update(adaptationJobs).set({ priority: 3 }).where(and(eq(adaptationJobs.fingerprint, fingerprint), eq(adaptationJobs.status, "queued")));
    return (await d.select().from(adaptationJobs).where(eq(adaptationJobs.fingerprint, fingerprint)))[0] ?? null;
  };
  const hook = await queuePiece("hook");
  // The DB preserves playback order for equal priorities. No model runs in this request.
  for (const v of videos) for (let i = 0; i < v.slides.length; i++) await queueSlide(user, courseId, moduleId, v.id, i, "initial");
  const worked = await queuePiece("worked");
  return { hook, worked };
}

export async function jobsFor(enrollmentId: string, moduleId: string) {
  return (await db()).select().from(adaptationJobs).where(and(eq(adaptationJobs.enrollmentId, enrollmentId), eq(adaptationJobs.moduleId, moduleId))).orderBy(asc(adaptationJobs.createdAt), asc(adaptationJobs.id));
}
export const publicJob = (r: Job) => ({ id: r.id, requestId: r.input.requestId, videoId: r.videoId, slide: r.slide, status: r.status, trigger: r.trigger, content: r.status === "ready" ? r.content : null, audio: r.status === "ready" ? r.audio : null, updatedAt: r.updatedAt.toISOString() });

export async function claimJob(lane: "all" | "interactive" | "background" = "all") {
  const d = await db();
  const now = new Date();
  // Compare-and-set makes claims safe across worker processes and both DB drivers.
  const candidates = await d.select().from(adaptationJobs).where(and(or(eq(adaptationJobs.status, "queued"), and(eq(adaptationJobs.status, "running"), lt(adaptationJobs.leaseUntil, now))), lane === "all" ? undefined : lane === "interactive" ? eq(adaptationJobs.priority, 10) : lt(adaptationJobs.priority, 10))).orderBy(desc(adaptationJobs.priority), asc(adaptationJobs.createdAt)).limit(10);
  for (const r of candidates) {
    const predicate = and(eq(adaptationJobs.id, r.id), eq(adaptationJobs.attempts, r.attempts), or(eq(adaptationJobs.status, "queued"), and(eq(adaptationJobs.status, "running"), lt(adaptationJobs.leaseUntil, now))));
    // A prompt deployment must never generate old snapshots with new instructions.
    if ((r.input.context as { promptVersion?: number } | undefined)?.promptVersion !== ADAPTIVE_PROMPT_VERSION) {
      await d.update(adaptationJobs).set({ status: "superseded", updatedAt: now }).where(predicate);
      continue;
    }
    const [claimed] = await d.update(adaptationJobs).set({ status: r.attempts >= 3 ? "failed" : "running", attempts: r.attempts + 1, lease: randomUUID(), leaseUntil: new Date(Date.now() + 60_000), updatedAt: now }).where(predicate).returning();
    if (claimed?.status === "running") return claimed;
  }
  return null;
}

export async function leasedJob(id: string, lease: string) {
  const d = await db();
  const r = (await d.select().from(adaptationJobs).where(and(eq(adaptationJobs.id, id), eq(adaptationJobs.lease, lease), eq(adaptationJobs.status, "running"))).limit(1))[0];
  if (!r || !r.leaseUntil || r.leaseUntil.getTime() <= Date.now()) throw new ApiError(409, "lease_expired", "Job lease expired.");
  return r;
}

export async function heartbeat(id: string, lease: string) {
  await leasedJob(id, lease);
  await (await db()).update(adaptationJobs).set({ leaseUntil: new Date(Date.now() + 60_000) }).where(and(eq(adaptationJobs.id, id), eq(adaptationJobs.lease, lease), eq(adaptationJobs.status, "running")));
}

export async function finishJob(id: string, lease: string, generated: unknown, model: string, metrics: Record<string, number>, voice: Voicer | null = defaultVoicer()) {
  const row = await leasedJob(id, lease);
  if (row.input.piece) {
    const { mod } = await videosOf(String(row.input.courseId), row.moduleId);
    const def = piecesOf(mod).find((p) => p.piece === row.input.piece);
    if (!def) throw new ApiError(422, "invalid_content", "Unknown lesson piece.");
    const merged = mergeShape(def.authored, generated, row.input.piece === "hook" ? { banned: /\b(?:Orbit|ORB-\d+)\b/i } : {});
    if (merged.problems.length) throw new ApiError(422, "invalid_content", "Lesson structure changed.");
    const content = merged.value as Record<string, unknown>;
    const clips = def.clips(content).filter((c) => c.text.trim());
    const keys = clips.map((c) => ({ original: c.key, key: clipKey(c.text), text: c.text }));
    const dir = path.join(audioRoot(), row.enrollmentId, row.moduleId, "clips");
    const started = Date.now();
    const cached = new Set(keys.filter((c) => fs.existsSync(path.join(dir, `${c.key}.wav`))).map((c) => c.key));
    const done = voice ? new Set([...cached, ...await voice(dir, keys.filter((c) => !cached.has(c.key)))]) : cached;
    if (keys.some((c) => !done.has(c.key))) throw new ApiError(503, "voice_unavailable", "Matching narration could not be prepared.");
    const audio = Object.fromEntries(keys.map((c) => [c.original, `/api/v1/adapted-audio/${row.enrollmentId}/${row.moduleId}/clips/${c.key}.wav`]));
    await leasedJob(id, lease);
    await (await db()).update(adaptationJobs).set({ status: "ready", content: { ...content, ...(clips.length ? { audio } : {}) }, model, metrics: { ...metrics, speechMs: Date.now() - started, totalMs: Date.now() - row.createdAt.getTime() }, updatedAt: new Date() }).where(and(eq(adaptationJobs.id, id), eq(adaptationJobs.lease, lease), eq(adaptationJobs.status, "running")));
    return;
  }
  const authored = row.input.authored as VideoSlide;
  const merged = mergeShape(authored, generated);
  if (merged.problems.length) throw new ApiError(422, "invalid_content", "Generated slide did not preserve its teaching structure.");
  const content = merged.value;
  if (content.sentences.some((s) => s.length > 1600)) throw new ApiError(422, "invalid_content", "Generated narration is too long.");
  const narrationHash = clipKey(content.narration);
  const dir = path.join(audioRoot(), row.enrollmentId, row.moduleId, "clips");
  const started = Date.now();
  const clips = fs.existsSync(path.join(dir, `${narrationHash}.wav`)) ? new Set([narrationHash]) : voice ? await voice(dir, [{ key: narrationHash, text: content.narration }]) : new Set<string>();
  if (!clips.has(narrationHash)) throw new ApiError(503, "voice_unavailable", "Matching narration could not be prepared.");
  await leasedJob(id, lease);
  await (await db()).update(adaptationJobs).set({ status: "ready", content: content as unknown as Record<string, unknown>, audio: `/api/v1/adapted-audio/${row.enrollmentId}/${row.moduleId}/clips/${narrationHash}.wav`, model, metrics: { ...metrics, speechMs: Date.now() - started, totalMs: Date.now() - row.createdAt.getTime() }, updatedAt: new Date() }).where(and(eq(adaptationJobs.id, id), eq(adaptationJobs.lease, lease), eq(adaptationJobs.status, "running")));
}

export async function failJob(id: string, lease: string) {
  const r = await leasedJob(id, lease);
  await (await db()).update(adaptationJobs).set({ status: r.attempts < 3 ? "queued" : "failed", error: "Generation could not complete. The original lesson remains available.", updatedAt: new Date() }).where(and(eq(adaptationJobs.id, id), eq(adaptationJobs.lease, lease), eq(adaptationJobs.status, "running")));
}
