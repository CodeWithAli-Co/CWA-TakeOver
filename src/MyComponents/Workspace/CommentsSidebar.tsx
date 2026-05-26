/**
 * CommentsSidebar.tsx — Right-rail thread list for the document editor.
 *
 * Renders one card per root comment, plus its replies as a stacked list
 * inside the card. Each card has:
 *   · author + relative timestamp
 *   · body
 *   · quoted text the comment was anchored to (when available)
 *   · reply composer (inline, expands on click)
 *   · resolve toggle (any user can resolve; only author can delete)
 *
 * Two filters at the top: Open / Resolved / All.
 *
 * Data flow:
 *   useComments() returns ALL comments + replies as a flat list. We
 *   group them by parent_id == null in-memory; replies are looked up
 *   per root by their parent_id.
 *
 * Selection sync:
 *   When the user clicks a card, we emit `onFocus(commentId)` upward.
 *   The doc editor uses that to scroll the matching mark into view.
 *   When the user makes a new comment via the bubble menu, the parent
 *   passes `pendingCommentId` and we open that thread's composer.
 */

import { useMemo, useState } from "react";
import {
  MessageSquare, CheckCircle2, Send, Trash2, X, Loader2,
  ChevronDown, ChevronRight, Filter,
} from "lucide-react";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/stores/workspace";
import type {
  WorkspaceComment,
  WorkspaceResourceKind,
} from "@/stores/workspaceTypes";
import { colorForUser } from "@/lib/yjs/awareness";

interface Props {
  kind: WorkspaceResourceKind;
  resourceId: string;
  currentUsername: string;
  /** Comment id the user just clicked in the doc — highlight + scroll into view. */
  focusedCommentId?: string | null;
  onFocusComment: (commentId: string | null) => void;
  onClose: () => void;
}

type Filter = "open" | "resolved" | "all";

