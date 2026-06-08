/**
 * Row5Section.tsx — Communication & Workspace overview row.
 *
 *   · Communication & Presence (col-span-6) — real @mentions from
 *                                             cwa_chat / cwa_dm_chat
 *                                             + online users from the
 *                                             chat presence store.
 *   · Workspace Deep Dive      (col-span-6) — docs/sheets you
 *                                             collaborate on +
 *                                             recent comments others
 *                                             have left on them.
 *
 * All data is live. The four panels each have their own query hook
 * (`useMentionsForUser`, `useOnlineUsers`, `useCoEditedResources`,
 * `useRecentFeedback`) defined at the top of this file; the
 * components below just consume them.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Hash,
  MessageSquare,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { BentoCard } from "./BentoCard";
import { DailySnapshotCard, QuickStartCard } from "./Row5Fallback";
import { colorForUser } from "@/lib/yjs/awareness";
import { companySupabase } from "@/routes/index.lazy";
import { ActiveUser, Employees } from "@/stores/query";
import { useChatStore } from "@/stores/chatStore";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Mention {
  id: string;
  from: string;
  snippet: string;
  channel: string;
  when: string;
  isDM?: boolean;
}

interface CoEditedDoc {
  id: string;
  title: string;
  kind: "document" | "spreadsheet";
  collaborator: string;
  lastEdit: string;
  commentCount: number;
}

interface FeedbackComment {
  id: string;
  from: string;
  snippet: string;
  docTitle: string;
  when: string;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp as a compact relative-time string —
 * "now", "5m", "3h", "2d", "3w". Caps at weeks.
 */
function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 30) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

/**
 * Build a `username → avatar URL` Map from the Employees table.
 * Supports both legacy bucket-filename avatars (rewrites to public
 * URL via supabase storage) and full-URL avatars (DiceBear, Direct
 * Hire). Memoized — recomputes only when the employees list changes.
 */
function useAvatarsByName(): Map<string, string> {
  const { data: employees } = Employees();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (employees as any[] | undefined) ?? []) {
      if (!e?.username) continue;
      let url: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        url = e.avatar;
      } else if (e.avatar) {
        const { data } = companySupabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        url = data?.publicUrl;
      }
      if (url) map.set(e.username, url);
    }
    return map;
  }, [employees]);
}

// ─────────────────────────────────────────────────────────────────
// Data hooks
// ─────────────────────────────────────────────────────────────────

/**
 * @mentions across General + every DM/group, last ~7 days.
 *
 * Runs two parallel queries — one against cwa_chat (the General
 * channel) and one against cwa_dm_chat (all other channels and 1:1
 * DMs). Both use `ilike` for case-insensitive @username matching,
 * scoped to messages newer than 7 days and excluding self-sent ones.
 */
