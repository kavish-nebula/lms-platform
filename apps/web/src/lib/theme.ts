"use client";

import { writeLocal } from "@/lib/local-store";
import { PREFS_KEY, applyPrefs } from "@/lib/prefs";

/** Merge display choices without discarding the learner's field/accessibility settings. */
export function setTheme(theme: "light" | "dark") {
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); } catch {}
  writeLocal(PREFS_KEY, JSON.stringify({ ...prefs, theme }));
  applyPrefs(true);
  // Also works in private windows where persistence is unavailable.
  if (theme === "light") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", "aurora");
}
