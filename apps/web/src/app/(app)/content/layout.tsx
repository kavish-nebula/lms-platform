import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionUser } from "@/server/auth";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getSessionUser();
  return <AppShell role="content_creator" heldRoles={["learner", "content_creator"]} user={user} courses={[]} notifications={[]} settingsHref="/content/settings">
    <p className="mb-6 rounded-lg border border-brand-line bg-brand-soft px-4 py-3 text-sm text-brand-ink">Content Creator · Local demo workspace. Role switching changes your view; it is not authentication or production access control.</p>
    {children}
  </AppShell>;
}
