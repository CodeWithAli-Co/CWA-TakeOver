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
import { ActiveUser } from "@/stores/query";
import { useRolePreview } from "@/stores/store";
import { useEffectiveRow4View, useRow4View } from "./row4ViewStore";

export function Row4SwapShortcut() {
  const toggleFrom = useRow4View((s) => s.toggleFrom);
  const { data: meRows } = ActiveUser();
  const actualRole: string | undefined =
    (meRows?.[0] as any)?.role ?? undefined;
  // Mirror Row4Swapper's resolution: preview role wins over the
  // actual role, and we ignore the persisted preference while
  // previewing so the chord toggles relative to what's on screen
  // — not relative to a stale stored pick the preview is hiding.
  const previewRole = useRolePreview((s) => s.previewRole);
  const effectiveRole = previewRole || actualRole;
  const isPreviewing = !!previewRole;
  const effective = useEffectiveRow4View(effectiveRole, isPreviewing);

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
        // While previewing another role we don't want the chord to
        // write a persisted preference on the actual user's account.
        // The preview is meant to show that role's default cleanly.
        if (isPreviewing) return;
        toggleFrom(effective);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFrom, effective, isPreviewing]);

  return null;
}
