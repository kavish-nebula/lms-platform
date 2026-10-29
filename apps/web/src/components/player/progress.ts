"use client";

import * as React from "react";
import { api, refreshEnrollments, storeEnrollment, useLearnerData } from "@/lib/api";
import { useLocalJson, useLocalString, writeLocal } from "@/lib/local-store";
import type { EnrollmentView } from "@/lib/learner-plan";
import type { StageId } from "@/lib/stages";
import { flushSignals } from "@/lib/signals";
import { previewKey } from '@/lib/preview-progress';

/**
 * Topics done in one module, by stable step ID (agents.md hard rule 1).
 * Enrolled learners' progress lives on the server (finishing a module tells
 * the planner); a preview before enrolling stays in this browser and moves
 * to the server on enrolment.
 */

export function useModuleProgress(courseId: string, moduleId: string, initialDone: StageId[]) {
  const { enrollments } = useLearnerData();
  const enrollment = enrollments[courseId];
  const local = useLocalJson<StageId[]>(previewKey(courseId, moduleId), initialDone);
  const serverDone = enrollment?.progress[moduleId];
  const done = React.useMemo(() => (enrollment ? ((serverDone ?? []) as StageId[]) : local), [enrollment, serverDone, local]);

  const complete = React.useCallback(
    async (stage: StageId) => {
      if (done.includes(stage)) return;
      if (!enrollment) {
        writeLocal(previewKey(courseId, moduleId), JSON.stringify([...done, stage]));
        return;
      }
      await storeEnrollment({ ...enrollment, progress: { ...enrollment.progress, [moduleId]: [...done, stage] } });
      await flushSignals(courseId);
      const res = await api<{ enrollment: EnrollmentView }>(`/api/v1/enrollments/${courseId}/progress`, { method: "POST", body: { moduleId, stage } }).catch(() => null);
      if (res) await storeEnrollment(res.enrollment);
      else await refreshEnrollments();
    },
    [courseId, done, enrollment, moduleId],
  );

  return { done, complete };
}

/** Draft text for reflection answers; a per-viewer convenience only. */
export function useDraft(id: string, initial = "") {
  const k = `lms-draft:${id}`;
  const stored = useLocalString(k);
  const update = React.useCallback((v: string) => writeLocal(k, v), [k]);
  return [stored ?? initial, update] as const;
}
