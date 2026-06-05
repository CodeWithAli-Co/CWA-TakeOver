/**
 * InboxPage — full-width email client surface at /inbox.
 *
 * Layout (revised polish v2):
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ MAIL                                                          │
 *   │ Inbox                              [Sync]  [Compose]          │
 *   │ Send email from inside Takeover…                              │
 *   ╞══════════════════════╤══════════════════════════════════════╡
 *   │ Rail (300px)         │ List (fill remaining)                  │
 *   │                      │                                         │
 *   │ ▸ Inbox       3      │ TODAY                                   │
 *   │ ▸ Sent       12      │ ● John   Re: pricing       2h          │
 *   │                      │ ● Sarah  Quick question    5h          │
 *   │ This week            │                                         │
 *   │ Received    8        │ YESTERDAY                               │
 *   │ Sent       12        │ ● Bob    Update            1d          │
 *   │                      │                                         │
 *   │ Connected            │                                         │
 *   │ user@gmail.com       │                                         │
 *   │ Last sync 5m ago     │                                         │
 *   └──────────────────────┴────────────────────────────────────────┘
 *
 * Why this layout: the previous "single centered card" felt lonely
 * on a wide screen. Real email clients use a left rail because it
 * gives the eye a vertical anchor, lets stats live somewhere
 * useful, and frees the main column to be wide enough that rows
 * breathe. The whole surface fills the viewport width so the page
 * never feels like there's wasted gutter.
 *
 * No nested card — the page itself is the surface. Subtle vertical
 * divider between rail + list does all the structural work.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  Send,
  Plug,
  RefreshCw,
  Inbox as InboxIcon,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  useGmailConnection,
  useSyncInbox,
  useInboxActivities,
  type InboxActivity,
} from "@/stores/gmail";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { useNavigate } from "@tanstack/react-router";

const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fromDisplayName(from?: string): string {
  if (!from) return "Unknown sender";
  const m = from.match(/^"?([^"<]+?)"?\s*<.+>/);
  if (m && m[1].trim()) return m[1].trim();
  return from.split("@")[0] || from;
}

function initialFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function countSince(items: InboxActivity[], days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((i) => new Date(i.happened_at).getTime() >= cutoff).length;
}

// ────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────

type Tab = "inbox" | "sent";

export const InboxPage: React.FC = () => {
  const { data: connection, isLoading: connLoading } = useGmailConnection();
  const [composeOpen, setComposeOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("inbox");
  const navigate = useNavigate();
  const sync = useSyncInbox();

  const inbound = useInboxActivities({ direction: "inbound", limit: 200 });
  const outbound = useInboxActivities({ direction: "outbound", limit: 200 });

  const inboundAll = inbound.data ?? [];
  const outboundAll = outbound.data ?? [];

  // Auto-sync on mount when opted in.
  const didAutoSync = useRef(false);
  useEffect(() => {
    if (didAutoSync.current) return;
    if (!connection?.sync_enabled) return;
    didAutoSync.current = true;
    sync.mutate(undefined, {
      onError: (e) => console.warn("[inbox] auto-sync failed:", e),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.sync_enabled]);

  const visible = tab === "inbox" ? inboundAll : outboundAll;
  const listLoading = tab === "inbox" ? inbound.isLoading : outbound.isLoading;

  const receivedThisWeek = countSince(inboundAll, 7);
  const sentThisWeek = countSince(outboundAll, 7);

  return (
    <div
      className="min-h-screen w-full text-zinc-100 flex flex-col bg-zinc-950"
    >
      {/* ─── Top header bar — spans the whole page ───
          Carries the same gradient surface treatment as the cards
          throughout the app so the header reads as an elevated
          strip instead of letting eyebrows/title float on the
          flat page background. The downward fade into the body
          adds a natural separation without needing a hard line. */}
      <header
        className="border-b border-white/[0.06] px-8 pt-8 pb-6 flex items-start justify-between gap-6 bg-zinc-900/60"
      >
        <div className="min-w-0">
          <p className={eyebrow}>Mail</p>
          <h1
            className="text-[34px] leading-[1.05] text-zinc-50 mt-1.5"
            style={{ fontFamily: "Newsreader, Georgia, serif" }}
          >
            Inbox
          </h1>
          <p className="text-[12.5px] text-zinc-400 mt-2 max-w-[560px] leading-relaxed">
            Send and receive email inside Takeover with your connected Gmail.
            Replies from CRM contacts sync into deal timelines automatically
            when auto-sync is on.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          {connLoading ? (
            <div className="h-5 w-40 bg-white/[0.04] rounded-full animate-pulse" />
          ) : connection ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-mono">{connection.email}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/settings",
                  search: { tab: "connectors" } as any,
                })
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/[0.06] text-[11px] font-mono text-amber-200 hover:bg-amber-500/[0.1] transition-colors"
            >
              <Plug className="h-3 w-3" />
              Connect Gmail
            </button>
          )}

          {connection && (
            <div className="flex items-center gap-2">
              {connection.sync_enabled && (
                <button
                  type="button"
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending}
                  title={
                    sync.isPending
                      ? "Syncing inbox…"
                      : connection.last_sync_at
                        ? `Last synced ${new Date(connection.last_sync_at).toLocaleTimeString()}`
                        : "Sync inbox now"
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] hover:border-emerald-500/35 hover:bg-emerald-500/[0.04] text-[10.5px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${sync.isPending ? "animate-spin" : ""}`}
                  />
                  {sync.isPending ? "Syncing…" : "Sync"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[10.5px] font-mono uppercase tracking-[0.16em] text-emerald-200 rounded-md transition-colors"
              >
                <Send className="h-3 w-3" />
                Compose
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── Sync-off nudge ─── */}
      {connection && !connection.sync_enabled && (
        <div className="px-8 py-3 border-b border-white/[0.05] bg-amber-500/[0.025] flex items-start gap-2 text-[11.5px] text-amber-200/90">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">
            Auto-sync is off — incoming replies won't appear here. Turn it on
            in{" "}
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/settings",
                  search: { tab: "connectors" } as any,
                })
              }
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Settings → Connectors
            </button>
            .
          </span>
        </div>
      )}

      {/* ─── Two-column body — fills remaining viewport height ─── */}
      <div className="flex-1 flex min-h-0">
        {/* Left rail — between body and header in the elevation
            stack. Translucent zinc layer so it blends with the
            existing app palette instead of inventing a new tone. */}
        <aside className="w-[280px] shrink-0 border-r border-white/[0.06] bg-zinc-900/30 flex flex-col">
          <nav className="p-5 space-y-1">
            <RailButton
              active={tab === "inbox"}
              onClick={() => setTab("inbox")}
              icon={<InboxIcon className="h-3.5 w-3.5" />}
              label="Inbox"
              count={inboundAll.length}
            />
            <RailButton
              active={tab === "sent"}
              onClick={() => setTab("sent")}
              icon={<Send className="h-3.5 w-3.5" />}
              label="Sent"
              count={outboundAll.length}
            />
          </nav>

          <div className="px-5 pb-5 space-y-5 flex-1 overflow-y-auto">
            {/* This week stats */}
            <StatBlock label="This week">
              <StatRow label="Received" value={receivedThisWeek} />
              <StatRow label="Sent" value={sentThisWeek} />
            </StatBlock>

            {/* Recent senders — top 5 unique contacts */}
            {inboundAll.length > 0 && (
              <StatBlock label="Top senders">
                {topSenders(inboundAll, 5).map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    onClick={() => {
                      // Best-effort jump to the contact whose
                      // inbound row we're highlighting.
                      const row = inboundAll.find(
                        (i) => i.metadata?.from === s.email,
                      );
                      if (row?.deal_id) {
                        navigate({ to: "/sales", search: { deal: row.deal_id } as any });
                      } else if (row?.contact_id) {
                        navigate({ to: "/sales", search: { contact: row.contact_id } as any });
                      }
                    }}
                    className="w-full flex items-center justify-between gap-2 px-1 py-1 rounded text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[11.5px] text-zinc-300 truncate">
                      {fromDisplayName(s.email)}
                    </span>
                    <span className={`text-[10px] ${monoNum} text-zinc-500 shrink-0`}>
                      {s.count}
                    </span>
                  </button>
                ))}
              </StatBlock>
            )}

            {/* Connection footer card */}
            {connection && (
              <StatBlock label="Connected">
                <p className="text-[11.5px] text-zinc-300 truncate">
                  {connection.email}
                </p>
                {connection.last_sync_at && connection.sync_enabled && (
                  <p className={`text-[10px] ${monoNum} text-zinc-500 mt-1`}>
                    Last sync{" "}
                    {relTime(connection.last_sync_at)} ago
                  </p>
                )}
                {!connection.sync_enabled && (
                  <p className="text-[10px] text-amber-300/70 mt-1">
                    Auto-sync off
                  </p>
                )}
              </StatBlock>
            )}

            {/* Tip card — appears only on the Inbox tab when empty */}
            {tab === "inbox" && inboundAll.length === 0 && connection?.sync_enabled && (
              <div className="border border-emerald-500/20 bg-emerald-500/[0.03] rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                  Replies from contacts in your CRM will appear here. Try
                  sending a deal-attached email and asking for a reply.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main list */}
        <main className="flex-1 min-w-0 flex flex-col">
          <InboxList
            items={visible}
            isLoading={listLoading}
            tab={tab}
            syncEnabled={connection?.sync_enabled ?? false}
            hasConnection={!!connection}
          />
        </main>
      </div>

      {composeOpen && (
        <ComposeEmailModal onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

const RailButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}> = ({ active, onClick, icon, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-[12.5px] transition-colors ${
      active
        ? "text-zinc-100 bg-white/[0.06] border border-white/[0.06]"
        : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] border border-transparent"
    }`}
  >
    <span className="flex items-center gap-2">
      {icon}
      <span className="font-mono uppercase tracking-[0.12em] text-[11px]">
        {label}
      </span>
    </span>
    <span
      className={`px-1.5 py-px rounded-full text-[9.5px] ${monoNum} ${
        active
          ? "bg-emerald-500/15 text-emerald-300/90"
          : "bg-white/[0.04] text-zinc-500"
      }`}
    >
      {count}
    </span>
  </button>
);

const StatBlock: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <section>
    <p className={`${eyebrow} mb-2`}>{label}</p>
    <div className="space-y-1">{children}</div>
  </section>
);

const StatRow: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[11.5px] text-zinc-400">{label}</span>
    <span className={`text-[12px] text-zinc-200 ${monoNum}`}>{value}</span>
  </div>
);

