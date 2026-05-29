import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StorageUsageChart } from "@/MyComponents/HomeDashboard/storage";
import {
  MessageSquare,
  Users,
  Terminal,
  DollarSignIcon,
  File,
  CalendarSearch,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import Quotas from "@/MyComponents/HomeDashboard/qoutas";
import CompanyStats from "@/MyComponents/HomeDashboard/companyStats";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { SchedImgStore, useCompanyFilter, type CompanyFilter } from "@/stores/store";
import { QuickActionCard } from "@/MyComponents/HomeDashboard/Components/quickActionCard";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import { ActiveUser } from "@/stores/query";
import { CompanyCard } from "@/MyComponents/HomeDashboard/Components/companyCard";
import { ActivityFeed } from "@/MyComponents/HomeDashboard/Components/activityFeed";
import { TeamPresence } from "@/MyComponents/HomeDashboard/Components/teamPresence";
import { CWADashboard } from "@/MyComponents/Dashboard/CWADashboard";
import { SimplicityDashboard } from "@/MyComponents/Dashboard/SimplicityDashboard";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Index = () => {
  const { isShowing } = SchedImgStore();
  const { data: user } = ActiveUser();
  const username = user?.[0]?.username || "there";
  const { activeCompany } = useCompanyFilter();

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Show the bento dashboards when a specific company is selected
  const showCWADashboard = activeCompany === "codeWithAli";
  const showSimplicityDashboard = activeCompany === "simplicityFunds";
  const showOverview = activeCompany === "all";

  return (
    <main className="">
   {/* ── Page header — the masterpiece.
       *
       *  Three structural beats, each beat is one column in a CSS
       *  grid so the centre pill anchors to true centre regardless
       *  of how the surrounding content grows:
       *
       *    LEFT   · presence dot · greeting · live HH:MM · date
       *    CENTRE · Cmd+K palette pill (frosted, focal point)
       *    RIGHT  · nav · etched divider · theme · avatar
       *
       *  No visible border. The bottom edge is etched with a 1px
       *  near-black hairline + a soft 24px elevation shadow, so the
       *  header reads as floating above the canvas rather than as
       *  a card lipped onto it. Pulls vocabulary from macOS Big Sur
       *  / Linear / Notion — refined chrome that disappears when
       *  you're not looking at it. h-12 / 48px keeps the strip
       *  dense and disciplined.
       *
       *  Two faint ambient effects (top hairline + bottom radial
       *  halo) are pinned to the edges; both pointer-events-none
       *  + aria-hidden. They give the strip dimension without
       *  introducing surface chrome to compete with content.
       */}
      <header className="relative bg-sidebar border-b border-xs border-line">
        {/* Top hairline whisper — soft light along the leading edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px
                     bg-gradient-to-r from-transparent via-line-strong/40 to-transparent"
        />
        {/* Centre-bottom coral halo — the radiant brand glow the user
         *  liked. Pure decoration, pointer-events-none + aria-hidden. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 h-[80px] w-[520px]
                     bg-[radial-gradient(50%_100%_at_50%_100%,hsl(var(--primary)/0.12),transparent_70%)]"
        />

        <div className="relative h-14 px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* ── LEFT ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 min-w-0"
          >
            <PresenceDot />
            <h1 className="text-[14.5px] font-semibold text-fg tracking-tight whitespace-nowrap">
              {getGreeting()},{" "}
              <span className="text-primary">{username}</span>
            </h1>
            <span className="hidden lg:inline-block w-px h-3.5 bg-line-strong/70" aria-hidden />
            <div className="hidden lg:flex items-center gap-2 text-[11.5px] text-fg-muted whitespace-nowrap">
              <LiveClock />
              <span className="text-fg-faint">·</span>
              <span>{currentDate}</span>
            </div>
          </motion.div>

          {/* ── CENTRE — Cmd+K palette pill ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.04, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center"
          >
            <CommandKPill />
          </motion.div>

          {/* ── RIGHT ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.22 }}
            className="flex items-center justify-end gap-1 flex-shrink-0"
          >
            <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
              <QuickActionCard icon={Terminal} url="/details" title="Accounts" />
            </UserView>
            <QuickActionCard title="Chat" icon={MessageSquare} url="/chat" />
            <UserView userRole={["CEO", "COO"]}>
              <QuickActionCard title="Finance" url="/financialDashboard" icon={DollarSignIcon} />
            </UserView>
            <UserView excludeRoles={"COO"}>
              <QuickActionCard title="Invoicer" url="/invoicer" icon={File} />
            </UserView>
            <UserView excludeRoles={["COO", "CEO"]}>
              <QuickActionCard title="Schedule" url="/schedule" icon={CalendarSearch} />
            </UserView>
            <UserView userRole={[Role.CEO, Role.COO]}>
              <QuickActionCard title="Employees" icon={Users} url="/employee" />
            </UserView>

          </motion.div>
        </div>
      </header>

    <div className="min-h-screen bg-background overflow-y-auto transition-colors duration-500">
   

      {/* ── Main Content ── */}
      <div className="px-8 pt-4 pb-10 space-y-4">
        {/* Schedule image */}
        <UserView userRole={[Role.CEO, Role.COO]}>
          <img
            src="/schedule.png"
            alt="Schedule"
            className={`${isShowing ? "w-full h-auto" : "h-0"} rounded-sm border border-border transition-all duration-300`}
          />
        </UserView>

        {/* ── Bento Dashboard: CWA ── */}
        {showCWADashboard && (
          <motion.div
            key="cwa-dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <CWADashboard />
          </motion.div>
        )}

        {/* ── Bento Dashboard: Simplicity ── */}
        {showSimplicityDashboard && (
          <motion.div
            key="simplicity-dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <SimplicityDashboard />
          </motion.div>
        )}

        {/* ── Overview: "All" company view (original layout) ── */}
        {showOverview && (
          <>
            {/* Company Cards */}
            <UserView userRole={[Role.CEO, Role.COO]}>
              <div className="grid grid-cols-2 gap-4">
                <CompanyCard name="CodeWithAli" description="Software agency & media" memberCount={7} projectCount={4} revenue="$671" status="active" accentPosition="left" companyKey="codeWithAli" />
                <CompanyCard name="Simplicity" description="Fintech budgeting platform" memberCount={3} projectCount={2} revenue="$0" status="growing" accentPosition="right" companyKey="simplicityFunds" />
              </div>
            </UserView>

            {/* Stats strip */}
            <UserView excludeRoles={[Role.Intern, Role.Member]}>
              <CompanyStats />
            </UserView>

            {/* Row: Activity+Team | Meetings */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-7">
                <div className="bg-card border border-border rounded-sm overflow-hidden h-full">
                  <div className="grid grid-cols-2 h-full">
                    <div className="border-r border-border">
                      <div className="px-5 pt-4 pb-2">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                          Recent Activity
                        </span>
                      </div>
                      <div className="px-5 pb-5">
                        <ActivityFeed />
                      </div>
                    </div>
                    <div>
                      <div className="px-5 pt-4 pb-2">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                          Team
                        </span>
                      </div>
                      <div className="px-5 pb-5">
                        <TeamPresence />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
                <div className="col-span-12 lg:col-span-5">
                  <Meetings />
                </div>
              </UserView>
            </div>

            {/* Row: Tasks | Quotas */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-5">
                <TasksComponent />
              </div>
              <div className="col-span-12 lg:col-span-7">
                <Quotas />
              </div>
            </div>

            {/* Storage */}
            <UserView userRole={[Role.CEO, Role.COO]}>
              <div className="max-w-md">
                <StorageUsageChart />
              </div>
            </UserView>
          </>
        )}
      </div>
    </div>
    </main>
  );
};

export const Route = createLazyFileRoute("/")({
  component: Index,
});

export default Index;

/**
 * PresenceDot — small primary dot beside the greeting, with a much
 * slower / softer halo than the previous animate-ping. Pulse cycles
 * over 2.8s with a quiet 40% peak — looks alive without flickering.
 * Pure decoration.
 */
function PresenceDot() {
  return (
    <span
      aria-hidden
      className="relative inline-flex w-1.5 h-1.5 flex-shrink-0"
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-primary"
        animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 2.4, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-primary" />
    </span>
  );
}

/**
 * LiveClock — ticking HH:MM, updates on the wall-clock minute
 * boundary (first tick scheduled to align). tabular-nums keeps the
 * digit widths stable so the row never reflows.
 */
function LiveClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const formatted = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <span className="font-mono tabular-nums tracking-tight">
      {formatted}
    </span>
  );
}

/**
 * CommandKPill — the centre focal point.
 *
 * Behaviourally: clicking dispatches a synthetic Cmd/Ctrl+K so the
 * existing global CommandPalette listener picks it up. No new
 * plumbing needed.
 *
 * Visually:
 *   · h-7 / 28px tall — tight to match the new dense strip
 *   · bg-surface/40 — slightly elevated off the canvas
 *   · ring-line-strong/40 — almost invisible idle border
 *   · sparkles 12px primary/70 — restrained
 *   · "Search documents, projects, anything…" — text-fg-subtle so
 *     it whispers
 *   · kbd is its own surface-2 chip — proper editorial typography
 *   · hover blooms the ring to primary/35 + lifts text to fg
 *   · subtle inner glow on hover gives the focal-point feel
 */
function CommandKPill() {
  function openPalette() {
    const isMac =
      typeof navigator !== "undefined" &&
      navigator.platform.toLowerCase().includes("mac");
    const e = new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(e);
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Open command palette (⌘K)"
      className="
        group relative inline-flex items-center gap-2.5
        w-full max-w-[420px] h-8 px-3 rounded-md
        bg-transparent
        text-fg-subtle
        transition-colors duration-150
        hover:bg-surface/50 hover:text-fg-muted
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
      "
    >
      <Sparkles
        className="w-3.5 h-3.5 text-primary/80 group-hover:text-primary transition-colors flex-shrink-0"
        strokeWidth={2.2}
      />
      <span className="flex-1 text-left text-[12.5px] whitespace-nowrap overflow-hidden">
        Search documents, projects, anything…
      </span>
      <kbd
        className="
          inline-flex items-center h-5 px-1.5 rounded
          text-fg-faint font-mono text-[10px] tracking-tight
          flex-shrink-0
          group-hover:text-fg-subtle
          transition-colors
        "
      >
        ⌘K
      </kbd>
    </button>
  );
}

