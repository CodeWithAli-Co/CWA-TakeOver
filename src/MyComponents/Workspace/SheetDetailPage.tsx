/**
 * SheetDetailPage.tsx — Container for /workspace/sheets/$id.
 *
 * Phase 1 stub. Spreadsheet rows can be created from the landing page
 * and renamed here; the actual Univer canvas integration is Session 3.
 *
 * The header + title + visibility / delete affordances are wired now
 * so the route works end-to-end and the doc/sheet UX feels symmetric.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Lock, Globe, Trash2, Loader2, Sheet, Sparkles,
} from "lucide-react";
import {
  useSpreadsheet,
  useUpdateSpreadsheet,
  useDeleteSpreadsheet,
} from "@/stores/workspace";
import { ActiveUser } from "@/stores/query";

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
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="mx-auto w-full max-w-[1200px] px-6 h-12 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/workspace" })}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground/55 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} /> Workspace
          </button>
          <div className="flex-1" />
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

      {/* ── Title ──────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleCommitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-[28px] font-bold text-foreground placeholder:text-foreground/30 outline-none border-0 focus:ring-0 leading-tight mb-2"
        />
        <div className="flex items-center gap-2 text-[11px] text-foreground/45">
          <Sheet size={11} className="text-emerald-400" />
          <span>Spreadsheet · last edited {formatRelative(sheet.updated_at)}</span>
        </div>
      </div>

      {/* ── Coming-soon canvas ─────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="rounded-sm border border-dashed border-border bg-card/40 px-10 py-14 text-center max-w-md">
          <div className="h-12 w-12 rounded-sm bg-emerald-500/10 border border-emerald-500/25 mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </div>
          <p className="text-[14.5px] font-semibold text-foreground mb-1">
            Spreadsheet canvas — coming next session
          </p>
          <p className="text-[12.5px] text-foreground/55 leading-relaxed max-w-[40ch] mx-auto">
            The sheet shell is wired up: you can create, rename, share, and
            delete spreadsheets. The cell grid (formulas, formatting, charts)
            lands in Session 3 once Univer is integrated.
          </p>
          <p className="text-[10.5px] text-foreground/35 uppercase tracking-[0.14em] mt-5 font-mono">
            ID · {sheet.id.slice(0, 8)}
          </p>
        </div>
      </main>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
