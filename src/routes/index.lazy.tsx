import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { StorageUsageChart } from "@/MyComponents/HomeDashboard/storage";
import {
  MessageSquare,
  Users,
  Terminal,
  DollarSignIcon,
  File,
  CalendarSearch,
  Sparkles,
  RotateCcw,
  Eye,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import Quotas from "@/MyComponents/HomeDashboard/qoutas";
import CompanyStats from "@/MyComponents/HomeDashboard/companyStats";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { SchedImgStore, useAppStore, useCompanyFilter, type CompanyFilter } from "@/stores/store";
import { getStronghold } from "@/stores/stronghold";
import InitialOnboarding from "@/MyComponents/Beginning/initialOnboarding";
import { QuickActionCard } from "@/MyComponents/HomeDashboard/Components/quickActionCard";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import { ActiveUser } from "@/stores/query";
import { CompanyCard } from "@/MyComponents/HomeDashboard/Components/companyCard";
import { ActivityFeed } from "@/MyComponents/HomeDashboard/Components/activityFeed";
import { TeamPresence } from "@/MyComponents/HomeDashboard/Components/teamPresence";
// Lazy-load the two bento dashboards so the home route only pulls the
// one matching the selected company — and nothing extra when on the
// "all" overview (the default). Each is a large subtree; this keeps
// them out of the home boot graph until actually shown.
const CWADashboard = lazy(() =>
  import("@/MyComponents/Dashboard/CWADashboard").then((m) => ({ default: m.CWADashboard })),
);
const SimplicityDashboard = lazy(() =>
  import("@/MyComponents/Dashboard/SimplicityDashboard").then((m) => ({ default: m.SimplicityDashboard })),
);
import { companySupabase } from "@/MyComponents/supabase";

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
            <h1
              className="text-[15px] text-zinc-100 tracking-tight truncate font-medium"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              {getGreeting()},{" "}
              <span className="text-emerald-300">{username}</span>
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
            className="hidden md:flex justify-center"
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
            {/* TEMP — debug entry into the welcome wizard. Remove
             *  once auto-redirect verified in production. */}
            {/* Install-binder debug pill — preview the pre-login
             *  InitialOnboarding flow + hard reset back to it.
             *  Replaces the old <OnboardingDebugPill /> which was
             *  for my post-login wizard (now unwired). */}
            <InstallOnboardingPill />

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
            <Suspense fallback={null}>
              <CWADashboard />
            </Suspense>
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
            <Suspense fallback={null}>
              <SimplicityDashboard />
            </Suspense>
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

/* ════════════════════════════════════════════════════════════════
 * OnboardingDebugPill — TEMPORARY header chip for testing the
 * /welcome wizard. Two clicks:
 *   · Click "Welcome" → navigate to /welcome with no state change.
 *   · Click the small reset icon → clear onboarded_at + role +
 *     onboarding_state so the auto-redirect fires from scratch.
 *
 * Remove this component + its imports + the `<OnboardingDebugPill />`
 * usage in the header before shipping.
 * ════════════════════════════════════════════════════════════════ */
function OnboardingDebugPill() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = ActiveUser();
  const supaId = (user?.[0] as any)?.supa_id;

  // `debug=1` tells OnboardingPage to show the wizard even when
  // the user is already onboarded. Without this param, the page
  // immediately redirects to / for onboarded users.
  const go = () =>
    navigate({ to: "/welcome" as any, search: { debug: "1" } as any });

  const reset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supaId) {
      alert("No supa_id — can't reset.");
      return;
    }
    const { error } = await companySupabase
      .from("employee")
      .update({
        onboarded_at: null,
        role: null,
        onboarding_state: null,
      })
      .eq("supa_id", supaId);
    if (error) {
      alert(`Reset failed: ${error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-state"] });
    navigate({ to: "/welcome" as any });
  };

  return (
    <div className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-full bg-warning/15 border border-warning/40 text-warning ml-1">
      <button
        type="button"
        onClick={go}
        className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:text-warning/80 transition-colors"
        title="Open /welcome"
      >
        <Sparkles size={11} strokeWidth={2.4} />
        Welcome
      </button>
      <span className="w-px h-3 bg-warning/30" aria-hidden />
      <button
        type="button"
        onClick={reset}
        className="p-1 rounded-full hover:bg-warning/20 transition-colors"
        title="Reset onboarded_at + role, then open /welcome"
      >
        <RotateCcw size={10} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// Pill is unwired pending post-login wizard reconciliation.
void OnboardingDebugPill;

/* ════════════════════════════════════════════════════════════════
 * InstallOnboardingPill — TEMPORARY dashboard header chip for
 * the pre-login InitialOnboarding (install-binder) flow.
 *
 *   Preview (👁)  Opens InitialOnboarding in a fullscreen overlay
 *                 with `debugMode` so no DB / Stronghold writes
 *                 happen. Walk the founder path end-to-end, or
 *                 pick Employee to see the bouncer.
 *
 *   ↻ Reset      Confirms, then performs a HARD reset back to a
 *                fresh-install state:
 *                  • Clears `company_name` from Stronghold
 *                    (so companySupabase falls back to pseudo-key)
 *                  • Flips `initial_launch` back to true
 *                  • Sets `isLoggedIn` to "false"
 *                  • Reloads the window
 *                After reload, __root.tsx will render
 *                InitialOnboarding from scratch.
 *
 * Remove this whole component (+ its <InstallOnboardingPill />
 * usage in the header) before shipping.
 * ════════════════════════════════════════════════════════════════ */
function InstallOnboardingPill() {
  const [preview, setPreview] = useState(false);
  const [resetting, setResetting] = useState(false);

  const openPreview = () => setPreview(true);
  const closePreview = () => setPreview(false);

  const hardReset = async () => {
    const ok = window.confirm(
      "Hard reset back to the install-binder flow?\n\n" +
        "This will:\n" +
        "  · Clear the Stronghold company_name binding\n" +
        "  · Flip initial_launch back to true\n" +
        "  · Sign you out\n" +
        "  · Reload the window\n\n" +
        "Your remote DB data is NOT touched — only this install's\n" +
        "local state. Continue?",
    );
    if (!ok) return;

    setResetting(true);
    try {
      try {
        const sh = await getStronghold();
        await sh.removeRecord("company_name");
      } catch (err) {
        // Vault may not exist yet on a truly fresh install — fine.
        console.warn(
          "[install-pill] stronghold clear failed (probably empty):",
          err,
        );
      }

      const store: any = useAppStore.getState();
      // Zustand setters on the slice — flip both at once.
      useAppStore.setState({ initial_launch: true });
      store.setIsLoggedIn?.("false");

      window.location.reload();
    } finally {
      // No-op if reload happened; guard for the error path.
      setResetting(false);
    }
  };

  return (
    <>
      {/* Editorial debug pill — quietened from the loud warning
       *  yellow chip to a soft amber-tinted outline that still reads
       *  as "temporary/dev" without shouting in the header. */}
      <div className="inline-flex items-center gap-0.5 h-7 pl-2 pr-1 rounded-full bg-amber-500/[0.06] border border-amber-500/30 text-amber-300 ml-1">
        <button
          type="button"
          onClick={openPreview}
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] hover:text-amber-200 transition-colors pr-1"
          title="Preview the install-binder wizard (no DB writes)"
        >
          <Eye size={11} strokeWidth={2.4} />
          Onboarding
        </button>
        <span className="w-px h-3 bg-amber-500/30" aria-hidden />
        <button
          type="button"
          onClick={hardReset}
          disabled={resetting}
          className="p-1 rounded-full hover:bg-amber-500/15 transition-colors disabled:opacity-50"
          title="Hard reset — clear Stronghold, flip initial_launch, reload"
        >
          <RotateCcw size={10} strokeWidth={2.4} />
        </button>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[10000] bg-background">
          <button
            type="button"
            onClick={closePreview}
            className="absolute top-4 right-4 z-[10001] inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold text-foreground/85 bg-foreground/[0.05] border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.08] transition-colors"
            aria-label="Close preview"
          >
            <X size={12} />
            Close preview
          </button>
          <div className="absolute top-4 left-4 z-[10001] inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] bg-warning/15 border border-warning/40 text-warning">
            <Eye size={11} strokeWidth={2.4} />
            Preview mode · no writes
          </div>
          <InitialOnboarding debugMode completeInitialLaunch={closePreview} />
        </div>
      )}
    </>
  );
}

// Keep TS from flagging unused while pills sit alongside each other.
void InstallOnboardingPill;
