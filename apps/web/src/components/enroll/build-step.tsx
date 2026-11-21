"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown, Clock, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/kit/chip";
import { Surface } from "@/components/kit/surface";
import { FinaleArt, ModuleArt } from "@/components/course/module-art";
import { STAGE_META } from "@/lib/stages";
import { moduleTopics } from "@/lib/topics";
import type { Adaptation } from "@/lib/setup";
import type { Course } from "@/data/types";
import type { Pace } from "@/components/enroll/customize-step";

/** After this long, offer to carry on with the standard setup while the plan finishes. */
const SLOW_MS = 60_000;

/** Where the server is with this learner's course. */
export type BuildServer =
  | { status: "saving" }
  | { status: "planning"; since: number }
  | { status: "ready"; source: "ai" | "baseline"; failed: string | null }
  | { status: "error"; message: string };

/**
 * Show the server's enrollment and planning states, with a way to continue
 * using the standard setup when personalisation takes longer.
 */
export function BuildStep({
  course,
  name,
  adaptation,
  pace,
  authoredModules,
  server,
  onRetry,
  onGo,
}: {
  course: Course;
  name: string;
  adaptation: Adaptation;
  pace: Pace;
  authoredModules: string[];
  server: BuildServer;
  onRetry: () => void;
  onGo: () => void;
}) {
  const t = useTranslations("enroll");
  const tc = useTranslations("common");
  const [gaveUp, setGaveUp] = React.useState(false);
  const [slow, setSlow] = React.useState(false);

  const planningSince = server.status === "planning" ? server.since : null;
  React.useEffect(() => {
    if (planningSince === null) return;
    const id = setTimeout(() => setSlow(true), Math.max(0, planningSince + SLOW_MS - Date.now()));
    return () => clearTimeout(id);
  }, [planningSince]);

  const waiting = server.status === "saving" || (server.status === "planning" && !gaveUp);
  const ready = !waiting && server.status !== "error";
  const plan = adaptation.plan;
  const aiPlanned = adaptation.planSource === "ai";

  const who = adaptation.roleLabel && adaptation.domain
    ? t("readyForBoth", { role: adaptation.roleLabel, field: adaptation.domain.label })
    : adaptation.roleLabel
      ? t("readyForRole", { role: adaptation.roleLabel })
      : adaptation.domain
        ? t("readyForField", { field: adaptation.domain.label })
        : t("readyForYou");

  const sourceNote =
    server.status === "planning"
      ? t("planLater")
      : server.status === "ready" && server.source === "baseline" && server.failed
        ? t("standardSetupFailed", { reason: server.failed })
        : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div aria-live="polite" aria-atomic="true">
        <h1 tabIndex={-1} className="w-fit max-w-full text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {ready ? t("readyTitle", { name }) : server.status === "error" ? t("saveFailed") : server.status === "saving" ? t("savingEnrollment") : t("planningTitle")}
        </h1>
      </div>

      {server.status === "error" ? (
        <Surface className="flex flex-col gap-3 border-err-line">
          <p className="flex items-start gap-2 text-sm text-err" role="alert">
            <TriangleAlert className="size-5 shrink-0" aria-hidden />
            {server.message}
          </p>
          <Button type="button" variant="outline" className="w-fit" onClick={onRetry}>
            <RotateCcw aria-hidden data-icon="inline-start" />
            {t("retry")}
          </Button>
        </Surface>
      ) : waiting ? (
        <Surface className="flex flex-col gap-3 border-brand-line">
          <p className="flex items-start gap-2 text-sm leading-relaxed" role="status">
            <Loader2 className="size-5 shrink-0 text-brand-ink motion-safe:animate-spin" aria-hidden />
            {server.status === "saving" ? t("savingEnrollmentBody") : t("planningBody")}
          </p>
          {slow && server.status === "planning" && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {t("planningSlow")}
              <Button type="button" variant="outline" size="sm" onClick={() => setGaveUp(true)}>
                {t("continueStandard")}
              </Button>
            </div>
          )}
        </Surface>
      ) : (
        <Surface pad="lg" className="flex flex-col gap-3 border-brand-line">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="size-5 text-brand-ink" aria-hidden />
              {who}
            </p>
            <Chip size="sm" tone={aiPlanned ? "accent" : "neutral"}>
              {aiPlanned ? t("plannedByAi") : t("standardSetup")}
            </Chip>
          </div>
          {aiPlanned && plan?.summary ? <p className="leading-relaxed">{plan.summary}</p> : null}
          <ul className="grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
              {t(`readyOrder_${adaptation.order[0]}`)}
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
              {t(`readySupport_${adaptation.supportSource}`, { level: t(`support_${adaptation.support}`) })}
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
              {adaptation.analogyOpen ? t("sumAnalogyOpen") : t("sumAnalogyClosed")}
            </li>
            {plan ? (
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                {plan.pacing.note}
              </li>
            ) : pace.studyDays.length ? (
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                {t("sumPace", { minutes: pace.sessionMinutes, days: pace.studyDays.length })}
              </li>
            ) : null}
          </ul>
          {sourceNote ? <p className="text-sm text-ink-muted">{sourceNote}</p> : null}
          <Button size="xl" variant="brand" className="mt-2 w-fit" onClick={onGo}>
            {t("goToCourse")}
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
        </Surface>
      )}

      <details className="group rounded-xl border border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-ring">
          {t("courseOutline")}
          <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="flex flex-col gap-3 border-t border-line p-3">
          {course.modules.map((m, i) => {
            const topics = moduleTopics(m);
            const done = m.authored ?? (authoredModules.includes(m.module_id) ? m.stages : []);
            const authored = m.stages.every((s) => done.includes(s));
            const partly = !authored && done.length > 0;
            const emphasis = plan?.modules.find((x) => x.moduleId === m.module_id)?.emphasis;
            return (
              <li
                key={m.module_id}
                className={cn("relative flex items-center gap-4 rounded-card border bg-panel p-3", authored || partly ? "border-line" : "border-dashed border-line")}
              >
                <ModuleArt index={i + 1} size="sm" className="h-14 w-[4.5rem] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    {t("moduleShort", { n: i + 1 })}
                    {ready && emphasis && emphasis !== "standard" ? <span className="font-medium text-brand-ink">{t(`emphasis_${emphasis}`)}</span> : null}
                  </div>
                  <div className="font-semibold wrap-break-word">{m.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {topics.map(tp => (
                      <span key={tp.stage} title={tp.title} aria-hidden className={cn("size-2.5 rounded-full", STAGE_META[tp.stage].solid)} />
                    ))}
                    <span className="ml-1 text-xs text-ink-faint">{t("topicsN", { count: topics.length })}</span>
                  </div>
                </div>
                <span className="hidden shrink-0 text-right text-xs sm:block">
                  <span className="flex items-center justify-end gap-1 text-ink-faint">
                    <Clock className="size-3" aria-hidden />
                    {tc("minutes", { count: m.minutes })}
                  </span>
                  <span className={cn("mt-0.5 block font-medium", authored || partly ? "text-ok" : "text-ink-faint")}>
                    {authored ? t("moduleReady") : partly ? t("moduleVideosReady") : t("moduleComingSoon")}
                  </span>
                </span>
              </li>
            );
          })}
          <li className="flex items-center gap-4 rounded-card border border-line bg-panel p-3">
            <FinaleArt steps={course.finale.steps} className="h-14 w-[4.5rem] shrink-0 [&>span]:size-7 [&>span>svg]:size-3.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-ink-faint">{course.finale.title}</div>
              <div className="font-semibold wrap-break-word">{course.finale.steps.map((s) => s.kicker).join(" · ")}</div>
            </div>
          </li>
        </ol>
      </details>
    </div>
  );
}