function useMentionsForUser(currentUsername: string) {
  return useQuery({
    queryKey: ["row5", "mentions", currentUsername],
    enabled: !!currentUsername,
    staleTime: 60_000,
    queryFn: async (): Promise<Mention[]> => {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const needle = `%@${currentUsername}%`;
      const [generalRes, dmRes] = await Promise.all([
        companySupabase
          .from("cwa_chat")
          .select("msg_id, sent_by, message, created_at")
          .ilike("message", needle)
          .gte("created_at", sevenDaysAgo)
          .neq("sent_by", currentUsername)
          .order("created_at", { ascending: false })
          .limit(10),
        companySupabase
          .from("cwa_dm_chat")
          .select("msg_id, sent_by, message, created_at, dm_group")
          .ilike("message", needle)
          .gte("created_at", sevenDaysAgo)
          .neq("sent_by", currentUsername)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      const general: Mention[] = (generalRes.data ?? []).map((r: any) => ({
        id: `gen-${r.msg_id}`,
        from: r.sent_by,
        snippet: r.message ?? "",
        channel: "general",
        when: relativeTime(r.created_at),
        _ts: r.created_at,
      })) as any;
      const dms: Mention[] = (dmRes.data ?? []).map((r: any) => ({
        id: `dm-${r.msg_id}`,
        from: r.sent_by,
        snippet: r.message ?? "",
        // Heuristic: if the dm_group name contains the current
        // user's username, it's a 1:1 DM.
        channel: r.dm_group ?? "DM",
        when: relativeTime(r.created_at),
        isDM:
          typeof r.dm_group === "string" &&
          r.dm_group.toLowerCase().includes(currentUsername.toLowerCase()),
        _ts: r.created_at,
      })) as any;
      // Sort by actual ISO timestamp, then strip the sort key.
      return [...general, ...dms]
        .sort((a: any, b: any) =>
          (b._ts ?? "").localeCompare(a._ts ?? ""),
        )
        .slice(0, 10)
        .map(({ _ts: _ignored, ...rest }: any) => rest);
    },
  });
}

/**
 * Who's online right now, from the existing chat presence store.
 *
 * `chatStore.presenceByUser` is a Record<username, { lastSeen }> that
 * the chat layer keeps fresh via realtime subscriptions on message
 * tables. `presenceStatus("user")` returns "online" (< 1m),
 * "away" (< 5m), or "offline" — we surface anyone marked online,
 * excluding the current user.
 *
 * Caveat: presence is updated passively (only when someone sends a
 * message). On a quiet day this list will be sparse.
 */
function useOnlineUsers(currentUsername: string): string[] {
  const presenceByUser = useChatStore((s) => s.presenceByUser);
  const presenceStatus = useChatStore((s) => s.presenceStatus);
  return useMemo(() => {
    return Object.keys(presenceByUser)
      .filter((u) => u !== currentUsername)
      .filter((u) => presenceStatus(u) === "online")
      .sort();
  }, [presenceByUser, presenceStatus, currentUsername]);
}

/**
 * Workspace docs + sheets the current user collaborates on, with
 * recent-edit metadata and a comment count.
 *
 *   1. workspace_collaborators → resource IDs (docs + sheets) where
 *      username = currentUser.
 *   2. Parallel fetch of those docs/sheets by id, plus the full
 *      comment list per resource so we can count client-side
 *      (PostgREST has no GROUP BY).
 *   3. Sort by raw updated_at desc, slice to 5.
 *
 * "Collaborator avatar" → the most recent editor unless that's you,
 * in which case fall back to the owner.
 */
function useCoEditedResources(currentUsername: string) {
  return useQuery({
    queryKey: ["row5", "co-edited", currentUsername],
    enabled: !!currentUsername,
    staleTime: 60_000,
    queryFn: async (): Promise<CoEditedDoc[]> => {
      const { data: collabRows } = await companySupabase
  .from("workspace_collaborators")
        .select("resource_type, resource_id")
        .eq("username", currentUsername);
      const docIds = (collabRows ?? [])
        .filter((r: any) => r.resource_type === "document")
        .map((r: any) => r.resource_id);
      const sheetIds = (collabRows ?? [])
        .filter((r: any) => r.resource_type === "spreadsheet")
        .map((r: any) => r.resource_id);
      if (docIds.length === 0 && sheetIds.length === 0) return [];

      const [docsRes, sheetsRes, docCommentsRes, sheetCommentsRes] =
        await Promise.all([
          docIds.length
            ? companySupabase
                .from("workspace_documents")
                .select("id, title, owner, updated_at, updated_by, archived")
                .in("id", docIds)
                .order("updated_at", { ascending: false })
                .limit(10)
            : Promise.resolve({ data: [] as any[] }),
          sheetIds.length
            ? companySupabase
                .from("workspace_spreadsheets")
                .select("id, title, owner, updated_at, updated_by, archived")
                .in("id", sheetIds)
                .order("updated_at", { ascending: false })
                .limit(10)
            : Promise.resolve({ data: [] as any[] }),
          docIds.length
            ? companySupabase
                .from("workspace_comments")
                .select("resource_id")
                .eq("resource_type", "document")
                .in("resource_id", docIds)
            : Promise.resolve({ data: [] as any[] }),
          sheetIds.length
            ? companySupabase
                .from("workspace_comments")
                .select("resource_id")
                .eq("resource_type", "spreadsheet")
                .in("resource_id", sheetIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

      const commentCounts = new Map<string, number>();
      for (const c of (docCommentsRes.data ?? []) as any[]) {
        commentCounts.set(c.resource_id, (commentCounts.get(c.resource_id) ?? 0) + 1);
      }
      for (const c of (sheetCommentsRes.data ?? []) as any[]) {
        commentCounts.set(c.resource_id, (commentCounts.get(c.resource_id) ?? 0) + 1);
      }

      const toCoEdited = (
        r: any,
        kind: "document" | "spreadsheet",
      ): CoEditedDoc & { _ts: string } => ({
        id: r.id,
        title: r.title || "Untitled",
        kind,
        collaborator:
          r.updated_by && r.updated_by !== currentUsername
            ? r.updated_by
            : r.owner ?? "",
        lastEdit: relativeTime(r.updated_at),
        commentCount: commentCounts.get(r.id) ?? 0,
        _ts: r.updated_at,
      });

      const allRows = [
        ...((docsRes.data ?? []) as any[])
          .filter((r) => !r.archived)
          .map((r) => toCoEdited(r, "document")),
        ...((sheetsRes.data ?? []) as any[])
          .filter((r) => !r.archived)
          .map((r) => toCoEdited(r, "spreadsheet")),
      ];
      allRows.sort((a, b) => (b._ts ?? "").localeCompare(a._ts ?? ""));
      return allRows.slice(0, 5).map(({ _ts: _ignored, ...rest }) => rest);
    },
  });
}

/**
 * Recent feedback — comments left by other people on docs/sheets the
 * current user is involved in. Mirrors useCoEditedResources but
 * pivots on comments instead of resource recency.
 */
function useRecentFeedback(currentUsername: string) {
  return useQuery({
    queryKey: ["row5", "feedback", currentUsername],
    enabled: !!currentUsername,
    staleTime: 60_000,
    queryFn: async (): Promise<FeedbackComment[]> => {
      const { data: collabRows } = await companySupabase
  .from("workspace_collaborators")
        .select("resource_type, resource_id")
        .eq("username", currentUsername);
      const docIds = (collabRows ?? [])
        .filter((r: any) => r.resource_type === "document")
        .map((r: any) => r.resource_id);
      const sheetIds = (collabRows ?? [])
        .filter((r: any) => r.resource_type === "spreadsheet")
        .map((r: any) => r.resource_id);
      if (docIds.length === 0 && sheetIds.length === 0) return [];

      const [docCommentsRes, sheetCommentsRes, docsRes, sheetsRes] =
        await Promise.all([
          docIds.length
            ? companySupabase
                .from("workspace_comments")
                .select("id, body, author, created_at, resource_id, resource_type, status")
                .eq("resource_type", "document")
                .in("resource_id", docIds)
                .neq("author", currentUsername)
                .order("created_at", { ascending: false })
                .limit(15)
            : Promise.resolve({ data: [] as any[] }),
          sheetIds.length
            ? companySupabase
                .from("workspace_comments")
                .select("id, body, author, created_at, resource_id, resource_type, status")
                .eq("resource_type", "spreadsheet")
                .in("resource_id", sheetIds)
                .neq("author", currentUsername)
                .order("created_at", { ascending: false })
                .limit(15)
            : Promise.resolve({ data: [] as any[] }),
          docIds.length
            ? companySupabase
                .from("workspace_documents")
                .select("id, title")
                .in("id", docIds)
            : Promise.resolve({ data: [] as any[] }),
          sheetIds.length
            ? companySupabase
                .from("workspace_spreadsheets")
                .select("id, title")
                .in("id", sheetIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

      const titleById = new Map<string, string>();
      for (const r of (docsRes.data ?? []) as any[]) {
        titleById.set(r.id, r.title || "Untitled");
      }
      for (const r of (sheetsRes.data ?? []) as any[]) {
        titleById.set(r.id, r.title || "Untitled");
      }

      const allComments = [
        ...((docCommentsRes.data ?? []) as any[]),
        ...((sheetCommentsRes.data ?? []) as any[]),
      ].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

      return allComments.slice(0, 5).map((c: any) => ({
        id: c.id,
        from: c.author,
        snippet: c.body ?? "",
        docTitle: titleById.get(c.resource_id) ?? "Untitled",
        when: relativeTime(c.created_at),
      }));
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Main export — two grid children (col-span 6 + 6).
// ─────────────────────────────────────────────────────────────────

export function Row5Section() {
  // Pre-flight the data hooks the real cards use so we can swap to
  // the snapshot + quick-start fallbacks when both surfaces would
  // render empty (no mentions, no co-editing, no recent feedback).
  // Looks lifeless otherwise on a fresh install or solo founder.
  const { data: activeUserRows } = ActiveUser();
  const currentUsername = activeUserRows?.[0]?.username ?? "";
  const { data: mentions = [] } = useMentionsForUser(currentUsername);
  const { data: coEdited = [] } = useCoEditedResources(currentUsername);
  const { data: feedback = [] } = useRecentFeedback(currentUsername);

  // "Empty" = no chat mentions AND no co-editing AND no doc feedback.
  // Online-presence count is intentionally NOT part of this — a solo
  // founder will always have 0 online and we'd never show the real
  // cards if we counted it.
  const isEmpty =
    mentions.length === 0 &&
    coEdited.length === 0 &&
    feedback.length === 0;

  if (isEmpty) {
    return (
      <>
        <DailySnapshotCard />
        <QuickStartCard />
      </>
    );
  }

  return (
    <>
      <CommunicationPresence />
      <WorkspaceDeepDive />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Communication & Presence
// ─────────────────────────────────────────────────────────────────

function CommunicationPresence() {
  const navigate = useNavigate();
  const { data: activeUserRows } = ActiveUser();
  const currentUsername = activeUserRows?.[0]?.username ?? "";
  const avatarsByName = useAvatarsByName();
  const { data: mentionsData, isLoading: mentionsLoading } =
    useMentionsForUser(currentUsername);
  const online = useOnlineUsers(currentUsername);
  const mentions = mentionsData ?? [];
  const unreadCount = mentions.length;

  return (
    <BentoCard span="col-span-6" delay={0.5} noPadding>
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <MessagesSquare className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Communication
          </span>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
            <span className="h-1 w-1 rounded-full bg-primary" />
            {unreadCount} unread
          </span>
        )}
      </header>

      <div className="p-4 space-y-4">
        {/* ── Mentions ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <AtSign className="h-3 w-3 text-primary" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              Mentions
            </span>
            <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
              {mentions.length}
            </span>
          </div>
          {mentionsLoading ? (
            <ul className="list-none p-0 m-0 space-y-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="list-none">
                  <div className="flex items-start gap-2.5 px-2.5 py-2">
                    <div className="h-6 w-6 rounded-full bg-foreground/[0.06] animate-pulse flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-foreground/[0.06] animate-pulse" />
                      <div className="h-2.5 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : mentions.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic py-1.5">
              No mentions in the last 7 days.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1">
              {mentions.map((m, i) => {
                const avatarUrl = avatarsByName.get(m.from);
                return (
                  <motion.li
                    key={m.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    className="list-none"
                  >
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/chat" as any })}
                      className="group/m w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg border-xs border-transparent hover:bg-foreground/[0.04] hover:border-border-soft transition-colors"
                    >
                      <div
                        className="relative h-6 w-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0 mt-0.5 overflow-hidden"
                        style={{ backgroundColor: colorForUser(m.from) }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={m.from}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          m.from.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11.5px] font-semibold text-foreground">
                            {m.from}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[8.5px] font-bold uppercase tracking-wider ${
                              m.isDM
                                ? "bg-warning/10 text-warning"
                                : "bg-foreground/[0.06] text-text-tertiary"
                            }`}
                          >
                            {m.isDM ? (
                              <>
                                <MessageSquare className="h-2 w-2" /> DM
                              </>
                            ) : (
                              <>
                                <Hash className="h-2 w-2" />
                                {m.channel.replace("#", "")}
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground/75 truncate">
                          {m.snippet}
                        </p>
                      </div>
                      <span className="text-[10px] tabular-nums text-text-tertiary flex-shrink-0 mt-1 font-medium">
                        {m.when}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Online now ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              Online now
            </span>
            <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
              {online.length}
            </span>
          </div>
          {online.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic">
              Nobody else online right now.
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {online.map((u, i) => {
                const avatarUrl = avatarsByName.get(u);
                return (
                  <motion.button
                    key={u}
                    type="button"
                    onClick={() => navigate({ to: "/chat" as any })}
                    title={u}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -1 }}
                    className="group/u relative"
                  >
                    <div
                      className="relative h-8 w-8 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white ring-2 ring-card hover:ring-foreground/25 transition-all overflow-hidden"
                      style={{ backgroundColor: colorForUser(u) }}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={u}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        u.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      aria-hidden
                      className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card"
                    />
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </BentoCard>
  );
}

// ─────────────────────────────────────────────────────────────────
// Workspace Deep Dive
// ─────────────────────────────────────────────────────────────────

function WorkspaceDeepDive() {
  const navigate = useNavigate();
  const { data: activeUserRows } = ActiveUser();
  const currentUsername = activeUserRows?.[0]?.username ?? "";
  const avatarsByName = useAvatarsByName();
  const { data: coEditedData, isLoading: coEditedLoading } =
    useCoEditedResources(currentUsername);
  const { data: feedbackData, isLoading: feedbackLoading } =
    useRecentFeedback(currentUsername);
  const coEdited = coEditedData ?? [];
  const feedback = feedbackData ?? [];
  const activeCount = coEdited.length;

  return (
    <BentoCard span="col-span-6" delay={0.55} noPadding>
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Workspace
          </span>
        </div>
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground/70">
            {activeCount} co-editing
          </span>
        )}
      </header>

      <div className="p-4 space-y-4">
        {/* ── Co-editing ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              Co-editing
            </span>
            <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
              {coEdited.length}
            </span>
          </div>
          {coEditedLoading ? (
            <ul className="list-none p-0 m-0 space-y-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="list-none">
                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <div className="h-6 w-6 rounded-md bg-foreground/[0.06] animate-pulse flex-shrink-0" />
                    <div className="h-3 flex-1 rounded bg-foreground/[0.06] animate-pulse" />
                    <div className="h-5 w-5 rounded-full bg-foreground/[0.06] animate-pulse flex-shrink-0" />
                  </div>
                </li>
              ))}
            </ul>
          ) : coEdited.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic py-1.5">
              Not collaborating on any docs right now.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1">
              {coEdited.map((d, i) => {
                const FileIcon =
                  d.kind === "spreadsheet" ? FileSpreadsheet : FileText;
                const tone =
                  d.kind === "spreadsheet" ? "text-success" : "text-primary";
                const tonedChipBg =
                  d.kind === "spreadsheet" ? "bg-success/10" : "bg-primary/10";
                const collabAvatar = d.collaborator
                  ? avatarsByName.get(d.collaborator)
                  : undefined;
                return (
                  <motion.li
                    key={d.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    className="list-none"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to:
                            d.kind === "document"
                              ? ("/workspace/docs/$id" as any)
                              : ("/workspace/sheets/$id" as any),
                          params: { id: d.id },
                        } as any)
                      }
                      className="group/d w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg border-xs border-transparent hover:bg-foreground/[0.04] hover:border-border-soft transition-colors"
                    >
                      <div
                        className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${tonedChipBg}`}
                      >
                        <FileIcon className={`h-3 w-3 ${tone}`} />
                      </div>
                      <span className="text-[12px] text-foreground flex-1 truncate font-medium">
                        {d.title}
                      </span>
                      {d.collaborator && (
                        <div
                          className="relative h-5 w-5 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: colorForUser(d.collaborator) }}
                          title={d.collaborator}
                        >
                          {collabAvatar ? (
                            <img
                              src={collabAvatar}
                              alt={d.collaborator}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            d.collaborator.slice(0, 2).toUpperCase()
                          )}
                        </div>
                      )}
                      {d.commentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-text-tertiary flex-shrink-0 font-medium">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {d.commentCount}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-text-tertiary flex-shrink-0 w-8 text-right font-medium">
                        {d.lastEdit}
                      </span>
                      <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/d:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Recent feedback ──────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <MessageSquare className="h-3 w-3 text-warning" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              Recent feedback
            </span>
            <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
              {feedback.length}
            </span>
          </div>
          {feedbackLoading ? (
            <ul className="list-none p-0 m-0 space-y-1.5">
              {[0, 1].map((i) => (
                <li key={i} className="list-none">
                  <div className="flex items-start gap-2.5 px-2.5 py-2">
                    <span className="w-[2px] rounded-full bg-foreground/[0.06] self-stretch" />
                    <div className="h-5 w-5 rounded-full bg-foreground/[0.06] animate-pulse flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-3/4 rounded bg-foreground/[0.06] animate-pulse" />
                      <div className="h-2 w-1/2 rounded bg-foreground/[0.04] animate-pulse" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : feedback.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic">
              No new comments on your docs.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1.5">
              {feedback.map((c, i) => {
                const authorAvatar = avatarsByName.get(c.from);
                return (
                  <motion.li
                    key={c.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    className="list-none"
                  >
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/workspace" as any })}
                      className="group/c w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg border-xs border-transparent hover:bg-foreground/[0.04] hover:border-border-soft transition-colors"
                    >
                      <span className="w-[2px] rounded-full bg-warning/60 flex-shrink-0 self-stretch" />
                      <div
                        className="relative h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5 overflow-hidden"
                        style={{ backgroundColor: colorForUser(c.from) }}
                      >
                        {authorAvatar ? (
                          <img
                            src={authorAvatar}
                            alt={c.from}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          c.from.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] text-foreground/85 truncate italic leading-snug">
                          &ldquo;{c.snippet}&rdquo;
                        </p>
                        <div className="text-[10px] text-text-tertiary mt-0.5 flex items-center gap-1 font-medium">
                          <span className="font-semibold text-foreground/70">{c.from}</span>
                          <span className="opacity-50">·</span>
                          <span className="truncate">{c.docTitle}</span>
                        </div>
                      </div>
                      <span className="text-[10px] tabular-nums text-text-tertiary flex-shrink-0 mt-1 font-medium">
                        {c.when}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </BentoCard>
  );
}
