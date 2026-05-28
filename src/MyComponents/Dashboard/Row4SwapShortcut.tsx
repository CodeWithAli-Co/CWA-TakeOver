/**
 * Row4SwapShortcut.tsx — Hidden global Cmd+Shift+D / Ctrl+Shift+D
 * keyboard shortcut that toggles the home dashboard's Row 4 view
 * (lists ↔ today). Intentionally not advertised in the UI; the
 * swap button overlay was removed so this only flips for power
 * users or operators who've been told about the chord.
 *
 * Pattern mirrors ScheduleStatsShortcut. Returns null — pure effect
 * component. Mount once at the app root.
 */

import { useEffect } from "react";
import { useRow4View } from "./row4ViewStore";

export function Row4SwapShortcut() {
  const toggleRow4View = useRow4View((s) => s.toggleRow4View);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        // Don't steal the chord from a field the operator is typing in.
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (target?.isContentEditable ?? false);
        if (editable) return;

        e.preventDefault();
        toggleRow4View();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRow4View]);

  return null;
}
