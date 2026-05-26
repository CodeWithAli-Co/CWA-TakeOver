/**
 * VersionHistoryPanel.tsx — Right-rail timeline of versions for a doc
 * or spreadsheet.
 *
 * Owner workflow:
 *   · Top of panel: "Save current as version…" with an optional label.
 *   · Body: reverse-chronological list of versions, grouped by day.
 *   · Per row: author, time, label (if any), [Restore] button.
 *
 * Restore writes the chosen snapshot back to the resource's current
 * content (for docs: into `content` + clears `y_state`; for sheets:
 * into `snapshot`). Connected collaborators won't auto-sync — they
 * need to refresh to pick up the restored state.
 *
 * Phase 6 keeps preview minimal — we show a stripped-down text excerpt
 * for docs to avoid mounting a second TipTap instance just for preview.
 * Heavier preview (rendered-but-read-only TipTap) is a polish task.
 */

import { useMemo, useState } from "react";
import {
  Loader2, History, RotateCcw, Save, X, Tag, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  useVersions,
  useCreateVersion,
  useRestoreDocumentVersion,
  useRestoreSpreadsheetVersion,
} from "@/stores/workspace";
import type {
  WorkspaceResourceKind,
  WorkspaceVersion,
} from "@/stores/workspaceTypes";
import { colorForUser } from "@/lib/yjs/awareness";
import { extractDocText } from "./searchHelpers";

interface Props {
  kind: WorkspaceResourceKind;
  resourceId: string;
  currentUsername: string;
  /** Snapshot getter — invoked when the user clicks "Save current as version". */
  getCurrentSnapshot: () => unknown;
  /** Called after a successful restore so the parent can re-fetch + rerender. */
  onAfterRestore?: () => void;
  onClose: () => void;
}

export function VersionHistoryPanel({
  kind, resourceId, currentUsername, getCurrentSnapshot, onAfterRestore, onClose,
}: Props) {
  const { data: versions = [], isLoading } = useVersions(kind, resourceId);
  const createMut = useCreateVersion();
  const restoreDocMut = useRestoreDocumentVersion();
  const restoreSheetMut = useRestoreSpreadsheetVersion();

  const [label, setLabel] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = useMemo(() => groupByDay(versions), [versions]);

  const handleSaveVersion = async () => {
    const snapshot = getCurrentSnapshot();
    await createMut.mutateAsync({
      kind,
      resourceId,
      snapshot,
      createdBy: currentUsername,
      label: label.trim() || null,
    });
    setLabel("");
  };

  const handleRestore = async (v: WorkspaceVersion) => {
    const ok = window.confirm(
      "Restore this version? The current content will be overwritten. " +
      "Anyone editing this document right now will need to refresh to see the change.",
    );
    if (!ok) return;
    if (kind === "document") {
      await restoreDocMut.mutateAsync({
        docId: resourceId,
        snapshot: v.snapshot,
        restoredBy: currentUsername,
      });
    } else {
      await restoreSheetMut.mutateAsync({
        sheetId: resourceId,
        snapshot: v.snapshot,
        restoredBy: currentUsername,
      });
    }
    onAfterRestore?.();
  };

  return (
    <aside className="w-[360px] max-w-[40vw] border-l border-border bg-background flex flex-col min-h-0 flex-shrink-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="rounded-sm bg-sky-500/10 border border-sky-500/30 p-1">
            <History size={12} className="text-sky-300" />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.14em] uppercase text-foreground/40">
              History
            </div>
            <div className="text-[12.5px] font-semibold text-foreground">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="rounded-sm p-1 text-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X size={14} />
        </button>
      </header>

      {/* Save-current strip */}
      <section className="px-4 py-3 border-b border-border/60 flex-shrink-0">
        <label className="block text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 mb-1.5">
          Save current as a version
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Tag
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-foreground/35"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label (e.g. \"Pre-launch\")"
              className="w-full h-8 pl-7 pr-2 rounded-sm bg-muted/30 border border-border text-[12px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveVersion();
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveVersion}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {createMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save
          </button>
        </div>
      </section>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 flex items-center justify-center text-foreground/40 text-[12px]">
            <Loader2 size={13} className="animate-spin mr-2" /> Loading…
          </div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center">
            <div className="h-10 w-10 rounded-sm bg-muted/30 border border-border mx-auto mb-3 flex items-center justify-center">
              <History size={14} className="text-foreground/40" />
            </div>
            <p className="text-[12.5px] font-semibold text-foreground/80 mb-1">
              No versions yet
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed max-w-[28ch] mx-auto">
              Save the current state above to start a history trail.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {grouped.map(([day, items]) => (
              <li key={day} className="px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-foreground/35 px-2 mb-1.5 font-semibold">
                  {day}
                </div>
                <ul className="space-y-1">
                  {items.map((v) => (
                    <VersionRow
                      key={v.id}
                      version={v}
                      kind={kind}
                      expanded={expandedId === v.id}
                      onToggle={() =>
                        setExpandedId((cur) => (cur === v.id ? null : v.id))
                      }
                      onRestore={() => handleRestore(v)}
                      restoring={restoreDocMut.isPending || restoreSheetMut.isPending}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────
// One row + expandable preview
// ──────────────────────────────────────────────────────────────────
function VersionRow({
  version, kind, expanded, onToggle, onRestore, restoring,
}: {
  version: WorkspaceVersion;
  kind: WorkspaceResourceKind;
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  const preview = useMemo(() => {
    if (kind !== "document") return null;
    const text = extractDocText(version.snapshot as any);
    return text.length > 200 ? text.slice(0, 200) + "…" : text;
  }, [version, kind]);

  return (
    <li className="rounded-sm hover:bg-muted/20 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-2 py-1.5 flex items-center gap-2"
      >
        {expanded ? (
          <ChevronDown size={11} className="text-foreground/35 flex-shrink-0" />
        ) : (
          <ChevronRight size={11} className="text-foreground/35 flex-shrink-0" />
        )}
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: colorForUser(version.created_by) }}
        >
          {version.created_by.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-foreground truncate">
            {version.label || formatTime(version.created_at)}
          </div>
          <div className="text-[10.5px] text-foreground/45 truncate">
            {version.created_by}
            {version.label && (
              <>
                <span className="mx-1 text-foreground/25">·</span>
                {formatTime(version.created_at)}
              </>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2 ml-7 -mt-0.5">
          {preview !== null && preview.length > 0 && (
            <p className="text-[11.5px] text-foreground/60 leading-relaxed italic line-clamp-3 mb-2">
              "{preview}"
            </p>
          )}
          {preview !== null && preview.length === 0 && (
            <p className="text-[11.5px] text-foreground/45 italic mb-2">
              Empty document.
            </p>
          )}
          <button
            type="button"
            onClick={onRestore}
            disabled={restoring}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-border bg-secondary text-foreground text-[10.5px] font-bold uppercase tracking-wider hover:bg-muted transition-colors disabled:opacity-40"
          >
            {restoring ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RotateCcw size={11} />
            )}
            Restore this version
          </button>
        </div>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// Day grouping
// ──────────────────────────────────────────────────────────────────
function groupByDay(versions: WorkspaceVersion[]): [string, WorkspaceVersion[]][] {
  const map = new Map<string, WorkspaceVersion[]>();
  for (const v of versions) {
    const key = dayLabel(v.created_at);
    const arr = map.get(key) ?? [];
    arr.push(v);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
