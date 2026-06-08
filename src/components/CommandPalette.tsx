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
  HandHeart, TrendingUp, Phone, Mail, StickyNote, Video,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  MOCK_REPOS, MOCK_PRS, MOCK_ISSUES,
} from "@/MyComponents/Code/mockData";
import { useQuickCompose } from "@/MyComponents/Chat/quickComposeStore";
import { useEffectiveRow4View, useRow4View } from "@/MyComponents/Dashboard/row4ViewStore";
import { useSendKudosDialog } from "@/MyComponents/Dashboard/sendKudosStore";
import { useCreateGrowthTrackDialog } from "@/MyComponents/Dashboard/createGrowthTrackStore";
import { useLogActivityDialog } from "@/MyComponents/Sales/logActivityStore";
import type { ActivityType } from "@/stores/crm";
import { ActiveUser } from "@/stores/query";
import { useRolePreview } from "@/stores/store";
import { isCLevel } from "@/MyComponents/Dashboard/row4ViewStore";
import { useFundraiseStore } from "@/MyComponents/Fundraise/fundraiseStore";
import {
  useInvestors,
  PIPELINE_STAGE_LABEL,
  INVESTOR_PIPELINE_STAGES,
  type InvestorPipelineStage,
} from "@/stores/investors";
import { PiggyBank } from "lucide-react";

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
  const openSendKudos = useSendKudosDialog((s) => s.openDialog);
  const openCreateGrowthTrack = useCreateGrowthTrackDialog((s) => s.openDialog);
  const openLogActivity = useLogActivityDialog((s) => s.openDialog);
  const toggleFromRow4 = useRow4View((s) => s.toggleFrom);

  // Fundraise: read the investor list (live) + the global store
  // dispatch so the palette can open the drawer or filter the
  // kanban from anywhere. useInvestors() returns [] when not
  // authenticated -- that gracefully degrades the section to
  // empty (no nav-fundraise broken, just no per-investor items).
  const { data: investors = [] } = useInvestors();
  const openInvestorInStore = useFundraiseStore((s) => s.openInvestor);
  const setStageFilterInStore = useFundraiseStore((s) => s.setStageFilter);
  const setPendingViewMode = useFundraiseStore((s) => s.setPendingViewMode);
  // Resolve current effective Row 4 view so the toggle works even
  // when the user hasn't set an explicit preference yet (they're on
  // the role default). Mirror Row4Swapper's resolution: preview role
  // wins over the actual role, and the persisted preference is
  // ignored while previewing so the verb behaves against the view
  // actually on screen.
  const { data: row4MeRows } = ActiveUser();
  const row4ActualRole: string | undefined =
    (row4MeRows?.[0] as any)?.role ?? undefined;
  const row4PreviewRole = useRolePreview((s) => s.previewRole);
  const row4EffectiveRole = row4PreviewRole || row4ActualRole;
  const row4IsPreviewing = !!row4PreviewRole;
  const row4Effective = useEffectiveRow4View(
    row4EffectiveRole,
    row4IsPreviewing,
  );

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
      { id: "nav-fundraise",   label: "Fundraise",       icon: PiggyBank,      hint: "Go", haystack: "fundraise investors vc angel pipeline", onChoose: () => go("/fundraise") },
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
      // Row 4 home-dashboard variant swap. Toggles between the
      // tasks + meetings lists and the today-agenda view, relative
      // to whichever view is currently effective for the operator's
      // role + persisted preference.
      { id: "ax-row4-swap", label: "Switch row 4 view",   icon: Sparkles, hint: "Toggle",
        haystack: "row 4 switch toggle today agenda tasks meetings lists dashboard variant",
        onChoose: () => {
          // No-op when previewing another role — the toggle writes to
          // the actual user's preference and should only run against
          // their own dashboard, not a role they're peeking at.
          if (row4IsPreviewing) {
            close();
            return;
          }
          toggleFromRow4(row4Effective);
          close();
        } },
      // Team Pulse composers. Send kudos is available to everyone;
      // Create growth track is gated to C-level (CEO/COO/CFO) since
      // they're acting as managers until manager_id wires up.
      { id: "ax-kudos", label: "Send kudos", icon: HandHeart, hint: "Compose",
        haystack: "kudos thank send appreciation shout-out praise team pulse",
        onChoose: () => {
          openSendKudos();
          close();
        } },
      ...(isCLevel(row4ActualRole)
        ? [{
            id: "ax-growth-track",
            label: "Create growth track",
            icon: TrendingUp,
            hint: "Compose",
            haystack: "growth track milestone career arc manager approve employee",
            onChoose: () => {
              openCreateGrowthTrack();
              close();
            },
          }]
        : []),
      // Sales — Log activity verbs. Five entries: one generic
      // "Log activity" + four type-prefilled shortcuts. The
      // prefilled variants accept a free-text tail, so typing
      // "log call discovery with Acme" routes to the modal with
      // type=call and the rest of the line as the title.
      // Sales — Stripe → CRM sync. Fires a custom event the
      // SalesPage handles; if the user isn't on /sales we navigate
      // there first so the toast lands in view.
      { id: "ax-stripe-sync", label: "Sync Stripe customers", icon: Sparkles, hint: "Run",
        haystack: "stripe sync customers crm contacts billing backfill import",
        onChoose: () => {
          dispatchCustom("cwa-sales-stripe-sync", null);
          close();
          navigate({ to: "/sales" });
        } },
      ...(([
        { id: "ax-log",      type: undefined as ActivityType | undefined, icon: ClipboardList, label: "Log activity",            keywords: "log activity crm sales" },
        { id: "ax-log-call", type: "call"    as ActivityType,             icon: Phone,         label: "Log call",                keywords: "log call phone crm activity sales" },
        { id: "ax-log-mail", type: "email"   as ActivityType,             icon: Mail,          label: "Log email",               keywords: "log email crm activity sales" },
        { id: "ax-log-meet", type: "meeting" as ActivityType,             icon: CalendarDays,  label: "Log meeting",             keywords: "log meeting crm activity sales sync" },
        { id: "ax-log-note", type: "note"    as ActivityType,             icon: StickyNote,    label: "Log note",                keywords: "log note crm activity sales" },
        { id: "ax-log-demo", type: "demo"    as ActivityType,             icon: Video,         label: "Log demo",                keywords: "log demo crm activity sales" },
      ] as const).map((v) => ({
        id: v.id,
        label: v.label,
        icon: v.icon,
        hint: "Compose",
        haystack: v.keywords,
        onChoose: () => {
          // Strip the verb prefix from the query so the remainder
          // can seed the modal's title field. Mirrors the /msg
          // parser above — keep them aligned.
          const verbRe = /^\s*(\/?(?:log\s+)?(?:activity|call|email|mail|meeting|meet|note|demo))\s*/i;
          const tail = query.replace(verbRe, "").trim();
          close();
          openLogActivity({
            type: v.type,
            title: tail.length > 0 ? tail : undefined,
          });
        },
      }))),
    ];

    // ── Fundraise ──
    // Per-investor entries (open the drawer from anywhere) plus
    // stage-filter verbs ("show investors in replied"). The verbs
    // also flip view-mode to kanban -- "show investors in X" only
    // makes sense as a column-view operation.
    const FUNDRAISE: CommandItem[] = [
      // One palette entry per investor. Keyed by company_name +
      // stage so the search query "anthropic" surfaces both the
      // firm and (eventually) its stage chip.
      ...investors.map((inv) => ({
        id: `inv-${inv.id}`,
        label: inv.company_name,
        sublabel: PIPELINE_STAGE_LABEL[inv.pipeline_stage],
        icon: PiggyBank,
        hint: "Open",
        haystack:
          `${inv.company_name} ${inv.pipeline_stage} fundraise investor ` +
          (inv.company_domain ?? ""),
        onChoose: () => {
          close();
          // Order matters: navigate first so FundraisePage mounts,
          // then store dispatch -- the page's effect picks up the
          // active id on next render.
          go("/fundraise");
          openInvestorInStore(inv.id);
        },
      })),
      // One verb per stage: "show investors in <stage>". The
      // verb flips view-mode to kanban so the filtered view
      // is immediately useful.
      ...INVESTOR_PIPELINE_STAGES.map((stage) => ({
        id: `inv-stage-${stage}`,
        label: `Show investors in ${PIPELINE_STAGE_LABEL[stage]}`,
        icon: PiggyBank,
        hint: "Filter",
        haystack: `show investors ${stage} ${PIPELINE_STAGE_LABEL[stage]} kanban`,
        onChoose: () => {
          close();
          go("/fundraise");
          setStageFilterInStore(stage as InvestorPipelineStage);
          setPendingViewMode("kanban");
        },
      })),
    ];

    return [
      { section: "Navigation",   items: NAV },
      { section: "Investors",    items: FUNDRAISE },
      { section: "Repositories", items: REPOS },
      { section: "Pull requests", items: PRS },
      { section: "Issues",       items: ISSUES },
      { section: "Actions",      items: AXON },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investors]);

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
                      {/* list-none + zero margin/padding kills the
                       *  white bullet markers a global rule was
                       *  leaking through tailwind's preflight. */}
                      <ul className="list-none p-0 m-0">
                        {items.map((item) => {
                          const isActive = cursor === activeIdx;
                          const idx = cursor;
                          cursor++;
                          const Icon = item.icon;
                          return (
                            <li key={item.id} className="list-none">
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
