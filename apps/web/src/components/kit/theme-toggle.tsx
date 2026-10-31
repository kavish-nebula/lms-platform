"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setTheme } from "@/lib/theme";

/** Shared control, including full-screen lessons and pages without a navigation bar. */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const t = useTranslations("settings");
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.dataset.theme === "aurora");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size={floating ? "icon" : "sm"}
      className={floating ? "app-theme-toggle" : undefined}
      role="switch"
      aria-checked={!dark}
      aria-label={t("lightTheme")}
      title={t("lightTheme")}
      onClick={() => setTheme(document.documentElement.dataset.theme === "aurora" ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      {!floating && t("appearance")}
    </Button>
  );
}
