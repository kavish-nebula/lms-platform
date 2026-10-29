"use client";
import { useEffect } from "react";

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const url = new URL(anchor.href);
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      if (!window.confirm("Leave without saving? Your unsaved changes will be lost.")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    let restoring = false;
    const back = (event: PopStateEvent) => {
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      if (!window.confirm("Leave without saving? Your unsaved changes will be lost.")) { restoring = true; event.stopImmediatePropagation(); history.go(1); }
    };
    const navigate = (event: Event) => { if (!window.confirm("Leave without saving? Your unsaved changes will be lost.")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", back, true);
    window.addEventListener("lms:before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); window.removeEventListener("popstate", back, true); window.removeEventListener("lms:before-navigate", navigate); };
  }, [dirty]);
}

