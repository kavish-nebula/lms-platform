"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BookOpen, ListChecks, PencilRuler } from "lucide-react";
import type { LessonPart } from "@/lib/setup";

const PART: Record<LessonPart, { icon: typeof BookOpen; tone: string }> = {
  idea: { icon: BookOpen, tone: "text-stage-explainer border-stage-explainer-line bg-stage-explainer-soft" },
  example: { icon: ListChecks, tone: "text-stage-worked border-stage-worked-line bg-stage-worked-soft" },
  try: { icon: PencilRuler, tone: "text-stage-guided border-stage-guided-line bg-stage-guided-soft" },
};

/**
 * Show the approved teaching order separately from the learner's preference.
 * A support preference must not promise to reorder recorded/reviewed teaching.
 */
export function LessonOrderPreview({ order, preference, className }: { order: LessonPart[]; preference?: string | null; className?: string }) {
  const t = useTranslations("enroll");
  const selected = preference === 'try' || preference === 'example' ? preference : 'idea';
  return (
    <div className="space-y-3">
    <p role="status" aria-live="polite" className="rounded-lg border border-brand-line bg-brand-soft p-3 text-sm text-brand-ink">{t(`preference_help_${selected}`)}</p>
    <p className="text-sm text-ink-muted">{t('sequenceNote')}</p>
    <ol className={cn("flex flex-col gap-2", className)} aria-label={t("orderLabel")}>
      {order.map((p, i) => {
        const Icon = PART[p].icon;
        return (
          <motion.li
            key={p}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn("flex items-center gap-3 rounded-lg border bg-panel px-3 py-2.5", selected === p ? 'border-brand-line' : 'border-line')}
          >
            <span className="w-4 font-mono text-xs text-ink-faint tabular-nums">{i + 1}</span>
            <span className={cn("flex size-8 items-center justify-center rounded-md border", PART[p].tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t(`part_${p}`)}</span>
              <span className="block text-xs text-ink-muted">{t(`part_${p}_hint`)}</span>
            </span>
            {selected === p && <span className="ml-auto text-xs font-medium text-brand-ink">{t('preferenceBadge')}</span>}
          </motion.li>
        );
      })}
    </ol>
    </div>
  );
}
