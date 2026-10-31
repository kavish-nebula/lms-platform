"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  ArrowRight,
  BookMarked,
  BookOpen,
  Bot,
  Briefcase,
  CalendarClock,
  Check,
  CheckCheck,
  Code2,
  FolderKanban,
  Gauge,
  GraduationCap,
  ListOrdered,
  MessageSquareQuote,
  RotateCcw,
  SkipForward,
  Target,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssistantAvatar, type PipReaction } from "@/components/learning/assistant-avatar";
import { api } from "@/lib/api";
import { applyFieldAccent, FIELD_ACCENTS, type FieldAccent } from "@/lib/field-accent";
import type { SetupAnswers } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";

type Option = { label: string; value: string; kind?: string };
type Question = { slot: string; q: string; options: Option[]; multi?: boolean; source: "ai" | "rules" };
type Progress = { answered: number; remaining: number };
export type InterviewState = { answers: SetupAnswers; needs: string[]; derived: ProfileDerived | null; ack: string | null; question: Question | null; done: boolean; progress?: Progress };
type Last = { slot: string; q: string; value?: string | string[]; label?: string; text?: string; kind?: string; skipped?: boolean };

/** Each fact Pip asks about, as the learner sees it in "Your profile". Follow-ups and unknown slots fall back to the question. */
const SLOT_ICON = {
  domain: Briefcase,
  role: UserRound,
  years: CalendarClock,
  tools: Wrench,
  coding: Code2,
  style: BookOpen,
  firstStep: ListOrdered,
  needs: Accessibility,
  studyLevel: GraduationCap,
  studyField: BookMarked,
  project: FolderKanban,
  goal: Target,
  experience: Gauge,
  firstJob: Bot,
  known: CheckCheck,
  expect: MessageSquareQuote,
} satisfies Record<string, LucideIcon>;
type SlotKey = keyof typeof SLOT_ICON;
const isSlotKey = (slot: string): slot is SlotKey => slot in SLOT_ICON;
const SKIPPED = "(skipped)";

/** The learner's field as Pip's quote group and the app's accent colour. */
function fieldLook(a: SetupAnswers): { accent: FieldAccent | null } {
  const key = a.domain === "other" ? (a.field ?? "other") : a.domain;
  return {
    accent: key && (FIELD_ACCENTS as readonly string[]).includes(key) ? (key as FieldAccent) : null,
  };
}

/**
 * Pip's interview, in two places:
 *  - "About you", after signing in (no `course`): the learner types the field
 *    they work or study in; every question after that is written by the
 *    language model on the server for this learner (POST /api/v1/profiling/turn).
 *    Progress is saved each turn, so it resumes; "Start again" clears it.
 *  - Enrolling in a course (`course` given): four or five questions about this
 *    course only, what they want from it, what they already know of it
 *    (POST /api/v1/courses/:id/fit). The profile is not asked again, and
 *    nothing is stored until the enrolment is saved.
 * Each question occupies one step. The learner can tap an answer, use its
 * keyboard number, or write their own. A compact answer review preserves
 * context without making them scroll through an accumulating transcript.
 */
