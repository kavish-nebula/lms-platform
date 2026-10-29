import { CourseDrafts } from "@/components/content/course-drafts";
import { CreatorRoadmap, IldWorkflow } from "@/components/content/ild-workflow";
import { getSessionUser } from "@/server/auth";
import { listCreatorDrafts } from "@/server/content-creator";

export default async function ContentPage() {
  const drafts = await listCreatorDrafts((await getSessionUser()).id);
  return <div className="space-y-10"><header><p className="text-sm font-medium text-brand-ink">Course Creator Studio</p><h1 className="mt-2 text-3xl font-semibold">Turn expertise into a course</h1><p className="mt-3 max-w-3xl text-ink-muted">Begin with a course brief: who you teach, what they should achieve and the knowledge they need. Save your work now, then build toward a reviewed learning experience through the ILD workflow.</p></header><CourseDrafts drafts={drafts} /><IldWorkflow /><CreatorRoadmap /></div>;
}
