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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { ThreadInline } from "./ThreadInline";
import { TypingIndicator } from "./TypingIndicator";
import { MessageInterface } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { useChatStore, type ThreadStyle } from "@/stores/chatStore";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowDown } from "lucide-react";

// Module-level cache: once an UPDATE fails because a column doesn't
// exist in the DB (schemas drift between dev / staging / prod), stop
// hammering the endpoint with requests that will always 400.
// Keys: `${table}:${column}` → true means "skip this field everywhere".
const missingColumns = new Set<string>();
const isMissingColumn = (table: string, column: string) =>
  missingColumns.has(`${table}:${column}`);
const markColumnMissing = (table: string, column: string) => {
  missingColumns.add(`${table}:${column}`);
  console.info(
    `[chat] Detected missing DB column ${table}.${column}. Skipping future writes.`,
  );
};

interface Props {
  /** undefined = initial load / group-switch in progress → skeleton. */
  messages: MessageInterface[] | undefined;
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
  /** Edit / delete own message. */
  onEdit?: (msg: MessageInterface, nextText: string) => Promise<void> | void;
  onDelete?: (msg: MessageInterface) => Promise<void> | void;
  /** Forward — opens parent's forward dialog with this message. */
  onForward?: (msg: MessageInterface) => void;
  /** Text filter applied before day-grouping. Empty string = no filter. */
  searchQuery?: string;
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
  onEdit, onDelete, onForward,
  searchQuery = "",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [unreadWhileScrolledUp, setUnreadWhileScrolledUp] = useState(0);
  const lastMsgIdRef = useRef<number | null>(null);
  // Captures the highest msg_id present at mount/group-switch. Messages
  // with id <= this are NOT animated (they were already in the feed).
  // Messages above this threshold are new arrivals → animate them in.
  const initialMaxIdRef = useRef<number>(-1);
  const { setReplyingTo, markRead, lastReadAt } = useChatStore();

  // Resolve the actual scrollable element (Radix viewport).
  const getViewport = (): HTMLElement | null => {
    return (
      rootRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null
    ) ?? null;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const v = getViewport();
    if (!v) return;
    // Use scrollTop assignment for instant; scrollIntoView on sentinel for smooth.
    if (behavior === "smooth" && bottomSentinelRef.current) {
      bottomSentinelRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    } else {
      v.scrollTop = v.scrollHeight;
    }
  };

  const isNearBottom = (): boolean => {
    const v = getViewport();
    if (!v) return true;
    return v.scrollHeight - v.scrollTop - v.clientHeight < 120;
  };