export function InterviewChat({
  name,
  initial,
  continueLabel,
  onDone,
  course,
}: {
  name: string;
  initial: Pick<InterviewState, "answers" | "needs" | "derived">;
  continueLabel: string;
  onDone: (s: Pick<InterviewState, "answers" | "needs" | "derived">) => void | Promise<void>;
  course?: { id: string; title: string };
}) {
  const t = useTranslations("enroll");
  const key = course ? "courseInterview" : "interview";
  const [state, setState] = React.useState<InterviewState>({ ...initial, ack: null, question: null, done: false });
  const [started, setStarted] = React.useState(() => !!course || !!initial.answers.interview?.length);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState<Last | null | false>(false);
  const [draft, setDraft] = React.useState("");
  const [writingOwn, setWritingOwn] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [reaction, setReaction] = React.useState<PipReaction>("wave");
  const [confirmRestart, setConfirmRestart] = React.useState(false);
  const questionRef = React.useRef<HTMLHeadingElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const turns = state.answers[key] ?? [];
  const asksField = !course && started && !turns.length && !loading;
  const q = !loading && failed === false ? state.question : null;

  React.useEffect(() => {
    // Pip is right here, so the floating help launcher steps aside (learning.css)
    document.documentElement.dataset.pipChat = "";
    return () => {
      delete document.documentElement.dataset.pipChat;
    };
  }, []);

  // Each question is a new focused step, rather than a scrolling chat log.
  React.useEffect(() => {
    if (loading || !started) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (asksField || writingOwn) inputRef.current?.focus({ preventScroll: true });
      else questionRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.question, loading, asksField, state.done, started, writingOwn]);

  const send = React.useCallback(
    async (last: Last | null) => {
      setLoading(true);
      setFailed(false);
      setReaction("think");
      setConfirmRestart(false);
      try {
        const { interview } = await api<{ interview: InterviewState }>(course ? `/api/v1/courses/${course.id}/fit` : "/api/v1/profiling/turn", {
          method: "POST",
          body: course ? { answers: state.answers, last } : { answers: state.answers, needs: state.needs, last },
        });
        setState(interview);
        setDraft("");
        setWritingOwn(false);
        setPicked([]);
        setReaction(interview.done || last?.slot === "domain" ? "celebrate" : "point");
        if (last?.slot === "domain") applyFieldAccent(fieldLook(interview.answers).accent);
      } catch {
        setFailed(last);
        setReaction("idle");
      } finally {
        setLoading(false);
      }
    },
    [state.answers, state.needs, course],
  );

  // resuming a conversation, or opening a course's questions: ask for the next question
  const resumed = React.useRef(false);
  React.useEffect(() => {
    if (resumed.current || (!course && !initial.answers.interview?.length)) return;
    resumed.current = true;
    void send(null);
  }, [initial.answers.interview, course, send]);

  const answer = React.useCallback(
    (o: Option) => {
      if (q) void send({ slot: q.slot, q: q.q, value: o.value, label: o.label, ...(o.kind ? { kind: o.kind } : {}) });
    },
    [q, send],
  );
  const submitPicked = React.useCallback(() => {
    if (!q || !picked.length) return;
    void send({ slot: q.slot, q: q.q, value: picked, label: q.options.filter((o) => picked.includes(o.value)).map((o) => o.label).join(", ").slice(0, 200) });
  }, [q, picked, send]);
  const toggle = React.useCallback((v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])), []);

  // number keys pick an answer (1–9), Enter sends several; never while typing
  React.useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, [contenteditable]")) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, q.options.length)) {
        e.preventDefault();
        const o = q.options[n - 1]!;
        if (q.multi) toggle(o.value);
        else answer(o);
      } else if (e.key === "Enter" && q.multi && picked.length && !el?.closest("button")) {
        e.preventDefault();
        submitPicked();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, picked, answer, toggle, submitPicked]);

  const submitText = () => {
    const text = draft.trim();
    if (!text) return;
    if (asksField) void send({ slot: "domain", q: t("interviewFieldQ"), text });
    else if (q) void send({ slot: q.slot, q: q.q, text });
  };

  const restart = async () => {
    setConfirmRestart(false);
    setDraft("");
    setPicked([]);
    setFailed(false);
    if (course) {
      // the course answers live only here until the enrolment is saved
      setState((s) => ({ ...s, answers: {}, ack: null, question: null, done: false, progress: undefined }));
      resumed.current = true;
      setLoading(true);
      setReaction("think");
      try {
        const { interview } = await api<{ interview: InterviewState }>(`/api/v1/courses/${course.id}/fit`, { method: "POST", body: { answers: {}, last: null } });
        setState(interview);
        setReaction("point");
      } catch {
        setFailed(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    await api("/api/v1/profiling", { method: "DELETE" }).catch(() => undefined);
    applyFieldAccent(null);
    setState({ answers: {}, needs: [], derived: null, ack: null, question: null, done: false });
    setStarted(true);
    setReaction("wave");
  };

  const look = fieldLook(state.answers);
  // a resumed "About you" keeps the colour of the field already given
  const resumedAccent = React.useRef(false);
  React.useEffect(() => {
    if (course || resumedAccent.current || !look.accent) return;
    resumedAccent.current = true;
    applyFieldAccent(look.accent);
  }, [course, look.accent]);
  const answered = state.progress?.answered ?? turns.length;
  const remaining = state.done ? 0 : Math.max(state.progress?.remaining ?? (course ? 5 : 9) - turns.length, 0);
  const total = Math.max(answered + remaining, 1);
  const pct = state.done ? 100 : Math.round((answered / total) * 100);
  const composerOpen = !loading && (asksField || (!!q && (writingOwn || !q.options.length)));
  const thinkingText = turns.length || course ? t("interviewThinking") : t("chatReadingField");

  const QuestionIcon = q && isSlotKey(q.slot) ? SLOT_ICON[q.slot] : Briefcase;
  const currentQuestion = asksField ? t("interviewFieldQ") : q?.q;

  return (
    <section className="profile-setup" aria-label={course ? t("panelCourseTitle") : t("profilePanelTitle")}>
      <div className="profile-setup-topline">
        <span className="profile-guide"><AssistantAvatar className="size-8" reaction={reaction} /><span>Pip <span className="profile-guide-role">{t("chatRole")}</span></span></span>
        <span className="profile-step-label">{state.done ? t("chatStatusDone") : started ? t("chatProgress", { n: Math.min(answered + 1, total), total }) : t("chatTime")}</span>
      </div>
      <div className="profile-progress" role="progressbar" aria-label={t("chatProgressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="profile-question-surface" aria-busy={loading}>
        {!started ? <>
          <span className="profile-question-icon"><GraduationCap aria-hidden /></span>
          <p className="profile-greeting">{t("chatHello", { name })}</p>
          <h1 className="profile-question-title">{t("setupIntroTitle")}</h1>
          <p className="profile-question-description">{t("setupIntroBody")}</p>
          <div className="profile-intro-grid">
            {[{ icon: Briefcase, title: t("chatPlanField"), body: t("setupContextBenefit") }, { icon: Wrench, title: t("chatPlanWork"), body: t("setupWorkBenefit") }, { icon: BookOpen, title: t("chatPlanLearn"), body: t("setupLearningBenefit") }].map(item => <div className="profile-intro-card" key={item.title}><item.icon aria-hidden /><h2>{item.title}</h2><p>{item.body}</p></div>)}
          </div>
          <Button size="lg" variant="brand" onClick={() => setStarted(true)}>{t("setupBegin")}<ArrowRight data-icon="inline-end" /></Button>
          <p className="profile-question-footnote">{t("setupNoTest")}</p>
        </> : loading ? <div className="profile-loading" role="status" aria-live="polite">
          <AssistantAvatar className="size-14" reaction="think" />
          <h2 className="profile-question-title">{thinkingText}</h2>
          <p className="profile-question-description">{t("setupThinkingHelp")}</p>
        </div> : failed !== false ? <div role="alert" className="profile-error">
          <h2 className="profile-question-title">{t("interviewFailed")}</h2>
          <p className="profile-question-description">{t("setupRetryHelp")}</p>
          <Button variant="brand" onClick={() => void send(failed)}><RotateCcw data-icon="inline-start" />{t("interviewRetry")}</Button>
        </div> : state.done ? <>
          <span className="profile-question-icon"><CheckCheck aria-hidden /></span>
          <h1 ref={questionRef} tabIndex={-1} className="profile-question-title">{course ? t("fitAllDoneTitle") : t("chatAllDoneTitle")}</h1>
          <p className="profile-question-description">{course ? t("fitAllDone") : t("setupReadyBody")}</p>
          <dl className="profile-answer-review">
            {turns.map((turn, i) => <div key={`${turn.slot}-${i}`}><dt>{isSlotKey(turn.slot) ? t(`slot_${turn.slot}`) : turn.q}</dt><dd>{turn.a === SKIPPED ? t("chatSkipped") : turn.a}</dd></div>)}
          </dl>
          <Button variant="brand" size="lg" disabled={saving} onClick={async () => { setSaving(true); try { await onDone(state); } finally { setSaving(false); } }}>{saving ? t("setupSaving") : continueLabel}<ArrowRight data-icon="inline-end" /></Button>
        </> : <>
          <span className="profile-question-icon"><QuestionIcon aria-hidden /></span>
          <h1 id="interview-q" ref={questionRef} tabIndex={-1} className="profile-question-title">{currentQuestion}</h1>
          <p className="profile-question-description">{asksField ? t("chatFieldHelp") : q?.multi ? t("pickAny") : t("setupPickClosest")}</p>
          {state.ack ? <p className="profile-ack"><Check aria-hidden />{state.ack}</p> : null}
          {asksField ? <div className="profile-field-suggestions" aria-label={t("setupExampleFields")}>
            {[t("setupExampleFinance"), t("setupExampleTech"), t("setupExampleHealth"), t("setupExampleStudy")].map(example => <button type="button" key={example} onClick={() => { setDraft(example); inputRef.current?.focus(); }}>{example}</button>)}
          </div> : null}
          {q ? <div className="profile-choice-grid" role={q.multi ? "group" : "radiogroup"} aria-labelledby="interview-q">
            {q.options.map((option, i) => {
              const selected = picked.includes(option.value);
              return <button type="button" data-chip key={option.value + option.label} role={q.multi ? undefined : "radio"} aria-checked={q.multi ? undefined : false} aria-pressed={q.multi ? selected : undefined} aria-keyshortcuts={i < 9 ? String(i + 1) : undefined} className={cn("profile-choice", selected && "is-selected")} onClick={() => q.multi ? toggle(option.value) : answer(option)}>
                <span className="profile-choice-marker" aria-hidden>{selected ? <Check /> : i + 1}</span><span>{option.label}</span>{!q.multi ? <ArrowRight className="profile-choice-arrow" aria-hidden /> : null}
              </button>;
            })}
          </div> : null}
          {q && !composerOpen ? <button type="button" className="profile-own-answer" onClick={() => setWritingOwn(true)}><MessageSquareQuote aria-hidden />{t("interviewOwnWords")}</button> : null}
          {composerOpen ? <form className="profile-answer-form" onSubmit={e => { e.preventDefault(); submitText(); }}>
            <label htmlFor="interview-text">{asksField ? t("setupFieldLabel") : t("interviewOwnWords")}</label>
            <div className="profile-composer"><Input id="interview-text" ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} maxLength={asksField ? 80 : 200} placeholder={asksField ? t("interviewFieldPlaceholder") : t("interviewOwnWordsLong")} autoComplete="off" /><Button type="submit" variant="brand" disabled={!draft.trim()} aria-label={t("chatSend")}><ArrowRight aria-hidden /></Button></div>
            <span className="profile-question-footnote">{asksField ? t("chatFieldHint") : t("chatKeysHint", { n: Math.min(9, q?.options.length ?? 0) })}</span>
          </form> : null}
          <div className="profile-question-actions">
            {q ? <Button variant="ghost" onClick={() => void send({ slot: q.slot, q: q.q, skipped: true })}>{t("setupSkipQuestion")}<SkipForward data-icon="inline-end" /></Button> : <span />}
            {q?.multi ? <Button variant="brand" size="lg" disabled={!picked.length} onClick={submitPicked}>{picked.length ? t("chatDoneN", { n: picked.length }) : t("chatDone")}<ArrowRight data-icon="inline-end" /></Button> : null}
          </div>
        </>}
      </div>

      <footer className="profile-setup-footer">
        {turns.length && !state.done ? <details className="profile-answer-details"><summary>{t("setupViewAnswers", { n: turns.length })}</summary><dl className="profile-answer-review">{turns.map((turn, i) => <div key={`${turn.slot}-${i}`}><dt>{isSlotKey(turn.slot) ? t(`slot_${turn.slot}`) : turn.q}</dt><dd>{turn.a === SKIPPED ? t("chatSkipped") : turn.a}</dd></div>)}</dl></details> : <span>{t("setupEditable")}</span>}
        {turns.length ? <div className="profile-restart">{confirmRestart ? <><span>{t("interviewRestartAsk")}</span><Button size="sm" variant="outline" onClick={() => void restart()}>{t("interviewRestartYes")}</Button><Button size="sm" variant="ghost" onClick={() => setConfirmRestart(false)}>{t("interviewRestartNo")}</Button></> : <Button size="sm" variant="ghost" disabled={loading || saving} onClick={() => setConfirmRestart(true)}><RotateCcw data-icon="inline-start" />{t("interviewRestart")}</Button>}</div> : null}
      </footer>
    </section>
  );
}
