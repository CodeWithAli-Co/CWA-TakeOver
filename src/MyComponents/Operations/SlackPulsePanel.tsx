/**
 * SlackPulsePanel.tsx — full-width "team pulse" surface on
 * /operations. Renders the top-N most active public channels
 * the connected Slack bot can see, with a peek at the last
 * few messages in each.
 *
 * Auto-hides when:
 *   · no Slack connector exists for the active tenant, OR
 *   · the bot can see zero channels (lets demo-day fall back
 *     to a clean dashboard without an empty card).
 *
 * Networking strategy:
 *   · One conversations.list call up front, sorted by member
 *     count as a proxy for "primary channels".
 *   · One users.list call to resolve author labels.
 *   · One conversations.history call per channel in parallel.
 *   Three round-trips total, all CORS-safe direct to Slack.
 *
 * 60-second TanStack staleTime keeps the demo fresh without
 * pounding Slack's rate limits during testing.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Hash, MessageSquare, AlertCircle, Loader2, Slack as SlackIcon } from "lucide-react";
import { useConnectors } from "@/stores/connectors";
import {
  slackListChannels,
  slackChannelHistory,
  slackListUsers,
  slackAuthorLabel,
  type SlackChannel,
  type SlackMessage,
  type SlackUser,
} from "@/lib/slack";

const TOP_CHANNELS = 4;
const MESSAGES_PER_CHANNEL = 4;
const STALE_MS = 60_000;

interface ChannelPulse {
  channel: SlackChannel;
  messages: SlackMessage[];
}

interface PulseData {
  team: string;
  channels: ChannelPulse[];
  userDir: Map<string, SlackUser>;
}

export function SlackPulsePanel() {
  const { data: connectors = [] } = useConnectors();
  const slack = useMemo(
    () => connectors.find((c) => c.kind === "slack" && c.status === "connected"),
    [connectors],
  );
  const botToken = useMemo(() => {
    const creds = (slack?.credentials ?? {}) as Record<string, unknown>;
    return typeof creds.bot_token === "string" ? creds.bot_token.trim() : "";
  }, [slack]);

  const pulse = useQuery<PulseData>({
    queryKey: ["slack", "pulse", slack?.id ?? "none"],
    enabled: !!botToken,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Parallel: channels + users. We need both before we can show
      // anything, so launching them concurrently halves perceived
      // latency vs sequential.
      const [allChannels, users] = await Promise.all([
        slackListChannels(botToken, { limit: 100, types: "public_channel" }),
        slackListUsers(botToken).catch(() => [] as SlackUser[]),
      ]);
      const userDir = new Map(users.map((u) => [u.id, u] as const));

      // Rank channels: member count desc is a decent "primary
      // channels" proxy without per-channel activity queries. Filter
      // to channels the bot is actually a member of since
      // conversations.history will refuse otherwise.
      const ranked = allChannels
        .filter((c) => !c.is_archived && c.is_member !== false)
        .sort((a, b) => (b.num_members ?? 0) - (a.num_members ?? 0))
        .slice(0, TOP_CHANNELS);

      // Parallel histories — bounded fanout (TOP_CHANNELS = 4) so
      // this is safe. Individual failures don't fail the whole
      // panel; we render whatever came back.
      const histories = await Promise.all(
        ranked.map((c) =>
          slackChannelHistory(botToken, c.id, MESSAGES_PER_CHANNEL).catch(
            () => [] as SlackMessage[],
          ),
        ),
      );

      // Best-effort team name lookup — already cached by the
      // connector summary, but we don't depend on that and a single
      // auth.test isn't visible in the user count. Derive from the
      // connector display_name when available.
      const team =
        (typeof slack?.display_name === "string" && slack.display_name) ||
        ranked[0]?.purpose?.value ||
        "Slack";

      return {
        team,
        channels: ranked.map((c, i) => ({ channel: c, messages: histories[i] })),
        userDir,
      };
    },
  });

  // No Slack connector → render nothing. Dashboard stays clean for
  // fresh installs and tenants who haven't wired Slack.
  if (!slack) return null;

  // Slack connected but the pulse query failed (token revoked, scope
  // missing, network blip). Show an inline diagnostic line, not a
  // collapsed panel — the operator needs to know.
  if (pulse.isError) {
    return (
      <PanelShell title="Team pulse" subtitle="Slack">
        <div className="flex items-center gap-2 text-[11.5px] text-warning">
          <AlertCircle className="h-3.5 w-3.5" />
          {(pulse.error as Error)?.message ?? "Slack pulse failed to load."}
        </div>
      </PanelShell>
    );
  }

  if (pulse.isLoading || !pulse.data) {
    return (
      <PanelShell title="Team pulse" subtitle="Slack">
        <div className="flex items-center gap-2 text-[11.5px] text-text-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading channels…
        </div>
      </PanelShell>
    );
  }

  const data = pulse.data;

  // Zero visible channels — bot installed but no channel access.
  // Same hide-by-default rationale as ConnectorsStrip.
  if (data.channels.length === 0) {
    return (
      <PanelShell title="Team pulse" subtitle={data.team}>
        <p className="text-[11.5px] text-text-tertiary">
          The bot can't see any public channels yet. Invite it to a
          channel in Slack with <code>/invite @{slack.display_name ?? "Takeover"}</code>.
        </p>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Team pulse" subtitle={data.team}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {data.channels.map(({ channel, messages }) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            messages={messages}
            userDir={data.userDir}
          />
        ))}
      </div>
    </PanelShell>
  );
}

// ────────────────────────────────────────────────
// Shared chrome — matches the other dashboard panels.
// ────────────────────────────────────────────────

function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] px-4 py-3"
    >
      <header className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <SlackIcon className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/85">
            {title}
          </span>
          <span className="text-[10px] font-semibold text-text-tertiary">
            · {subtitle}
          </span>
        </div>
      </header>
      {children}
    </motion.section>
  );
}

// ────────────────────────────────────────────────
// ChannelCard — one channel, last N messages.
// ────────────────────────────────────────────────

function ChannelCard({
  channel,
  messages,
  userDir,
}: {
  channel: SlackChannel;
  messages: SlackMessage[];
  userDir: Map<string, SlackUser>;
}) {
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] transition-colors px-3 py-2.5 flex flex-col gap-2">
      <header className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Hash className="h-3 w-3 text-foreground/60 shrink-0" />
          <span className="text-[12px] font-bold text-foreground truncate">
            {channel.name}
          </span>
        </div>
        {channel.num_members != null && (
          <span className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] text-text-tertiary font-bold shrink-0">
            <MessageSquare className="h-2.5 w-2.5" />
            {channel.num_members}
          </span>
        )}
      </header>

      {messages.length === 0 ? (
        <p className="text-[11px] text-text-tertiary italic">No recent messages.</p>
      ) : (
        <ul className="space-y-1.5">
          {messages.map((m) => (
            <li key={m.ts} className="text-[11px] leading-tight">
              <span className="font-semibold text-foreground/90">
                {slackAuthorLabel(m, userDir)}
              </span>
              <span className="text-text-tertiary">: </span>
              <span className="text-foreground/75">
                {/* Slack formatting can include <@user> mentions and
                 *  <url|text> links. The pulse preview leaves them
                 *  raw — operators recognize the shape and the goal
                 *  here is "did the team talk", not "render Slack
                 *  HTML perfectly". */}
                {truncate(m.text ?? "", 120)}
              </span>
              {(m.reply_count ?? 0) > 0 && (
                <span className="text-text-tertiary ml-1.5">
                  · {m.reply_count} repl{m.reply_count === 1 ? "y" : "ies"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > n ? trimmed.slice(0, n - 1).trimEnd() + "…" : trimmed;
}

export default SlackPulsePanel;
