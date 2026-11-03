"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile";
import { importedCourses } from '@/lib/imported-courses';

/**
 * "About you" comes first: a learner whose profile has not been set yet is
 * sent to Pip's welcome chat, then back to where they were going. Only when
 * the server has answered: a failed request never redirects.
 */
export function ProfileGate() {
  const { profile, loaded } = useProfile();
  const path = usePathname();
  const router = useRouter();
  // Supplied learning packages run their own fixed teaching flow, without a
  // personalization interview. Native adaptive courses still require it.
  const packaged = importedCourses.some(c => path === `/learn/courses/${c.id}` || path.startsWith(`/learn/imported/${c.id}/`));
  const browsing = path === '/learn/courses';
  React.useEffect(() => {
    if (loaded && !profile && !packaged && !browsing && !path.startsWith("/learn/welcome")) router.replace(`/learn/welcome?return=${encodeURIComponent(path)}`);
  }, [loaded, profile, path, router, packaged, browsing]);
  return null;
}