  // Capture the lastReadAt for this group at mount / group-switch, so the
  // unread divider stays in place even after `markRead` zeros the store.
  const lastReadSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    lastReadSnapshotRef.current = lastReadAt[group] ?? null;
    lastMsgIdRef.current = null;
    // Capture the max msg_id seen on this group's first paint so subsequent
    // animations only fire for genuinely-new messages.
    initialMaxIdRef.current = (messages || []).reduce(
      (max, m) => (m.msg_id > max ? m.msg_id : max),
      -1,
    );
    setShowJumpButton(false);
    setUnreadWhileScrolledUp(0);
    // intentionally only depends on `group` — we want the snapshot frozen
    // for the lifetime of the current channel view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  // Initial paint: jump straight to the bottom on group switch / mount,
  // before the user sees the top of the list flash by.
  useLayoutEffect(() => {
    scrollToBottom("auto");
    // ensure after layout the viewport is at bottom (images/skeletons may push)
    const id = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  // On new messages: if user is near bottom, follow. Otherwise show a
  // "jump to bottom" pill that counts unread messages.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.msg_id ?? null;
    const previousLastId = lastMsgIdRef.current;
    lastMsgIdRef.current = lastId;

    // First settling pass for this group → jump to bottom + clear pill.
    if (previousLastId == null) {
      // run after render so layout is final
      requestAnimationFrame(() => scrollToBottom("auto"));
      markRead(group);
      return;
    }
    if (lastId === previousLastId) return;

    if (isNearBottom()) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
      setShowJumpButton(false);
      setUnreadWhileScrolledUp(0);
      markRead(group);
    } else {
      // Count messages added since last tick
      const added = messages.filter((m) => m.msg_id > (previousLastId ?? 0)).length;
      setUnreadWhileScrolledUp((c) => c + added);
      setShowJumpButton(true);
    }
  }, [messages, group, markRead]);

  // Track whether user has scrolled away from the bottom.
  useEffect(() => {
    const v = getViewport();
    if (!v) return;
    const onScroll = () => {
      if (isNearBottom()) {
        setShowJumpButton(false);
        setUnreadWhileScrolledUp(0);
      }
    };
    v.addEventListener("scroll", onScroll, { passive: true });
    return () => v.removeEventListener("scroll", onScroll);
  }, [group]);

  // Mark messages as read in Supabase.
  // Skip entirely if we've already discovered that the target column
  // doesn't exist in this schema — prevents an N-per-message flood of
  // 400s in the browser console for schemas that lack read_by.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (isMissingColumn(table, "read_by")) return;

    const unread = messages.filter(
      (m) =>
        m.sent_by !== currentUsername &&
        !(m.read_by || []).includes(currentUsername),
    );
    // Cap per-tick work to avoid a burst of 25 parallel requests.
    const batch = unread.slice(0, 10);
    batch.forEach(async (msg) => {
      if (isMissingColumn(table, "read_by")) return;
      const newReadBy = [...(msg.read_by || []), currentUsername];
      const { error } = await supabase
        .from(table)
        .update({ read_by: newReadBy })
        .eq("msg_id", msg.msg_id);
      if (!error) return;
      const em = error.message || "";
      // Postgres error codes 42703 (undefined column) / PGRST204 (schema mismatch)
      // bubble up as "column ... does not exist" or similar. Detect and cache.
      if (
        /column .* does not exist/i.test(em) ||
        /could not find the .* column/i.test(em) ||
        /PGRST204/i.test(em) ||
        em.toLowerCase().includes("read_by")
      ) {
        markColumnMissing(table, "read_by");
        return;
      }
      console.warn("Read receipt update failed:", em);
    });
  }, [messages, currentUsername, table]);

  const handleReact = async (msgId: number, emoji: string) => {
    if (onReactOverride) {
      await onReactOverride(msgId, emoji);
      return;
    }
    // Fallback implementation (for completeness; ChatLayout always provides one)
    const msg = messages?.find((m) => m.msg_id === msgId);
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

  // Loading state: messages is undefined (query still in flight).
  if (!messages) {
    return <MessageListSkeleton />;
  }

  if (messages.length === 0) {
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
  // Also apply the search filter when one is set.
  const needle = searchQuery.trim().toLowerCase();
  const feedMessages = messages.filter((m) => {
    if (m.thread_root_id != null) return false;
    if (!needle) return true;
    const hay = `${m.message ?? ""} ${m.sent_by ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  const rendered: React.ReactNode[] = [];
  let lastDay: string | null = null;
  const unreadAnchor = lastReadSnapshotRef.current;
  let unreadDividerInserted = false;

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

    // Unread divider — insert once, before the first message newer than
    // the snapshotted lastReadAt (and only if the message isn't your own).
    if (
      !unreadDividerInserted &&
      unreadAnchor &&
      new Date(msg.created_at) > new Date(unreadAnchor) &&
      msg.sent_by !== currentUsername
    ) {
      rendered.push(
        <div
          key={`unread-${msg.msg_id}`}
          className="flex items-center gap-3 px-5 my-3 select-none"
        >
          <div className="flex-1 h-px bg-primary/30" />
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-primary">
            New messages
          </span>
          <div className="flex-1 h-px bg-primary/30" />
        </div>,
      );
      unreadDividerInserted = true;
    }

    const replyCount = threadReplyCounts.get(msg.msg_id) ?? 0;

    const isNew = msg.msg_id > initialMaxIdRef.current;
    rendered.push(
      <motion.div
        key={msg.msg_id}
        id={`msg-${msg.msg_id}`}
        initial={isNew ? { opacity: 0, y: 8, scale: 0.98 } : false}
        animate={isNew ? { opacity: 1, y: 0, scale: 1 } : undefined}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
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
          onEdit={onEdit}
          onDelete={onDelete}
          onForward={onForward}
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
      </motion.div>,
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <ScrollArea ref={rootRef} className="flex-1">
        <div className="py-4">
          {rendered}
          <div ref={bottomSentinelRef} aria-hidden="true" />
        </div>
      </ScrollArea>

      {/* Jump-to-bottom pill */}
      <AnimatePresence>
        {showJumpButton && (
          <motion.button
            type="button"
            onClick={() => {
              scrollToBottom("smooth");
              setShowJumpButton(false);
              setUnreadWhileScrolledUp(0);
              markRead(group);
            }}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-primary/40 bg-primary px-3 py-1.5 text-[11.5px] font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {unreadWhileScrolledUp > 0
              ? `${unreadWhileScrolledUp} new ${unreadWhileScrolledUp === 1 ? "message" : "messages"}`
              : "Jump to bottom"}
          </motion.button>
        )}
      </AnimatePresence>

      <TypingIndicator group={group} currentUsername={currentUsername} />
    </div>
  );
};

// ── In-feed skeleton shown while the initial messages query is loading.
function MessageListSkeleton() {
  const rows = [
    { w: 180, self: false },
    { w: 90, self: false },
    { w: 240, self: true },
    { w: 140, self: false },
    { w: 320, self: true },
    { w: 110, self: false },
    { w: 200, self: false },
    { w: 160, self: true },
  ];
  return (
    <div className="flex-1 flex flex-col gap-3 px-5 py-6 overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 ${r.self ? "flex-row-reverse" : ""}`}
        >
          {!r.self && (
            <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-muted/60 animate-pulse" />
          )}
          <div className={`flex flex-col gap-1.5 ${r.self ? "items-end" : ""}`}>
            {!r.self && (
              <div className="h-2.5 w-20 rounded bg-muted/50 animate-pulse" />
            )}
            <div
              className="h-6 rounded-xl bg-muted/40 animate-pulse"
              style={{
                width: r.w,
                animationDelay: `${i * 80}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
