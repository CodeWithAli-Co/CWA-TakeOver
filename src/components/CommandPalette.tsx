/**
 * CommandPalette.tsx — Global Cmd/Ctrl+K palette.
 *
 * Opens from anywhere via the keyboard shortcut. Renders a
 * centered overlay with:
 *   · Search input (autofocused)
 *   · Sectioned results: Navigation / Repos / Pull requests /
 *     Issues / Recent / Axon actions
 *   · Keyboard nav (↑↓ to move, ↵ to choose, Esc to close)
 *
 * Mounted once at app root (__root.tsx). Result sources are
 * inlined for now — mock repos / PRs / issues + the static
 * navigation list. When Supabase wiring lands the search hooks
 * just point at real tables.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, ArrowRight, Hash, GitPullRequest, AlertCircle, Code as CodeIcon,
  Inbox, Sparkles, Home, MessageCircle, ClipboardList, Users,
  UserCircle, CalendarDays, BarChart3, FileText, Bug, FolderKanban,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  MOCK_REPOS, MOCK_PRS, MOCK_ISSUES,
} from "@/MyComponents/Code/mockData";
import { useQuickCompose } from "@/MyComponents/Chat/quickComposeStore";

interface CommandItem {
  /** Stable key for selection state. */
  id: string;
  /** Short label shown on the left of the row. */
  label: string;
  /** Secondary text shown to the right of the label. */
  sublabel?: string;
  /** Lucide icon component. */
  icon: typeof Home;
  /** "Open" / "Switch to" / "Run" — small hint chip on the right. */
  hint: string;
  /** What to do when this item is chosen. */
  onChoose: () => void;
  /** Searchable haystack (combined into search filter). */
  haystack: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const openCompose = useQuickCompose((s) => s.openCompose);

  // Global keyboard binding — Cmd+K (mac) / Ctrl+K (everyone else).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset query + cursor when the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = () => setOpen(false);
  const go = (to: string) => {
    navigate({ to }).catch(() => { /* noop — stale route */ });
    close();
  };

  // ── Result sources ──────────────────────────────────────
  // Each section returns CommandItems; the search filter runs
  // across all of them by their `haystack` field.
  const allItems: { section: string; items: CommandItem[] }[] = useMemo(() => {
    const NAV: CommandItem[] = [
      { id: "nav-home",        label: "Home",            icon: Home,           hint: "Go", haystack: "home dashboard", onChoose: () => go("/") },
      { id: "nav-chat",        label: "Chat",            icon: MessageCircle,  hint: "Go", haystack: "chat messages dm channels", onChoose: () => go("/chat") },
      { id: "nav-task",        label: "Tasks",           icon: ClipboardList,  hint: "Go", haystack: "task todo", onChoose: () => go("/task") },
      { id: "nav-code",        label: "Code",            icon: CodeIcon,       hint: "Go", haystack: "code repo repos pulls pr", onChoose: () => go("/code") },
      { id: "nav-reports",     label: "Reports",         icon: Inbox,          hint: "Go", haystack: "reports inbox", onChoose: () => go("/reports") },
      { id: "nav-submit",      label: "Submit a report", icon: FileText,       hint: "Go", haystack: "submit report write", onChoose: () => go("/reports/submit") },
      { id: "nav-hiring",      label: "Hiring",          icon: Users,          hint: "Go", haystack: "hiring candidates", onChoose: () => go("/hiring") },
      { id: "nav-onboarding",  label: "Onboarding",      icon: FolderKanban,   hint: "Go", haystack: "onboarding pipeline", onChoose: () => go("/onboarding") },
      { id: "nav-schedule",    label: "Schedule",        icon: CalendarDays,   hint: "Go", haystack: "schedule shifts calendar", onChoose: () => go("/schedule") },
      { id: "nav-analytics",   label: "Analytics",       icon: BarChart3,      hint: "Go", haystack: "analytics insights data", onChoose: () => go("/analytics") },
      { id: "nav-settings",    label: "Settings",        icon: UserCircle,     hint: "Go", haystack: "settings profile preferences", onChoose: () => go("/settings") },
    ];

    const REPOS: CommandItem[] = MOCK_REPOS.map((r) => ({
      id: `repo-${r.id}`,
      label: `${r.owner}/${r.name}`,
      sublabel: r.description,
      icon: CodeIcon,
      hint: "Open repo",
      haystack: `${r.owner} ${r.name} ${r.description}`,
      onChoose: () => go("/code"),
    }));

    const PRS: CommandItem[] = MOCK_PRS.map((p) => ({
      id: `pr-${p.id}`,
      label: `#${p.number} · ${p.title}`,
      sublabel: p.status,
      icon: GitPullRequest,
      hint: "Open PR",
      haystack: `${p.number} ${p.title} ${p.body} pr pull request`,
      onChoose: () => go("/code"),
    }));

    const ISSUES: CommandItem[] = MOCK_ISSUES.map((i) => ({
      id: `iss-${i.id}`,
      label: `#${i.number} · ${i.title}`,
      sublabel: i.status,
      icon: AlertCircle,
      hint: "Open issue",
      haystack: `${i.number} ${i.title} ${i.body} issue`,
      onChoose: () => go("/code"),
    }));

    // Axon actions — quick-fire surface for things you'd otherwise
    // say out loud. Hint says "Run" so users grok these execute
    // immediately, not navigate.
    const AXON: CommandItem[] = [
      { id: "ax-light",   label: "Switch to light mode", icon: Sparkles, hint: "Run",
        haystack: "axon theme light mode switch",
        onChoose: () => {
          dispatchCustom("cwa-axon-run", { intent: "set_theme", mode: "light" });
          close();
        } },
      { id: "ax-dark",    label: "Switch to dark mode",  icon: Sparkles, hint: "Run",
        haystack: "axon theme dark mode switch",
        onChoose: () => {
          dispatchCustom("cwa-axon-run", { intent: "set_theme", mode: "dark" });
          close();
        } },
      { id: "ax-system",  label: "Follow system theme",  icon: Sparkles, hint: "Run",
        haystack: "axon theme system",
        onChoose: () => {
          dispatchCustom("cwa-axon-run", { intent: "set_theme", mode: "system" });
          close();
        } },
      { id: "ax-bug",     label: "Report a bug",         icon: Bug,      hint: "Open",
        haystack: "axon bug report file",
        onChoose: () => {
          dispatchCustom("cwa-open-bug-report", null);
          close();
        } },
      // /msg verb — quick-compose entrypoint from the palette.
      // Matches typing "/msg", "msg", "send message", or "dm".
      // Reads the current query at click-time so the parser sees
      // the exact text the operator typed.
      { id: "ax-msg",     label: "Send a message",       icon: MessageCircle, hint: "Compose",
        haystack: "msg send message dm chat compose /msg",
        onChoose: () => {
          // Parse "/msg #channel body words..." or "/msg #channel" or just "/msg".
          // Drop the verb (/msg | msg | send) at the front; remaining
          // tokens are target + body.
          const stripped = query.replace(/^\s*(\/msg|msg|send|dm)\s*/i, "").trim();
          let target: string | undefined;
          let body: string | undefined;
          if (stripped) {
            // First whitespace-delimited token is the target (channel
            // or DM, with or without # / @ prefix). Rest is the body.
            const match = stripped.match(/^(\S+)(?:\s+(.+))?$/);
            if (match) {
              target = match[1];
              body = match[2]?.trim();
            }
          }
          close();
          openCompose({ target, body });
        } },
    ];

    return [
      { section: "Navigation",   items: NAV },
      { section: "Repositories", items: REPOS },
      { section: "Pull requests", items: PRS },
      { section: "Issues",       items: ISSUES },
      { section: "Actions",      items: AXON },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter by query. Keep section grouping so the user can see
  // what kind of thing they're picking; collapse empty sections.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems
      .map(({ section, items }) => ({
        section,
        items: items.filter((it) =>
          `${it.label} ${it.sublabel ?? ""} ${it.haystack}`.toLowerCase().includes(q),
        ),
      }))
      .filter(({ items }) => items.length > 0);
  }, [query, allItems]);

  // Flat list for keyboard nav — maps activeIdx → CommandItem.
  const flat = useMemo(() => filtered.flatMap((s) => s.items), [filtered]);
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(0);
  }, [flat.length, activeIdx]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIdx]?.onChoose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={close}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-background/70 backdrop-blur-[3px] pt-[14vh] px-4"
        >
          <motion.div
            key="cmdk-panel"
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump anywhere or run an action…"
                className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              <kbd className="font-mono text-[9.5px] tracking-widest rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                  No matches for "{query}".
                </div>
              ) : (
                (() => {
                  let cursor = 0;
                  return filtered.map(({ section, items }) => (
                    <div key={section} className="border-b border-border/60 last:border-0">
                      <p className="px-4 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80 bg-muted/20">
                        {section}
                      </p>
                      <ul>
                        {items.map((item) => {
                          const isActive = cursor === activeIdx;
                          const idx = cursor;
                          cursor++;
                          const Icon = item.icon;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onMouseEnter={() => setActiveIdx(idx)}
                                onClick={() => item.onChoose()}
                                className={[
                                  "w-full px-4 py-2 flex items-center gap-3 text-left transition-colors",
                                  isActive ? "bg-muted text-foreground" : "text-foreground/85 hover:bg-muted/40",
                                ].join(" ")}
                              >
                                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="text-[13px] font-medium truncate">{item.label}</span>
                                {item.sublabel && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {item.sublabel}
                                  </span>
                                )}
                                <span className={[
                                  "ml-auto inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-widest",
                                  isActive ? "text-primary" : "text-muted-foreground/70",
                                ].join(" ")}>
                                  {item.hint}
                                  {isActive && <ArrowRight className="h-2.5 w-2.5" />}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Footer hint bar */}
            <div className="flex items-center gap-3 border-t border-border bg-muted/20 px-4 py-2 text-[10.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <kbd className="font-mono rounded border border-border bg-background px-1">↑</kbd>
                <kbd className="font-mono rounded border border-border bg-background px-1">↓</kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="font-mono rounded border border-border bg-background px-1.5">↵</kbd>
                select
              </span>
              <span className="ml-auto inline-flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {flat.length} result{flat.length === 1 ? "" : "s"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Best-effort custom event dispatch — providers (Axon, etc.)
 *  can listen for these to react to palette-driven intents
 *  without us having to import their refs through prop-drilling. */
function dispatchCustom(name: string, detail: unknown): void {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch { /* noop */ }
}
