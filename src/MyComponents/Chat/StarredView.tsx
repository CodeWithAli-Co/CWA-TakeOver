/**
 * StarredView.tsx — Virtual channel listing every message the current
 * user has starred. Pulls each message from its source table on mount
 * so starred messages survive app reloads even if the channel isn't open.
 */

import { useEffect, useMemo, useState } from "react";
import { Star, StarOff } from "lucide-react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import supabase from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";
import { useAppStore } from "@/stores/store";
import type { MessageInterface } from "@/stores/query";
import { MessageBubble } from "./MessageBubble";

interface Props {
  currentUsername: string;
  onReact: (msgId: number, emoji: string) => Promise<void> | void;
}

export function StarredView({ currentUsername, onReact }: Props) {
  const { starredMessages, toggleStarred } = useChatStore();
  const { setGroupName } = useAppStore();
  const [items, setItems] = useState<(MessageInterface & { _group: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const results: (MessageInterface & { _group: string })[] = [];
      await Promise.all(
        starredMessages.map(async (s) => {
          const { data } = await supabase
            .from(s.table)
            .select("*")
            .eq("msg_id", s.msgId)
            .single();
          if (data) results.push({ ...(data as MessageInterface), _group: s.group });
        }),
      );
      if (!cancelled) {
        results.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        setItems(results);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [starredMessages]);

  const allMessages = useMemo(() => items.map((x) => x as MessageInterface), [items]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-5">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <h2 className="text-[13px] font-semibold text-foreground">
          Starred messages
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {items.length}
        </span>
      </header>

      <ScrollArea className="flex-1">
        {loading ? (
          <p className="px-5 py-10 text-center text-[12px] text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <StarOff className="mb-3 h-7 w-7 text-muted-foreground/40" />
            <p className="text-[13px] text-muted-foreground/80">
              You haven't starred any messages yet.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Star a message from its ⋯ menu to bookmark it here.
            </p>
          </div>
        ) : (
          <div className="py-3">
            {items.map((m) => (
              <div key={m.msg_id} className="group/item">
                <div className="flex items-center justify-between border-b border-border/40 px-5 pt-3 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setGroupName(m._group)}
                    className="hover:text-foreground"
                  >
                    #{m._group}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      toggleStarred({
                        msgId: m.msg_id,
                        group: m._group,
                        table: m.dm_group ? "cwa_dm_chat" : "cwa_chat",
                      })
                    }
                    className="flex items-center gap-1 text-amber-400/70 hover:text-amber-400"
                  >
                    <Star className="h-3 w-3 fill-amber-400" />
                    Unstar
                  </button>
                </div>
                <MessageBubble
                  msg={m}
                  currentUsername={currentUsername}
                  onReact={onReact}
                  onReply={() => void 0}
                  allMessages={allMessages}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
