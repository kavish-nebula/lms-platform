import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Surface } from '@/components/kit/surface';
import { Button } from '@/components/ui/button';
import type { ImportedCourse } from '@/lib/imported-courses';

export function ImportedCourseCard({ course }: { course: ImportedCourse }) {
  const unit = course.modules[0];
  return <Surface pad="lg" className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
    <div className="max-w-2xl space-y-2">
      <p className="text-sm text-ink-muted">Nebula KnowLab · {course.modules.length} module available</p>
      <h2 className="text-2xl font-semibold"><Link className="hover:underline" href={`/learn/courses/${course.id}`}>{course.title}</Link></h2>
      <p className="text-ink-muted">{course.description}</p>
      <p className="text-sm">Module 1: {unit.title}</p>
    </div>
    <Button asChild variant="brand"><Link href={`/learn/courses/${course.id}`}><BookOpen />Explore course<ArrowRight /></Link></Button>
  </Surface>;
}

export function ImportedCourseDetails({ course }: { course: ImportedCourse }) {
  return <div className="flex flex-col gap-6">
    <Link href="/learn/courses" className="text-sm text-brand-ink hover:underline">← All courses</Link>
    <header className="space-y-3"><h1 className="text-3xl font-semibold">{course.title}</h1><p className="max-w-3xl text-ink-muted">{course.description}</p></header>
    {course.modules.map((unit, index) => <Surface key={unit.id} pad="lg" className="space-y-6">
      <div className="space-y-2"><p className="text-sm text-brand-ink">Module {index + 1}</p><h2 className="text-2xl font-semibold">{unit.title}</h2></div>
      <div><h3 className="mb-2 font-semibold">What you’ll learn</h3><ul className="list-disc space-y-2 pl-5">{unit.objectives.map(o => <li key={o}>{o}</li>)}</ul></div>
      <div className="grid gap-5 md:grid-cols-3">{unit.concepts.map((c, i) => <div key={c.title} className="rounded-lg border border-line bg-panel-2 p-4"><h3 className="font-semibold">{i + 1}. {c.title}</h3><ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-ink-muted">{c.topics.map(t => <li key={t}>{t}</li>)}</ul></div>)}</div>
      <p className="text-sm text-ink-muted">Includes knowledge checks and practical tasks: {unit.tasks.join('; ')}.</p>
      <p className="text-sm text-ink-muted">Your place, quiz progress and notes save here. External AI tutoring and remote submission services are not connected.</p>
      <Button asChild variant="brand" size="lg"><Link href={`/learn/imported/${course.id}/${unit.id}`}><BookOpen />Open Module {index + 1}<ArrowRight /></Link></Button>
    </Surface>)}
  </div>;
}
