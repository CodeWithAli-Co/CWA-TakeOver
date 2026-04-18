/**
 * MessageBubble.tsx — Single message rendering.
 *
 * Layout:
 *   [Avatar 36px]  [Name · time · pinned?]
 *                  [Optional reply quote]
 *                  [Message text]
 *                  [Image gallery]
 *                  [Reaction pills]
 *                  [Thread chip · N replies]
 *                  [Read receipts]
 *                                     [Hover actions — absolute top-right]
 *
 * Grouped mode (consecutive msgs from same user within 5 min):
 *   hides avatar + name + time; avatar slot becomes timestamp on hover.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Smile, Reply, MoreVertical, CheckCheck, Pin, PinOff, MessagesSquare,
  Pencil, Trash2, Copy, Check,
} from "lucide-react";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { ReactionPicker } from "./ReactionPicker";
import { MessageText } from "./MessageText";
import { MessageInterface } from "@/stores/query";
import { formatDistanceToNow, isValid, format } from "date-fns";

interface Props {
  msg: MessageInterface;
  prevMsg?: MessageInterface;
  currentUsername: string;
  onReact: (msgId: number, emoji: string) => void;
  onReply: (msg: MessageInterface) => void;
  onJumpTo?: (msgId: number) => void;
  /** Open the thread rooted at this message. */
  onOpenThread?: (msg: MessageInterface) => void;
  /** Toggle pinned state. */
  onTogglePin?: (msg: MessageInterface) => void;
  /** Admin-only gating for pin control. */
  canPin?: boolean;
  /** Count of replies to display as a chip. Computed by parent. */
  threadReplyCount?: number;
  /** Edit the message body (called with the new plain text). */
  onEdit?: (msg: MessageInterface, nextText: string) => Promise<void> | void;
  /** Delete / tombstone the message. */
  onDelete?: (msg: MessageInterface) => Promise<void> | void;
  allMessages: MessageInterface[];
}

const formatRelative = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch { return ""; }
};

const formatExactTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "";
    return format(date, "h:mm a");
  } catch { return ""; }
};

/** Extract image URLs embedded in the message body. Used when image_urls
 *  column isn't populated (migration not run yet or old message). */
const IMG_URL_RE = /https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?/gi;
function extractImageUrls(text: string): { cleanText: string; urls: string[] } {
  const urls: string[] = [];
  const cleanText = text.replace(IMG_URL_RE, (match) => {
    urls.push(match);
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, urls };
}

/** Extract non-image attachment URLs uploaded to the `chat-images` bucket.
 *  Identified by the storage path pattern, not by extension. */
const FILE_URL_RE =
  /https?:\/\/[^\s]*storage\/v1\/object\/public\/chat-images\/[^\s]+/gi;
function extractFileAttachments(
  text: string,
): {
  cleanText: string;
  files: { url: string; name: string }[];
} {
  const files: { url: string; name: string }[] = [];
  const cleanText = text.replace(FILE_URL_RE, (match) => {
    // Images have already been removed by extractImageUrls; any remaining
    // chat-images URL is a non-image file attachment.
    if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(match)) {
      return match; // leave image URLs alone (shouldn't happen but defensive)
    }
    // Reconstruct an approximate filename from the last path segment.
    const slug = decodeURIComponent(match.split("/").pop() || "attachment");
    // Our upload naming is `{group}/{user}-{ts}-{rnd}-{origName}`.
    const parts = slug.split("-");
    const recovered = parts.length > 3 ? parts.slice(3).join("-") : slug;
    files.push({ url: match, name: recovered });
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, files };
}

function attachmentIcon(name: string): string {
  const ext = (name.split(".").pop() || "FILE").toUpperCase();
  return ext.slice(0, 4);
}

function humanSizeFromUrl(_url: string): string {
  // We don't have size info post-upload without a HEAD request. Keep blank.
  return "";
}

/** Parse a reply marker embedded in the message body. The composer
 *  prepends `{reply:<id>|<sender>}` so the quote renders even when the
 *  `reply_to` DB column doesn't exist. */
const REPLY_MARKER_RE = /^\{reply:(\d+)\|([^}]+)\}\s*\n?/;
function extractReplyMarker(
  text: string,
): { cleanText: string; replyId: number | null; replySender: string | null } {
  const match = text.match(REPLY_MARKER_RE);
  if (!match) return { cleanText: text, replyId: null, replySender: null };
  return {
    cleanText: text.replace(REPLY_MARKER_RE, "").trimStart(),
    replyId: Number(match[1]),
    replySender: match[2]!,
  };
}

