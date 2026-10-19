"use client";

import * as React from "react";
import { api, refreshEnrollments } from "@/lib/api";

/**
 * Learning signals: answers from inside lessons (in-video checks, recall
 * questions, the final check, capstone checks) sent to the server, which
 * may revise the learner's plan. Sent in small batches; each signal has its
 * own id, so a resend is harmless. Nothing is sent while only previewing.
 */

export type SignalKind = "video_check" | "recall_answer" | "scenario_answer" | "module_check" | "final_check" | "capstone_check" | "slide_activity" | "support_request";
export type Signal = { kind: SignalKind; moduleId?: string | null; lesson?: string | null; payload: Record<string, unknown> };
type Queued = Signal & { id: string };

const queues = new Map<string, Queued[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const sending = new Map<string, Promise<void>>();
const restored = new Set<string>();
const keyOf = (id: string) => `lms-signal-queue:v1:${id}`;
function persistQueue(courseId: string, list: Queued[]) {
  try { localStorage.setItem(keyOf(courseId), JSON.stringify(list)); } catch { /* memory queue still works */ }
}
function restore(courseId: string) {
  if (restored.has(courseId)) return;
  restored.add(courseId);
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(keyOf(courseId)) ?? "[]");
    if (Array.isArray(saved)) queues.set(courseId, saved.filter((s) => s && typeof s.id === "string" && typeof s.kind === "string" && s.payload && typeof s.payload === "object"));
  } catch { /* a malformed local cache does not block lessons */ }
}

async function flush(courseId: string, keepalive = false) {
  restore(courseId);
  const inFlight = sending.get(courseId);
  if (inFlight) { await inFlight; if (queues.get(courseId)?.length) await flush(courseId, keepalive); return; }
  const batch = (queues.get(courseId) ?? []).slice(0, 50);
  clearTimeout(timers.get(courseId));
  timers.delete(courseId);
  if (!batch.length) return;
  let finish: () => void = () => {};
  sending.set(courseId, new Promise<void>((resolve) => { finish = resolve; }));
  try {
    const res = await api<{ accepted: number; replanning: boolean }>(`/api/v1/enrollments/${courseId}/signals`, {
      method: "POST",
      keepalive,
      body: { signals: batch.map((s) => ({ id: s.id, kind: s.kind, moduleId: s.moduleId ?? null, lesson: s.lesson ?? null, payload: s.payload })) },
    });
    const ids = new Set(batch.map((s) => s.id));
    const left = (queues.get(courseId) ?? []).filter((s) => !ids.has(s.id));
    queues.set(courseId, left); persistQueue(courseId, left);
    // a revision (or a rule change) may have happened: pick up the new plan
    if (res.replanning) await refreshEnrollments();
  } catch {
    // Keep the same IDs for safe retry, including after a page reload.
  } finally {
    sending.delete(courseId);
    finish();
    if (queues.get(courseId)?.length && !keepalive) timers.set(courseId, setTimeout(() => void flush(courseId), 5000));
  }
}

function enqueue(courseId: string, s: Signal) {
  restore(courseId);
  const q = queues.get(courseId) ?? [];
  q.push({ ...s, id: crypto.randomUUID() });
  queues.set(courseId, q);
  persistQueue(courseId, q);
  if (q.length >= 20) return void flush(courseId);
  if (!timers.has(courseId)) timers.set(courseId, setTimeout(() => void flush(courseId), 1500));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const id of queues.keys()) void flush(id, true);
  });
}

const SignalContext = React.createContext<{ courseId: string; enabled: boolean } | null>(null);
export const useSignalScope = () => React.useContext(SignalContext);

/** Wrap a lesson or the finale so the components inside can report answers. */
export function SignalProvider({ courseId, enabled, children }: { courseId: string; enabled: boolean; children: React.ReactNode }) {
  React.useEffect(() => { if (enabled) void flush(courseId); }, [courseId, enabled]);
  const value = React.useMemo(() => ({ courseId, enabled }), [courseId, enabled]);
  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

/** Report an answer from inside a lesson. A no-op outside a provider or while previewing. */
export function useSignal() {
  const ctx = React.useContext(SignalContext);
  return React.useCallback(
    (s: Signal) => {
      if (ctx?.enabled) enqueue(ctx.courseId, s);
    },
    [ctx],
  );
}

/** Queue a signal outside a provider (the capstone sandbox, the finale). The caller checks enrolment. */
export const queueSignal = (courseId: string, s: Signal) => enqueue(courseId, s);

/** Send now (e.g. right before navigating away from the finale). */
export const flushSignals = (courseId: string) => flush(courseId);
