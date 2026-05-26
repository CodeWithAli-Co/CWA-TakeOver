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

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Lock, Globe, Trash2, Loader2,
} from "lucide-react";
import {
  useSpreadsheet,
  useUpdateSpreadsheet,
  useDeleteSpreadsheet,
} from "@/stores/workspace";
import { ActiveUser } from "@/stores/query";
import { SheetEditor } from "./SheetEditor";
import { PresenceBar } from "./PresenceBar";
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

  const [title, setTitle] = useState("");
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

  const handleDelete = async () => {
    if (!sheet) return;
    if (!window.confirm("Delete this spreadsheet? This cannot be undone.")) return;
    await deleteMut.mutateAsync(sheet.id);
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
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            aria-label="Delete spreadsheet"
            className="rounded-sm p-1.5 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* ── Univer canvas ──────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <SheetEditor
          snapshot={(sheet.snapshot ?? {}) as Record<string, unknown>}
          onSave={async (next) => {
            await updateMut.mutateAsync({
              id: sheet.id,
              patch: { snapshot: next as any },
              updatedBy: username,
            });
          }}
        />
      </main>
    </div>
  );
}
