import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse, getFinale } from "@/data";
import { WorkflowWorkspace } from "@/components/project/workflow-workspace";
import { ProjectSandboxWorkspace } from '@/components/project/project-sandbox';
import { GuidedProjectWorkspace } from '@/components/project/guided-project';

type Params = { courseId: string; step: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course ? `Mini project workspace · ${course.title}` : "Mini project workspace" };
}

/** The mini project workspace, full screen: /learn/courses/[courseId]/finale/capstone/workspace, where the learner builds the agent's workflow. */
export default async function ProjectWorkspacePage({ params }: { params: Promise<Params> }) {
  const { courseId, step } = await params;
  const course = await getCourse(courseId);
  if (!course || step !== 'capstone') notFound();
  const finale = await getFinale(courseId);
  if (finale?.capstone.sandbox?.sandbox.guided) return <GuidedProjectWorkspace key={finale.capstone.sandbox.revisionId} project={finale.capstone.sandbox} />;
  if (finale?.capstone.sandbox) return <ProjectSandboxWorkspace project={finale.capstone.sandbox} />;
  if (courseId !== 'ai-agent') notFound();
  return <WorkflowWorkspace course={course} />;
}