const InboxList: React.FC<{
  items: InboxActivity[];
  isLoading: boolean;
  tab: Tab;
  syncEnabled: boolean;
  hasConnection: boolean;
}> = ({ items, isLoading, tab, syncEnabled, hasConnection }) => {
  const groups = useMemo(() => groupByDay(items), [items]);

  if (isLoading) {
    return (
      <div className="px-8 py-10 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 bg-white/[0.025] rounded-md animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
        <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] mb-5">
          <Mail className="h-6 w-6 text-zinc-500" />
        </div>
        <p
          className="text-[20px] text-zinc-200"
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        >
          {tab === "inbox" ? "Nothing in your inbox yet" : "No sent email yet"}
        </p>
        <p className="text-[12.5px] text-zinc-500 mt-2 max-w-[420px] leading-relaxed">
          {tab === "inbox"
            ? !hasConnection
              ? "Connect Gmail to start receiving replies from CRM contacts here."
              : !syncEnabled
                ? "Auto-sync is off — turn it on to start pulling in replies from CRM contacts."
                : "Sync runs automatically when this page opens. Replies from CRM contacts will appear as they come in."
            : "Compose your first message from this page or from a deal drawer to get started."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-8 pt-5 pb-2 sticky top-0 z-[1] bg-zinc-950/85 backdrop-blur-sm">
            <p className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-zinc-600">
              {group.label}
            </p>
          </div>
          <ul>
            {group.items.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const InboxRow: React.FC<{ item: InboxActivity }> = ({ item }) => {
  const navigate = useNavigate();
  const meta = item.metadata ?? {};
  const from = (meta.from as string | undefined) ?? "";
  const subject =
    (meta.subject as string | undefined) ?? item.title ?? "(no subject)";
  const displayName = fromDisplayName(from);
  const snippet = (item.body_md ?? "").replace(/\s+/g, " ").slice(0, 160);

  const onClick = () => {
    if (item.deal_id) {
      navigate({ to: "/sales", search: { deal: item.deal_id } as any });
    } else if (item.contact_id) {
      navigate({ to: "/sales", search: { contact: item.contact_id } as any });
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-8 py-3.5 flex items-start gap-4 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="mt-0.5 h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-[11px] font-mono text-emerald-200 shrink-0">
          {initialFor(displayName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold text-zinc-100 truncate">
              {displayName}
              {from && (
                <span className="ml-2 text-[11px] font-mono font-normal text-zinc-500">
                  {from}
                </span>
              )}
            </p>
            <span className={`text-[10.5px] ${monoNum} text-zinc-500 shrink-0`}>
              {relTime(item.happened_at)}
            </span>
          </div>
          <p className="text-[12.5px] text-zinc-300 mt-0.5 truncate">
            {subject}
          </p>
          {snippet && (
            <p className="text-[11.5px] text-zinc-500 mt-0.5 truncate">
              {snippet}
            </p>
          )}
        </div>
      </button>
    </li>
  );
};

// ────────────────────────────────────────────────
// Data helpers
// ────────────────────────────────────────────────

interface DayGroup {
  label: string;
  items: InboxActivity[];
}

function groupByDay(items: InboxActivity[]): DayGroup[] {
  const groups: Map<string, InboxActivity[]> = new Map();
  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date(Date.now() - 86_400_000));
  for (const item of items) {
    const d = startOfDay(new Date(item.happened_at));
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else
      label = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    const arr = groups.get(label) ?? [];
    arr.push(item);
    groups.set(label, arr);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function topSenders(
  items: InboxActivity[],
  limit: number,
): { email: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const from = item.metadata?.from as string | undefined;
    if (!from) continue;
    counts.set(from, (counts.get(from) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([email, count]) => ({ email, count }));
}

export default InboxPage;
