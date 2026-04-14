/**
 * logs.tsx — Mod Logs page (Void theme).
 *
 * Admin-only activity feed aggregating webhooks from multiple services:
 *   - GitHub (live via GitHubWebhookComponent)
 *   - LinkedIn, Calendly, Upwork, Indeed, Hostinger (placeholder stubs)
 *
 * Restyled from the old red-950 theme to match the rest of the app:
 *   bg-background page, bg-card cards, red-500 accents, rounded-sm.
 * Old `bg-background/60 border-red-950/30 backdrop-blur-sm` cyberpunk patterns
 * are replaced with the unified Void palette.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Github, GitCommit, Briefcase, Calendar as CalendarIcon, Globe,
  Linkedin, Network, RefreshCw, Shield, UserCircle,
} from "lucide-react";
import GitHubWebhookComponent from "../Webhooks/GithubHook";

// ── Placeholder mock data (LinkedIn / Calendly tabs until real APIs wired) ──
const mockLinkedInData = [
  {
    id: "linkedin_1",
    timestamp: "Today at 10:15 AM",
    activity: {
      type: "Connection Request",
      user: "John Developer",
      details: "New connection request from a senior engineer",
    },
  },
];

const mockCalendlyData = [
  {
    id: "calendly_1",
    timestamp: "Today at 9:30 AM",
    event: {
      type: "Meeting Scheduled",
      with: "Jane Client",
      time: "Tomorrow at 2:00 PM",
      duration: "30 minutes",
    },
  },
];

// ── Tab configuration ──
const TABS = [
  { key: "github", label: "GitHub", icon: Github },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "calendly", label: "Calendly", icon: CalendarIcon },
  { key: "upwork", label: "Upwork", icon: Briefcase },
  { key: "indeed", label: "Indeed", icon: Network },
  { key: "hostinger", label: "Hostinger", icon: Globe },
] as const;

// ── LinkedIn activity card ──
const LinkedInActivityCard: React.FC<{ data: typeof mockLinkedInData[0] }> = ({ data }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-sm overflow-hidden hover:border-primary/10 transition-colors"
  >
    <div className="px-4 py-3 flex items-start gap-3 border-b border-border">
      <div className="h-9 w-9 rounded-sm bg-blue-500/[0.08] border border-blue-500/15 flex items-center justify-center shrink-0">
        <Linkedin className="h-4 w-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-medium text-white/85">LinkedIn</h3>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-500/[0.08] text-blue-400/80 border border-blue-500/10">
            App
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/50">{data.timestamp}</span>
      </div>
    </div>
    <div className="px-4 py-3">
      <p className="text-[13px] font-medium text-white/75">{data.activity.type}</p>
      <p className="text-[12px] text-muted-foreground/80 mt-0.5">{data.activity.user}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{data.activity.details}</p>
    </div>
  </motion.div>
);

// ── Calendly event card ──
const CalendlyEventCard: React.FC<{ data: typeof mockCalendlyData[0] }> = ({ data }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-sm overflow-hidden hover:border-primary/10 transition-colors"
  >
    <div className="px-4 py-3 flex items-start gap-3 border-b border-border">
      <div className="h-9 w-9 rounded-sm bg-amber-500/[0.08] border border-amber-500/15 flex items-center justify-center shrink-0">
        <CalendarIcon className="h-4 w-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-medium text-white/85">Calendly</h3>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-amber-500/[0.08] text-amber-400/80 border border-amber-500/10">
            App
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/50">{data.timestamp}</span>
      </div>
    </div>
    <div className="px-4 py-3 space-y-1">
      <p className="text-[13px] font-medium text-white/75">{data.event.type}</p>
      <p className="text-[12px] text-muted-foreground/80">With: <span className="text-foreground/70">{data.event.with}</span></p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
        <span>{data.event.time}</span>
        <span>·</span>
        <span>{data.event.duration}</span>
      </div>
    </div>
  </motion.div>
);

// ── Empty state for unimplemented integrations ──
const EmptyIntegration: React.FC<{
  name: string;
  icon: React.ElementType;
  message?: string;
}> = ({ name, icon: Icon, message }) => (
  <div className="bg-card border border-border rounded-sm py-16 text-center">
    <Icon className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
    <p className="text-[14px] text-muted-foreground font-medium mb-1">{name} integration not connected</p>
    <p className="text-[12px] text-muted-foreground/40">
      {message || "Configure a webhook endpoint in Settings to start streaming activity"}
    </p>
  </div>
);

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
function ModLogsPage() {
  const [activeTab, setActiveTab] = useState<string>("github");

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <GitCommit className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-[24px] font-bold text-foreground tracking-tight">Mod Logs</h1>
                <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                  Aggregated webhooks from connected services
                </p>
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-500/[0.08] border border-amber-500/15 text-amber-400 text-[10px] uppercase tracking-wider font-medium">
                <Shield className="h-2.5 w-2.5" /> Admin only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="px-8 pt-5">
        <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-sm p-0.5 w-fit overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium whitespace-nowrap transition-all ${
                activeTab === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 py-5 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          key={activeTab}
        >
          {activeTab === "github" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground/70" />
                  <h2 className="text-[14px] font-semibold text-white/85">GitHub Activity</h2>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/70 hover:text-foreground/70 text-[11px] rounded-sm transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
              <GitHubWebhookComponent />
            </>
          )}

          {activeTab === "linkedin" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-muted-foreground/70" />
                  <h2 className="text-[14px] font-semibold text-white/85">LinkedIn Activity</h2>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/70 hover:text-foreground/70 text-[11px] rounded-sm transition-colors">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              <div className="space-y-2">
                {mockLinkedInData.length > 0 ? (
                  mockLinkedInData.map((item) => <LinkedInActivityCard key={item.id} data={item} />)
                ) : (
                  <EmptyIntegration name="LinkedIn" icon={Linkedin} />
                )}
              </div>
            </>
          )}

          {activeTab === "calendly" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground/70" />
                  <h2 className="text-[14px] font-semibold text-white/85">Calendly Events</h2>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/70 hover:text-foreground/70 text-[11px] rounded-sm transition-colors">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              <div className="space-y-2">
                {mockCalendlyData.length > 0 ? (
                  mockCalendlyData.map((item) => <CalendlyEventCard key={item.id} data={item} />)
                ) : (
                  <EmptyIntegration name="Calendly" icon={CalendarIcon} />
                )}
              </div>
            </>
          )}

          {activeTab === "upwork" && <EmptyIntegration name="Upwork" icon={Briefcase} />}
          {activeTab === "indeed" && <EmptyIntegration name="Indeed" icon={Network} />}
          {activeTab === "hostinger" && <EmptyIntegration name="Hostinger" icon={Globe} />}
        </motion.div>
      </div>
    </div>
  );
}

export default ModLogsPage;
