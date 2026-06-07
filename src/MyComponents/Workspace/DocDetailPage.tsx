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
  ArrowLeft, Lock, Globe, Trash2, Loader2, Share2, MessageSquare, History,
  Plus, Pencil, X, BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";

import {
  useDocument,
  useUpdateDocument,
  useDeleteDocument,
  useHardDeleteDocument,
  useCreateComment,
  useComments,
  useUpdateDocTabs,
} from "@/stores/workspace";
import type { WorkspaceDocTab } from "@/stores/workspaceTypes";
import { ActiveUser } from "@/stores/query";
import { DocEditor } from "./DocEditor";
import { getBaseDocExtensions } from "./docSchema";
import { SupabaseYProvider, bytesToB64, b64ToBytes } from "@/lib/yjs/SupabaseYProvider";
import { makeRemoteUser } from "@/lib/yjs/awareness";
import { PresenceBar } from "./PresenceBar";
import { ShareDialog } from "./ShareDialog";
import { CommentsSidebar } from "./CommentsSidebar";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { MarkdownHelpPalette } from "./MarkdownHelpPalette";
import { useMarkdownHelp } from "./markdownHelpStore";
import { DeleteResourceDialog } from "./DeleteResourceDialog";
import { CommentDraftDialog } from "./CommentDraftDialog";
import { extractDocText } from "./searchHelpers";
import "./workspace.css";

/**
 * How many chars of plain text we store as the body preview on every
 * save. Read by the workspace landing page card grid. ~180 fits ~3
 * lines of card text comfortably without overflowing the line-clamp.
 */
