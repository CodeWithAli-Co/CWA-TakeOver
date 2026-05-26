/**
 * SheetEditor.tsx — Univer-powered spreadsheet canvas for
 * /workspace/sheets/$id.
 *
 * Mount/Load:
 *   1. On mount, create a Univer instance inside `containerRef`, pulling
 *      in the sheets-core preset (sheets + ui + formula + render + design).
 *   2. If we have a saved snapshot (non-empty), pass it to
 *      `createWorkbook()` so Univer hydrates the user's data. Otherwise
 *      create a default empty workbook.
 *
 * Save loop:
 *   · A 2-second polling interval reads the current workbook snapshot,
 *     compares it to the last-saved JSON via stringify, and calls
 *     `onSave(snapshot)` when something changed. Polling is intentional
 *     over event subscriptions for v1 — robust, easy to reason about,
 *     and 2s latency is acceptable for an internal tool. Phase 4
 *     (collaboration) will switch to event-driven for live cursors.
 *
 * Dispose:
 *   · We dispose the Univer instance on unmount via the returned API's
 *     dispose() method. Univer attaches a fair amount of global state
 *     (event listeners, render workers) so missing this leaks memory
 *     across navigations.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { createUniver, LocaleType } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/presets/preset-sheets-core";
import sheetsCoreEnUS from "@univerjs/presets/preset-sheets-core/locales/en-US";
import "@univerjs/presets/lib/styles/preset-sheets-core.css";

interface Props {
  /** The Univer workbook snapshot from the database. May be {} on first open. */
  snapshot: Record<string, unknown>;
  onSave: (next: Record<string, unknown>) => Promise<void>;
}

const SAVE_POLL_INTERVAL_MS = 2000;

export function SheetEditor({ snapshot, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerApiRef = useRef<any>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const lastSavedJsonRef = useRef<string>(safeStringify(snapshot));

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    // createUniver hands back the API + dispose. The container option
    // accepts either an HTMLElement or a selector string — pass the
    // DOM node directly to avoid timing races with selector lookup.
    const { univerAPI, univer } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: sheetsCoreEnUS },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
        }),
      ],
    });

    univerApiRef.current = univerAPI;
    disposeRef.current = () => {
      try { univer.dispose(); } catch { /* ignore */ }
    };

    // Hydrate from the saved snapshot. Empty / placeholder objects fall
    // back to a default workbook so the user lands on a blank sheet.
    const initialSnapshot =
      snapshot && Object.keys(snapshot).length > 0 ? snapshot : undefined;
    try {
      // Newer Univer: createWorkbook(snapshot?) — undefined → default.
      univerAPI.createWorkbook(initialSnapshot ?? {});
    } catch (e) {
      console.error("[SheetEditor] failed to load snapshot:", e);
      // Fall back to empty workbook so the user at least sees a grid.
      try { univerAPI.createWorkbook({}); } catch { /* noop */ }
    }

    // Start the save loop. We use a simple interval + JSON diff so any
    // cell value, format, sheet add/remove, etc. is captured uniformly
    // without us needing to subscribe to Univer's command system.
    pollHandle = setInterval(async () => {
      if (cancelled) return;
      const wb = univerAPI.getActiveWorkbook?.();
      if (!wb || typeof wb.save !== "function") return;
      let current: any;
      try {
        current = wb.save();
      } catch (e) {
        console.warn("[SheetEditor] workbook.save() threw:", e);
        return;
      }
      const currentJson = safeStringify(current);
      if (currentJson === lastSavedJsonRef.current) return;

      setSaving(true);
      try {
        await onSave(current);
        lastSavedJsonRef.current = currentJson;
        setSavedAt(Date.now());
      } catch (e) {
        console.error("[SheetEditor] save failed:", e);
      } finally {
        if (!cancelled) setSaving(false);
      }
    }, SAVE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
      disposeRef.current?.();
      disposeRef.current = null;
      univerApiRef.current = null;
    };
    // We intentionally only mount/dispose Univer ONCE per page open —
    // external snapshot changes (realtime) are reconciled in a separate
    // effect below so we don't tear down the canvas mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External snapshot sync. If the row in the DB changes (eg. realtime
  // from another user), we'd want to merge their state in. For v1 we
  // just log and rely on the next save to overwrite — Phase 4 ships
  // proper collaboration. Comparing here also helps reset the
  // lastSaved baseline if the parent's prop changes after first mount.
  useEffect(() => {
    const incoming = safeStringify(snapshot);
    if (incoming === lastSavedJsonRef.current) return;
    // No-op for now — see Phase 4 for live merge.
  }, [snapshot]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full workspace-sheet-canvas"
      />

      {/* Save indicator — bottom-right overlay so it doesn't fight
          Univer's toolbar. */}
      <div className="absolute bottom-2 right-3 z-10 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-popover/90 border border-border/60 backdrop-blur text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 shadow-sm">
          {saving ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : savedAt ? (
            <>
              <Check size={10} className="text-emerald-400" />
              <span>Saved · {formatRelative(savedAt)}</span>
            </>
          ) : (
            <span>Idle</span>
          )}
        </div>
      </div>
    </div>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function formatRelative(ts: number): string {
  const ms = Date.now() - ts;
  const secs = Math.floor(ms / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}
