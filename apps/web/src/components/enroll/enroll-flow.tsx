"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/kit/logo";
import { CardSkeleton } from "@/components/kit/states";
import { QuickEnrollment } from "@/components/enroll/quick-enrollment";
import { PrerequisiteCheck } from '@/components/enroll/prerequisite-check';
import { prerequisitesFor, prerequisiteEnrollmentAnswers, type PrerequisiteSelections, type PrerequisiteSuggestion } from '@/lib/course-prerequisites';
import { CustomizeStep, type Pace } from "@/components/enroll/customize-step";
import { BuildStep, type BuildServer } from "@/components/enroll/build-step";
import { useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import { useLearnerReady } from "@/lib/api";
import { useEnrollment } from "@/lib/enrollment";
import { autoFill } from "@/lib/plan";
import { applyComfort, useProfile } from "@/lib/profile";
import { adaptationOf, coursePart, normalizeAnswers, profilePart, type SetupAnswers, type SupportOverride } from "@/lib/setup";
import type { Course } from "@/data/types";

export type EnrollPhase = "prerequisites" | "fit" | "customize" | "build";

/** "About you" lives right after signing in; editing it from here comes back to this step. */
export const welcomeHref = (back: string) => `/learn/welcome?return=${encodeURIComponent(back)}`;

/** New enrollments check configured prerequisites, then ask two optional course questions.
 * The server reuses the canonical saved profile; extra setup is optional.
 * Existing enrollments still open their editable setup and keep their progress. */
export function EnrollFlow({
  course,
  name,
  today,
  authoredModules,
  initialPhase,
  prerequisiteSuggestions = [],
}: {
  course: Course;
  name: string;
  today: string;
  authoredModules: string[];
  initialPhase?: EnrollPhase;
  prerequisiteSuggestions?: PrerequisiteSuggestion[];
}) {
  const prerequisiteTopics = prerequisitesFor(course);
  const first: EnrollPhase = prerequisiteTopics.length ? 'prerequisites' : 'fit';
  const t = useTranslations("enroll");
  const router = useRouter();
  const learnerReady = useLearnerReady();
  const courseHref = `/learn/courses/${course.course_id}`;
  const { profile, ready: profileReady } = useProfile();
  const { enrollment, enrolled, save, adaptation: saved } = useEnrollment(course.course_id);
  const hydrated = learnerReady && profileReady;
  const { plan, setPlan } = usePlanState();
  const { byCourse } = useCourseUnits(React.useMemo(() => [course], [course]));

  const [phase, setPhase] = React.useState<EnrollPhase | null>(null);
  const previousPhase = React.useRef<EnrollPhase | null>(null);
  const mainRef = React.useRef<HTMLElement>(null);
  const [showOptions, setShowOptions] = React.useState(initialPhase === "customize");
  const [previewFromQuickStart, setPreviewFromQuickStart] = React.useState(false);
  const [prerequisiteSelections, setPrerequisiteSelections] = React.useState<PrerequisiteSelections>({});
  // Keep the stepper steady when saving creates the enrollment during Build.
  const PHASES: EnrollPhase[] = enrolled && phase === 'prerequisites' ? ['prerequisites'] : [...(prerequisiteTopics.length && (!enrolled || Object.keys(prerequisiteSelections).length) ? ['prerequisites' as const] : []), ...(showOptions ? ["fit", "customize", "build"] as const : ["fit", "build"] as const)];
  const [answers, setAnswers] = React.useState<SetupAnswers>({});
  const [override, setOverride] = React.useState<SupportOverride>("auto");
  const [pace, setPace] = React.useState<Pace>({ sessionMinutes: 30, studyDays: [1, 3, 5], addToPlan: true });
  const [saving, setSaving] = React.useState<{ state: "idle" | "saving" | "saved" } | { state: "error"; message: string }>({ state: "idle" });
  const [planningSince, setPlanningSince] = React.useState(0);
  // an older enrollment may carry a quick-check result: it is kept, never asked for again
  const precheck = enrollment?.precheck ?? null;
  const needs = profile?.needs ?? [];

  // start from what is saved, once storage has been read
  if (hydrated && phase === null) {
    // the profile as saved now, with this course's own answers from the enrolment
    setAnswers({ ...profilePart(profile?.answers ?? {}), ...coursePart(enrollment?.answers ?? {}) });
    setOverride(enrollment?.supportOverride ?? "auto");
    setPace({ sessionMinutes: plan.sessionMinutes, studyDays: plan.studyDays, addToPlan: !enrolled });
    setShowOptions(initialPhase === "customize" || (!initialPhase && enrolled));
    setPhase(enrolled ? initialPhase ?? 'customize' : prerequisiteTopics.length ? first : initialPhase ?? first);
  }

  React.useEffect(() => {
    if (!phase) return;
    if (previousPhase.current && previousPhase.current !== phase) {
      window.scrollTo({ top: 0 });
      mainRef.current?.querySelector("h1")?.focus({ preventScroll: true });
    }
    previousPhase.current = phase;
  }, [phase]);

  /** Saves enrollment and study preferences without rewriting the saved profile. */
  async function commit(courseAnswers: SetupAnswers = answers) {
    setSaving({ state: "saving" });
    try {
      // answers from a branch the learner left are dropped here as on the server, so both hold the same profile
      await save(normalizeAnswers(courseAnswers, profile?.derived), { supportOverride: override, pace: pace.studyDays.length ? { sessionMinutes: pace.sessionMinutes, studyDays: pace.studyDays } : null });
    } catch (e) {
      setSaving({ state: "error", message: e instanceof Error ? e.message : String(e) });
      return false;
    }
    applyComfort(needs.includes("none") ? [] : needs);
    const prefs = { ...plan, studyDays: pace.studyDays, sessionMinutes: pace.sessionMinutes };
    const remaining = (byCourse.get(course.course_id) ?? []).filter((u) => !u.done);
    const added = pace.addToPlan && pace.studyDays.length ? autoFill(remaining, prefs, today) : [];
    setPlan({ ...prefs, sessions: [...plan.sessions, ...added] });
    setPlanningSince(Date.now());
    setSaving({ state: "saved" });
    return true;
  }

  const server: BuildServer =
    saving.state === "error"
      ? { status: "error", message: saving.message }
      : saving.state !== "saved"
        ? { status: "saving" }
        : enrollment?.pending
          ? { status: "planning", since: planningSince }
          : { status: "ready", source: enrollment?.plan?.source ?? "baseline", failed: enrollment?.lastError ?? null };

  const adaptation = adaptationOf(answers, { precheck, override });
  const editing = enrolled && phase !== "build";

  let body: React.ReactNode = <CardSkeleton lines={6} />;
  if (phase === 'prerequisites')
    body = <PrerequisiteCheck topics={prerequisiteTopics} suggestions={prerequisiteSuggestions} value={prerequisiteSelections} onChange={setPrerequisiteSelections} alreadyEnrolled={enrolled} onContinue={()=>{if(enrolled){router.push(courseHref);return;}setAnswers(current=>prerequisiteEnrollmentAnswers(current,prerequisiteTopics,prerequisiteSelections));setPhase('fit');}} />;
  else if (phase === "fit")
    body = (
      <div className="mx-auto grid max-w-4xl gap-5">
        {!enrolled && prerequisiteTopics.length > 0 && (
          <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setPhase("prerequisites")}>
            <ChevronLeft aria-hidden data-icon="inline-start" />
            Review starting point
          </Button>
        )}
        <QuickEnrollment
          topic={course.authoredRevisionId ? course.subjectLabel ?? "the course topic" : undefined}
          answers={answers}
          derived={profile?.derived}
          editProfileHref={welcomeHref(`${courseHref}/enroll?step=fit`)}
          onStart={next => { setAnswers(next); setPhase("build"); void commit(next); }}
          onOptions={next => { setAnswers(next); setShowOptions(true); setPreviewFromQuickStart(true); setPhase("customize"); }}
        />
      </div>
    );
  else if (phase === "customize")
    body = (
      <CustomizeStep
        order={adaptation.order}
        primaryLabel={enrolled ? t(previewFromQuickStart ? "saveChanges" : "backToCourse") : t("buildCourse")}
        onBack={previewFromQuickStart ? () => { setShowOptions(false); setPreviewFromQuickStart(false); setPhase("fit"); } : undefined}
        onEditProfile={() => router.push(welcomeHref(`${courseHref}/enroll?step=customize`))}
        onSubmit={async () => {
          if (enrolled) {
            if (!previewFromQuickStart) {
              router.push(courseHref);
              return;
            }
            if (await commit()) {
              toast.success(t("toastSaved"));
              router.push(courseHref);
            } else toast.error(t("saveFailed"));
          } else {
            setPhase("build");
            void commit();
          }
        }}
      />
    );
  else if (phase === "build")
    body = (
      <BuildStep
        course={course}
        name={name}
        adaptation={saving.state === "saved" && enrollment ? saved : adaptation}
        pace={pace}
        authoredModules={authoredModules}
        server={server}
        onRetry={() => void commit()}
        onGo={() => {
          toast.success(t("toastEnrolled", { course: course.title }));
          router.push(courseHref);
        }}
      />
    );

  const current = phase ? PHASES.indexOf(phase) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#enrollment-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-panel focus:p-3 focus:ring-2 focus:ring-ring">
        {t("skipToSetup")}
      </a>
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex min-h-(--nav-h) items-center gap-2 py-2 page-pad sm:gap-4">
          <Button asChild variant="ghost" size="icon" aria-label={t("backToCourse")}>
            <Link href={courseHref}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Logo wordmark={false} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <div className="hidden truncate text-xs text-ink-muted md:block">{editing ? t("editingSetup") : t("settingUp")}</div>
            <div className="font-semibold leading-snug">{course.title}</div>
            <div className="mt-1 text-xs text-ink-muted md:hidden" aria-current="step">
              {t("phaseOf", { n: current + 1, total: PHASES.length })} · {t(`phase_${phase ?? first}`)}
            </div>
          </div>
          <ol className="hidden items-center gap-1 md:flex" aria-label={t("progressLabel")}>
            {PHASES.map((p, i) => {
              const done = i < current;
              const on = i === current;
              return (
                <li key={p} className="flex items-center gap-1">
                  {i > 0 ? <span aria-hidden className={cn("h-px w-5", done || on ? "bg-brand" : "bg-line")} /> : null}
                  <span
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium",
                      on ? "bg-brand-soft text-brand-ink" : done ? "text-ink" : "text-ink-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[10px]",
                        done ? "bg-ok text-on-ok" : on ? "bg-brand text-on-brand" : "border border-line",
                      )}
                    >
                      {done ? <Check className="size-2.5" aria-hidden /> : i + 1}
                    </span>
                    {t(`phase_${p}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>
      <main ref={mainRef} id="enrollment-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 scroll-mt-[calc(var(--nav-h)+1rem)] page-pad pt-7 pb-24 lg:pt-10">
        {body}
      </main>
    </div>
  );
}
