/**
 * SlashCommandPicker.tsx — Slack-style popover that slides up from the
 * composer when the user types `/`. Filters as you keep typing and
 * lets them pick a command via arrow keys + Enter (or click).
 */

import { motion } from "framer-motion";
import {
  AtSign, BarChart3, Bell, Code, Hash, Image as ImgIcon, MessageCircle,
  Moon, Sparkles, Terminal, Type, Wand2,
} from "lucide-react";

export interface SlashCommandDef {
  command: string;       // "/poll"
  label: string;         // short description
  hint: string;          // usage example
  Icon: React.ComponentType<{ className?: string }>;
  /** Commands that take arguments show a suffix in the picker. */
  argHint?: string;
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { command: "/poll",      label: "Start a poll",           hint: "Create a poll with up to 10 options", argHint: "[question]", Icon: BarChart3 },
  { command: "/remind",    label: "Set a reminder",         hint: "/remind me in 10m <message>",         argHint: "me in 10m <msg>", Icon: Bell },
  { command: "/me",        label: "Action message",         hint: "Posts in italics as you",             argHint: "<action>", Icon: Type },
  { command: "/code",      label: "Send as code block",     hint: "Fenced code block",                   argHint: "<code>", Icon: Code },
  { command: "/axon",      label: "Draft with Axon",        hint: "Ask Axon to compose a reply",         argHint: "<prompt>", Icon: Sparkles },
  { command: "/shrug",     label: "Shrug emoticon",         hint: "¯\\_(ツ)_/¯",                         argHint: "[text]", Icon: Wand2 },
  { command: "/tableflip", label: "Table flip",             hint: "(╯°□°）╯︵ ┻━┻",                      argHint: "[text]", Icon: Wand2 },
  { command: "/unflip",    label: "Unflip table",           hint: "┬─┬ ノ( ゜-゜ノ)",                    argHint: "[text]", Icon: Wand2 },
  { command: "/here",      label: "Notify online members",  hint: "@here everyone in the channel",       argHint: "[message]", Icon: AtSign },
  { command: "/channel",   label: "Notify all members",     hint: "@channel — notifies everyone",        argHint: "[message]", Icon: Hash },
  { command: "/giphy",     label: "Attach giphy link",      hint: "Search giphy for a gif",              argHint: "<query>", Icon: ImgIcon },
  { command: "/status",    label: "Set a status",           hint: "Set your presence label",             argHint: "<label>", Icon: MessageCircle },
  { command: "/away",      label: "Mark yourself away",     hint: "Appears 'away' to others",            Icon: Moon },
  { command: "/dnd",       label: "Do not disturb",         hint: "Silence notifications",               Icon: Moon },
  { command: "/clear",     label: "Mark channel as read",   hint: "Dismiss unread badges",               Icon: Terminal },
  { command: "/shortcuts", label: "Show keyboard shortcuts",hint: "Open the cheat-sheet",                Icon: Terminal },
];

interface Props {
  /** What's currently typed (includes the leading '/'). */
  query: string;
  activeIndex: number;
  onSetIndex: (i: number) => void;
  onPick: (cmd: SlashCommandDef) => void;
}

/**
 * Match: prefix-first, then substring within command or label.
 * Case-insensitive. Empty query shows the top 8 commands.
 */
export function filterSlashCommands(query: string): SlashCommandDef[] {
  const raw = query.replace(/^\//, "").toLowerCase().trim();
  if (!raw) return SLASH_COMMANDS.slice(0, 8);
  const prefix: SlashCommandDef[] = [];
  const substring: SlashCommandDef[] = [];
  for (const c of SLASH_COMMANDS) {
    const cmd = c.command.slice(1).toLowerCase();
    if (cmd.startsWith(raw)) prefix.push(c);
    else if (cmd.includes(raw) || c.label.toLowerCase().includes(raw))
      substring.push(c);
  }
  return [...prefix, ...substring].slice(0, 8);
}

export function SlashCommandPicker({ query, activeIndex, onSetIndex, onPick }: Props) {
  const matches = filterSlashCommands(query);
  if (matches.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 8, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 8, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="w-[360px] overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 shadow-2xl backdrop-blur-md"
      style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
    >
      <div className="px-2 pt-1 pb-1.5 flex items-center justify-between">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground">
          Slash commands
        </span>
        <span className="font-mono text-[9.5px] text-muted-foreground/70">
          {matches.length} match{matches.length === 1 ? "" : "es"}
        </span>
      </div>
      <ul className="flex flex-col">
        {matches.map((m, i) => {
          const active = i === activeIndex;
          const Icon = m.Icon;
          return (
            <li key={m.command}>
              <button
                type="button"
                onMouseEnter={() => onSetIndex(i)}
                onClick={() => onPick(m)}
                className={`
                  flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors
                  ${active ? "bg-primary/15" : "hover:bg-muted/50"}
                `}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/70 bg-background/40 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-[15px] w-[15px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[12.5px] font-semibold text-foreground">
                      {m.command}
                    </span>
                    {m.argHint && (
                      <span className="font-mono text-[10.5px] text-muted-foreground/60">
                        {m.argHint}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.hint}
                  </div>
                </div>
                {active && (
                  <span className="shrink-0 font-mono text-[9.5px] text-primary">
                    ↵
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border/40 px-2 py-1 font-mono text-[9.5px] text-muted-foreground/70">
        ↑↓ to navigate · Enter to pick · Esc to dismiss
      </div>
    </motion.div>
  );
}
