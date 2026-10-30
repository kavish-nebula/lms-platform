'use client';

import Link from 'next/link';
import { ArrowRight, Check, CirclePlay, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/kit/surface';
import type { PublicSandboxProject } from '@/server/project-sandbox';

export function GuidedProjectIntro({ project }: { project: PublicSandboxProject }) {
  return <Surface pad="lg" className="space-y-5">
    <p className="text-sm font-medium text-brand-ink">Guided mini project</p>
    <h1 className="text-2xl font-semibold">{project.title}</h1>
    <p className="max-w-2xl text-ink-muted">Explore a ready-made workflow, run two examples, and explain what the results mean. The workflow is already complete.</p>
    <ul className="space-y-3 text-sm">
      <li className="flex items-center gap-2"><LockKeyhole className="size-4" aria-hidden />Read-only workflow · no building or editing</li>
      <li className="flex items-center gap-2"><CirclePlay className="size-4" aria-hidden />Run supplied examples and inspect each transformation</li>
      <li className="flex items-center gap-2"><Check className="size-4" aria-hidden />Submit your explanations for concept checks</li>
    </ul>
    <Button asChild variant="brand" size="lg"><Link href={`/learn/courses/${project.courseId}/finale/capstone/workspace`}>Open guided project<ArrowRight aria-hidden /></Link></Button>
    <p className="text-xs text-ink-muted">Your saved explanations and place in the project will resume in the workspace.</p>
  </Surface>;
}
