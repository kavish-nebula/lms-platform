import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLearner } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { ProfileEditor } from "@/components/learn/profile-editor";

export const metadata: Metadata = { title: "Profile" };

/** The learner profile: the seven questions asked at the first enrolment, editable here. */
export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const learner = await getLearner();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProfileEditor name={learner.user.name} />
    </div>
  );
}
