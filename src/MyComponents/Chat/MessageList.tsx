/**
 * MessageList.tsx — Scrollable message feed with day separators.
 *
 * Groups messages by day (Today / Yesterday / Mon Mar 3 / etc) and renders
 * subtle divider between day groups. Handles reactions, reply refs, read
 * receipts. Auto-scrolls to bottom on new messages.
 */

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageInterface, MessageReactions } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";
import { format, isToday, isYesterday } from "date-fns";

interface Props {
  messages: MessageInterface[];
  group: string;
  currentUsername: string;
  table: "cwa_chat" | "cwa_dm_chat";
}

// Format a date as a day separator label
const formatDayLabel = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
};

// Strip time from a date string for day-grouping comparison
const dayKey = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "unknown";
  return format(date, "yyyy-MM-dd");
};

export const MessageList: React.FC<Props> = ({
  messages, group, currentUsername, table,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setReplyingTo, markRead } = useChatStore();

  // Auto-scroll + mark read on change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    markRead(group);
  }, [messages, group, markRead]);

  // Mark messages as read in Supabase (graceful fallback if column missing)
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const unread = messages.filter(
      (m) => m.sent_by !== currentUsername && !(m.read_by || []).includes(currentUsername)
    );
    unread.forEach(async (msg) => {
      const newReadBy = [...(msg.read_by || []), currentUsername];
      const { error } = await supabase.from(table).update({ read_by: newReadBy }).eq("msg_id", msg.msg_id);
      if (error && !error.message.includes("column")) {
        console.warn("Read receipt update failed:", error.message);
      }
    });
  }, [messages, currentUsername, table]);

  // Toggle a reaction — graceful fallback when column missing
  const handleReact = async (msgId: number, emoji: string) => {
    const msg = messages.find((m) => m.msg_id === msgId);
    if (!msg) return;
    const reactions: MessageReactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(currentUsername)) {
      reactions[emoji] = users.filter((u) => u !== currentUsername);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, currentUsername];
    }
    const { error } = await supabase.from(table).update({ reactions }).eq("msg_id", msgId);
    if (error) {
      console.warn(
        "Reactions not saved — add the `reactions jsonb` column on " + table +
        " (see docs/INVOICER_CHAT_NOTIFICATIONS_QUOTAS.md)"
      );
    }
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
          <p className="text-[14px] text-white/40 font-medium mb-1">Say hello!</p>
          <p className="text-[12px] text-white/20">
            Be the first to start the conversation in <span className="text-red-400">#{group}</span>
          </p>
        </div>
      </div>
    );
  }

  // Build rendered list with day separators injected
  const rendered: React.ReactNode[] = [];
  let lastDay: string | null = null;

  messages.forEach((msg, i) => {
    const thisDay = dayKey(msg.created_at);
    const prevMsg = messages[i - 1];

    // Insert day separator when the day changes
    if (thisDay !== lastDay) {
      rendered.push(
        <div key={`day-${thisDay}-${i}`} className="flex items-center gap-3 px-5 my-4 select-none">
          <div className="flex-1 h-px bg-white/[0.04]" />
          <span className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-sm bg-white/[0.02] border border-white/[0.04]">
            {formatDayLabel(msg.created_at)}
          </span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
      );
      lastDay = thisDay;
    }

    rendered.push(
      <div key={msg.msg_id} id={`msg-${msg.msg_id}`}>
        <MessageBubble
          msg={msg}
          prevMsg={thisDay === dayKey(prevMsg?.created_at || "") ? prevMsg : undefined}
          currentUsername={currentUsername}
          onReact={handleReact}
          onReply={handleReply}
          onJumpTo={handleJumpTo}
          allMessages={messages}
        />
      </div>
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