export function CommentsSidebar({
  kind, resourceId, currentUsername, focusedCommentId, onFocusComment, onClose,
}: Props) {
  const { data: comments = [], isLoading } = useComments(kind, resourceId);
  const createMut = useCreateComment();
  const updateMut = useUpdateComment();
  const deleteMut = useDeleteComment();

  const [filter, setFilter] = useState<Filter>("open");

  const { roots, repliesByParent } = useMemo(() => {
    const r: WorkspaceComment[] = [];
    const m = new Map<string, WorkspaceComment[]>();
    for (const c of comments) {
      if (c.parent_id == null) {
        r.push(c);
      } else {
        const arr = m.get(c.parent_id) ?? [];
        arr.push(c);
        m.set(c.parent_id, arr);
      }
    }
    return { roots: r, repliesByParent: m };
  }, [comments]);

  const visible = useMemo(() => {
    if (filter === "all") return roots;
    return roots.filter((r) => r.status === filter);
  }, [roots, filter]);

  const counts = useMemo(
    () => ({
      open: roots.filter((r) => r.status === "open").length,
      resolved: roots.filter((r) => r.status === "resolved").length,
      all: roots.length,
    }),
    [roots],
  );

  const handleToggleResolved = (c: WorkspaceComment) => {
    updateMut.mutate({
      id: c.id,
      kind: c.resource_type,
      resourceId: c.resource_id,
      status: c.status === "open" ? "resolved" : "open",
    });
  };

  const handleDelete = (c: WorkspaceComment) => {
    if (!window.confirm("Delete this comment and its replies?")) return;
    deleteMut.mutate({ id: c.id, kind: c.resource_type, resourceId: c.resource_id });
  };

  const handleReply = async (parent: WorkspaceComment, body: string) => {
    if (!body.trim()) return;
    await createMut.mutateAsync({
      kind: parent.resource_type,
      resourceId: parent.resource_id,
      author: currentUsername,
      body,
      parentId: parent.id,
    });
  };

  return (
    <aside className="w-[360px] max-w-[40vw] border-l border-border bg-background flex flex-col min-h-0 flex-shrink-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="rounded-sm bg-amber-500/10 border border-amber-500/30 p-1">
            <MessageSquare size={12} className="text-amber-300" />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.14em] uppercase text-foreground/40">
              Comments
            </div>
            <div className="text-[12.5px] font-semibold text-foreground">
              {counts.open} open
              {counts.resolved > 0 && (
                <span className="text-foreground/45 font-normal ml-1.5">
                  · {counts.resolved} resolved
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments"
          className="rounded-sm p-1 text-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X size={14} />
        </button>
      </header>

      {/* Filter strip */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/60 flex-shrink-0">
        <Filter size={11} className="text-foreground/35 mr-1" />
        <FilterPill label="Open" count={counts.open} active={filter === "open"} onClick={() => setFilter("open")} />
        <FilterPill label="Resolved" count={counts.resolved} active={filter === "resolved"} onClick={() => setFilter("resolved")} />
        <FilterPill label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 flex items-center justify-center text-foreground/40 text-[12px]">
            <Loader2 size={13} className="animate-spin mr-2" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="divide-y divide-border/40">
            {visible.map((root) => (
              <CommentThread
                key={root.id}
                root={root}
                replies={repliesByParent.get(root.id) ?? []}
                currentUsername={currentUsername}
                focused={focusedCommentId === root.id}
                onFocus={() => onFocusComment(root.id)}
                onToggleResolved={() => handleToggleResolved(root)}
                onDelete={() => handleDelete(root)}
                onReply={(body) => handleReply(root, body)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────
// One thread (root + replies)
// ──────────────────────────────────────────────────────────────────
function CommentThread({
  root, replies, currentUsername, focused, onFocus, onToggleResolved, onDelete, onReply,
}: {
  root: WorkspaceComment;
  replies: WorkspaceComment[];
  currentUsername: string;
  focused: boolean;
  onFocus: () => void;
  onToggleResolved: () => void;
  onDelete: () => void;
  onReply: (body: string) => Promise<void>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const quoted = (root.anchor as any)?.selected_text as string | undefined;

  const handleSendReply = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await onReply(draft);
      setDraft("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li
      onClick={onFocus}
      className={
        "px-4 py-3 cursor-pointer transition-colors " +
        (focused ? "bg-primary/[0.06]" : "hover:bg-muted/15")
      }
    >
      {/* Quoted anchor */}
      {quoted && (
        <div className="border-l-2 border-amber-500/40 pl-2 mb-2 text-[11px] text-foreground/55 italic leading-relaxed line-clamp-2">
          "{quoted}"
        </div>
      )}

      {/* Root comment */}
      <CommentRow
        comment={root}
        currentUsername={currentUsername}
        onDelete={onDelete}
      />

      {/* Replies */}
      {replies.length > 0 && (
        <ul className="mt-2 pl-3 border-l border-border/40 space-y-2">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentRow comment={r} currentUsername={currentUsername} />
            </li>
          ))}
        </ul>
      )}

      {/* Footer actions */}
      <div className="mt-2.5 flex items-center gap-2">
        {!replyOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReplyOpen(true);
            }}
            className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-foreground/55 hover:text-foreground transition-colors"
          >
            Reply
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolved();
          }}
          className={
            "inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] font-semibold transition-colors " +
            (root.status === "resolved"
              ? "text-emerald-300 hover:text-emerald-200"
              : "text-foreground/55 hover:text-foreground")
          }
        >
          <CheckCircle2 size={11} />
          {root.status === "resolved" ? "Reopen" : "Resolve"}
        </button>
      </div>

      {/* Reply composer */}
      {replyOpen && (
        <div
          className="mt-2.5 flex items-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply…"
            rows={2}
            autoFocus
            className="flex-1 px-2 py-1.5 rounded-sm bg-muted/30 border border-border text-[12px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendReply();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSendReply}
            disabled={!draft.trim() || submitting}
            aria-label="Send reply"
            className="inline-flex items-center justify-center h-8 w-8 rounded-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
          </button>
        </div>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// A single comment row (author, time, body, delete)
// ──────────────────────────────────────────────────────────────────
function CommentRow({
  comment,
  currentUsername,
  onDelete,
}: {
  comment: WorkspaceComment;
  currentUsername: string;
  onDelete?: () => void;
}) {
  const canDelete = onDelete && comment.author === currentUsername;
  return (
    <div className="flex items-start gap-2">
      <div
        className="h-6 w-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0 mt-0.5"
        style={{ backgroundColor: colorForUser(comment.author) }}
      >
        {comment.author.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold text-foreground">
            {comment.author}
          </span>
          <span className="text-[10px] text-foreground/40">
            {formatRelative(comment.created_at)}
          </span>
        </div>
        <p className="text-[12.5px] text-foreground/85 leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete!();
          }}
          aria-label="Delete comment"
          className="rounded-sm p-1 text-foreground/35 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Small UI helpers
// ──────────────────────────────────────────────────────────────────
function FilterPill({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 h-6 inline-flex items-center gap-1 rounded-sm text-[10.5px] font-bold uppercase tracking-wider transition-colors " +
        (active
          ? "bg-primary/[0.08] text-primary border border-primary/20"
          : "text-foreground/55 hover:text-foreground border border-transparent")
      }
    >
      {label}
      <span className="font-mono tabular-nums opacity-65">{count}</span>
    </button>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const map: Record<Filter, { title: string; body: string }> = {
    open: {
      title: "No open comments",
      body: "Select text in the doc and click \"Comment\" in the floating toolbar to start a thread.",
    },
    resolved: {
      title: "No resolved threads yet",
      body: "Resolved comments stay here as a record. They don't show up in the editor.",
    },
    all: {
      title: "No comments yet",
      body: "Select text in the doc and click \"Comment\" in the floating toolbar to start a thread.",
    },
  };
  const { title, body } = map[filter];
  return (
    <div className="p-6 text-center">
      <div className="h-10 w-10 rounded-sm bg-muted/30 border border-border mx-auto mb-3 flex items-center justify-center">
        <MessageSquare size={14} className="text-foreground/40" />
      </div>
      <p className="text-[12.5px] font-semibold text-foreground/80 mb-1">
        {title}
      </p>
      <p className="text-[11px] text-foreground/50 leading-relaxed max-w-[28ch] mx-auto">
        {body}
      </p>
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
