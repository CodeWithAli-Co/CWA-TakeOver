/**
 * MessageList.tsx — Scrollable message feed with day separators.
 *
 * Groups messages by day (Today / Yesterday / Mon Mar 3 / etc), handles
 * reactions/reply refs/read receipts, auto-scrolls on new messages, and
 * (when threadStyle === "inline") renders ThreadInline under each
 * thread-root message.
 *
 * Thread replies (messages with thread_root_id set) are HIDDEN from the
 * main feed — they only appear inside their thread.
 */

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { ThreadInline } from "./ThreadInline";
import { TypingIndicator } from "./TypingIndicator";
import { MessageInterface } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { useChatStore, type ThreadStyle } from "@/stores/chatStore";
import { format, isToday, isYesterday } from "date-fns";

interface Props {
  messages: MessageInterface[];
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";

  // New props wired by ChatLayout
  onOpenThread: (m: MessageInterface) => void;
  onTogglePin: (m: MessageInterface) => void;
  canPin: boolean;
  threadReplyCounts: Map<number, number>;
  threadStyle: ThreadStyle;
  /** Parent-supplied reaction handler. Falls back to local impl if absent. */
  onReactOverride?: (msgId: number, emoji: string) => Promise<void> | void;
}

const formatDayLabel = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
};

const dayKey = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "unknown";
  return format(date, "yyyy-MM-dd");
};

export const MessageList: React.FC<Props> = ({
  messages, group, currentUsername, userAvatar, table,
  onOpenThread, onTogglePin, canPin,
  threadReplyCounts, threadStyle,
  onReactOverride,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setReplyingTo, markRead } = useChatStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    markRead(group);
  }, [messages, group, markRead]);

  // Mark messages as read in Supabase
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const unread = messages.filter(
      (m) =>
        m.sent_by !== currentUsername &&
        !(m.read_by || []).includes(currentUsername),
    );
    unread.forEach(async (msg) => {
      const newReadBy = [...(msg.read_by || []), currentUsername];
      const { error } = await supabase
        .from(table)
        .update({ read_by: newReadBy })
        .eq("msg_id", msg.msg_id);
      if (error && !error.message.includes("column")) {
        console.warn("Read receipt update failed:", error.message);
      }
    });
  }, [messages, currentUsername, table]);

  const handleReact = async (msgId: number, emoji: string) => {
    if (onReactOverride) {
      await onReactOverride(msgId, emoji);
      return;
    }
    // Fallback implementation (for completeness; ChatLayout always provides one)
    const msg = messages.find((m) => m.msg_id === msgId);
    if (!msg) return;
    const reactions: Record<string, string[]> = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(currentUsername)) {
      reactions[emoji] = users.filter((u) => u !== currentUsername);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, currentUsername];
    }
    await supabase.from(table).update({ reactions }).eq("msg_id", msgId);
  };

  const handleReply = (msg: MessageInterface) => {
    setReplyingTo({
      msgId: msg.msg_id,
      sentBy: msg.sent_by,
      preview: msg.message.slice(0, 60),
    });
  };

  const handleJumpTo = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <div className="text-4xl mb-3">👋</div>
          <p className="text-[14px] text-muted-foreground/70 font-medium mb-1">
            Say hello!
          </p>
          <p className="text-[12px] text-muted-foreground/60">
            Be the first to start the conversation in{" "}
            <span className="text-primary">#{group}</span>
          </p>
        </div>
      </div>
    );
  }

  // Top-level feed hides thread replies; they render inside their thread.
  const feedMessages = messages.filter((m) => m.thread_root_id == null);

  const rendered: React.ReactNode[] = [];
  let lastDay: string | null = null;

  feedMessages.forEach((msg, i) => {
    const thisDay = dayKey(msg.created_at);
    const prevMsg = feedMessages[i - 1];

    if (thisDay !== lastDay) {
      rendered.push(
        <div
          key={`day-${thisDay}-${i}`}
          className="flex items-center gap-3 px-5 my-4 select-none"
        >
          <div className="flex-1 h-px bg-muted/50" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-sm bg-muted/30 border border-border">
            {formatDayLabel(msg.created_at)}
          </span>
          <div className="flex-1 h-px bg-muted/50" />
        </div>,
      );
      lastDay = thisDay;
    }

    const replyCount = threadReplyCounts.get(msg.msg_id) ?? 0;

    rendered.push(
      <div key={msg.msg_id} id={`msg-${msg.msg_id}`}>
        <MessageBubble
          msg={msg}
          prevMsg={
            thisDay === dayKey(prevMsg?.created_at || "") ? prevMsg : undefined
          }
          currentUsername={currentUsername}
          onReact={handleReact}
          onReply={handleReply}
          onJumpTo={handleJumpTo}
          onOpenThread={onOpenThread}
          onTogglePin={onTogglePin}
          canPin={canPin}
          threadReplyCount={replyCount}
          allMessages={messages}
        />
        {threadStyle === "inline" && replyCount > 0 && (
          <ThreadInline
            rootMsg={msg}
            group={group}
            currentUsername={currentUsername}
            userAvatar={userAvatar}
            table={table}
            onReact={handleReact}
          />
        )}
      </div>,
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="py-4">
          {rendered}
        </div>
      </ScrollArea>
      <TypingIndicator group={group} currentUsername={currentUsername} />
    </div>
  );
};