/** Reactions marker — stored at the top of the message body when the
 *  `reactions` DB column doesn't exist. Format:
 *  `{rx:<emoji>=<user1>,<user2>;<emoji>=<user>}` on its own line.
 *  Encoded values are comma-separated usernames per emoji. */
export const REACTIONS_MARKER_RE = /^\{rx:([^}]*)\}\s*\n?/;

export function parseReactionsMarker(text: string): Record<string, string[]> {
  const match = text.match(REACTIONS_MARKER_RE);
  if (!match) return {};
  const body = match[1] ?? "";
  const out: Record<string, string[]> = {};
  for (const chunk of body.split(";")) {
    const piece = chunk.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    if (eq < 0) continue;
    const emoji = piece.slice(0, eq).trim();
    const users = piece.slice(eq + 1).split(",").map((u) => u.trim()).filter(Boolean);
    if (emoji) out[emoji] = users;
  }
  return out;
}

export function stripReactionsMarker(text: string): string {
  return text.replace(REACTIONS_MARKER_RE, "").trimStart();
}

export function encodeReactionsMarker(
  reactions: Record<string, string[]>,
): string {
  const parts: string[] = [];
  for (const [emoji, users] of Object.entries(reactions)) {
    if (!users || users.length === 0) continue;
    parts.push(`${emoji}=${users.join(",")}`);
  }
  if (parts.length === 0) return "";
  return `{rx:${parts.join(";")}}\n`;
}

