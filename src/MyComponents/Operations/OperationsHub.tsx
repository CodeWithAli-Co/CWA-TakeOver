/**
 * OperationsHub.tsx — Unified /operations workspace.
 *
 * Replaces three sibling routes (/task, /quota, /projects) with a
 * single editorial surface and a tab strip. Each tab renders the
 * corresponding panel in "embedded" mode, which suppresses that
 * panel's own page-level header so the hub owns the chrome.
 *
 * Design language mirrors the home dashboard:
 *   · Editorial page header — display title, breadcrumb tracker
 *     above, contextual subtitle below, right-side action slot
 *   · Hairline border-border/15 dividers
 *   · Underline-style tabs with a smooth indicator
 *   · Refined typography (text-[11px] / 0.14em tracking on caps,
 *     38px display title on the hero)
 *
 * Deep-linking: `?tab=tasks|quotas|projects` selects the panel and
 * stays in sync with state. Defaults to `tasks` when absent.
 *
 * The three legacy routes redirect into here (see routes/task.lazy
 * etc.) so existing sidebar links and bookmarks keep working until
 * the nav is fully migrated.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ClipboardList, Target, Briefcase } from "lucide-react";
import TaskSettings from "@/MyComponents/Sidebar/handlingTasking/tasks";
import { WeeklyQuotas } from "@/MyComponents/WeeklyQuota";
import { ProjectsPage } from "@/MyComponents/Projects/ProjectsPage";

type TabKey = "tasks" | "quotas" | "projects";

const TABS: {
  key: TabKey;
  label: string;
  icon: typeof ClipboardList;
  subtitle: string;
}[] = [
  {
    key: "tasks",
    label: "Tasks",
    icon: ClipboardList,
    subtitle:
      "Inbox + Kanban for every assigned task. AXON nudges owners as deadlines approach.",
  },
  {
    key: "quotas",
    label: "Weekly Quotas",
    icon: Target,
    subtitle:
      "Goals scoped to a single week. Carry-overs and week-over-week deltas keep momentum visible.",
  },
  {
    key: "projects",
    label: "Projects",
    icon: Briefcase,
    subtitle:
      "Every long-running effort across the org. Owners update status; C-level creates and assigns.",
  },
];

function parseTab(raw: unknown): TabKey {
  return raw === "quotas" || raw === "projects" ? raw : "tasks";
}

export function OperationsHub() {
  // Pull initial tab from the URL search string. TanStack Router's
  // `useSearch` types vary per route, so we cast loosely here — the
  // route definition validates the search shape.
  const search = (useSearch({ strict: false }) ?? {}) as { tab?: string };
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>(parseTab(search.tab));

  // Keep state ↔ URL in sync (URL is the source of truth on mount).
  useEffect(() => {
    const fromUrl = parseTab(search.tab);
    if (fromUrl !== tab) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab]);

  const onSelectTab = (next: TabKey) => {
    if (next === tab) return;
    setTab(next);
    // Reflect the choice in the URL without remounting the route.
    navigate({
      to: "/operations" as any,
      search: { tab: next },
      replace: true,
    } as any);
  };

  const active = useMemo(() => TABS.find((t) => t.key === tab)!, [tab]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── Editorial header ─────────────────────────────────────────
       * Compressed, dense hero: title + subtitle on the left, tabs
       * inline on the right. Edge-to-edge `px-6` matches the
       * filter bar and the 3-pane grid below — no more centered
       * max-width column that disagreed with the indentation of
       * everything else. */}
      <header className="border-b border-xs border-border/15 bg-background/95 backdrop-blur-sm flex-shrink-0">
        <div className="px-6 pt-5 pb-0">
          {/* Single row: title block on the left, tabs on the right.
           *  Removes the dead whitespace that used to sit beside the
           *  title. The hero now reads as a proper page header — both
           *  sides earning their pixels. */}
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              {/* Hero title — slightly smaller (28px) for a denser
               *  header. The breadcrumb above the title was redundant
               *  with the tabs (tabs already say which page you're on)
               *  so it's gone. */}
              <h1
                className="font-bold text-foreground leading-[1.05]"
                style={{
                  fontFamily:
                    "var(--ed-font-display, Inter), system-ui, sans-serif",
                  fontSize: "clamp(24px, 1.9vw, 28px)",
                  letterSpacing: "-0.02em",
                }}
              >
                Operations.
              </h1>
              {/* Contextual subtitle — quieter, switches per tab. */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={active.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[12px] text-text-tertiary mt-1.5 max-w-2xl leading-relaxed"
                >
                  {active.subtitle}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* ── Tab strip ─────────────────────────────────────────
             *  Underline tabs lifted into the title row so the header
             *  reads as a single dense band instead of two stacked
             *  bars. The indicator glides between selections via
             *  shared `layoutId`. */}
            <nav
              className="flex items-end gap-1 shrink-0"
              role="tablist"
              aria-label="Operations sections"
            >
              {TABS.map((t) => {
                const isActive = t.key === tab;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectTab(t.key)}
                    className={`relative inline-flex items-center gap-2 px-3.5 pt-2 pb-3 text-[12.5px] font-semibold transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-text-tertiary hover:text-foreground/80"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        isActive ? "text-primary" : "text-text-tertiary"
                      }`}
                    />
                    {t.label}
                    {isActive && (
                      <motion.span
                        layoutId="operations-tab-indicator"
                        className="absolute left-2 right-2 -bottom-px h-[2px] rounded-none bg-primary"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 32,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Tab content ─────────────────────────────────────────────
       * Each panel renders in "embedded" mode (passing `embedded` to
       * existing page components so they skip their own outer page
       * chrome — the hub already provides it).
       *
       * We crossfade between tabs so the switch feels deliberate. */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full overflow-hidden"
          >
            {tab === "tasks" && <TaskSettings embedded />}
            {tab === "quotas" && <WeeklyQuotas embedded />}
            {tab === "projects" && <ProjectsPage embedded />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default OperationsHub;
