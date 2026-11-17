import { CourseCompanionProvider } from "@/components/learning/course-companion";
import { FieldAccentSync } from "@/components/learning/field-accent-sync";
import { ProfileGate } from "@/components/onboarding/profile-gate";
import { connection } from 'next/server';

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <CourseCompanionProvider>
      <ProfileGate />
      <FieldAccentSync />
      {children}
    </CourseCompanionProvider>
  );
}
