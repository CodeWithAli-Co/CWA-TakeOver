/**
 * ThreadsView.tsx — Virtual "Threads" channel showing every thread the
 * user has participated in OR been mentioned in, across all channels.
 *
 * For each thread-root message we render:
 *   · The root message preview
 *   · Count of replies + last-reply timestamp
 *   · Click → sets GroupName + activeThreadRootId → ThreadPanel/ThreadInline opens
 *
 * Query strategy: pull recent messages with thread_root_id from both
 * cwa_chat and cwa_dm_chat, group by root, keep threads where the
 * current user has either sent a reply or is the root author.
 */

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, ChevronRight, Hash, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { companySupabase } from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";
import { useChatStore } from "@/stores/chatStore";
import { formatDistanceToNow } from "date-fns";
import { displayLabelForDM, isDMKey } from "./displayName";

interface ThreadSummary {
  rootId: number;
  group: string;
  table: "cwa_chat" | "cwa_dm_chat";
  rootSender: string;
  rootText: string;
  rootAt: string;
  replyCount: number;
  lastReplyAt: string;
  participants: Set<string>;
}

interface Props {
  currentUsername: string;
}

const LOOKBACK_LIMIT = 500;

export function ThreadsView({ currentUsername }: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { setGroupName } = useAppStore();
  const { setActiveThreadRootId } = useChatStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Pull recent thread replies from both tables. Keep it to 500 rows
      // per table — generous enough for a week+ of normal activity.
      const [c1, c2] = await Promise.all([
        supabase
          .from("cwa_chat")
          .select("msg_id, sent_by, message, created_at, thread_root_id")
          .not("thread_root_id", "is", null)
          .order("msg_id", { ascending: false })
          .limit(LOOKBACK_LIMIT),
        supabase
          .from("cwa_dm_chat")
          .select("msg_id, sent_by, message, created_at, thread_root_id, dm_group")
          .not("thread_root_id", "is", null)
          .order("msg_id", { ascending: false })
          .limit(LOOKBACK_LIMIT),
      ]);

      const bucketed = new Map<string, ThreadSummary>();
      const put = (
        table: "cwa_chat" | "cwa_dm_chat",
        group: string,
        row: any,
      ) => {
        const key = `${table}::${row.thread_root_id}`;
        let s = bucketed.get(key);
        if (!s) {
          s = {
            rootId: row.thread_root_id,
            group,
            table,
            rootSender: "",
            rootText: "",
            rootAt: "",
            replyCount: 0,
            lastReplyAt: row.created_at || "",
            participants: new Set<string>(),
          };
          bucketed.set(key, s);
        }
        s.replyCount += 1;
        if (row.sent_by) s.participants.add(row.sent_by);
        if ((row.created_at || "") > s.lastReplyAt) s.lastReplyAt = row.created_at;
      };

      for (const r of c1.data ?? []) put("cwa_chat", "General", r);
      for (const r of c2.data ?? []) put("cwa_dm_chat", r.dm_group, r);

      // Fetch each root message (small batch per table).
      const rootIdsByTable: Record<string, number[]> = {
        cwa_chat: [],
        cwa_dm_chat: [],
      };
      for (const s of bucketed.values()) rootIdsByTable[s.table].push(s.rootId);

      const roots = new Map<string, { sent_by: string; message: string; created_at: string }>();
      await Promise.all(
        (Object.keys(rootIdsByTable) as Array<keyof typeof rootIdsByTable>).map(
          async (table) => {
            const ids = rootIdsByTable[table];
            if (ids.length === 0) return;
            const { data } = await companySupabase
        .from(table)
              .select("msg_id, sent_by, message, created_at")
              .in("msg_id", ids.slice(0, 200));
            for (const r of data ?? []) {
              roots.set(`${table}::${r.msg_id}`, r as any);
            }
          },
        ),
      );

      const out: ThreadSummary[] = [];
      for (const [key, s] of bucketed) {
        const root = roots.get(key);
        if (root) {
          s.rootSender = root.sent_by || "";
          s.rootText = root.message || "";
          s.rootAt = root.created_at || s.lastReplyAt;
          if (root.sent_by) s.participants.add(root.sent_by);
        }
        // Only include threads where the current user participated OR
        // was the root author.
        if (s.participants.has(currentUsername)) out.push(s);
      }
      out.sort((a, b) => (b.lastReplyAt || "").localeCompare(a.lastReplyAt || ""));
      if (!cancelled) {
        setThreads(out);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUsername]);

  const openThread = (t: ThreadSummary) => {
    setGroupName(t.group);
    // Give the group switch a beat to settle, then open the thread pane.
    setTimeout(() => setActiveThreadRootId(t.rootId), 120);
  };

  const empty = !loading && threads.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-[13.5px] font-semibold text-foreground">Threads</h2>
          <p className="text-[10.5px] text-muted-foreground">
            Every thread you've participated in
          </p>
        </div>
        <div className="ml-auto font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
          {loading ? "…" : `${threads.length} active`}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-[12px]">Loading threads…</span>
            </div>
          )}

          {empty && (
            <div className="text-center max-w-sm mx-auto py-16">
              <MessageSquare className="h-6 w-6 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-[13px] text-muted-foreground/80 font-medium mb-1">
                No threads yet
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                Reply in-thread on any message and it'll show up here.
              </p>
            </div>
          )}

          {threads.map((t) => (
            <ThreadCard
              key={`${t.table}-${t.rootId}`}
              t={t}
              currentUsername={currentUsername}
              onOpen={() => openThread(t)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ThreadCard({
  t, currentUsername, onOpen,
}: {
  t: ThreadSummary;
  currentUsername: string;
  onOpen: () => void;
}) {
  // Display layer — never leak the raw "dm::Ali::Mason" storage key.
  const channelLabel = displayLabelForDM(t.group, currentUsername);
  const isDM = isDMKey(t.group);
  const participantList = useMemo(() => Array.from(t.participants), [t.participants]);
  const lastRel = t.lastReplyAt
    ? formatDistanceToNow(new Date(t.lastReplyAt), { addSuffix: true })
    : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-1.5 rounded-lg border border-border/50 bg-card/40 p-3 text-left transition-colors hover:border-primary/30 hover:bg-card/60"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-5 items-center gap-1 rounded-full bg-muted/40 px-2 text-[10.5px] font-medium text-muted-foreground">
          {isDM ? null : <Hash className="h-2.5 w-2.5" />}
          <span className="truncate max-w-[160px]">{channelLabel}</span>
        </div>
        <span className="text-[10.5px] text-muted-foreground">
          {participantList.length} {participantList.length === 1 ? "person" : "people"}
        </span>
        <span className="ml-auto text-[10.5px] text-muted-foreground/70">
          {lastRel}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60" />
      </div>
      <div className="text-[12.5px] text-foreground/90">
        <span className="font-semibold text-foreground">{t.rootSender || "Unknown"}</span>
        <span className="text-muted-foreground/70"> · </span>
        <span className="line-clamp-2 text-foreground/80">
          {(t.rootText || "[attachment]").replace(/^\{[^}]+\}\s*\n?/, "")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/80">
        <MessageSquare className="h-3 w-3 text-primary/70" />
        {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}
      </div>
    </button>
  );
}
