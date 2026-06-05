/**
 * SlackInChat.tsx — Slack workspace as a tab inside TakeOver Chat.
 *
 * Three pieces live here, deliberately co-located so the whole
 * Slack-as-a-section feature is one file to read or revert:
 *
 *   · useSlackChannels()         — React Query around slackListChannels
 *   · useSlackChannelHistory()   — React Query around slackChannelHistory +
 *                                  slackListUsers (parallel)
 *   · usePostSlackMessage()      — Mutation around slackPostMessage with
 *                                  optimistic invalidation
 *   · SlackSidebarSection        — Workspace name + channel list rendered
 *                                  inside ChatSidebar
 *   · SlackChannelView           — Replaces MessageList + MessageComposer
 *                                  when a Slack channel is selected in
 *                                  ChatLayout
 *
 * Data path: lib/slack.ts → takeover-B2B proxy → slack.com. Bot
 * tokens are looked up server-side from the tenant's connector row,
 * so this module never has to handle credentials.
 *
 * Visual treatment: subtle "via Slack" badge in the header so the
 * user always knows they're posting to the external workspace, not
 * to TakeOver Chat. Same reason the channel list shows under a
 * distinct "SLACK" eyebrow in the sidebar — keeps the boundary
 * between the two messaging systems obvious.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Hash,
  Send,
  Slack as SlackIcon,
  Loader2,
  AlertCircle,
  Lock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAppStore } from "@/stores/store";
import { useConnectors } from "@/stores/connectors";
import {
  slackAuthorLabel,
  slackChannelHistory,
  slackListChannels,
  slackListUsers,
  slackPostMessage,
  type SlackChannel,
  type SlackMessage,
  type SlackUser,
} from "@/lib/slack";

// ────────────────────────────────────────────────
// Hooks
// ────────────────────────────────────────────────

/** Pull the operator-visible Slack channels for the connected tenant.
 *  Public channels by default; pass `includePrivate` when we want
 *  to surface privates the bot's been invited to (requires
 *  `groups:read` scope on the Slack App). */
function useSlackChannels(opts: { includePrivate?: boolean } = {}) {
  return useQuery<SlackChannel[]>({
    queryKey: ["slack", "channels", opts.includePrivate ?? false],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const types = opts.includePrivate
        ? "public_channel,private_channel"
        : "public_channel";
      return slackListChannels({ limit: 500, types });
    },
  });
}

/** Pull the last N messages + the user directory for one channel.
 *  The directory comes back in parallel so we can render author
 *  labels immediately rather than showing `@U123` first. */
function useSlackChannelHistory(
  channelId: string | null,
  opts: { limit?: number } = {},
) {
  return useQuery<{ messages: SlackMessage[]; users: Map<string, SlackUser> }>({
    queryKey: ["slack", "history", channelId, opts.limit ?? 40],
    enabled: !!channelId,
    // 30s window keeps the demo fresh without flooding Slack rate
    // limits when the operator is rapidly clicking between channels.
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!channelId) return { messages: [], users: new Map() };
      const [messages, users] = await Promise.all([
        slackChannelHistory(channelId, opts.limit ?? 40),
        slackListUsers().catch(() => [] as SlackUser[]),
      ]);
      return {
        messages,
        users: new Map(users.map((u) => [u.id, u] as const)),
      };
    },
  });
}

/** Post a message — invalidates the channel history so the new
 *  message shows up without waiting for the polling tick. */
function usePostSlackMessage(channelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!channelId) throw new Error("No Slack channel selected.");
      if (!text.trim()) throw new Error("Message is empty.");
      return slackPostMessage({ channel: channelId, text });
    },
    onSuccess: () => {
      // Refresh every history view for this channel — caller might
      // be using a different limit than the polling view.
      qc.invalidateQueries({ queryKey: ["slack", "history", channelId] });
    },
  });
}

// ────────────────────────────────────────────────
// SlackSidebarSection — drops into ChatSidebar
// ────────────────────────────────────────────────

