/**
 * ThreadPanel.tsx — Slack-style right-hand thread panel.
 *
 * Opens when a user clicks the thread icon on a message. Renders:
 *   · Header with close button + "Thread · #group"
 *   · The root message
 *   · Divider · "N replies"
 *   · All thread replies (chronological)
 *   · A composer pinned to the bottom
 *
 * Subscribes to realtime inserts on the relevant table filtered by
 * thread_root_id so new replies appear instantly.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessagesSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { companySupabase } from "@/routes/index.lazy";
import type { MessageInterface } from "@/stores/query";
import { fetchThreadReplies } from "@/stores/query";
import { MessageBubble } from "./MessageBubble";
import { ThreadComposer } from "./ThreadComposer";
import { useChatStore } from "@/stores/chatStore";
import { displayLabelForDM, isDMKey } from "./displayName";

interface Props {
  rootMsg: MessageInterface;
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";
  onClose: () => void;
  allMessages: MessageInterface[];
  onReact: (msgId: number, emoji: string) => void;
}

export function ThreadPanel({
  rootMsg,
  group,
  currentUsername,
  userAvatar,
  table,
  onClose,
  allMessages,
  onReact,
}: Props) {
  const [replies, setReplies] = useState<MessageInterface[]>([]);
  const { setReplyingTo } = useChatStore();

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetchThreadReplies(group, rootMsg.msg_id).then((r) => {
      if (!cancelled) setReplies(r);
    });
    return () => {
      cancelled = true;
    };
  }, [group, rootMsg.msg_id]);

  // Realtime subscription for new replies in this thread
  useEffect(() => {
    const channel = companySupabase
      .channel(`thread-${table}-${rootMsg.msg_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `thread_root_id=eq.${rootMsg.msg_id}`,
        },
        async () => {
          const fresh = await fetchThreadReplies(group, rootMsg.msg_id);
          setReplies(fresh);
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [group, rootMsg.msg_id, table]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleReply = (m: MessageInterface) => {
    setReplyingTo({
      msgId: m.msg_id,
      sentBy: m.sent_by,
      preview: m.message.slice(0, 60),
    });
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={rootMsg.msg_id}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-card"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-muted-foreground" />
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] font-semibold text-foreground">
                Thread
              </span>
              <span className="text-[10px] text-muted-foreground">
                {/* Display label — never the raw "dm::Ali::Mason" key. */}
                {isDMKey(group)
                  ? displayLabelForDM(group, currentUsername)
                  : `#${group}`}{" "}
                · {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close thread"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <ScrollArea className="flex-1">
          <div className="py-3">
            {/* Root */}
            <MessageBubble
              msg={rootMsg}
              currentUsername={currentUsername}
              onReact={onReact}
              onReply={handleReply}
              allMessages={allMessages}
            />

            {/* Divider */}
            <div className="my-3 flex items-center gap-3 px-5 select-none">
              <div className="h-px flex-1 bg-border/60" />
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            {/* Replies */}
            {replies.map((r) => (
              <div key={r.msg_id} id={`msg-${r.msg_id}`}>
                <MessageBubble
                  msg={r}
                  currentUsername={currentUsername}
                  onReact={onReact}
                  onReply={handleReply}
                  allMessages={[rootMsg, ...replies]}
                />
              </div>
            ))}
          </div>
        </ScrollArea>

        <ThreadComposer
          group={group}
          currentUsername={currentUsername}
          userAvatar={userAvatar}
          table={table}
          rootMsgId={rootMsg.msg_id}
        />
      </motion.aside>
    </AnimatePresence>
  );
}
