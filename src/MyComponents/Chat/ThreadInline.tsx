/**
 * ThreadInline.tsx — Discord-style inline thread.
 *
 * Renders nested replies directly under a root message with a left-side
 * accent rail. Collapsible via the root's "N replies" chip.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import { fetchThreadReplies } from "@/stores/query";
import type { MessageInterface } from "@/stores/query";
import { MessageBubble } from "./MessageBubble";
import { ThreadComposer } from "./ThreadComposer";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  rootMsg: MessageInterface;
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";
  onReact: (msgId: number, emoji: string) => void;
  defaultOpen?: boolean;
}

export function ThreadInline({
  rootMsg,
  group,
  currentUsername,
  userAvatar,
  table,
  onReact,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [replies, setReplies] = useState<MessageInterface[]>([]);
  const { setReplyingTo } = useChatStore();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchThreadReplies(group, rootMsg.msg_id).then((r) => {
      if (!cancelled) setReplies(r);
    });
    return () => {
      cancelled = true;
    };
  }, [open, group, rootMsg.msg_id]);

  useEffect(() => {
    if (!open) return;
    const channel = companySupabase
      .channel(`thread-inline-${table}-${rootMsg.msg_id}`)
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
  }, [open, group, rootMsg.msg_id, table]);

  const handleReply = (m: MessageInterface) => {
    setReplyingTo({
      msgId: m.msg_id,
      sentBy: m.sent_by,
      preview: m.message.slice(0, 60),
    });
  };

  return (
    <div className="ml-14 mt-1 border-l-2 border-primary/30 pl-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-1">
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
              <div className="mt-2">
                <ThreadComposer
                  group={group}
                  currentUsername={currentUsername}
                  userAvatar={userAvatar}
                  table={table}
                  rootMsgId={rootMsg.msg_id}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