export const SlackSidebarSection: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { data: connectors = [] } = useConnectors();
  const slackConn = useMemo(
    () => connectors.find((c) => c.kind === "slack" && c.status === "connected"),
    [connectors],
  );

  // Workspace label — display_name on the connector row, falling back
  // to "Slack" if the connectorSummary hasn't populated it yet.
  const workspace = slackConn?.display_name ?? "Slack";

  const { setGroupName } = useAppStore();
  const activeSlackChannelId = useChatStore((s) => s.activeSlackChannelId);
  const setActiveSlackChannel = useChatStore((s) => s.setActiveSlackChannel);

  const { data: channels, isLoading, isError, error } = useSlackChannels();

  // Auto-hide entirely when Slack isn't connected — keeps the
  // sidebar clean for tenants who haven't wired it.
  if (!slackConn) return null;

  // Click a Slack channel → switch the chat surface. Clearing
  // GroupName makes ChatLayout drop its native MessageList/Composer
  // (Messages query becomes inert), and setActiveSlackChannel
  // promotes our SlackChannelView in its place.
  const select = (c: SlackChannel) => {
    setGroupName("");
    setActiveSlackChannel(c.id, `#${c.name}`);
  };

  return (
    <div className="pt-2">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-text-tertiary hover:text-foreground/85 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <SlackIcon className="h-3 w-3" />
        <span className="truncate flex-1 text-left">SLACK · {workspace}</span>
        {channels && (
          <span className="text-[9.5px] font-semibold text-text-tertiary/70 tabular-nums">
            {channels.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-1 space-y-0.5">
          {isLoading && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-tertiary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading channels…
            </div>
          )}
          {isError && (
            <div className="px-2 py-1 text-[11px] text-warning flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              <span className="truncate">
                {(error as Error)?.message ?? "Slack unavailable"}
              </span>
            </div>
          )}
          {channels?.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-text-tertiary italic">
              Invite the bot to a channel first: <code>/invite @TakeOver</code>
            </p>
          )}
          {channels?.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-[12px] transition-colors text-left ${
                activeSlackChannelId === c.id
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
              }`}
              title={c.purpose?.value || c.topic?.value || c.name}
            >
              {c.is_private ? (
                <Lock className="h-3 w-3 shrink-0 opacity-70" />
              ) : (
                <Hash className="h-3 w-3 shrink-0 opacity-70" />
              )}
              <span className="truncate flex-1">{c.name}</span>
              {!c.is_member && (
                <span className="text-[9px] uppercase tracking-wider text-text-tertiary/70 shrink-0">
                  invite
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// SlackChannelView — replaces MessageList + Composer
// ────────────────────────────────────────────────

export const SlackChannelView: React.FC = () => {
  const activeSlackChannelId = useChatStore((s) => s.activeSlackChannelId);
  const activeSlackChannelName = useChatStore((s) => s.activeSlackChannelName);

  const { data, isLoading, isError, error } = useSlackChannelHistory(activeSlackChannelId);
  const post = usePostSlackMessage(activeSlackChannelId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message on load + after post.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages?.length]);

  if (!activeSlackChannelId) return null;

  // Slack returns newest-first; flip to oldest-first for natural
  // reading order in the message list.
  const ordered = useMemo(() => {
    const m = data?.messages ?? [];
    return [...m].reverse();
  }, [data?.messages]);

  const handleSend = async () => {
    if (!draft.trim() || post.isPending) return;
    try {
      await post.mutateAsync(draft);
      setDraft("");
    } catch {
      // Error surfaced via post.isError below.
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
      {/* Header — distinct "via Slack" badge so the operator always
       *  knows they're in the external workspace, not TakeOver Chat. */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-soft bg-card/40">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 text-foreground/60 shrink-0" />
          <h2 className="text-[14px] font-bold text-foreground truncate">
            {activeSlackChannelName ?? "Slack"}
          </h2>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border-soft bg-foreground/[0.04] text-[9.5px] font-mono uppercase tracking-[0.16em] text-text-tertiary shrink-0">
            <SlackIcon className="h-2.5 w-2.5" />
            via Slack
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              {ordered.length} msg
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
      >
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-text-tertiary text-[12px]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Reading channel…
          </div>
        )}
        {isError && (
          <div className="border border-warning/30 bg-warning/[0.08] rounded-lg px-3 py-2 text-[12px] text-warning flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {(error as Error)?.message ?? "Couldn't load this Slack channel."}
            </span>
          </div>
        )}
        {!isLoading && !isError && ordered.length === 0 && (
          <p className="text-center text-text-tertiary text-[12px] italic py-12">
            No messages here yet. Send the first one ↓
          </p>
        )}
        {ordered.map((m) => (
          <SlackMessageRow key={m.ts} m={m} userDir={data?.users ?? new Map()} />
        ))}
      </div>

      {/* Composer — posts via the proxy on Enter (Shift+Enter for newline). */}
      <div className="border-t border-border-soft px-4 py-3 bg-card/30">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${activeSlackChannelName ?? "Slack"} — Enter to send · Shift+Enter for newline`}
            rows={2}
            className="flex-1 resize-none rounded-md border border-border-soft bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            disabled={post.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || post.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/40 bg-primary/[0.1] hover:bg-primary/[0.18] text-[11px] font-mono uppercase tracking-wider text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {post.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Send
          </button>
        </div>
        {post.isError && (
          <p className="text-[11px] text-warning mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {(post.error as Error)?.message ?? "Send failed."}
          </p>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// SlackMessageRow — one rendered message
// ────────────────────────────────────────────────

function SlackMessageRow({
  m,
  userDir,
}: {
  m: SlackMessage;
  userDir: Map<string, SlackUser>;
}) {
  const author = slackAuthorLabel(m, userDir);
  const when = useMemo(() => {
    const seconds = Number(m.ts.split(".")[0]);
    if (!Number.isFinite(seconds)) return "";
    return new Date(seconds * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [m.ts]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex gap-2 group"
    >
      <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border-soft flex items-center justify-center text-[11px] font-bold text-foreground/80">
        {author.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-foreground">
            {author}
          </span>
          <span className="text-[10.5px] text-text-tertiary tabular-nums">
            {when}
          </span>
        </div>
        <p className="text-[13px] text-foreground/90 whitespace-pre-wrap break-words">
          {m.text || <em className="text-text-tertiary">(no text)</em>}
        </p>
        {(m.reply_count ?? 0) > 0 && (
          <p className="text-[11px] text-text-tertiary mt-1">
            <ExternalLink className="inline-block h-2.5 w-2.5 mr-1 align-baseline" />
            {m.reply_count} repl{m.reply_count === 1 ? "y" : "ies"} in thread
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default SlackChannelView;
