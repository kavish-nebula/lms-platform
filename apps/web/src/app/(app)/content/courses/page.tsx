import { CourseDrafts } from "@/components/content/course-drafts";
import { getSessionUser } from "@/server/auth";
import { listCreatorDrafts } from "@/server/content-creator";

export default async function CreatorCoursesPage() {
  const drafts = await listCreatorDrafts((await getSessionUser()).id);
  return <div className="space-y-6"><header><h1 className="text-3xl font-semibold">Your courses</h1><p className="mt-2 text-ink-muted">Saved authoring drafts. Existing LMS courses remain outside this workspace until course import is available.</p></header><CourseDrafts drafts={drafts} searchable /></div>;
}
