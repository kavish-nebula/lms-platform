import { CourseDrafts } from "@/components/content/course-drafts";
import { getSessionUser } from "@/server/auth";
import { listCreatorDrafts } from "@/server/content-creator";

export default async function ContentPage() {
  const drafts = await listCreatorDrafts((await getSessionUser()).id);
  return <div className="space-y-10"><header><p className="text-sm font-medium text-brand-ink">Course Creator Studio</p><h1 className="mt-2 text-3xl font-semibold">Turn expertise into a course</h1><p className="mt-3 max-w-3xl text-ink-muted">Start with the course brief and a source library mapped to objectives, modules and topics. Generate a blueprint, review and produce modules, then assemble, approve and publish the complete course.</p></header><CourseDrafts drafts={drafts} /></div>;
}
