"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/kit/progress-ring";
import { useCourseProgress } from "@/lib/course-progress";
import { useEnrollment } from "@/lib/enrollment";
import { useLearning } from "@/lib/learning-state";
import { useHydrated } from "@/lib/local-store";
import { useWatchedVideos } from "@/components/player/video/watched";
import { deriveGameProgress } from "@/lib/gamification";
import type { Course } from "@/data/types";
import { PipTour } from "@/components/onboarding/pip-tour";
import { DailyMission } from "./game-ui";

export function CourseJourney({ course }: { course: Course }) {
  const progress = useCourseProgress(course);
  const { enrolled } = useEnrollment(course.course_id);
  const { state } = useLearning(course.course_id);
  const { watched } = useWatchedVideos();
  const hydrated = useHydrated();
  const base = `/learn/courses/${course.course_id}`;
  const resume = state.resume?.href.startsWith(`${base}/`) ? state.resume : progress.resume;
  const due = hydrated ? state.reviews.filter((r) => !r.completedAt && new Date(r.due) <= new Date()) : [];
  const game = deriveGameProgress(course, progress, state, watched, due.length, new Date(), enrolled);
  const mission = enrolled ? game.quest : { eyebrow: "FIRST MISSION", title: "Make this course yours", detail: "Answer a few questions about the course, then choose how it fits you.", href: `${base}/enroll`, xp: 25, dailyDone: false };
  return <>
    <section id="course-hero" className="journey-hero">
      <div>
        <Link href="/learn/courses" className="journey-kicker"><Route className="size-4" />Your learning adventure</Link>
        <h1>{course.title}</h1>
        <p className="max-w-lg text-sm leading-relaxed text-ink-muted">{course.course_id === 'ai-agent' ? 'Join the team at Orbit Outdoor. Explore real problems, try your ideas, and build Scout into a dependable support agent.' : course.tagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg"><Link href={enrolled ? resume?.href ?? `${base}/${course.modules[0]?.module_id}/hook` : `${base}/enroll`}>{enrolled ? "Continue my journey" : "Make this course mine"}<ArrowRight /></Link></Button>
          {(course.course_id === 'ai-agent' || course.authoredRevisionId) && course.modules[0] ? <Button asChild variant="outline" size="lg"><Link href={`${base}/${course.modules[0].module_id}/reader`}><BookOpen/>Read the course</Link></Button> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted"><span>{course.modules.length} connected chapters</span><span>One final mini-project</span><span>Your pace. Your path.</span></div>
        {enrolled && <div className="mt-6 max-w-md"><div className="mb-2 flex justify-between text-xs text-ink-muted"><span>Your course progress</span><span>{progress.topicsDone} / {progress.topicsTotal} phases</span></div><ProgressBar value={progress.ratio} size="sm" /></div>}
      </div>
    </section>
    <DailyMission quest={mission} />
    <PipTour enabled={hydrated && enrolled} />
  </>;
}
