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
} from "lucide-react";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import { ReactionPicker } from "./ReactionPicker";
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

export const MessageBubble: React.FC<Props> = ({
  msg, prevMsg, currentUsername,
  onReact, onReply, onJumpTo,
  onOpenThread, onTogglePin, canPin = false,
  threadReplyCount,
  allMessages,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const isOwn = msg.sent_by === currentUsername;

  const isGrouped = !!prevMsg
    && prevMsg.sent_by === msg.sent_by
    && msg.created_at && prevMsg.created_at
    && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;

  const replyTarget = msg.reply_to
    ? allMessages.find((m) => m.msg_id === msg.reply_to)
    : null;

  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  const handleReactClick = (emoji: string) => {
    onReact(msg.msg_id, emoji);
    setShowPicker(false);
  };

  const readBy = (msg.read_by || []).filter((u) => u !== msg.sent_by);
  const isPinned = !!msg.pinned_at;

  // Images + display text: prefer the image_urls column when it's populated;
  // otherwise extract image URLs embedded in the message body (our fallback
  // path when the image_urls column doesn't exist yet in the DB).
  let images: string[] = msg.image_urls ?? [];
  let displayText: string = msg.message ?? "";
  if (images.length === 0 && displayText) {
    const extracted = extractImageUrls(displayText);
    if (extracted.urls.length > 0) {
      images = extracted.urls;
      displayText = extracted.cleanText;
    }
  }

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

        {/* Reply quote */}
        {replyTarget && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onJumpTo?.(replyTarget.msg_id)}
            className="mb-1.5 flex items-stretch gap-2 hover:bg-muted/40 rounded-sm transition-colors text-left max-w-md overflow-hidden group/reply"
          >
            <div className="w-0.5 bg-primary/40 group-hover/reply:bg-red-500/60 rounded-full shrink-0" />
            <div className="py-1 pr-2 min-w-0">
              <p className="text-[10px] text-primary/70 font-medium mb-0.5">
                ↳ {replyTarget.sent_by}
              </p>
              <p className="text-[11px] text-muted-foreground/70 truncate">{replyTarget.message}</p>
            </div>
          </motion.button>
        )}

        {/* Body */}
        {displayText && (
          <div className="text-[13.5px] text-foreground/85 break-words leading-relaxed whitespace-pre-wrap">
            {displayText}
          </div>
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

      {/* Action bar — always visible at subtle opacity, 100% on hover so
          reply / react / thread / pin are discoverable without having to
          hover-hunt for them. */}
      <div className="absolute right-4 -top-3 opacity-70 group-hover:opacity-100 transition-opacity z-10">
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
            <button
              className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="More"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
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