export const MessageBubble: React.FC<Props> = ({
  msg, prevMsg, currentUsername,
  onReact, onReply, onJumpTo,
  onOpenThread, onTogglePin, canPin = false,
  threadReplyCount,
  onEdit, onDelete,
  allMessages,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const isOwn = msg.sent_by === currentUsername;

  const isDeleted = (msg.message || "").trim() === "[message deleted]";

  const isGrouped = !!prevMsg
    && prevMsg.sent_by === msg.sent_by
    && msg.created_at && prevMsg.created_at
    && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;

  const handleReactClick = (emoji: string) => {
    onReact(msg.msg_id, emoji);
    setShowPicker(false);
  };

  const startEdit = () => {
    // Use the cleaned body (no markers) as the edit seed so users don't see
    // the {reply:...} prefix.
    const stripped = stripReactionsMarker(msg.message || "");
    const withoutReply = stripped.replace(/^\{reply:\d+\|[^}]+\}\s*\n?/, "");
    setEditText(withoutReply);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!onEdit) { setIsEditing(false); return; }
    const next = editText.trim();
    if (!next) { setIsEditing(false); return; }
    setEditing(true);
    try {
      await onEdit(msg, next);
      setIsEditing(false);
    } finally {
      setEditing(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText("");
  };

  const doDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Delete this message?")) return;
    await onDelete(msg);
  };

  const copyText = async () => {
    try {
      const stripped = stripReactionsMarker(msg.message || "")
        .replace(/^\{reply:\d+\|[^}]+\}\s*\n?/, "")
        .trim();
      await navigator.clipboard.writeText(stripped);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };

  const readBy = (msg.read_by || []).filter((u) => u !== msg.sent_by);
  const isPinned = !!msg.pinned_at;

  // Strip embedded markers before rendering. The composer prepends reply
  // + reactions markers + appends image URLs so each survives even when
  // the corresponding DB column doesn't exist.
  let displayText: string = msg.message ?? "";
  let images: string[] = msg.image_urls ?? [];
  let files: { url: string; name: string }[] = [];
  let parsedReplyId: number | null = null;
  let parsedReplySender: string | null = null;
  let parsedReactions: Record<string, string[]> = {};

  if (displayText) {
    // reactions first (they're always at the top if present)
    parsedReactions = parseReactionsMarker(displayText);
    displayText = stripReactionsMarker(displayText);

    const r = extractReplyMarker(displayText);
    displayText = r.cleanText;
    parsedReplyId = r.replyId;
    parsedReplySender = r.replySender;
  }
  if (images.length === 0 && displayText) {
    const extracted = extractImageUrls(displayText);
    if (extracted.urls.length > 0) {
      images = extracted.urls;
      displayText = extracted.cleanText;
    }
  }
  // Non-image file attachments that were stored to chat-images too.
  if (displayText) {
    const fExtracted = extractFileAttachments(displayText);
    if (fExtracted.files.length > 0) {
      files = fExtracted.files;
      displayText = fExtracted.cleanText;
    }
  }

  // Effective reactions: prefer DB column; fall back to parsed marker.
  const reactions: Record<string, string[]> =
    msg.reactions && Object.keys(msg.reactions).length > 0
      ? msg.reactions
      : parsedReactions;
  const reactionEntries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0,
  );

  // Resolve the replied-to target. Prefer DB column; fall back to the
  // parsed marker. When the target message isn't in the currently-loaded
  // window, use the marker's sender label so the quote still renders.
  const effectiveReplyId = msg.reply_to ?? parsedReplyId;
  const replyTarget = effectiveReplyId
    ? allMessages.find((m) => m.msg_id === effectiveReplyId) ?? null
    : null;
  const replyFallbackSender = replyTarget ? null : parsedReplySender;

  return (
    <div
      className={`group relative flex gap-3 px-5 hover:bg-card transition-colors ${
        isGrouped ? "py-0.5" : "pt-3 pb-1 mt-1"
      } ${isPinned ? "bg-primary/[0.03]" : ""}`}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0 flex items-start justify-center pt-0.5">
        {!isGrouped ? (
          <Avatar className="h-9 w-9 rounded-sm border border-border">
            <AvatarImage
              src={`https://tqaytmvihogvhhvwgbwm.supabase.co/storage/v1/object/public/avatars//${msg.userAvatar}`}
            />
            <AvatarFallback className="bg-muted/50 text-muted-foreground/70 text-[10px] rounded-sm font-medium">
              {msg.sent_by?.slice(0, 2)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[9px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity pt-1 font-medium tabular-nums">
            {formatExactTime(msg.created_at)}
          </span>
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[13px] font-semibold ${isOwn ? "text-primary" : "text-foreground"}`}>
              {msg.sent_by}
            </span>
            <span className="text-[10px] text-muted-foreground/50" title={formatExactTime(msg.created_at)}>
              {formatRelative(msg.created_at)}
            </span>
            {isPinned && (
              <span
                className="flex items-center gap-1 text-[9px] text-primary/70 font-medium"
                title={msg.pinned_by ? `Pinned by ${msg.pinned_by}` : "Pinned"}
              >
                <Pin className="h-2.5 w-2.5" />
                pinned
              </span>
            )}
          </div>
        )}

        {/* Reply quote — renders from DB column OR from the embedded marker
            so it's visible to everyone, regardless of whether the `reply_to`
            column exists in the schema. */}
        {(replyTarget || replyFallbackSender) && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => replyTarget ? onJumpTo?.(replyTarget.msg_id) : undefined}
            disabled={!replyTarget}
            className="mb-2 flex items-stretch gap-2 max-w-md overflow-hidden rounded-md bg-primary/[0.06] hover:bg-primary/[0.12] border border-primary/20 transition-colors text-left group/reply disabled:cursor-default disabled:hover:bg-primary/[0.06]"
          >
            <div className="w-[3px] bg-primary/80 shrink-0" />
            <div className="py-1.5 pr-2.5 min-w-0">
              <p className="text-[10.5px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                <Reply className="h-2.5 w-2.5" />
                Replying to {replyTarget ? replyTarget.sent_by : replyFallbackSender}
              </p>
              <p className="text-[11px] text-foreground/80 truncate italic">
                {replyTarget
                  ? (replyTarget.message || "[attachment]")
                  : "(original message not in view)"}
              </p>
            </div>
          </motion.button>
        )}

        {/* Body — rendered with markdown + URL embeds + @mention highlight.
            In edit mode we swap for a textarea + save/cancel buttons. */}
        {isEditing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              autoFocus
              rows={2}
              className="w-full resize-none rounded-md border border-primary/30 bg-background px-2.5 py-1.5 text-[13px] text-foreground/90 focus:border-primary/60 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-[10.5px]">
              <button
                type="button"
                onClick={saveEdit}
                disabled={editing}
                className="rounded-md bg-primary px-2 py-0.5 font-semibold text-primary-foreground disabled:opacity-60"
              >
                {editing ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <span className="text-muted-foreground">
                Enter to save · Esc to cancel
              </span>
            </div>
          </div>
        ) : isDeleted ? (
          <div className="text-[12.5px] italic text-muted-foreground/60">
            [message deleted]
          </div>
        ) : displayText ? (
          <MessageText text={displayText} currentUsername={currentUsername} />
        ) : null}

        {/* Image gallery */}
        {images.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setExpandedImage(url)}
                className="group/img relative overflow-hidden rounded-md border border-border bg-background transition-transform hover:scale-[1.02]"
                style={{ maxWidth: images.length === 1 ? 340 : 160 }}
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-auto w-full max-h-[280px] object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}

        {/* Non-image file attachments */}
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                download={f.name}
                className="flex max-w-[260px] items-center gap-2 rounded-md border border-border bg-muted/25 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                  {attachmentIcon(f.name)}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[11.5px] font-medium text-foreground" title={f.name}>
                    {f.name}
                  </div>
                  <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    {humanSizeFromUrl(f.url) || "download"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {reactionEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactionEntries.map(([emoji, users]) => {
              const userReacted = users.includes(currentUsername);
              return (
                <motion.button
                  key={emoji}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onReact(msg.msg_id, emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-colors ${
                    userReacted
                      ? "bg-red-500/[0.12] border-red-500/25 hover:bg-primary/80/[0.15]"
                      : "bg-muted/50 border-border hover:bg-white/[0.08]"
                  }`}
                  title={users.join(", ")}
                >
                  <span className="text-[12px] leading-none">{emoji}</span>
                  <span className={`text-[10px] font-medium tabular-nums ${
                    userReacted ? "text-red-300" : "text-muted-foreground/80"
                  }`}>
                    {users.length}
                  </span>
                </motion.button>
              );
            })}
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center justify-center h-[22px] w-[22px] rounded-full border border-border bg-muted/30 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground/60 transition-colors opacity-0 group-hover:opacity-100"
              title="Add reaction"
            >
              <Smile className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Thread reply chip */}
        {threadReplyCount != null && threadReplyCount > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(msg)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[10.5px] text-primary transition-colors hover:border-primary/50"
          >
            <MessagesSquare className="h-3 w-3" />
            <span className="font-medium">
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </span>
            <span className="opacity-60">· view thread</span>
          </button>
        )}

        {/* Read receipts */}
        {isOwn && readBy.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <CheckCheck className="h-3 w-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/50">
              Seen by {readBy.length === 1 ? readBy[0] : `${readBy.length} people`}
            </span>
          </div>
        )}
      </div>

      {/* Action bar — hidden at rest, appears on hover only. Native
          browser tooltips (`title=`) name each icon, so the thread button
          is discoverable without cluttering every message at rest. */}
      <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
        {showPicker ? (
          <ReactionPicker onPick={handleReactClick} />
        ) : (
          <div className="flex items-center gap-0.5 bg-[#0f0f0f] border border-border rounded-sm p-0.5 shadow-lg shadow-black/50">
            <button
              onClick={() => setShowPicker(true)}
              className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="Add reaction"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReply(msg)}
              className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {onOpenThread && (
              <button
                onClick={() => onOpenThread(msg)}
                className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                title="Open thread"
              >
                <MessagesSquare className="h-3.5 w-3.5" />
              </button>
            )}
            {canPin && onTogglePin && (
              <button
                onClick={() => onTogglePin(msg)}
                className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                title={isPinned ? "Unpin" : "Pin"}
              >
                {isPinned ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                  title="More"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={copyText} className="gap-2 text-[12px]">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy text"}
                </DropdownMenuItem>
                {isOwn && !isDeleted && onEdit && (
                  <DropdownMenuItem onSelect={startEdit} className="gap-2 text-[12px]">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit message
                  </DropdownMenuItem>
                )}
                {isOwn && !isDeleted && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={doDelete}
                      className="gap-2 text-[12px] text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete message
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Expanded image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setExpandedImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={expandedImage}
            alt=""
            className="max-h-full max-w-full rounded-lg"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
};
