/**
 * MessageList.tsx — Virtualized chat feed (react-virtuoso).
 *
 * Messages, day separators, and the unread divider are flattened into a
 * single typed `FeedRow[]` and handed to Virtuoso. Virtuoso only mounts
 * the rows currently in the viewport (plus a small buffer), so channels
 * with thousands of messages scroll smoothly and open instantly.
 *
 * Behavior preserved from the pre-virtualization version:
 *   · Auto-scroll to bottom on group switch / first load.
 *   · Follow newest messages only when user is near the bottom; otherwise
 *     show a "N new messages" pill.
 *   · Reply jumps (handleJumpTo) scroll the target message into view.
 *   · New-message enter animation (only for genuinely-new rows).
 *   · Inline skeleton while the query is loading (messages === undefined).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
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

// ── Flat row model ──────────────────────────────────────────────────
type DayRow = { kind: "day"; key: string; day: string; dateISO: string };
type UnreadRow = { kind: "unread"; key: string };
type MessageRow = {
  kind: "message";
  key: string;
  msg: MessageInterface;
  prevMsg?: MessageInterface;
  replyCount: number;
  isNew: boolean;
};
type FeedRow = DayRow | UnreadRow | MessageRow;

export const MessageList: React.FC<Props> = ({
  messages, group, currentUsername, userAvatar, table,
  onOpenThread, onTogglePin, canPin,
  threadReplyCounts, threadStyle,
  onReactOverride,
  onEdit, onDelete, onForward,
  searchQuery = "",
}) => {
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [unreadWhileScrolledUp, setUnreadWhileScrolledUp] = useState(0);
  const lastMsgIdRef = useRef<number | null>(null);
  // Captures the highest msg_id present at mount/group-switch. Messages
  // with id <= this are NOT animated (they were already in the feed).
  // Messages above this threshold are new arrivals → animate them in.
  const initialMaxIdRef = useRef<number>(-1);
  const { setReplyingTo, markRead, lastReadAt } = useChatStore();

  // Capture the lastReadAt for this group at mount / group-switch, so the
  // unread divider stays in place even after `markRead` zeros the store.
  const lastReadSnapshotRef = useRef<string | null>(null);
  useLayoutEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  // Update the initial-max-id when messages first arrive for the current
  // group (placeholder / loading → real data transition).
  useLayoutEffect(() => {
    if (initialMaxIdRef.current >= 0) return;
    if (!messages || messages.length === 0) return;
    initialMaxIdRef.current = messages.reduce(
      (max, m) => (m.msg_id > max ? m.msg_id : max),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Track new-message arrivals for the jump-pill + auto-scroll-when-near-bottom.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.msg_id ?? null;
    const previousLastId = lastMsgIdRef.current;
    lastMsgIdRef.current = lastId;

    if (previousLastId == null) {
      // First settle for this group — mark read.
      markRead(group);
      return;
    }
    if (lastId === previousLastId) return;

    if (atBottom) {
      // Virtuoso's `followOutput` prop handles the actual scroll.
      setShowJumpButton(false);
      setUnreadWhileScrolledUp(0);
      markRead(group);
    } else {
      const added = messages.filter((m) => m.msg_id > (previousLastId ?? 0)).length;
      setUnreadWhileScrolledUp((c) => c + added);
      setShowJumpButton(true);
    }
  }, [messages, group, markRead, atBottom]);

  // Mark messages as read in Supabase. Skip entirely if we've already
  // discovered the column is missing — prevents an N-per-message flood
  // of 400s in the browser console.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (isMissingColumn(table, "read_by")) return;

    const unread = messages.filter(
      (m) =>
        m.sent_by !== currentUsername &&
        !(m.read_by || []).includes(currentUsername),
    );
    const batch = unread.slice(0, 10);
    // Serial loop with bail-on-first-failure. The previous version
    // fired all 10 PATCHes in parallel; if read_by was missing on the
    // table, all 10 hit 400 before the missing-column cache kicked in
    // — flooding the console. Awaiting each request means the moment
    // we discover the column is missing, the loop short-circuits and
    // no further requests fire.
    let cancelled = false;
    (async () => {
      for (const msg of batch) {
        if (cancelled) return;
        if (isMissingColumn(table, "read_by")) return;
        const newReadBy = [...(msg.read_by || []), currentUsername];
        const { error } = await supabase
          .from(table)
          .update({ read_by: newReadBy })
          .eq("msg_id", msg.msg_id);
        if (!error) continue;
        const em = error.message || "";
        const code = (error as { code?: string }).code || "";
        // PostgREST returns PGRST204 for "no row" but the actual
        // missing-column error code is 42703. Accept both, plus the
        // various human-readable variants that have been observed
        // across Supabase versions.
        if (
          /column .* does not exist/i.test(em) ||
          /could not find the .* column/i.test(em) ||
          /PGRST204/i.test(em) ||
          code === "42703" ||
          code === "PGRST204" ||
          em.toLowerCase().includes("read_by") ||
          // Bare 400 with no body — assume it's the column issue too,
          // since this code path has no other reason to 400.
          em === "" ||
          em.toLowerCase() === "bad request"
        ) {
          markColumnMissing(table, "read_by");
          return;
        }
        console.warn("Read receipt update failed:", em);
      }
    })();
    return () => { cancelled = true; };
  }, [messages, currentUsername, table]);

  // The followOutput prop on Virtuoso below reads this ref when
  // deciding whether to scroll. We point it at the latest message's
  // sender so that any time the user JUST sent (regardless of where
  // the viewport currently is), Virtuoso scrolls to the new bottom.
  // Other people's messages still respect the at-bottom gate.
  const lastSenderRef = useRef<string>("");
  const lastMsgIdForScrollRef = useRef<number>(-1);

  const handleReact = async (msgId: number, emoji: string) => {
    if (onReactOverride) {
      await onReactOverride(msgId, emoji);
      return;
    }
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

  // Jump to a message by id. Virtuoso owns the scroll, but the bubble
  // still has id="msg-<id>" so scrollIntoView works after a small
  // delay that gives Virtuoso time to mount the row. We also pre-scroll
  // the virtualizer to the row index for long-distance jumps.
  const handleJumpTo = (msgId: number) => {
    const idx = feedRows.findIndex(
      (r) => r.kind === "message" && r.msg.msg_id === msgId,
    );
    if (idx >= 0) {
      virtuosoRef.current?.scrollToIndex({
        index: idx,
        align: "center",
        behavior: "smooth",
      });
    }
    // Briefly highlight the bubble by scrollIntoView on the DOM node once
    // it mounts.
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${msgId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // ── Build the flat row array ──────────────────────────────────────
  // NB: useMemo keeps Virtuoso's `data` reference stable across renders
  // where nothing relevant changed.
  const feedRows: FeedRow[] = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    const needle = searchQuery.trim().toLowerCase();
    const feedMessages = messages.filter((m) => {
      if (m.thread_root_id != null) return false;
      if (!needle) return true;
      const hay = `${m.message ?? ""} ${m.sent_by ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });

    const out: FeedRow[] = [];
    let lastDay: string | null = null;
    const unreadAnchor = lastReadSnapshotRef.current;
    let unreadDividerInserted = false;

    for (let i = 0; i < feedMessages.length; i++) {
      const msg = feedMessages[i]!;
      const prevMsg = feedMessages[i - 1];
      const thisDay = dayKey(msg.created_at);

      if (thisDay !== lastDay) {
        out.push({
          kind: "day",
          key: `day-${thisDay}-${i}`,
          day: thisDay,
          dateISO: msg.created_at,
        });
        lastDay = thisDay;
      }

      if (
        !unreadDividerInserted &&
        unreadAnchor &&
        new Date(msg.created_at) > new Date(unreadAnchor) &&
        msg.sent_by !== currentUsername
      ) {
        out.push({ kind: "unread", key: `unread-${msg.msg_id}` });
        unreadDividerInserted = true;
      }

      out.push({
        kind: "message",
        key: `msg-${msg.msg_id}`,
        msg,
        prevMsg:
          thisDay === dayKey(prevMsg?.created_at || "") ? prevMsg : undefined,
        replyCount: threadReplyCounts.get(msg.msg_id) ?? 0,
        isNew:
          initialMaxIdRef.current >= 0 && msg.msg_id > initialMaxIdRef.current,
      });
    }
    return out;
  }, [messages, searchQuery, threadReplyCounts, currentUsername]);

  // Capture the latest message's sender + msg_id during render so
  // followOutput (called by Virtuoso when data changes) can decide
  // whether to scroll based on whoever just spoke.
  if (messages && messages.length > 0) {
    const lastM = messages[messages.length - 1];
    lastSenderRef.current = lastM.sent_by;
    lastMsgIdForScrollRef.current = lastM.msg_id;
  }

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

  const renderItem = (row: FeedRow) => {
    if (row.kind === "day") {
      return (
        <div className="flex items-center gap-3 px-5 my-4 select-none">
          <div className="flex-1 h-px bg-muted/50" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium px-2 py-0.5 rounded-sm bg-muted/30 border border-border">
            {formatDayLabel(row.dateISO)}
          </span>
          <div className="flex-1 h-px bg-muted/50" />
        </div>
      );
    }
    if (row.kind === "unread") {
      return (
        <div className="flex items-center gap-3 px-5 my-3 select-none">
          <div className="flex-1 h-px bg-primary/30" />
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-primary">
            New messages
          </span>
          <div className="flex-1 h-px bg-primary/30" />
        </div>
      );
    }
    const { msg, prevMsg, replyCount, isNew } = row;
    const inner = (
      <div id={`msg-${msg.msg_id}`}>
        <MessageBubble
          msg={msg}
          prevMsg={prevMsg}
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
      </div>
    );
    if (!isNew) return inner;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {inner}
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        data={feedRows}
        // Auto-scroll behavior on new rows:
        //   • If YOU just sent a message → always scroll smooth, even
        //     if the viewport drifted off-bottom (composer expanded,
        //     scrolled by a pixel, etc.). Critical UX: your own
        //     message should ALWAYS appear in view.
        //   • Otherwise (someone else sent / a vision note landed) →
        //     respect the at-bottom gate so the user isn't yanked
        //     while reading older messages.
        followOutput={(isAtBottom) => {
          if (lastSenderRef.current === currentUsername) return "smooth";
          return isAtBottom ? "smooth" : false;
        }}
        // Wider at-bottom threshold — Virtuoso's default of 4px is
        // jittery when the composer expands by 1 line or animations
        // settle. 64px is generous enough that "near-bottom" still
        // counts as "at-bottom" for follow purposes.
        atBottomThreshold={64}
        // Start at the bottom on mount / group switch.
        initialTopMostItemIndex={Math.max(0, feedRows.length - 1)}
        // Feed dedup key so scroll position is preserved across renders.
        computeItemKey={(_, row) => row.key}
        atBottomStateChange={(v) => {
          setAtBottom(v);
          if (v) {
            setShowJumpButton(false);
            setUnreadWhileScrolledUp(0);
          }
        }}
        // Buffer a few screens so quick scroll-up feels instant.
        increaseViewportBy={{ top: 600, bottom: 600 }}
        // Give the list some bottom padding so the composer doesn't
        // overlap the most recent message.
        className="flex-1"
        itemContent={(_, row) => renderItem(row)}
        components={{
          Header: () => <div className="h-3" />,
          // Tall footer = bottom safety margin. The composer overlays
          // the bottom of the scroll area in this layout, so without
          // a generous spacer the last message gets clipped behind
          // the input. 96px ≈ standard composer height + a comfortable
          // breathing line above it. If the composer ever expands
          // (image preview, reply quote), the user can still see the
          // most recent message.
          Footer: () => <div className="h-24" />,
        }}
      />

      {/* Jump-to-bottom pill */}
      <AnimatePresence>
        {showJumpButton && (
          <motion.button
            type="button"
            onClick={() => {
              virtuosoRef.current?.scrollToIndex({
                index: feedRows.length - 1,
                align: "end",
                behavior: "smooth",
              });
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
    { wBody: [260], wMeta: 100 },
    { wBody: [180], wMeta: 70,  grouped: true },
    { wBody: [90],  wMeta: 90 },
    { wBody: [320, 200], wMeta: 120 },
    { wBody: [140], wMeta: 80,  grouped: true },
    { wBody: [240], wMeta: 110 },
    { wBody: [110], wMeta: 70 },
    { wBody: [200, 140], wMeta: 90 },
    { wBody: [160], wMeta: 100, grouped: true },
    { wBody: [280], wMeta: 80 },
  ];
  return (
    <div className="flex-1 flex flex-col gap-2 py-4 overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-5 ${r.grouped ? "pl-[60px]" : ""}`}
        >
          {!r.grouped && (
            <div className="h-9 w-9 shrink-0 rounded-sm bg-muted/80 animate-pulse" />
          )}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {!r.grouped && (
              <div className="flex items-center gap-2">
                <div
                  className="h-3 rounded bg-muted/80 animate-pulse"
                  style={{ width: r.wMeta }}
                />
                <div className="h-2.5 w-12 rounded bg-muted/40 animate-pulse" />
              </div>
            )}
            {r.wBody.map((w, j) => (
              <div
                key={j}
                className="h-4 rounded-md bg-muted/60 animate-pulse"
                style={{
                  width: w,
                  animationDelay: `${(i * 2 + j) * 70}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
