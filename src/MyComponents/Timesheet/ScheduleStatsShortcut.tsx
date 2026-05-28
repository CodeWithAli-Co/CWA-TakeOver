/**
 * ScheduleStatsShortcut.tsx — Root-mounted Cmd+Shift+S / Ctrl+Shift+S
 * keyboard listener. Toggles the global ScheduleStats modal from
 * anywhere in the app.
 *
 * Mirrors the pattern of QuickComposeShortcut. Returns null — pure
 * effect component. Mount once at the app root alongside the modal
 * itself.
 */

import { useEffect } from "react";
import { useScheduleStats } from "./scheduleStatsStore";

export function ScheduleStatsShortcut() {
  const toggleStats = useScheduleStats((s) => s.toggleStats);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        // Ignore if the user is mid-edit in a form field — Cmd+Shift+S
        // could legitimately mean "save as" inside an editor.
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (target?.isContentEditable ?? false);
        if (editable) return;

        e.preventDefault();
        toggleStats();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleStats]);

  return null;
}
