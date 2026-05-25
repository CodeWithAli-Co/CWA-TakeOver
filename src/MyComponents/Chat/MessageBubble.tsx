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
  Pencil, Trash2, Copy, Check, Forward, Star, X, Sparkles,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
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
import { PresenceDot } from "./PresenceDot";
import { VoicePlayer } from "./VoicePlayer";
import { PollMessage, parsePollMarker, stripPollMarker } from "./PollMessage";
import { FolderAttachmentCard } from "./FolderAttachmentCard";
import {
  decodeFolderToken,
  FOLDER_TOKEN_RE,
  type FolderManifest,
} from "./useFolderUpload";
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
  /** Open the forward dialog with this message as source. */
  onForward?: (msg: MessageInterface) => void;
  allMessages: MessageInterface[];
}

/** Recognise messages posted by AXON (the in-app agent) so we can
 *  swap the standard avatar for a branded orb. Case-insensitive +
 *  also accepts "axon" / "Axon" in case future writers vary. */
function isAxonSender(sender: string | null | undefined): boolean {
  if (!sender) return false;
  return sender.trim().toLowerCase() === "axon";
}

/** Static orb avatar — radial red gradient with a sparkle glyph +
 *  a soft red glow. Visually matches the canvas Orb used in the
 *  command panel without paying the canvas cost per message.
 *
 *  The gradient is brand-red in both themes (it IS the brand mark).
 *  The Sparkles glyph is forced white via the `!` modifier because
 *  the bulk theme tokenization swept `text-white` → `text-foreground`
 *  globally — and on a saturated red orb we explicitly want a white
 *  glyph in both light and dark modes. */
function AxonOrbAvatar() {
  return (
    <div
      className="h-9 w-9 rounded-sm border border-red-500/40 flex items-center justify-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgb(254, 202, 202) 0%, rgb(239, 68, 68) 35%, rgb(127, 29, 29) 100%)",
        boxShadow:
          "0 0 14px rgba(239, 68, 68, 0.45), inset 0 0 6px rgba(255, 255, 255, 0.15)",
      }}
      aria-label="AXON"
      title="AXON"
    >
      <Sparkles size={14} className="!text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.6)]" />
    </div>
  );
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

/** Extract image URLs embedded in the message body. Covers:
 *   · URLs ending in .png/.jpg/.jpeg/.gif/.webp/.avif (plus optional query).
 *   · Supabase public-bucket chat-image URLs where the filename carries
 *     the extension after the last path segment.
 *   · Bare .gif URLs from giphy.com / media.tenor.com (GIFs via picker).
 *  Strips matched URLs from the body completely — including the newline
 *  that the composer inserts around them — so the image renders inline
 *  without a visible link beside it. */
const IMG_URL_RE =
  /https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?/gi;
const GIPHY_TENOR_RE =
  /https?:\/\/(?:[^\s]*(?:giphy\.com|media\.tenor\.com|tenor\.com)[^\s]+)/gi;
function extractImageUrls(text: string): { cleanText: string; urls: string[] } {
  const urls: string[] = [];
  const matchers = [IMG_URL_RE, GIPHY_TENOR_RE];
  let body = text;
  for (const re of matchers) {
    body = body.replace(re, (match) => {
      // Dedup — same URL showing up in multiple regexes shouldn't
      // render twice.
      if (!urls.includes(match)) urls.push(match);
      return "";
    });
  }
  // Collapse the newlines the composer inserted around attachments so
  // we don't leave empty gaps.
  const cleanText = body
    .split("\n")
    .filter((ln) => ln.trim().length > 0)
    .join("\n")
    .trim();
  return { cleanText, urls };
}

/** Audio attachment detection (voice messages + uploaded audio). */
const AUDIO_RE = /\.(webm|mp3|m4a|ogg|wav|opus)(\?|$)/i;

/** Extract non-image attachment URLs uploaded to the `chat-images` bucket.
 *  Identified by the storage path pattern, not by extension. Audio URLs
 *  are returned in their own array so the bubble can render an inline
 *  player; everything else lands as a download card. */
const FILE_URL_RE =
  /https?:\/\/[^\s]*storage\/v1\/object\/public\/chat-images\/[^\s]+/gi;
function extractFileAttachments(
  text: string,
): {
  cleanText: string;
  files: { url: string; name: string }[];
  audios: string[];
} {
  const files: { url: string; name: string }[] = [];
  const audios: string[] = [];
  const cleanText = text.replace(FILE_URL_RE, (match) => {
    if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(match)) {
      return match; // leave image URLs alone — handled by image extractor
    }
    if (AUDIO_RE.test(match)) {
      audios.push(match);
      return "";
    }
    const slug = decodeURIComponent(match.split("/").pop() || "attachment");
    const parts = slug.split("-");
    const recovered = parts.length > 3 ? parts.slice(3).join("-") : slug;
    files.push({ url: match, name: recovered });
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, files, audios };
}

