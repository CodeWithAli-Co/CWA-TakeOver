/**
 * DocDetailPage.tsx — Container for /workspace/docs/$id.
 *
 * Owns:
 *   · Document fetch + currentUsername wiring
 *   · Title input (commit-on-blur)
 *   · Visibility / archive / delete actions in the header
 *   · DocEditor child for the body
 *
 * Phase 1 — no comments, no collaborative cursors, no version history.
 * Those layers wire into this same component in later sessions.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Lock, Globe, Trash2, Loader2,
} from "lucide-react";
import {
  useDocument,
  useUpdateDocument,
  useDeleteDocument,
} from "@/stores/workspace";
import { ActiveUser } from "@/stores/query";
import { DocEditor } from "./DocEditor";
import "./workspace.css";
import "tippy.js/dist/tippy.css";

interface Props {
  id: string;
}

export function DocDetailPage({ id }: Props) {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";

  const { data: doc, isLoading } = useDocument(id);
  const updateMut = useUpdateDocument();
  const deleteMut = useDeleteDocument();

  const [title, setTitle] = useState("");
  useEffect(() => {
    if (doc) setTitle(doc.title);
  }, [doc?.title, doc]);

  const handleCommitTitle = async () => {
    if (!doc) return;
    if (title === doc.title) return;
    await updateMut.mutateAsync({
      id: doc.id,
      patch: { title: title.trim() || "Untitled" },
      updatedBy: username,
    });
  };

  const handleToggleVisibility = async () => {
    if (!doc) return;
    const next = doc.visibility === "private" ? "shared" : "private";
    await updateMut.mutateAsync({
      id: doc.id,
      patch: { visibility: next },
      updatedBy: username,
    });
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    await deleteMut.mutateAsync(doc.id);
    navigate({ to: "/workspace" });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-foreground/45 text-[13px]">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading document…
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-foreground/55 text-[13px]">
        Document not found.
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="mx-auto w-full max-w-[860px] px-6 h-12 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/workspace" })}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground/55 hover:text-foreground transition-colors"
            title="Back to workspace"
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
              (doc.visibility === "shared"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : "bg-muted/40 border border-border text-foreground/65 hover:text-foreground")
            }
            title="Toggle visibility"
          >
            {doc.visibility === "shared" ? (
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
            aria-label="Delete document"
            className="rounded-sm p-1.5 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* ── Title + body ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0">
        <div className="mx-auto w-full max-w-[860px] px-6 py-10 flex-1 flex flex-col min-h-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleCommitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Untitled"
            className="w-full bg-transparent text-[32px] font-bold text-foreground placeholder:text-foreground/30 outline-none border-0 focus:ring-0 leading-tight mb-6 flex-shrink-0"
          />

          <DocEditor
            content={doc.content}
            currentUsername={username}
            onSave={async (content) => {
              await updateMut.mutateAsync({
                id: doc.id,
                patch: { content },
                updatedBy: username,
              });
            }}
          />
        </div>
      </main>
    </div>
  );
}
