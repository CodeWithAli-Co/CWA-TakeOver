/**
 * modulesCatalog.ts — single source of truth for every TakeOver
 * module the founder can enable on their workspace.
 *
 * Used by:
 *   · `InitialOnboarding`'s Step 4 — the install-time picker
 *   · Settings → Modules — the "I changed my mind" picker
 *
 * The selected ids are stored on `takeover_companies.components`
 * (TEXT[]). Every consumer that needs to know "is module X
 * enabled?" should read that column rather than hard-coding the
 * routes — that's how disabling a module actually removes it
 * from the user's nav.
 *
 * Adding a new module: one entry here, one route (or wire-in)
 * elsewhere, and any conditional "show only if enabled" check
 * in the consumer. Removing one is harmless — unknown ids in
 * `components` are silently ignored.
 *
 * Categories drive the visual grouping in the picker. Their
 * order in `MODULE_CATEGORIES` is the order they render.
 */

import {
  // Operations
  Briefcase,
  Calendar,
  MessageCircle,
  FileText,
  ClipboardList,
  // Business / Sales
  Receipt,
  Mail,
  FileSignature,
  Megaphone,
  BarChart3,
  BookOpen,
  // Finance
  DollarSign,
  TrendingUp,
  Banknote,
  CreditCard,
  // People
  UserPlus,
  Users,
  UserCog,
  Sparkles,
  GraduationCap,
  Award,
  Clock,
  // Engineering / Strategy
  Code as CodeIcon,
  Target,
  Map as MapIcon,
  type LucideIcon,
} from "lucide-react";

export type ModuleCategory =
  | "operations"
  | "business"
  | "finance"
  | "people"
  | "engineering";

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: ModuleCategory;
  /** Always on by default — can't turn off in onboarding.
   *  Reserved for things that genuinely break the app without
   *  them (currently: nothing). */
  alwaysOn?: boolean;
  /** Suggested industries that pre-check this module. */
  industryHints?: string[];
  /** Pre-check if the picked team size has at least this many. */
  minTeamSize?: number;
}

/** Display order + label for category groups in the picker.
 *  `accent` is a CSS color value (hex) used to tint the category
 *  tab + cards. Picked for high contrast against the dark canvas
 *  while still feeling on-brand. */
export const MODULE_CATEGORIES: Array<{
  id: ModuleCategory;
  label: string;
  /** One-line subtitle shown under the category heading. */
  desc: string;
  /** Hex color for tab + card accents. */
  accent: string;
}> = [
  {
    id: "operations",
    label: "Operations",
    desc: "Day-to-day work + collaboration.",
    accent: "#E5484D", // red — matches the brand primary
  },
  {
    id: "business",
    label: "Sales & Comms",
    desc: "How you reach customers and bring in revenue.",
    accent: "#F5A524", // amber — warmth for outreach
  },
  {
    id: "finance",
    label: "Finance",
    desc: "Money in, money out, runway, raises.",
    accent: "#30A46C", // green — money
  },
  {
    id: "people",
    label: "People",
    desc: "Hire, onboard, train, grow.",
    accent: "#8E4EC6", // violet — warmth for the human stuff
  },
  {
    id: "engineering",
    label: "Engineering & Strategy",
    desc: "Code, roadmap, intelligence.",
    accent: "#0091FF", // electric blue — engineering tone
  },
];

/** Quick-pick bundles offered at the top of the modules step.
 *  Lets a founder say "I'm a startup, give me the basics" without
 *  ticking 6 boxes individually. Each preset is a curated subset
 *  of module ids. */
export const MODULE_PRESETS: Array<{
  id: string;
  label: string;
  tagline: string;
  ids: string[];
  /** Hex color for the preset chip. */
  accent: string;
}> = [
  {
    id: "starter",
    label: "Startup Starter",
    tagline: "Just the essentials to get a team running.",
    ids: ["operations", "schedule", "chat", "workspace", "hiring"],
    accent: "#E5484D",
  },
  {
    id: "ops-only",
    label: "Operations Only",
    tagline: "Just the work + collaboration layer.",
    ids: ["operations", "schedule", "chat", "workspace", "reports"],
    accent: "#0091FF",
  },
  {
    id: "sales-team",
    label: "Sales Team",
    tagline: "Outreach, deals, invoicing, contracts.",
    ids: [
      "operations",
      "chat",
      "workspace",
      "invoicer",
      "coldemail",
      "contractGenerator",
      "broadcast",
      "analytics",
    ],
    accent: "#F5A524",
  },
  {
    id: "full",
    label: "Full Suite",
    tagline: "Every module — turn off what you don't need later.",
    ids: [], // populated at runtime to all module ids
    accent: "#30A46C",
  },
];

/** Maps team-size bucket → minimum team count for matching. */
const TEAM_SIZE_MIN: Record<string, number> = {
  "just-me": 1,
  "small": 2,
  "mid": 11,
  "large": 51,
  "enterprise": 200,
};

