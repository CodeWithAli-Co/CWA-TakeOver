/**
 * SettingsPage.tsx — left-sidebar settings layout.
 *
 * Layout:
 *   · Left rail (220px on desktop, collapses to a top dropdown on
 *     mobile): vertical list of sections with icons + labels.
 *   · Right pane: header (title + description) + the section's
 *     content component.
 *
 * Navigation state is URL-synced via `?tab=…` so sharing a link to
 * "/settings?tab=integrations" lands directly on that section. This
 * also lets other parts of the app deep-link (e.g. the nav-user
 * dropdown pointing at /settings for notifications).
 *
 * Styling is theme-var driven (bg-background, text-foreground,
 * border-border) so the whole page follows the platform theme
 * instead of hardcoded red-950 accents everywhere.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle,
  Bell,
  Users2,
  Building2,
  Database,
  LineChart,
  Plug,
  Shield,
  Menu,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { ActiveUser } from "@/stores/query";
import { DeveloperResourceHub } from "@/MyComponents/HomeDashboard/ResourceHub";
import { ConnectorsSettings } from "@/MyComponents/SettingNavComponents/connectors";
import { NotificationSetting } from "@/MyComponents/SettingNavComponents/notification";
import { CompanySettings } from "@/MyComponents/SettingNavComponents/company";
import ReportSettings from "../SettingNavComponents/reports";
import TeamsAndProjects from "../SettingNavComponents/TeamProject";
import UserView, { Role } from "../Reusables/userView";
import { ProfileSettings } from "./settings/ProfileSettings";
import { SecuritySettings } from "./settings/SecuritySettings";
import { ModulesSettings } from "./settings/ModulesSettings";

// ── Tab registry ────────────────────────────────────────────────

interface TabDef {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Elevated roles see the full breadth of tabs. Everyone else
   *  sees Profile + Notifications + Security only — no access to
   *  billing, teams, company data, etc. */
  elevatedOnly?: boolean;
}

const TABS: TabDef[] = [
  {
    value: "profile",
    label: "Profile",
    description: "Your personal info, avatar, and display preferences.",
    icon: UserCircle,
  },
  {
    value: "teams",
    label: "Teams & Projects",
    description: "Team memberships, project assignments, and collaboration.",
    icon: Users2,
    elevatedOnly: true,
  },
  {
    value: "company",
    label: "Company",
    description: "Legal info, branding, and configuration for each company you operate.",
    icon: Building2,
    elevatedOnly: true,
  },
  {
    value: "reports",
    label: "Reports",
    description: "Automated report cadence and delivery preferences.",
    icon: LineChart,
    elevatedOnly: true,
  },
  {
    value: "resources",
    label: "Resources",
    description: "Internal knowledge base, docs, and shared developer assets.",
    icon: Database,
    elevatedOnly: true,
  },
  {
    value: "connectors",
    label: "Connectors",
    description:
      "Wire up the SaaS tools your team already uses — Stripe, Plaid, Google Docs, and more.",
    icon: Plug,
    elevatedOnly: true,
  },
  {
    value: "modules",
    label: "Modules",
    description:
      "Turn TakeOver modules on or off — change which parts of the app your team sees.",
    icon: LayoutGrid,
    elevatedOnly: true,
  },
  {
    value: "notifications",
    label: "Notifications",
    description: "How and when Takeover contacts you.",
    icon: Bell,
  },
  {
    value: "security",
    label: "Security",
    description: "Password, sessions, recent sign-ins.",
    icon: Shield,
  },
];

// ── Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: user } = ActiveUser();
  const role = user?.[0]?.role ?? "";
  const isElevated = ["CEO", "COO", "CFO", "Admin", "ProjectManager"].includes(role);
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.elevatedOnly || isElevated),
    [isElevated],
  );

  // URL-synced active tab. Using plain URLSearchParams because the
  // route is registered with no `validateSearch` — keeps this file
  // route-agnostic and portable.
  const readUrlTab = (): string => {
    if (typeof window === "undefined") return "profile";
    const q = new URLSearchParams(window.location.search).get("tab");
    return visibleTabs.some((t) => t.value === q) ? q! : visibleTabs[0]!.value;
  };
  const [activeTab, setActiveTab] = useState<string>(readUrlTab());

  useEffect(() => {
    const onPop = () => setActiveTab(readUrlTab());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.length]);

  const selectTab = (value: string) => {
    setActiveTab(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState(null, "", url.toString());
    }
    setMobileOpen(false);
  };

  // Responsive
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1400,
  );
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile = windowWidth < 1024;
  const [mobileOpen, setMobileOpen] = useState(false);

  const active = visibleTabs.find((t) => t.value === activeTab) ?? visibleTabs[0]!;
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page header strip */}
      <header className="border-b border-border/60 bg-card/30 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8 py-5">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Settings
            </p>
          </div>
          <h1 className="mt-1 text-[22px] md:text-[26px] font-bold tracking-tight text-foreground">
            {active.label}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {active.description}
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8 py-6">
        {isMobile ? (
          // ── Mobile / narrow: tab dropdown on top ──
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ActiveIcon className="h-4 w-4 text-muted-foreground" />
                {active.label}
              </span>
              <Menu className="h-4 w-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg"
                >
                  <ul className="p-1">
                    {visibleTabs.map((t) => (
                      <li key={t.value}>
                        <TabRow
                          tab={t}
                          active={activeTab === t.value}
                          onClick={() => selectTab(t.value)}
                        />
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          // ── Desktop: left rail + right content ──
          <div className="grid gap-6 grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
            <aside>
              <nav className="sticky top-6 flex flex-col gap-0.5 rounded-md border border-border bg-card/40 p-1.5">
                {visibleTabs.map((t) => (
                  <TabRow
                    key={t.value}
                    tab={t}
                    active={activeTab === t.value}
                    onClick={() => selectTab(t.value)}
                  />
                ))}
              </nav>
              <p className="mt-3 px-2 text-[10.5px] text-muted-foreground/70">
                Some sections are visible only to elevated roles.
              </p>
            </aside>

            <TabContent activeTab={activeTab} user={user?.[0]} />
          </div>
        )}

        {/* On mobile, the content goes below the dropdown */}
        {isMobile && <TabContent activeTab={activeTab} user={user?.[0]} />}
      </div>
    </div>
  );
}

// ── Tab row ─────────────────────────────────────────────────────

function TabRow({
  tab, active, onClick,
}: {
  tab: TabDef;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[12.5px] transition-colors",
        active
          ? "bg-primary/[0.12] text-primary font-semibold"
          : "text-foreground/85 hover:bg-muted/60 hover:text-foreground font-medium",
      ].join(" ")}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span className="flex-1 truncate">{tab.label}</span>
      {active && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
    </button>
  );
}

// ── Tab content dispatcher ──────────────────────────────────────

function TabContent({
  activeTab, user,
}: {
  activeTab: string;
  user: any;
}) {
  return (
    <main className="min-w-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          {activeTab === "profile" && <ProfileSettings user={user} />}

          <UserView userRole={[Role.ProjectManager, Role.COO, Role.CEO, Role.CFO, Role.Admin]}>
            {activeTab === "teams" && (
              <SectionCard>
                <TeamsAndProjects />
              </SectionCard>
            )}
            {activeTab === "company" && (
              <SectionCard>
                <CompanySettings />
              </SectionCard>
            )}
            {activeTab === "reports" && (
              <SectionCard>
                <ReportSettings />
              </SectionCard>
            )}
            {activeTab === "resources" && (
              <SectionCard>
                <DeveloperResourceHub />
              </SectionCard>
            )}
            {activeTab === "connectors" && (
              <SectionCard>
                <ConnectorsSettings />
              </SectionCard>
            )}
            {activeTab === "modules" && (
              <SectionCard>
                <ModulesSettings />
              </SectionCard>
            )}
          </UserView>

          {activeTab === "notifications" && (
            <SectionCard>
              <NotificationSetting />
            </SectionCard>
          )}
          {activeTab === "security" && <SecuritySettings />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

// ── Section card shell (shared between wrapped subcomponents) ──

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
      {children}
    </div>
  );
}
