"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/kit/surface";
import { EnrollmentChoice } from "@/components/enroll/enrollment-choice";
import {
  PREREQUISITE_TOPICS,
  prerequisiteSelectionComplete,
  reviewPrerequisites,
  type PrerequisiteTopic,
  type PrerequisiteSelections,
  type PrerequisiteSuggestion,
} from "@/lib/course-prerequisites";

const FAMILIARITY_OPTIONS = [
  { value: "familiar", label: "Yes, I know the basics" },
  { value: "new", label: "No, I need an introduction" },
  { value: "unsure", label: "I’m not sure yet" },
] as const;

export function PrerequisiteCheck({ topics, suggestions, value, onChange, onContinue, alreadyEnrolled = false }: {
  topics: PrerequisiteTopic[];
  suggestions: PrerequisiteSuggestion[];
  value: PrerequisiteSelections;
  onChange: (value: PrerequisiteSelections) => void;
  onContinue: () => void;
  alreadyEnrolled?: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const completed = topics.filter(topic => prerequisiteSelectionComplete([topic], value)).length;
  const complete = completed === topics.length;
  const results = reviewPrerequisites(topics, value);
  const needed = results.filter(result => result.needsIntroduction).map(result => result.topic);
  const relevant = suggestions.filter(suggestion => suggestion.topics.some(topic => needed.includes(topic)));

  function update(topic: PrerequisiteTopic, change: Partial<NonNullable<PrerequisiteSelections[PrerequisiteTopic]>>) {
    onChange({ ...value, [topic]: { ...value[topic], ...change } });
  }

  function showReview(next: boolean) {
    setReviewed(next);
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 sm:gap-8">
      <header>
        <h1 ref={heading} tabIndex={-1} className="w-fit max-w-full scroll-mt-[calc(var(--nav-h)+1rem)] text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {reviewed ? "Your starting point" : "Find your starting point"}
        </h1>
        <p className="mt-3 max-w-[62ch] leading-relaxed text-ink-muted">
          {reviewed
            ? needed.length ? "These short introductions can help you feel more prepared. You can also continue now." : "You have a useful starting point. You’re ready to continue."
            : "Tell us which ideas you already know. If you know a topic, you’ll get one short concept question. This check is ungraded."}
        </p>
        {alreadyEnrolled && <p className="mt-3 text-sm text-ink-muted">This review is for your reference. Your enrollment and progress stay the same.</p>}
      </header>

      {reviewed ? (
        <>
          <Surface as="section" aria-labelledby="prerequisite-result" className="grid gap-4">
            <h2 id="prerequisite-result" className="text-lg font-semibold">Topic guidance</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map(result => (
                <li key={result.topic} className="rounded-xl border border-line px-4 py-3">
                  <h3 className="font-medium">{PREREQUISITE_TOPICS[result.topic].title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {result.needsIntroduction ? "Introduction recommended" : "Concept check supported"}
                  </p>
                  {result.observed !== "not-taken" && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{PREREQUISITE_TOPICS[result.topic].explanation}</p>}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button type="button" variant="brand" onClick={onContinue}>
                {alreadyEnrolled ? "Back to course" : "Continue to course setup"}
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Button>
              <Button type="button" variant="ghost" onClick={() => showReview(false)}>Edit answers</Button>
            </div>
          </Surface>

          {needed.length > 0 && (
            <section className="grid gap-3" aria-labelledby="prerequisite-introductions">
              <h2 id="prerequisite-introductions" className="font-semibold">Optional introductions</h2>
              {needed.map(topic => (
                <details key={topic} className="group rounded-xl border border-line bg-panel">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-ring">
                    {PREREQUISITE_TOPICS[topic].title}
                    <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="max-w-[70ch] px-4 pb-4 text-sm leading-relaxed text-ink-muted">{PREREQUISITE_TOPICS[topic].introduction}</p>
                </details>
              ))}
              {relevant.map(suggestion => (
                <Link key={suggestion.href} href={suggestion.href} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-ink underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">
                  <BookOpen className="size-4 shrink-0" aria-hidden />
                  <span>{suggestion.moduleTitle ? `Read ${suggestion.moduleTitle} in ${suggestion.title}` : `View ${suggestion.title}`}</span>
                </Link>
              ))}
            </section>
          )}
        </>
      ) : (
        <form className="grid gap-5" onSubmit={event => {
          event.preventDefault();
          if (complete) showReview(true);
        }}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {topics.map(topic => {
              const item = PREREQUISITE_TOPICS[topic];
              const selection = value[topic];
              return (
                <Surface key={topic} as="section" aria-labelledby={`prerequisite-${topic}-title`} className="grid min-w-0 gap-4">
                  <div>
                    <h2 id={`prerequisite-${topic}-title`} className="text-lg font-semibold leading-snug">{item.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.why}</p>
                  </div>
                  <fieldset className="grid min-w-0 gap-2">
                    <legend className="mb-2 text-sm font-medium"><span className="sr-only">{item.title}. </span>How familiar are you with this topic?</legend>
                    {FAMILIARITY_OPTIONS.map(option => (
                      <EnrollmentChoice
                        key={option.value}
                        name={`prerequisite-${topic}`}
                        value={option.value}
                        checked={selection?.familiarity === option.value}
                        onChange={() => update(topic, { familiarity: option.value, response: undefined })}
                      >{option.label}</EnrollmentChoice>
                    ))}
                  </fieldset>
                  {selection?.familiarity === "familiar" && (
                    <fieldset className="grid min-w-0 gap-2">
                      <legend className="mb-2 pt-2 text-sm font-medium">{item.question}</legend>
                      {item.choices.map(option => (
                        <EnrollmentChoice
                          key={option.id}
                          name={`prerequisite-check-${topic}`}
                          value={option.id}
                          checked={selection.response === option.id}
                          onChange={() => update(topic, { response: option.id })}
                        >{option.text}</EnrollmentChoice>
                      ))}
                    </fieldset>
                  )}
                </Surface>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p id="prerequisite-progress" role="status" className="flex min-h-6 items-center gap-2 text-sm text-ink-muted">
              {complete && <CheckCircle2 className="size-4 text-ok" aria-hidden />}
              {completed} of {topics.length} topics complete
            </p>
            <Button type="submit" variant="brand" disabled={!complete} aria-describedby="prerequisite-progress">
              Review my starting point <ArrowRight aria-hidden data-icon="inline-end" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
