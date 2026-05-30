/**
 * modulesCatalog.ts — the modules a founder can enable during
 * onboarding. Smart defaults are applied based on industry +
 * team size; see `defaultModulesFor()`.
 *
 * Adding a new module is a 1-entry change. Removing one needs
 * to also remove the matching id from any stored
 * onboarding_state, which is a non-issue because we don't read
 * unknown ids back anywhere.
 *
 * These ids will eventually become rows in a per-company
 * `enabled_modules` table once the proper companies schema
 * lands. For now we store them in `onboarding_state.modules`.
 */

import {
  Briefcase,
  Calendar,
  Code,
  FileText,
  LineChart,
  MessageCircle,
  Users2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Always on by default — can't turn off in onboarding. */
  alwaysOn?: boolean;
  /** Suggested industries that pre-check this module. */
  industryHints?: string[];
  /** Pre-check if the picked team size has at least this many. */
  minTeamSize?: number;
}

/** Maps team-size bucket → minimum team count for matching. */
const TEAM_SIZE_MIN: Record<string, number> = {
  "just-me": 1,
  "small": 2,
  "mid": 11,
  "large": 51,
  "enterprise": 200,
};

export const MODULES: ModuleDef[] = [
  {
    id: "operations",
    name: "Operations",
    description: "Tasks, projects, weekly quotas — your day-to-day.",
    icon: Briefcase,
    alwaysOn: true,
  },
  {
    id: "workspace",
    name: "Workspace",
    description: "Collaborative docs and sheets.",
    icon: FileText,
    alwaysOn: true,
  },
  {
    id: "chat",
    name: "Chat",
    description: "Channels, DMs, huddles, kudos.",
    icon: MessageCircle,
    alwaysOn: true,
  },
  {
    id: "schedule",
    name: "Schedule",
    description: "Shifts, meetings, time tracking.",
    icon: Calendar,
    minTeamSize: 2,
  },
  {
    id: "hiring",
    name: "Hiring",
    description: "Candidate pipeline + onboarding new hires.",
    icon: Users2,
    minTeamSize: 6,
  },
  {
    id: "code",
    name: "Code",
    description: "Repo browser, PR review, issue tracker.",
    icon: Code,
    industryHints: ["tech", "saas"],
  },
  {
    id: "reports",
    name: "Reports",
    description: "Submit bugs + ops reports, route to owners.",
    icon: LineChart,
    minTeamSize: 6,
  },
  {
    id: "bookkeeping",
    name: "Bookkeeping",
    description: "Budgets, invoices, payroll, financials.",
    icon: Wallet,
    industryHints: ["finance"],
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