const BODY_PREVIEW_MAX_CHARS = 180;
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
  const hardDeleteMut = useHardDeleteDocument();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Pending comment draft state. The bubble menu's "Comment" action
  // doesn't create a row anymore — it stashes the selected text +
  // applyMark callback here and opens the CommentDraftDialog. The
  // dialog's submit handler creates the row WITH the body already
  // filled in, then applies the mark. Closes the previous footgun
  // where users couldn't add their first message until after the
  // empty thread was committed.
  const [pendingComment, setPendingComment] = useState<{
    selectedText: string;
    applyMark: (commentId: string) => void;
  } | null>(null);

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const createCommentMut = useCreateComment();
  const updateTabsMut = useUpdateDocTabs();

  // ── Markdown cheatsheet palette (Cmd+/) ──────────────────────
  const openMarkdownHelp = useMarkdownHelp((s) => s.openPalette);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        openMarkdownHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMarkdownHelp]);

  // ── Doc tabs (multi-page within one document) ────────────────
  // Persisted in workspace_documents.tabs as a JSONB array. Empty
  // array = single-tab / legacy mode using the 'default' Y.js
  // fragment. As soon as the user creates a tab we promote the doc
  // to multi-tab mode and back-mark the legacy content as "Page 1"
  // (still bound to 'default' for content preservation).
  const tabs: WorkspaceDocTab[] = doc?.tabs ?? [];
  const hasTabs = tabs.length > 0;
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [pendingDeleteTabId, setPendingDeleteTabId] = useState<string | null>(null);

  // Ensure activeTabId is always either null (single-tab mode) or a
  // valid tab id from the current tabs list.
  useEffect(() => {
    if (!hasTabs) {
      setActiveTabId(null);
      return;
    }
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [hasTabs, tabs, activeTabId]);

  /** Y.js fragment the editor binds to. 'default' for single-tab
   *  and legacy docs; 'tab:<id>' for the active tab in multi-tab mode. */
  const activeField = useMemo(() => {
    if (!hasTabs || !activeTabId) return "default";
    return tabs.find((t) => t.id === activeTabId)?.field ?? "default";
  }, [hasTabs, activeTabId, tabs]);

  // ── Tab CRUD ──
  const handleAddTab = async () => {
    if (!doc) return;
    const newId = crypto.randomUUID();
    let next: WorkspaceDocTab[];
    if (tabs.length === 0) {
      // Promote: the existing doc becomes "Page 1" (still using the
      // 'default' fragment so its content survives), and we add a
      // fresh "Page 2" using a new fragment.
      next = [
        { id: crypto.randomUUID(), title: "Page 1", icon: null, position: 1, field: "default" },
        { id: newId, title: "Page 2", icon: null, position: 2, field: `tab:${newId}` },
      ];
    } else {
      next = [
        ...tabs,
        {
          id: newId,
          title: `Page ${tabs.length + 1}`,
          icon: null,
          position: (tabs[tabs.length - 1]?.position ?? tabs.length) + 1,
          field: `tab:${newId}`,
        },
      ];
    }
    await updateTabsMut.mutateAsync({ id: doc.id, tabs: next });
    setActiveTabId(newId);
  };

  const handleCommitTabRename = async (tabId: string, title: string) => {
    if (!doc) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setRenamingTabId(null);
      return;
    }
    const next = tabs.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t));
    await updateTabsMut.mutateAsync({ id: doc.id, tabs: next });
    setRenamingTabId(null);
  };

  const handleCommitTabDelete = async () => {
    if (!doc || !pendingDeleteTabId) return;
    // Don't allow deleting the last tab — that'd leave the doc in a
    // weird state. Just collapse back to single-tab mode by emptying
    // tabs[] (the 'default' fragment content survives because it was
    // never moved).
    let next: WorkspaceDocTab[];
    if (tabs.length <= 1) {
      next = [];
    } else {
      next = tabs.filter((t) => t.id !== pendingDeleteTabId);
    }
    await updateTabsMut.mutateAsync({ id: doc.id, tabs: next });
    if (activeTabId === pendingDeleteTabId) {
      setActiveTabId(next[0]?.id ?? null);
    }
    setPendingDeleteTabId(null);
  };
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
    //
    // CRITICAL: the third arg to prosemirrorJSONToYDoc is the Y.Doc
    // fragment name. It defaults to "prosemirror", but our DocEditor
    // binds to "default" (or `tab:<id>` for multi-tab docs). Without
    // passing "default" the seeded content lands in the wrong fragment
    // and the editor renders empty — manifested as "AXON wrote a doc
    // but the body is blank when I open it."
    if (!hydratedRef.current && doc.content?.content?.length) {
      try {
        const schema = getSchema(getBaseDocExtensions({ withHistory: true }) as any);
        const seeded = prosemirrorJSONToYDoc(schema, doc.content as any, "default");
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
        // Cheap plain-text extract for the landing page card preview.
        // Trimming here means the landing query never has to load the
        // full content JSON to render a snippet -- big win when there
        // are 30+ docs in the workspace.
        const bodyPreview =
          extractDocText(json as any).slice(0, BODY_PREVIEW_MAX_CHARS) ||
          null;
        await updateMut.mutateAsync({
          id: doc.id,
          patch: {
            content: json,
            y_state: bytesToB64(yBytes),
            body_preview: bodyPreview,
          } as any,
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

  // Soft + hard delete now happen inside DeleteResourceDialog. The
  // trash button just opens the dialog; the dialog runs the chosen
  // mutation and then we navigate back. Kept as a single handler
  // that closes the dialog and bounces back to the workspace.
  const handleArchive = async () => {
    if (!doc) return;
    await deleteMut.mutateAsync(doc.id);
    navigate({ to: "/workspace" });
  };
  const handleHardDelete = async () => {
    if (!doc) return;
    await hardDeleteMut.mutateAsync(doc.id);
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
            onClick={openMarkdownHelp}
            className="inline-flex items-center gap-1.5 px-2 h-7 rounded-sm text-[10.5px] font-semibold uppercase tracking-wider bg-muted/40 border border-border text-foreground/65 hover:text-foreground transition-colors"
            title="Markdown cheatsheet (Cmd+/)"
          >
            <BookOpen size={11} />
            Markdown
          </button>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen((v) => !v);
              if (!historyOpen) setCommentsOpen(false);
            }}
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
            onClick={() => {
              setCommentsOpen((v) => !v);
              if (!commentsOpen) setHistoryOpen(false);
            }}
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
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMut.isPending || hardDeleteMut.isPending}
            aria-label="Archive or delete document"
            title="Archive document"
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

            {/* ── Tab bar (only when this doc has been promoted to
                    multi-tab mode). Single-tab docs show a tiny "+ Add tab"
                    button instead so users can opt in.  ──────────────── */}
            <DocTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              renamingTabId={renamingTabId}
              pendingDeleteTabId={pendingDeleteTabId}
              onSelect={setActiveTabId}
              onAddTab={handleAddTab}
              onBeginRename={(id) => {
                setRenamingTabId(id);
                setPendingDeleteTabId(null);
              }}
              onCommitRename={handleCommitTabRename}
              onCancelRename={() => setRenamingTabId(null)}
              onBeginDelete={(id) => {
                setPendingDeleteTabId(id);
                setRenamingTabId(null);
              }}
              onCommitDelete={handleCommitTabDelete}
              onCancelDelete={() => setPendingDeleteTabId(null)}
            />

            {ydoc && provider && (
              <DocEditor
                // Key includes the active tab so the editor remounts on
                // tab switch — clean fragment binding, no save/restore.
                key={`${doc.id}:${activeField}`}
                ydoc={ydoc}
                provider={provider}
                user={makeRemoteUser(username)}
                field={activeField}
                onLocalChange={handleLocalChange}
                onAddComment={(selectedText, applyMark) => {
                  // Defer creation — open the draft dialog and let
                  // the user write the first message. The row is
                  // created on submit, not here. See pendingComment
                  // state + the <CommentDraftDialog /> below.
                  setPendingComment({ selectedText, applyMark });
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

        {historyOpen && (
          <VersionHistoryPanel
            kind="document"
            resourceId={doc.id}
            currentUsername={username}
            getCurrentSnapshot={() => {
              if (!ydoc) return doc.content;
              return yDocToProsemirrorJSON(ydoc);
            }}
            onAfterRestore={() => setHistoryOpen(false)}
            onClose={() => setHistoryOpen(false)}
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

      {/* Markdown cheatsheet — opens via the Markdown button in the
       *  header or Cmd+/ anywhere on the page. Renders only when
       *  its zustand store has open=true. */}
      <MarkdownHelpPalette />

      {/* Delete / archive confirm dialog. Default action archives
       *  (sets archived=true). C-level operators see an additional
       *  "Delete permanently" option that bypasses the archive and
       *  destroys the row. Replaces the previous window.confirm. */}
      <DeleteResourceDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        kind="document"
        title={doc.title}
        onArchive={handleArchive}
        onHardDelete={handleHardDelete}
      />

      {/* New comment composer — opens when the bubble menu "Comment"
       *  action fires. The thread row isn't created until the user
       *  submits their first message; cancelling discards everything
       *  including the mark application. */}
      <CommentDraftDialog
        open={!!pendingComment}
        selectedText={pendingComment?.selectedText ?? ""}
        onCancel={() => setPendingComment(null)}
        onSubmit={async (body) => {
          if (!pendingComment) return;
          const created = await createCommentMut.mutateAsync({
            kind: "document",
            resourceId: doc.id,
            author: username,
            body,
            anchor: {
              kind: "doc-mark",
              selected_text: pendingComment.selectedText,
            } as any,
          });
          pendingComment.applyMark(created.id);
          setCommentsOpen(true);
          setFocusedCommentId(created.id);
          setPendingComment(null);
        }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// DocTabBar — Google-Docs-style tab strip above the editor.
//
//   · When `tabs` is empty the bar collapses to a single "+ Add tab"
//     pill. The first click promotes the doc to multi-tab mode.
//   · Each tab supports click-to-switch, hover-reveal rename/delete,
//     inline rename input, and inline red delete confirm.
//   · Active tab gets a Framer-Motion `layoutId` underline that
//     animates between tabs on switch.
// ═════════════════════════════════════════════════════════════════
function DocTabBar({
  tabs,
  activeTabId,
  renamingTabId,
  pendingDeleteTabId,
  onSelect,
  onAddTab,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onBeginDelete,
  onCommitDelete,
  onCancelDelete,
}: {
  tabs: WorkspaceDocTab[];
  activeTabId: string | null;
  renamingTabId: string | null;
  pendingDeleteTabId: string | null;
  onSelect: (id: string) => void;
  onAddTab: () => void;
  onBeginRename: (id: string) => void;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onBeginDelete: (id: string) => void;
  onCommitDelete: () => void;
  onCancelDelete: () => void;
}) {
  // Empty state: tiny inline button. Doesn't dominate the layout.
  if (tabs.length === 0) {
    return (
      <div className="flex items-center mb-4">
        <button
          type="button"
          onClick={onAddTab}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm text-[11px] font-semibold uppercase tracking-wider text-foreground/45 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Split this document into multiple tabs"
        >
          <Plus size={11} />
          Add tab
        </button>
      </div>
    );
  }

  const sorted = [...tabs].sort((a, b) => a.position - b.position);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 border-b border-border/60">
        {sorted.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isRenaming = tab.id === renamingTabId;
          return (
            <div
              key={tab.id}
              className={
                "relative group flex items-center gap-1 px-3 h-9 cursor-pointer transition-colors " +
                (isActive
                  ? "text-foreground"
                  : "text-foreground/45 hover:text-foreground/70")
              }
              onClick={() => !isRenaming && onSelect(tab.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onBeginRename(tab.id);
              }}
            >
              {tab.icon && (
                <span className="text-[13px] leading-none">{tab.icon}</span>
              )}
              {isRenaming ? (
                <TabInlineRename
                  initial={tab.title}
                  onCommit={(name) => onCommitRename(tab.id, name)}
                  onCancel={onCancelRename}
                />
              ) : (
                <span className="text-[12px] font-bold uppercase tracking-wider whitespace-nowrap">
                  {tab.title}
                </span>
              )}

              {!isRenaming && (
                <div
                  className="hidden group-hover:flex items-center gap-0.5 ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onBeginRename(tab.id)}
                    title="Rename"
                    className="p-0.5 text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <Pencil size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBeginDelete(tab.id)}
                    title="Delete tab"
                    className="p-0.5 text-foreground/40 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              {isActive && (
                <motion.span
                  layoutId="doc-tab-underline"
                  className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
            </div>
          );
        })}

        {/* Add-tab pill at the end of the strip */}
        <button
          type="button"
          onClick={onAddTab}
          className="inline-flex items-center gap-1 px-2.5 h-9 text-[11px] font-semibold uppercase tracking-wider text-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="New tab"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Inline delete-confirm row directly below the bar */}
      {pendingDeleteTabId && (
        <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-sm bg-red-500/[0.08] border border-red-500/30">
          <X size={11} className="text-red-300 shrink-0" />
          <span className="flex-1 text-[11.5px] text-foreground/85">
            Delete tab "
            {sorted.find((t) => t.id === pendingDeleteTabId)?.title ?? "?"}
            "? Its content is removed from the document.
          </span>
          <button
            type="button"
            onClick={onCommitDelete}
            className="px-2 h-6 rounded-sm bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[11px] font-bold uppercase tracking-wider transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="px-2 h-6 rounded-sm text-foreground/55 hover:text-foreground hover:bg-muted text-[11px] font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function TabInlineRename({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (value.trim()) onCommit(value);
        else onCancel();
      }}
      className="bg-background border border-primary/40 rounded-sm px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider text-foreground outline-none focus:border-primary/60 min-w-[80px]"
    />
  );
}
