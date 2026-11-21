"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ListOrdered, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/kit/surface";
import { EnrollmentChoice } from "@/components/enroll/enrollment-choice";
import { profileLines, questionById, type SetupAnswers } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import { QUICK_EXPERIENCE, quickEnrollmentAnswers } from "@/lib/quick-enrollment";

type Props = {
  topic?: string;
  answers: SetupAnswers;
  derived?: ProfileDerived | null;
  editProfileHref: string;
  onStart: (answers: SetupAnswers) => void;
  onOptions: (answers: SetupAnswers) => void;
};

const DISCLOSURE = "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-ring";
const TEXTAREA = "min-h-24 w-full rounded-xl border border-line bg-panel p-3 focus-visible:ring-2 focus-visible:ring-ring";

export function QuickEnrollment({ topic, answers, derived, editProfileHref, onStart, onOptions }: Props) {
  const savedGoal = answers.courseInterview?.find(turn => turn.slot === "goal")?.a ?? "";
  const savedExperience = answers.courseInterview?.find(turn => turn.slot === "experience")?.a ?? "";
  const [goal, setGoal] = React.useState(answers.goal ?? (savedGoal ? "custom" : ""));
  const [ownGoal, setOwnGoal] = React.useState(answers.goal ? "" : savedGoal);
  const [experience, setExperience] = React.useState(answers.experience === "regularly" ? "sometimes" : answers.experience ?? (savedExperience ? "custom" : ""));
  const [ownExperience, setOwnExperience] = React.useState(answers.experience ? "" : savedExperience);
  const [starting, setStarting] = React.useState(false);
  const [preferencesOpen, setPreferencesOpen] = React.useState(Boolean(goal || experience));
  const summary = profileLines(answers, derived).filter(line => ["domain", "role", "studyField", "coding", "style"].includes(line.id) && line.answer);
  const goals = topic ? [] : questionById("goal", answers, derived).options;
  const topicLabel = topic ?? "AI agents";
  const draft = () => quickEnrollmentAnswers(answers, goal, ownGoal, experience, ownExperience, topic);

  function start(skip = false) {
    if (starting) return;
    setStarting(true);
    onStart(skip ? quickEnrollmentAnswers(answers, "", "", "", "") : draft());
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <h1 tabIndex={-1} className="w-fit max-w-full text-3xl font-semibold tracking-tight text-balance md:text-4xl">Start learning</h1>
        <p className="mt-3 max-w-[62ch] leading-relaxed text-ink-muted">
          Your saved profile guides your setup. Add course preferences if you’d like to tell us what you want to learn.
        </p>
      </header>

      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); start(); }}>
        <Surface pad="none">
          <details open={preferencesOpen} onToggle={event => setPreferencesOpen(event.currentTarget.open)} className="group">
            <summary className={DISCLOSURE}>
              <span>Add course preferences <span className="ml-1 text-sm font-normal text-ink-muted">Optional</span></span>
              <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-5 border-t border-line p-4 sm:p-5">
              <fieldset disabled={starting} className="grid min-w-0 gap-3">
                <legend className="mb-2 text-sm font-semibold">What do you want to achieve with this course?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...goals.map(option => ({ value: option.v, label: option.label })), { value: "custom", label: "Write my own answer" }, { value: "", label: "Skip this question" }].map(option => (
                    <EnrollmentChoice key={option.value} name="enrollment-goal" value={option.value} checked={goal === option.value} onChange={() => setGoal(option.value)}>
                      {option.label}
                    </EnrollmentChoice>
                  ))}
                </div>
                {goal === "custom" && (
                  <label className="grid gap-2 text-sm">
                    Your course goal
                    <textarea className={TEXTAREA} name="course-goal" autoComplete="off" maxLength={200} value={ownGoal} onChange={event => setOwnGoal(event.target.value)} placeholder={topic ? "Describe what you want to apply at work…" : "For example, build an assistant for document reviews…"} />
                  </label>
                )}
              </fieldset>

              <fieldset disabled={starting} className="grid min-w-0 gap-3">
                <legend className="mb-2 text-sm font-semibold">How familiar are you with {topicLabel}?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...QUICK_EXPERIENCE.map(option => topic && option.value === "sometimes" ? { ...option, label: "Use it regularly" } : option), { value: "custom", label: "Write my own answer" }, { value: "", label: "Skip this question" }].map(option => (
                    <EnrollmentChoice key={option.value} name="enrollment-experience" value={option.value} checked={experience === option.value} onChange={() => setExperience(option.value)}>
                      {option.label}
                    </EnrollmentChoice>
                  ))}
                </div>
                {experience === "custom" && (
                  <label className="grid gap-2 text-sm">
                    Your experience with {topicLabel}
                    <textarea className={TEXTAREA} name="course-experience" autoComplete="off" maxLength={200} value={ownExperience} onChange={event => setOwnExperience(event.target.value)} placeholder="Describe your experience in your own words…" />
                  </label>
                )}
              </fieldset>
              <p className="text-sm text-ink-muted">These answers apply only to this course.</p>
            </div>
          </details>
        </Surface>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" variant="brand" disabled={starting}>
            {starting ? "Starting…" : "Start learning"}
            {starting ? <Loader2 className="motion-safe:animate-spin" aria-hidden data-icon="inline-end" /> : <ArrowRight aria-hidden data-icon="inline-end" />}
          </Button>
          {(goal || experience) && (
            <Button type="button" variant="ghost" disabled={starting} onClick={() => start(true)}>
              Start without course answers
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={starting} onClick={() => onOptions(draft())}>
            <ListOrdered aria-hidden data-icon="inline-start" /> Preview lesson flow
          </Button>
        </div>
      </form>

      <details className="group min-w-0 rounded-xl border border-line">
        <summary className={DISCLOSURE}>
          <span className="text-sm">View saved profile</span>
          <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-line p-4 text-sm">
          {summary.length ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {summary.map(line => (
                <div key={line.id} className="min-w-0 wrap-break-word">
                  <dt className="text-ink-muted">{line.label}</dt>
                  <dd>{line.answer}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-ink-muted">We’ll use general examples to begin.</p>}
          <p className="max-w-[70ch] leading-relaxed text-ink-muted">
            {topic ? "Your saved preferences guide the course plan. Lessons keep the supplied fictional case and its reviewed narration." : "Your field and learning preferences guide the examples and support. “Read the course” keeps the original concepts and narration."}
          </p>
          <Link href={editProfileHref} className="inline-flex min-h-9 w-fit items-center rounded-md text-brand-ink underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">Edit profile</Link>
        </div>
      </details>
    </div>
  );
}
