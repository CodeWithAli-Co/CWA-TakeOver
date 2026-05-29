/**
 * SheetDetailPage.tsx — Container for /workspace/sheets/$id.
 *
 * Mounts the Univer canvas (SheetEditor) inside the workspace chrome
 * (back button, title, visibility toggle, delete). The page layout is
 * full-height so Univer has the entire viewport below the header for
 * its grid + toolbar.
 *
 * Save model:
 *   · SheetEditor owns the change-detection loop (2s polling + diff)
 *   · onSave passes the snapshot up to useUpdateSpreadsheet
 *
 * Realtime: workspace.ts already subscribes via useWorkspaceRealtime,
 * which invalidates the spreadsheet query on change; for v1 that's a
 * no-op while the editor is open (we don't tear it down), but the
 * landing page card refreshes immediately when another user saves.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Lock, Globe, Trash2, Loader2, Share2, History,
} from "lucide-react";
import {
  useSpreadsheet,
  useUpdateSpreadsheet,
  useDeleteSpreadsheet,
  useHardDeleteSpreadsheet,
} from "@/stores/workspace";
import { ActiveUser } from "@/stores/query";
import { DeleteResourceDialog } from "./DeleteResourceDialog";
import { SheetEditor } from "./SheetEditor";
import { PresenceBar } from "./PresenceBar";
import { ShareDialog } from "./ShareDialog";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import "./workspace-sheet.css";

interface Props {
  id: string;
}

export function SheetDetailPage({ id }: Props) {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";

  const { data: sheet, isLoading } = useSpreadsheet(id);
  const updateMut = useUpdateSpreadsheet();
  const deleteMut = useDeleteSpreadsheet();
  const hardDeleteMut = useHardDeleteSpreadsheet();

  const [title, setTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // The Univer API doesn't have a stable React-friendly way to expose
  // the live snapshot through props, so we let SheetEditor stash a
  // getter we can call. (Same pattern Univer's own samples use.)
  const sheetSnapshotRef = useRef<() => Record<string, unknown>>(() => ({}));
  useEffect(() => {
    if (sheet) setTitle(sheet.title);
  }, [sheet?.title, sheet]);

  const handleCommitTitle = async () => {
    if (!sheet) return;
    if (title === sheet.title) return;
    await updateMut.mutateAsync({
      id: sheet.id,
      patch: { title: title.trim() || "Untitled" },
      updatedBy: username,
    });
  };

  const handleToggleVisibility = async () => {
    if (!sheet) return;
    const next = sheet.visibility === "private" ? "shared" : "private";
    await updateMut.mutateAsync({
      id: sheet.id,
      patch: { visibility: next },
      updatedBy: username,
    });
  };

  // Soft + hard delete handlers — invoked from DeleteResourceDialog.
  const handleArchive = async () => {
    if (!sheet) return;
    await deleteMut.mutateAsync(sheet.id);
    navigate({ to: "/workspace" });
  };
  const handleHardDelete = async () => {
    if (!sheet) return;
    await hardDeleteMut.mutateAsync(sheet.id);
    navigate({ to: "/workspace" });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-foreground/45 text-[13px]">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading spreadsheet…
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-foreground/55 text-[13px]">
        Spreadsheet not found.
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-background flex-shrink-0">
        <div className="mx-auto w-full max-w-[1600px] px-6 h-12 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/workspace" })}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground/55 hover:text-foreground transition-colors"
            title="Back to workspace"
          >
            <ArrowLeft size={13} /> Workspace
          </button>
          <span className="text-foreground/25 text-[11px]">·</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleCommitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Untitled spreadsheet"
            className="flex-1 max-w-[420px] bg-transparent text-[14px] font-bold text-foreground placeholder:text-foreground/30 outline-none border-0 focus:ring-0"
          />
          <div className="flex-1" />
          <PresenceBar channelName={`sheet:${sheet.id}`} self={username} />
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 px-2 h-7 rounded-sm text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
              (historyOpen
                ? "bg-sky-500/10 border border-sky-500/30 text-sky-300"
                : "bg-muted/40 border border-border text-foreground/65 hover:text-foreground")
            }
            title={historyOpen ? "Hide history" : "Show history"}
          >
            <History size={11} />
            History
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 px-2 h-7 rounded-sm bg-primary text-primary-foreground text-[10.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            title="Share"
          >
            <Share2 size={11} /> Share
          </button>
          <button
            type="button"
            onClick={handleToggleVisibility}
            disabled={updateMut.isPending}
            className={
              "inline-flex items-center gap-1.5 px-2 h-7 rounded-sm text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
              (sheet.visibility === "shared"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : "bg-muted/40 border border-border text-foreground/65 hover:text-foreground")
            }
          >
            {sheet.visibility === "shared" ? (
              <>
                <Globe size={11} /> Shared
              </>
            ) : (
              <>
                <Lock size={11} /> Private
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMut.isPending || hardDeleteMut.isPending}
            aria-label="Archive or delete spreadsheet"
            title="Archive spreadsheet"
            className="rounded-sm p-1.5 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* ── Univer canvas ──────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-h-0 overflow-hidden">
          <SheetEditor
            snapshot={(sheet.snapshot ?? {}) as Record<string, unknown>}
            onSave={async (next) => {
              sheetSnapshotRef.current = () => next;
              await updateMut.mutateAsync({
                id: sheet.id,
                patch: { snapshot: next as any },
                updatedBy: username,
              });
            }}
          />
        </div>

        {historyOpen && (
          <VersionHistoryPanel
            kind="spreadsheet"
            resourceId={sheet.id}
            currentUsername={username}
            getCurrentSnapshot={() => sheetSnapshotRef.current()}
            onAfterRestore={() => setHistoryOpen(false)}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </main>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        kind="spreadsheet"
        resourceId={sheet.id}
        resourceTitle={sheet.title}
        owner={sheet.owner}
        currentUsername={username}
        visibility={sheet.visibility}
      />

      {/* Archive / hard-delete confirm dialog. Same component the
       *  doc detail page uses; pass the matching mutations. */}
      <DeleteResourceDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        kind="spreadsheet"
        title={sheet.title}
        onArchive={handleArchive}
        onHardDelete={handleHardDelete}
      />
    </div>
  );
}
