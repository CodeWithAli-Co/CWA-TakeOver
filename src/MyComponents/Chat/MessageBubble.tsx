/**
 * MessageBubble.tsx — Single message rendering.
 *
 * Layout:
 *   [Avatar 36px]  [Name · time]
 *                  [Optional reply quote]
 *                  [Message text]
 *                  [Reaction pills]
 *                  [Read receipts]
 *                                           [Hover actions — absolute top-right]
 *
 * Grouped mode (consecutive msgs from same user within 5 min):
 *   — Hides avatar + name + time
 *   — Compact vertical padding
 *   — Avatar slot becomes timestamp on hover
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Smile, Reply, MoreVertical, CheckCheck } from "lucide-react";
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

export const MessageBubble: React.FC<Props> = ({
  msg, prevMsg, currentUsername, onReact, onReply, onJumpTo, allMessages,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const isOwn = msg.sent_by === currentUsername;

  // Group consecutive messages from same user within 5 min
  const isGrouped = !!prevMsg
    && prevMsg.sent_by === msg.sent_by
    && msg.created_at && prevMsg.created_at
    && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;

  // Reply target lookup
  const replyTarget = msg.reply_to
    ? allMessages.find((m) => m.msg_id === msg.reply_to)
    : null;

  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([_, users]) => users.length > 0);

  const handleReactClick = (emoji: string) => {
    onReact(msg.msg_id, emoji);
    setShowPicker(false);
  };

  const readBy = (msg.read_by || []).filter((u) => u !== msg.sent_by);

  return (
    <div
      className={`group relative flex gap-3 px-5 hover:bg-card transition-colors ${
        isGrouped ? "py-0.5" : "pt-3 pb-1 mt-1"
      }`}
    >
      {/* Avatar column (36px) */}
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
          // Grouped: show timestamp in avatar slot on hover
          <span className="text-[9px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity pt-1 font-medium tabular-nums">
            {formatExactTime(msg.created_at)}
          </span>
        )}
      </div>

      {/* Message content column */}
      <div className="flex-1 min-w-0">
        {/* Header (only on first of group) */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[13px] font-semibold ${isOwn ? "text-primary" : "text-foreground"}`}>
              {msg.sent_by}
            </span>
            <span className="text-[10px] text-muted-foreground/50" title={formatExactTime(msg.created_at)}>
              {formatRelative(msg.created_at)}
            </span>
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

        {/* Message body */}
        <div className="text-[13.5px] text-foreground/85 break-words leading-relaxed whitespace-pre-wrap">
          {msg.message}
        </div>

        {/* Reactions row */}
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

        {/* Read receipts (own messages, below text) */}
        {isOwn && readBy.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <CheckCheck className="h-3 w-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/50">
              Seen by {readBy.length === 1 ? readBy[0] : `${readBy.length} people`}
            </span>
          </div>
        )}
      </div>

      {/* Hover action bar — absolute top-right */}
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
            <button
              className="p-1.5 rounded-sm hover:bg-white/[0.06] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              title="More"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