export const MODULES: ModuleDef[] = [
  // ── Operations ────────────────────────────────────────────
  {
    id: "operations",
    name: "Operations",
    description: "Tasks, projects, weekly quotas — your day-to-day work.",
    icon: Briefcase,
    category: "operations",
  },
  {
    id: "schedule",
    name: "Schedule",
    description: "Shifts, meetings, coverage requests, time tracking.",
    icon: Calendar,
    category: "operations",
    minTeamSize: 2,
  },
  {
    id: "chat",
    name: "Chat",
    description: "Channels, DMs, huddles, kudos — team communication.",
    icon: MessageCircle,
    category: "operations",
  },
  {
    id: "workspace",
    name: "Workspace",
    description: "Realtime docs and sheets with comments, history, presence.",
    icon: FileText,
    category: "operations",
  },
  {
    id: "reports",
    name: "Reports",
    description: "Submit bugs, route assignments, track resolution.",
    icon: ClipboardList,
    category: "operations",
    minTeamSize: 6,
  },

  // ── Business / Sales / Comms ──────────────────────────────
  {
    id: "invoicer",
    name: "Invoicer",
    description: "Send and track client invoices with payment links.",
    icon: Receipt,
    category: "business",
  },
  {
    id: "coldemail",
    name: "Cold Email",
    description: "Outreach sequences with reply detection and throttling.",
    icon: Mail,
    category: "business",
  },
  {
    id: "contractGenerator",
    name: "Contract Generator",
    description: "Build contracts and SOWs from templates.",
    icon: FileSignature,
    category: "business",
  },
  {
    id: "broadcast",
    name: "Broadcast",
    description: "Company-wide announcements + targeted audience sends.",
    icon: Megaphone,
    category: "business",
    minTeamSize: 11,
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Cross-module analytics + custom dashboards.",
    icon: BarChart3,
    category: "business",
  },
  {
    id: "bookkeeping",
    name: "Bookkeeping",
    description: "Books, ledger, reconciliation, monthly close.",
    icon: BookOpen,
    category: "business",
    industryHints: ["finance"],
  },

  // ── Finance ───────────────────────────────────────────────
  {
    id: "financialDashboard",
    name: "Finance Dashboard",
    description: "Revenue, expenses, KPIs, MRR/ARR — at a glance.",
    icon: DollarSign,
    category: "finance",
  },
  {
    id: "capitalPlan",
    name: "Capital Plan",
    description: "Cash runway, burn rate, hiring + spend scenarios.",
    icon: TrendingUp,
    category: "finance",
  },
  {
    id: "funding",
    name: "Funding",
    description: "Investor pipeline, rounds, term sheets, cap table.",
    icon: Banknote,
    category: "finance",
  },
  {
    id: "billing",
    name: "Billing",
    description: "Subscription tiers, customer billing, dunning.",
    icon: CreditCard,
    category: "finance",
  },

  // ── People ────────────────────────────────────────────────
  {
    id: "hiring",
    name: "Hiring",
    description: "Candidates, offers, interviews, hiring pipeline.",
    icon: UserPlus,
    category: "people",
    minTeamSize: 6,
  },
  {
    id: "employee",
    name: "Employees",
    description: "Directory, roles, employment lifecycle.",
    icon: Users,
    category: "people",
    minTeamSize: 2,
  },
  {
    id: "onboarding",
    name: "Onboarding",
    description: "New-hire welcome plans, drip emails, first-week tasks.",
    icon: UserCog,
    category: "people",
  },
  {
    id: "growth",
    name: "Career Growth",
    description: "Per-employee growth tracks with manager reviews.",
    icon: Sparkles,
    category: "people",
    minTeamSize: 6,
  },
  {
    id: "trainingplan",
    name: "Training Plans",
    description: "Per-role onboarding curricula and progress tracking.",
    icon: GraduationCap,
    category: "people",
  },
  {
    id: "graduationPlan",
    name: "Graduation Plans",
    description: "Intern → full-time transition planning.",
    icon: Award,
    category: "people",
    minTeamSize: 11,
  },
  {
    id: "timetracking",
    name: "Time Tracking",
    description: "Time entries, project codes, billable hours.",
    icon: Clock,
    category: "people",
  },

  // ── Engineering & Strategy ────────────────────────────────
  {
    id: "code",
    name: "Code",
    description: "Repo browser, PR review, issues, AI agent activity.",
    icon: CodeIcon,
    category: "engineering",
    industryHints: ["tech", "ai"],
  },
  {
    id: "strategy",
    name: "Strategy",
    description: "Strategic intelligence + C-level briefings.",
    icon: Target,
    category: "engineering",
    minTeamSize: 11,
  },
  {
    id: "roadmap",
    name: "Roadmap",
    description: "Roadmap planning + cross-team commitments.",
    icon: MapIcon,
    category: "engineering",
  },
];

/** Picks initial module checkboxes based on the founder's
 *  industry + team size answers. Always-on modules are
 *  unconditionally included. */
export function defaultModulesFor(input: {
  industry?: string;
  teamSize?: string;
}): Set<string> {
  const picked = new Set<string>();
  const minTeam = input.teamSize ? TEAM_SIZE_MIN[input.teamSize] ?? 1 : 1;
  for (const m of MODULES) {
    if (m.alwaysOn) {
      picked.add(m.id);
      continue;
    }
    if (m.minTeamSize !== undefined && minTeam >= m.minTeamSize) {
      picked.add(m.id);
      continue;
    }
    if (
      m.industryHints &&
      input.industry &&
      m.industryHints.includes(input.industry)
    ) {
      picked.add(m.id);
      continue;
    }
  }
  return picked;
}

/** Group modules by category for picker rendering. */
export function modulesByCategory(): Map<ModuleCategory, ModuleDef[]> {
  const grouped = new Map<ModuleCategory, ModuleDef[]>();
  for (const cat of MODULE_CATEGORIES) {
    grouped.set(cat.id, []);
  }
  for (const m of MODULES) {
    const arr = grouped.get(m.category);
    if (arr) arr.push(m);
  }
  return grouped;
}

/** Look up a single module by id. */
export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
