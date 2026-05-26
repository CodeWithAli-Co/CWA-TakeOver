/**
 * DocDetailPage.tsx — Container for /workspace/docs/$id.
 *
 * Phase 4 responsibilities (in addition to title/visibility/delete UX):
 *   1. Construct a Y.Doc the first time we mount for this doc id.
 *   2. Bootstrap that Y.Doc from either:
 *        a) the saved y_state (base64-encoded Y.Doc binary) if present, OR
 *        b) the saved TipTap JSON via prosemirrorJSONToYDoc otherwise.
 *      The y_state path is preferred — it preserves collab history so
 *      two reconnecting clients don't end up duplicating content.
 *   3. Create a SupabaseYProvider that ferries Y.Doc + Awareness
 *      updates over a Supabase Realtime channel keyed by the doc id.
 *   4. Push the current operator's name + cursor color onto Awareness
 *      so peers see who's editing.
 *   5. Run a debounced save that serializes BOTH the TipTap JSON
 *      (for list/search/non-collab readers) AND the Y.Doc binary
 *      (authoritative collab state) on every commit.
 *   6. Dispose the provider + clean up Y.Doc on unmount / id change.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Lock, Globe, Trash2, Loader2, Share2, MessageSquare,
} from "lucide-react";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";

import {
  useDocument,
  useUpdateDocument,
  useDeleteDocument,
  useCreateComment,
  useComments,
} from "@/stores/workspace";
import { ActiveUser } from "@/stores/query";
import { DocEditor } from "./DocEditor";
import { getBaseDocExtensions } from "./docSchema";
import { SupabaseYProvider, bytesToB64, b64ToBytes } from "@/lib/yjs/SupabaseYProvider";
import { makeRemoteUser } from "@/lib/yjs/awareness";
import { PresenceBar } from "./PresenceBar";
import { ShareDialog } from "./ShareDialog";
import { CommentsSidebar } from "./CommentsSidebar";
import "./workspace.css";
import "tippy.js/dist/tippy.css";

interface Props {
  id: string;
}

const SAVE_DEBOUNCE_MS = 1200;

export function DocDetailPage({ id }: Props) {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "Anonymous";

  const { data: doc, isLoading } = useDocument(id);
  const updateMut = useUpdateDocument();
  const deleteMut = useDeleteDocument();

  const [title, setTitle] = useState("");
  useEffect(() => {
    if (doc) setTitle(doc.title);
  }, [doc?.title, doc]);

  // ── Y.Doc + provider, recreated per `id` ──────────────────────
  // We use a state ref so the editor can re-mount cleanly when the
  // id changes (navigating between docs without unmounting the page).
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<SupabaseYProvider | null>(null);
  const hydratedRef = useRef<boolean>(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const createCommentMut = useCreateComment();
  const { data: commentsData = [] } = useComments("document", doc?.id ?? null);
  const openCommentCount = commentsData.filter(
    (c) => c.parent_id == null && c.status === "open",
  ).length;

  // Construct Y.Doc + provider once per doc id, after the document
  // record is loaded (so we have the saved state to bootstrap from).
  useEffect(() => {
    if (!doc) return;
    hydratedRef.current = false;
    const next = new Y.Doc();

    // Bootstrap path A: saved y_state exists → apply directly.
    if (doc.y_state) {
      try {
        Y.applyUpdate(next, b64ToBytes(doc.y_state));
        hydratedRef.current = true;
      } catch (e) {
        console.warn("[DocDetailPage] y_state apply failed, falling back to JSON:", e);
      }
    }

    // Bootstrap path B: no y_state, but we have TipTap JSON content.
    // Use prosemirrorJSONToYDoc with a schema built from the SAME
    // extension list the editor uses, so the doc shape lines up.
    if (!hydratedRef.current && doc.content?.content?.length) {
      try {
        const schema = getSchema(getBaseDocExtensions({ withHistory: true }) as any);
        const seeded = prosemirrorJSONToYDoc(schema, doc.content as any);
        Y.applyUpdate(next, Y.encodeStateAsUpdate(seeded));
        seeded.destroy();
        hydratedRef.current = true;
      } catch (e) {
        console.warn("[DocDetailPage] JSON bootstrap failed:", e);
      }
    }

    const newProvider = new SupabaseYProvider(next, `doc:${doc.id}`);
    newProvider.setUser(makeRemoteUser(username));

    setYdoc(next);
    setProvider(newProvider);

    return () => {
      newProvider.destroy();
      next.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  // ── Save loop ────────────────────────────────────────────────
  // Debounced after the last local change. Writes BOTH the TipTap
  // JSON (for non-collab consumers — landing list, future search) AND
  // the Y.Doc binary as base64 (authoritative for collaboration).
  const saveTimerRef = useRef<number | null>(null);
  const handleLocalChange = () => {
    if (!ydoc || !doc) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const json = yDocToProsemirrorJSON(ydoc);
        const yBytes = Y.encodeStateAsUpdate(ydoc);
        await updateMut.mutateAsync({
          id: doc.id,
          patch: { content: json, y_state: bytesToB64(yBytes) } as any,
          updatedBy: username,
        });
      } catch (e) {
        console.error("[DocDetailPage] save failed:", e);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  // ── Header actions ──────────────────────────────────────────
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

  // ── Loading / error states ──────────────────────────────────
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
          {provider && <PresenceBar provider={provider} self={username} />}
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 px-2 h-7 rounded-sm text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
              (commentsOpen
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                : "bg-muted/40 border border-border text-foreground/65 hover:text-foreground")
            }
            title={commentsOpen ? "Hide comments" : "Show comments"}
          >
            <MessageSquare size={11} />
            {openCommentCount > 0 ? openCommentCount : "Comments"}
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
      <main className="flex-1 flex min-h-0">
        <div
          className={
            "flex-1 flex flex-col min-h-0 transition-all " +
            (commentsOpen ? "" : "")
          }
        >
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

            {ydoc && provider && (
              <DocEditor
                key={doc.id}
                ydoc={ydoc}
                provider={provider}
                user={makeRemoteUser(username)}
                onLocalChange={handleLocalChange}
                onAddComment={async (selectedText, applyMark) => {
                  const created = await createCommentMut.mutateAsync({
                    kind: "document",
                    resourceId: doc.id,
                    author: username,
                    body: "",
                    anchor: { kind: "doc-mark", selected_text: selectedText } as any,
                  });
                  applyMark(created.id);
                  setCommentsOpen(true);
                  setFocusedCommentId(created.id);
                }}
                onFocusComment={(id) => {
                  setCommentsOpen(true);
                  setFocusedCommentId(id);
                }}
              />
            )}
          </div>
        </div>

        {commentsOpen && (
          <CommentsSidebar
            kind="document"
            resourceId={doc.id}
            currentUsername={username}
            focusedCommentId={focusedCommentId}
            onFocusComment={setFocusedCommentId}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </main>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        kind="document"
        resourceId={doc.id}
        resourceTitle={doc.title}
        owner={doc.owner}
        currentUsername={username}
        visibility={doc.visibility}
      />
    </div>
  );
}
