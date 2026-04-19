/**
 * PollMessage.tsx — Renders an inline poll inside a chat message.
 *
 * Poll state lives inside the message body via an embedded marker:
 *   {poll:QUESTION|OPTION1|OPTION2|...|OPTION_N}
 *
 * Votes ride on the `reactions` column (or reaction marker fallback).
 * Convention: each option key is `__poll_<i>` where `i` is the
 * zero-based option index. Users appear once per option; clicking a
 * different option removes their prior vote.
 *
 * Multi-select polls (allow multiple votes) use `__poll_multi_<i>`.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, Check } from "lucide-react";

export interface PollDefinition {
  question: string;
  options: string[];
  multi?: boolean;
}

/** Parses `{poll:question|opt1|opt2|...}` out of the start of a message. */
export function parsePollMarker(message: string): PollDefinition | null {
  const m = message.match(/^\{poll(\*)?:([^}]+)\}/);
  if (!m) return null;
  const multi = m[1] === "*";
  const parts = m[2].split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [question, ...options] = parts;
  return { question, options, multi };
}

/** Strips the poll marker so the rest of the body can render normally. */
export function stripPollMarker(message: string): string {
  return message.replace(/^\{poll\*?:[^}]+\}\s*\n?/, "");
}

/** Encodes a PollDefinition into the `{poll:...}` marker form. */
export function encodePollMarker(poll: PollDefinition): string {
  const parts = [poll.question, ...poll.options].map((p) => p.replace(/\|/g, "/"));
  return `{poll${poll.multi ? "*" : ""}:${parts.join("|")}}`;
}

interface Props {
  poll: PollDefinition;
  reactions: Record<string, string[]>;
  currentUsername: string;
  onVote: (optionIdx: number) => void;
}

export function PollMessage({ poll, reactions, currentUsername, onVote }: Props) {
  const keyPrefix = poll.multi ? "__poll_multi_" : "__poll_";

  const votesPerOption = useMemo(() => {
    return poll.options.map((_, i) => {
      const key = `${keyPrefix}${i}`;
      return reactions[key] || [];
    });
  }, [poll.options, reactions, keyPrefix]);

  const totalVotes = votesPerOption.reduce((sum, arr) => sum + arr.length, 0);
  const myVoteIdx = votesPerOption.findIndex((arr) => arr.includes(currentUsername));

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
        <BarChart3 className="h-3 w-3" />
        Poll
        {poll.multi && <span className="text-muted-foreground">· multi-select</span>}
      </div>
      <div className="text-[13px] font-medium text-foreground leading-snug">
        {poll.question}
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {poll.options.map((opt, i) => {
          const votes = votesPerOption[i];
          const voteCount = votes.length;
          const pct = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const selected = votes.includes(currentUsername);
          const disableOthers = !poll.multi && myVoteIdx !== -1 && myVoteIdx !== i;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onVote(i)}
              disabled={disableOthers && !selected}
              className={`
                relative group flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all
                ${selected
                  ? "border-primary/50 bg-primary/15"
                  : "border-border/60 bg-background/40 hover:border-primary/30 hover:bg-background/70"
                }
                ${disableOthers && !selected ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {/* Fill bar */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-lg bg-primary/15"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              />
              <div
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border group-hover:border-primary/40"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
              </div>
              <span className="relative flex-1 text-[12.5px] text-foreground truncate">
                {opt}
              </span>
              <span className="relative shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {voteCount} · {pct.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <span>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
        {myVoteIdx !== -1 && (
          <>
            <span>·</span>
            <span className="text-primary font-medium">You voted</span>
          </>
        )}
      </div>
    </div>
  );
}
