import { InlineScript } from "@/app/inline-script";
import { prefsScript } from "@/lib/prefs";

/**
 * Applies saved preferences before first paint so nothing flashes:
 * larger text, reduced motion, and the chosen theme on every page.
 * Dark is the default; the saved appearance choice applies before hydration.
 */
export function PrefsScript({ allowLight = true }: { allowLight?: boolean }) {
  return <InlineScript html={prefsScript(allowLight)} />;
}
