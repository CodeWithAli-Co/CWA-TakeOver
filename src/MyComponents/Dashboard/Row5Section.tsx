/**
 * Row5Section.tsx — preview row to be evaluated against Row 4.
 *
 *   · Communication & Presence (col-span-6) — recent @mentions, hot
 *                                             chat threads, who's
 *                                             online right now.
 *   · Workspace Deep Dive      (col-span-6) — docs/sheets you're
 *                                             co-editing + recent
 *                                             feedback comments.
 *
 * Both panels are *engagement-focused*, not task-focused. The point
 * is to surface the conversations and collaborations that aren't
 * shown anywhere else on the dashboard (chat happens in /chat,
 * docs live in /workspace — neither bleeds into the home view today).
 *
 * Status today: UI is real, data is mocked. Schema notes in comments
 * point to the production tables to hook up once we're ready
 * (cwa_chat / cwa_dm_chat for mentions, workspace_documents +
 * workspace_spreadsheets + workspace_comments for the right panel,
 * and the existing presence channel for who's online).
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
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
import { colorForUser } from "@/lib/yjs/awareness";

// ─────────────────────────────────────────────────────────────────
// MOCK DATA — replace with real queries when ready.
//
//   Mentions:  cwa_chat / cwa_dm_chat where body matches "@<user>"
//              (or a dedicated cwa_mentions table if we build one).
//   Online:    Supabase realtime presence channel ("dashboard:online")
//              that the chat layer already maintains.
//   Co-edited: workspace_documents / workspace_spreadsheets where the
//              active user is in collaborators[] AND something has
//              been edited in the last 7 days.
//   Comments:  workspace_comments joined with the parent doc, filtered
//              to docs the user is a collaborator on.
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

const MOCK_MENTIONS: Mention[] = [
  {
    id: "m1",
    from: "Jane",
    snippet: "Can you review the spec when you have a sec?",
    channel: "#engineering",
    when: "5m",
  },
  {
    id: "m2",
    from: "Mike",
    snippet: "Quick Q on the auth migration timeline",
    channel: "DM",
    when: "1h",
    isDM: true,
  },
  {
    id: "m3",
    from: "Blaze",
    snippet: "Heads up — Tauri update broke on Windows",
    channel: "#general",
    when: "3h",
  },
];

const MOCK_ONLINE = ["Jane", "Mike", "Blaze", "Sarah", "Riya"];

const MOCK_CO_EDITED: CoEditedDoc[] = [
  {
    id: "d1",
    title: "Q4 Marketing Plan",
    kind: "document",
    collaborator: "Jane",
    lastEdit: "10m",
    commentCount: 2,
  },
  {
    id: "d2",
    title: "Auth migration spec",
    kind: "document",
    collaborator: "Mike",
    lastEdit: "2h",
    commentCount: 1,
  },
  {
    id: "d3",
    title: "Revenue projections Q3",
    kind: "spreadsheet",
    collaborator: "Ali",
    lastEdit: "4h",
    commentCount: 5,
  },
];

const MOCK_FEEDBACK: FeedbackComment[] = [
  {
    id: "c1",
    from: "Jane",
    snippet: "Looking good — can we shorten the headline?",
    docTitle: "Q4 Marketing Plan",
    when: "10m",
  },
  {
    id: "c2",
    from: "Mike",
    snippet: "What about edge cases when the token is null?",
    docTitle: "Auth migration spec",
    when: "2h",
  },
];

// ─────────────────────────────────────────────────────────────────
// Main export — two grid children (col-span 6 + 6).
// ─────────────────────────────────────────────────────────────────

export function Row5Section() {
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
  const mentions = MOCK_MENTIONS;
  const online = MOCK_ONLINE;
  const unreadCount = mentions.length;

  return (
    <BentoCard span="col-span-6" delay={0.5} noPadding>
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <MessagesSquare className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Communication
          </span>
        </div>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-primary/80 font-semibold">
          {unreadCount} unread
        </span>
      </header>

      <div className="p-3 space-y-3.5">
        {/* Mentions */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-primary">
            <AtSign className="h-2.5 w-2.5" />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
              Mentions
            </span>
            <span className="text-[9.5px] font-semibold tabular-nums text-text-tertiary/70 ml-1">
              {mentions.length}
            </span>
          </div>
          {mentions.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic py-1.5">
              No mentions in the last 24h.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1.5">
              {mentions.map((m) => (
                <li key={m.id} className="list-none">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/chat" as any })}
                    className="group/m w-full text-left flex items-start gap-2.5 px-2 py-2 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
                  >
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: colorForUser(m.from) }}
                    >
                      {m.from.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11.5px] font-semibold text-foreground">
                          {m.from}
                        </span>
                        <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary inline-flex items-center gap-0.5">
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
                      <p className="text-[11px] text-foreground/80 truncate">
                        {m.snippet}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider tabular-nums text-text-tertiary flex-shrink-0 mt-1">
                      {m.when}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Online now */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-success">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
              Online now
            </span>
            <span className="text-[9.5px] font-semibold tabular-nums text-text-tertiary/70 ml-1">
              {online.length}
            </span>
          </div>
          {online.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic">
              Nobody else online right now.
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {online.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => navigate({ to: "/chat" as any })}
                  title={u}
                  className="group/u relative"
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-card hover:ring-foreground/20 transition-all"
                    style={{ backgroundColor: colorForUser(u) }}
                  >
                    {u.slice(0, 2).toUpperCase()}
                  </div>
                  {/* Presence dot */}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-card"
                  />
                </button>
              ))}
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
  const coEdited = MOCK_CO_EDITED;
  const feedback = MOCK_FEEDBACK;
  const activeCount = coEdited.length;

  return (
    <BentoCard span="col-span-6" delay={0.55} noPadding>
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Workspace
          </span>
        </div>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-text-tertiary/70">
          {activeCount} co-editing
        </span>
      </header>

      <div className="p-3 space-y-3.5">
        {/* Co-edited docs */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
              Co-editing
            </span>
            <span className="text-[9.5px] font-semibold tabular-nums text-text-tertiary/70 ml-1">
              {coEdited.length}
            </span>
          </div>
          {coEdited.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic py-1.5">
              Not collaborating on any docs right now.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1.5">
              {coEdited.map((d) => {
                const FileIcon =
                  d.kind === "spreadsheet" ? FileSpreadsheet : FileText;
                const tone =
                  d.kind === "spreadsheet" ? "text-success" : "text-primary";
                return (
                  <li key={d.id} className="list-none">
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
                      className="group/d w-full text-left flex items-center gap-2.5 px-2 py-2 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
                    >
                      <FileIcon
                        className={`h-3 w-3 flex-shrink-0 ${tone}`}
                      />
                      <span className="text-[12px] text-foreground flex-1 truncate font-medium">
                        {d.title}
                      </span>
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: colorForUser(d.collaborator) }}
                        title={d.collaborator}
                      >
                        {d.collaborator.slice(0, 2).toUpperCase()}
                      </div>
                      {d.commentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-text-tertiary flex-shrink-0">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {d.commentCount}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider tabular-nums text-text-tertiary flex-shrink-0 w-8 text-right">
                        {d.lastEdit}
                      </span>
                      <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/d:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent feedback */}
        <section>
          <div className="flex items-center gap-1.5 mb-2 text-warning">
            <MessageSquare className="h-2.5 w-2.5" />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
              Recent feedback
            </span>
            <span className="text-[9.5px] font-semibold tabular-nums text-text-tertiary/70 ml-1">
              {feedback.length}
            </span>
          </div>
          {feedback.length === 0 ? (
            <div className="text-[11.5px] text-text-tertiary italic">
              No new comments on your docs.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1.5">
              {feedback.map((c) => (
                <li key={c.id} className="list-none">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/workspace" as any })}
                    className="group/c w-full text-left flex items-start gap-2.5 px-2 py-1.5 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
                  >
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: colorForUser(c.from) }}
                    >
                      {c.from.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] text-foreground/85 truncate italic">
                        &ldquo;{c.snippet}&rdquo;
                      </p>
                      <div className="text-[9.5px] uppercase tracking-wider text-text-tertiary mt-0.5 flex items-center gap-1">
                        <span className="font-semibold">{c.from}</span>
                        <span>·</span>
                        <span className="truncate">{c.docTitle}</span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider tabular-nums text-text-tertiary flex-shrink-0 mt-1">
                      {c.when}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </BentoCard>
  );
}