function attachmentIcon(name: string): string {
  const ext = (name.split(".").pop() || "FILE").toUpperCase();
  return ext.slice(0, 4);
}

/** Deterministic color (HSL) derived from a username, used for the
 *  read-receipt avatar pips so each teammate has a stable tint. */
function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${h % 360} 52% 38%)`;
}

function humanSizeFromUrl(_url: string): string {
  // We don't have size info post-upload without a HEAD request. Keep blank.
  return "";
}

/** Parse a forwarded-from marker. Prepended by the Forward dialog when
 *  inserting a copy of someone else's message into a new channel. */
const FWD_MARKER_RE = /^\{fwd:([^|]+)\|([^}]+)\}\s*\n?/;
function extractForwardMarker(
  text: string,
): { cleanText: string; fromSender: string | null; fromGroup: string | null } {
  const match = text.match(FWD_MARKER_RE);
  if (!match) return { cleanText: text, fromSender: null, fromGroup: null };
  return {
    cleanText: text.replace(FWD_MARKER_RE, "").trimStart(),
    fromSender: match[1]!.trim(),
    fromGroup: match[2]!.trim(),
  };
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

// Reactions marker codec lives in `reactionMarkers.ts` so it can be
// unit-tested without React. Imported here so this file can use the
// helpers (display-time parsing in the bubble), and re-exported so
// existing import paths (`ChatLayout`, etc) keep working.
import {
  REACTIONS_MARKER_RE,
  parseReactionsMarker,
  stripReactionsMarker,
  encodeReactionsMarker,
} from "./reactionMarkers";

export {
  REACTIONS_MARKER_RE,
  parseReactionsMarker,
  stripReactionsMarker,
  encodeReactionsMarker,
};

export const MessageBubble: React.FC<Props> = ({
  msg, prevMsg, currentUsername,
  onReact, onReply, onJumpTo,
  onOpenThread, onTogglePin, canPin = false,
  threadReplyCount,
  onEdit, onDelete, onForward,
  allMessages,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toggleStarred, isStarred } = useChatStore();
  const isOwn = msg.sent_by === currentUsername;
  const starred = isStarred(msg.msg_id);

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

  // Read receipts ONLY render under the LAST own message in the
  // channel — not under every single one. Avatar tails after every
  // message looked like spam. We compute "is this the last own
  // message" by walking allMessages once. Cheap because it's just a
  // .findLast on a finite array.
  const isLastOwnMessage = (() => {
    if (msg.sent_by !== currentUsername) return false;
    if (!allMessages || allMessages.length === 0) return true;
    // Find the largest msg_id authored by currentUsername.
    let lastOwnId = -1;
    for (const m of allMessages) {
      if (m.sent_by === currentUsername && m.msg_id > lastOwnId) {
        lastOwnId = m.msg_id;
      }
    }
    return msg.msg_id === lastOwnId;
  })();

  // Strip embedded markers before rendering. The composer prepends reply
  // + reactions markers + appends image URLs so each survives even when
  // the corresponding DB column doesn't exist.
  let displayText: string = msg.message ?? "";
  let images: string[] = msg.image_urls ?? [];
  let files: { url: string; name: string }[] = [];
  let audios: string[] = [];
  let folders: FolderManifest[] = [];
  let parsedReplyId: number | null = null;
  let parsedReplySender: string | null = null;
  let parsedReactions: Record<string, string[]> = {};
  let forwardedFromSender: string | null = null;
  let forwardedFromGroup: string | null = null;

  if (displayText) {
    // Forwarded-from marker lives at the top (before reactions / reply).
    const f = extractForwardMarker(displayText);
    displayText = f.cleanText;
    forwardedFromSender = f.fromSender;
    forwardedFromGroup = f.fromGroup;

    // reactions marker next
    parsedReactions = parseReactionsMarker(displayText);
    displayText = stripReactionsMarker(displayText);

    const r = extractReplyMarker(displayText);
    displayText = r.cleanText;
    parsedReplyId = r.replyId;
    parsedReplySender = r.replySender;
  }
  // Folder bundles are parsed FIRST so the image/file URL extractors
  // below don't pick up the folder's internal URLs as standalone
  // attachments. Each `[folder:<base64>]` token decodes to one
  // FolderManifest rendered as a FolderAttachmentCard.
  if (displayText) {
    const tokens = displayText.match(FOLDER_TOKEN_RE) ?? [];
    if (tokens.length > 0) {
      for (const t of tokens) {
        const m = decodeFolderToken(t);
        if (m) folders.push(m);
      }
      displayText = displayText
        .replace(FOLDER_TOKEN_RE, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }

  // Always strip image URLs from displayText — even when image_urls
  // column is populated — so the raw link never shows up next to the
  // rendered image. If image_urls is empty we also promote the extracted
  // URLs into the images array.
  if (displayText) {
    const extracted = extractImageUrls(displayText);
    if (extracted.urls.length > 0) {
      if (images.length === 0) images = extracted.urls;
      displayText = extracted.cleanText;
    }
  }
  // Non-image file attachments (voice + files) that were stored to
  // chat-images too.
  if (displayText) {
    const fExtracted = extractFileAttachments(displayText);
    if (fExtracted.files.length > 0 || fExtracted.audios.length > 0) {
      files = fExtracted.files;
      audios = fExtracted.audios;
      displayText = fExtracted.cleanText;
    }
  }

  // Poll marker — if present, renders as an interactive PollMessage
  // block instead of inline text. The poll's question is also kept as
  // the message's text fallback for systems that can't render the poll.
  const poll = displayText ? parsePollMarker(displayText) : null;
  if (poll) displayText = stripPollMarker(displayText).trim();

  // Effective reactions: prefer DB column; fall back to parsed marker.
  const reactions: Record<string, string[]> =
    msg.reactions && Object.keys(msg.reactions).length > 0
      ? msg.reactions
      : parsedReactions;
  const reactionEntries = Object.entries(reactions).filter(
    ([emoji, users]) => users.length > 0 && !emoji.startsWith("__poll_"),
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
      className={`group relative flex gap-3 px-5 hover:bg-card transition-colors min-w-0 max-w-full ${
        isGrouped ? "py-0.5" : "pt-3 pb-1 mt-1"
      } ${isPinned ? "bg-primary/[0.03]" : ""}`}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0 flex items-start justify-center pt-0.5">
        {!isGrouped ? (
          <div className="relative">
            {isAxonSender(msg.sent_by) ? (
              <AxonOrbAvatar />
            ) : (
              <Avatar className="h-9 w-9 rounded-sm border border-border">
                <AvatarImage
                  src={`https://tqaytmvihogvhhvwgbwm.supabase.co/storage/v1/object/public/avatars//${msg.userAvatar}`}
                />
                <AvatarFallback className="bg-muted/50 text-muted-foreground/70 text-[10px] rounded-sm font-medium">
                  {msg.sent_by?.slice(0, 2)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            {!isAxonSender(msg.sent_by) && (
              <div className="absolute -right-0.5 -bottom-0.5">
                <PresenceDot username={msg.sent_by} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity pt-1 font-medium tabular-nums">
            {formatExactTime(msg.created_at)}
          </span>
        )}
      </div>

      {/* Content column. Capped at a sensible reading width so long
          pasted blocks (security audits, multi-paragraph briefs, log
          dumps) don't extend across a maximized window and clip on
          the right edge. Matches the ~900px column Slack/Discord use.
          The outer row stays full-width so hover states and grouped
          time stamps align across the panel. */}
      <div className="flex-1 min-w-0 max-w-[860px]">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[13px] font-semibold ${isOwn ? "text-primary" : "text-foreground"}`}>
              {msg.sent_by}
            </span>
            <span className="text-[10px] text-muted-foreground/80" title={formatExactTime(msg.created_at)}>
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
            {starred && (
              <span
                className="flex items-center gap-0.5 text-[9px] text-amber-400 font-medium"
                title="You starred this"
              >
                <Star className="h-2.5 w-2.5 fill-amber-400" />
              </span>
            )}
          </div>
        )}

        {/* Forwarded-from banner */}
        {forwardedFromSender && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <Forward className="h-2.5 w-2.5" />
            Forwarded from{" "}
            <span className="font-medium text-foreground/80">
              {forwardedFromSender}
            </span>
            {forwardedFromGroup && (
              <>
                <span>·</span>
                <span>#{forwardedFromGroup}</span>
              </>
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

        {/* Poll — votes stored inside `reactions` under __poll_<i> keys */}
        {poll && (
          <PollMessage
            poll={poll}
            reactions={reactions}
            currentUsername={currentUsername}
            onVote={(optionIdx) => {
              const keyPrefix = poll.multi ? "__poll_multi_" : "__poll_";
              if (!poll.multi) {
                // Single-select: find and remove any other option I voted for.
                for (let i = 0; i < poll.options.length; i++) {
                  const k = `${keyPrefix}${i}`;
                  const users = reactions[k] || [];
                  if (i !== optionIdx && users.includes(currentUsername)) {
                    onReact(msg.msg_id, k);
                  }
                }
              }
              onReact(msg.msg_id, `${keyPrefix}${optionIdx}`);
            }}
          />
        )}

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

        {/* Voice / audio attachments — rendered inline */}
        {audios.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {audios.map((url) => (
              <VoicePlayer key={url} src={url} />
            ))}
          </div>
        )}

        {/* Folder bundles — each renders as a card with a browse
            overlay listing every file inside. Decoded from
            `[folder:<base64>]` tokens earlier in the body parsing. */}
        {folders.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {folders.map((m, i) => (
              <FolderAttachmentCard key={`folder-${i}-${m.name}`} manifest={m} />
            ))}
          </div>
        )}

        {/* Non-image file attachments — PDFs open an in-app preview; all
            other file types fall through as a normal download link. */}
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f) => {
              const isPdf = /\.pdf(\?|$)/i.test(f.url) || /\.pdf$/i.test(f.name);
              const body = (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                    {attachmentIcon(f.name)}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[11.5px] font-medium text-foreground" title={f.name}>
                      {f.name}
                    </div>
                    <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                      {isPdf ? "preview" : humanSizeFromUrl(f.url) || "download"}
                    </div>
                  </div>
                </>
              );
              const cls = "flex max-w-[260px] items-center gap-2 rounded-md border border-border bg-muted/25 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40";
              if (isPdf) {
                return (
                  <button
                    key={f.url}
                    type="button"
                    onClick={() => setPdfPreview({ url: f.url, name: f.name })}
                    className={cls}
                  >
                    {body}
                  </button>
                );
              }
              return (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={f.name}
                  className={cls}
                >
                  {body}
                </a>
              );
            })}
          </div>
        )}
        {/* PDF preview overlay */}
        {pdfPreview && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setPdfPreview(null)}
          >
            <div
              className="flex h-[90vh] w-[min(1100px,100%)] flex-col overflow-hidden rounded-xl border border-border bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                  PDF · {pdfPreview.name}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={pdfPreview.name}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10.5px] text-foreground/80 hover:border-primary/40 hover:text-foreground"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setPdfPreview(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <iframe
                title={pdfPreview.name}
                src={pdfPreview.url}
                className="flex-1 border-0 bg-background"
              />
            </div>
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
              className="flex items-center justify-center h-[22px] w-[22px] rounded-full border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground/60 transition-colors opacity-0 group-hover:opacity-100"
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

        {/* Read receipts — only on the LAST own message in the channel.
            Renders as a small "Read by [avatars]" chip aligned right
            so it doesn't crowd message bodies. iMessage-style: one
            indicator at the bottom of your own thread, not under
            every single bubble. */}
        {isOwn && isLastOwnMessage && readBy.length > 0 && (
          <div className="mt-1 flex items-center justify-end gap-1.5 opacity-70">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
              Read
            </span>
            <CheckCheck className="h-3 w-3 text-emerald-400/80" />
            <div className="flex -space-x-1">
              {readBy.slice(0, 3).map((u) => (
                <div
                  key={u}
                  title={u}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-background text-[7.5px] font-semibold text-foreground/95"
                  style={{ background: colorForName(u) }}
                >
                  {u.slice(0, 1).toUpperCase()}
                </div>
              ))}
              {readBy.length > 3 && (
                <div
                  title={readBy.slice(3).join(", ")}
                  className="flex h-3.5 items-center justify-center rounded-full border border-background bg-muted/80 px-1 text-[7.5px] font-semibold text-muted-foreground"
                >
                  +{readBy.length - 3}
                </div>
              )}
            </div>
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
              className="p-1.5 rounded-sm hover:bg-muted/60 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="Add reaction"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReply(msg)}
              className="p-1.5 rounded-sm hover:bg-muted/60 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {onOpenThread && (
              <button
                onClick={() => onOpenThread(msg)}
                className="p-1.5 rounded-sm hover:bg-muted/60 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
                title="Open thread"
              >
                <MessagesSquare className="h-3.5 w-3.5" />
              </button>
            )}
            {canPin && onTogglePin && (
              <button
                onClick={() => onTogglePin(msg)}
                className="p-1.5 rounded-sm hover:bg-muted/60 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
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
                  className="p-1.5 rounded-sm hover:bg-muted/60 text-muted-foreground/70 hover:text-foreground/80 transition-colors"
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
                {onForward && !isDeleted && (
                  <DropdownMenuItem onSelect={() => onForward(msg)} className="gap-2 text-[12px]">
                    <Forward className="h-3.5 w-3.5" />
                    Forward
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    // Heuristic: General → cwa_chat else cwa_dm_chat. Caller can
                    // override later with a proper `table` prop if needed.
                    const table = msg.dm_group ? "cwa_dm_chat" : "cwa_chat";
                    const group = msg.dm_group || "General";
                    toggleStarred({ msgId: msg.msg_id, group, table });
                  }}
                  className="gap-2 text-[12px]"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${starred ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                  {starred ? "Unstar message" : "Star message"}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6"
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
