/**
 * mockData.ts — Fake repos / commits / PRs for the /code surface.
 *
 * Used by the UI shell before the Supabase wiring is in place.
 * Shape matches the migration in migrations/code_init.sql so when
 * we wire real data in, the components don't need to change.
 *
 * Every row has at least one AI agent attribution so the
 * "AI commits / reviews / PRs" identity story reads correctly
 * even on a fresh install.
 */

export interface AiAgent {
  id: string;
  slug: string;
  displayName: string;
  role: "architect" | "engineer" | "critic" | "other";
  accentHsl: string;
}

export interface Repo {
  id: string;
  owner: string;
  name: string;
  description: string;
  status: "active" | "archived" | "draft";
  visibility: "private" | "internal" | "public";
  defaultBranch: string;
  primaryLanguage: string;
  languageBreakdown: Record<string, number>;
  openPrCount: number;
  lastCommitAt: string;
  lastCommitAgentId: string;
  /** AI activity heat — 0-100, drives the heat indicator on the card. */
  activityHeat: number;
}

export interface CommitRow {
  id: string;
  repoId: string;
  sha: string;
  parentSha: string | null;
  branchName: string;
  message: string;
  authorUsername: string | null;
  authorAgentId: string | null;
  agentReasoning: string | null;
  createdAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface FileRow {
  id: string;
  repoId: string;
  branchName: string;
  path: string;
  content: string | null;
  sizeBytes: number;
  language: string;
  isBinary: boolean;
  aiSummary: string | null;
  depsOut: string[];
  depsIn: string[];
  lastModifiedAt: string;
  lastModifiedAgentId: string | null;
}

export interface PullRequest {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  status: "open" | "draft" | "merged" | "closed";
  authorUsername: string | null;
  authorAgentId: string | null;
  sourceBranch: string;
  targetBranch: string;
  headSha: string;
  createdAt: string;
  updatedAt: string;
  aiExplanation: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commentCount: number;
}

export interface ActivityItem {
  id: string;
  repoId: string | null;
  agentId: string | null;
  kind: "commit" | "opened_pr" | "reviewed_pr" | "merged_pr" | "created_branch" | "edited_file";
  summary: string;
  createdAt: string;
}

// ── Agents ──────────────────────────────────────────────────────

export const MOCK_AGENTS: AiAgent[] = [
  { id: "a-architect", slug: "architect", displayName: "Architect", role: "architect", accentHsl: "260 70% 60%" },
  { id: "a-engineer-1", slug: "engineer-1", displayName: "Engineer", role: "engineer", accentHsl: "0 72% 51%" },
  { id: "a-critic", slug: "critic", displayName: "Critic", role: "critic", accentHsl: "40 95% 55%" },
];

// ── Repos ───────────────────────────────────────────────────────

export const MOCK_REPOS: Repo[] = [
  {
    id: "r-takeover-web",
    owner: "codewithali",
    name: "takeover-web",
    description: "Public-facing site + apply pipeline. Next.js 16, Tailwind, Supabase.",
    status: "active",
    visibility: "internal",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    languageBreakdown: { TypeScript: 0.68, CSS: 0.18, MDX: 0.09, JSON: 0.05 },
    openPrCount: 4,
    lastCommitAt: minutesAgo(8),
    lastCommitAgentId: "a-engineer-1",
    activityHeat: 92,
  },
  {
    id: "r-cwa-manager",
    owner: "codewithali",
    name: "cwa-manager",
    description: "Tauri desktop ops platform. Voice + Axon agents.",
    status: "active",
    visibility: "private",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    languageBreakdown: { TypeScript: 0.72, Rust: 0.16, CSS: 0.08, SQL: 0.04 },
    openPrCount: 7,
    lastCommitAt: minutesAgo(2),
    lastCommitAgentId: "a-architect",
    activityHeat: 100,
  },
  {
    id: "r-axon-actions",
    owner: "codewithali",
    name: "axon-actions",
    description: "Shared registry of voice + chat actions across Axon agents.",
    status: "active",
    visibility: "private",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    languageBreakdown: { TypeScript: 0.94, JSON: 0.06 },
    openPrCount: 2,
    lastCommitAt: hoursAgo(2),
    lastCommitAgentId: "a-critic",
    activityHeat: 38,
  },
  {
    id: "r-payments-svc",
    owner: "codewithali",
    name: "payments-svc",
    description: "Stripe + invoice pipeline. Edge functions + cron.",
    status: "active",
    visibility: "private",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    languageBreakdown: { TypeScript: 0.85, SQL: 0.15 },
    openPrCount: 1,
    lastCommitAt: hoursAgo(11),
    lastCommitAgentId: "a-engineer-1",
    activityHeat: 24,
  },
  {
    id: "r-recruiting-core",
    owner: "codewithali",
    name: "recruiting-core",
    description: "Resume parsing + scoring engine. Claude Vision + structured JSON.",
    status: "active",
    visibility: "internal",
    defaultBranch: "main",
    primaryLanguage: "Python",
    languageBreakdown: { Python: 0.88, "Jupyter Notebook": 0.10, YAML: 0.02 },
    openPrCount: 0,
    lastCommitAt: daysAgo(1),
    lastCommitAgentId: "a-architect",
    activityHeat: 12,
  },
  {
    id: "r-legacy-classroom",
    owner: "codewithali",
    name: "legacy-classroom",
    description: "Old training platform. Archived; preserved for reference.",
    status: "archived",
    visibility: "private",
    defaultBranch: "main",
    primaryLanguage: "JavaScript",
    languageBreakdown: { JavaScript: 0.66, CSS: 0.22, HTML: 0.12 },
    openPrCount: 0,
    lastCommitAt: daysAgo(94),
    lastCommitAgentId: "a-engineer-1",
    activityHeat: 0,
  },
];

// ── Commits ─────────────────────────────────────────────────────

export const MOCK_COMMITS: CommitRow[] = [
  {
    id: "c1", repoId: "r-cwa-manager", sha: "9a4f2c1b3e0d5f6a7b8c9d0e1f2a3b4c5d6e7f81",
    parentSha: "9a4f2c1b3e0d5f6a7b8c9d0e1f2a3b4c5d6e7f80",
    branchName: "main",
    message: "feat(theme): light mode for axon panel + orb canvas",
    authorUsername: null,
    authorAgentId: "a-architect",
    agentReasoning: "User reported the floating orb looked harsh on light backgrounds. Added theme-aware --axon-orb-edge-rgb so the canvas reads near-white in light mode without losing the plasma red centre.",
    createdAt: minutesAgo(2),
    additions: 47, deletions: 14, changedFiles: 3,
  },
  {
    id: "c2", repoId: "r-cwa-manager", sha: "8b3e1d0a2f9c4e5b6c7d8e9f0a1b2c3d4e5f6a72",
    parentSha: "9a4f2c1b3e0d5f6a7b8c9d0e1f2a3b4c5d6e7f81",
    branchName: "main",
    message: "fix(huddle): debounce presence-leave to kill stale call indicators",
    authorUsername: "Ali",
    authorAgentId: null,
    agentReasoning: null,
    createdAt: hoursAgo(3),
    additions: 28, deletions: 11, changedFiles: 2,
  },
  {
    id: "c3", repoId: "r-cwa-manager", sha: "7d2c0b9a1e8f3c4d5e6f7a8b9c0d1e2f3a4b5c63",
    parentSha: "8b3e1d0a2f9c4e5b6c7d8e9f0a1b2c3d4e5f6a72",
    branchName: "feature/bug-reports",
    message: "feat(reports): bug report inbox + diagnostic capture",
    authorUsername: null,
    authorAgentId: "a-engineer-1",
    agentReasoning: "Built around the user's existing /reports route. Added rolling 50-line console buffer + 20-request network log so triagers don't need the reporter to paste from devtools.",
    createdAt: hoursAgo(8),
    additions: 312, deletions: 22, changedFiles: 9,
  },
];

// ── Files (snapshots of takeover-web HEAD for the mock file tree) ──

export const MOCK_FILES: FileRow[] = [
  {
    id: "f1", repoId: "r-takeover-web", branchName: "main", path: "src/app/page.tsx",
    content: "export default function HomePage() {\n  return (\n    <main className=\"min-h-screen bg-background\">\n      <Hero />\n      <Features />\n      <CTA />\n    </main>\n  );\n}\n",
    sizeBytes: 184, language: "typescript", isBinary: false,
    aiSummary: "Top-level App-Router home page. Composes the marketing site's three primary blocks: Hero, Features, CTA. Pure server component — no client interactivity here.",
    depsOut: ["src/components/Hero.tsx", "src/components/Features.tsx", "src/components/CTA.tsx"],
    depsIn: [],
    lastModifiedAt: hoursAgo(5),
    lastModifiedAgentId: "a-engineer-1",
  },
  {
    id: "f2", repoId: "r-takeover-web", branchName: "main", path: "src/app/careers/[slug]/apply/page.tsx",
    content: "// Server component that loads the role + renders the apply form\nimport { ApplyForm } from './ApplyForm';\nimport { ROLES } from '@/lib/roles';\nexport default async function ApplyPage({ params }: { params: { slug: string } }) {\n  const role = ROLES.find((r) => r.slug === params.slug);\n  if (!role) return <div>Role not found</div>;\n  return <ApplyForm role={role} />;\n}\n",
    sizeBytes: 326, language: "typescript", isBinary: false,
    aiSummary: "Server-rendered shell for the public /careers/[slug]/apply route. Loads role metadata from the shared ROLES catalog and hands it to the client-side ApplyForm.",
    depsOut: ["src/app/careers/[slug]/apply/ApplyForm.tsx", "src/lib/roles.ts"],
    depsIn: [],
    lastModifiedAt: daysAgo(2),
    lastModifiedAgentId: "a-architect",
  },
  {
    id: "f3", repoId: "r-takeover-web", branchName: "main", path: "src/components/Hero.tsx",
    content: "export function Hero() {\n  return (\n    <section className=\"px-6 py-24 text-center\">\n      <h1 className=\"text-5xl font-bold\">Run your company with AI</h1>\n      <p className=\"mt-4 text-muted-foreground\">One desktop app. 15+ tools, gone.</p>\n    </section>\n  );\n}\n",
    sizeBytes: 248, language: "typescript", isBinary: false,
    aiSummary: "Hero block on the marketing home page. Static copy + a centred CTA. No props.",
    depsOut: [], depsIn: ["src/app/page.tsx"],
    lastModifiedAt: hoursAgo(5),
    lastModifiedAgentId: "a-engineer-1",
  },
  {
    id: "f4", repoId: "r-takeover-web", branchName: "main", path: "lib/supabase.ts",
    content: "import { createBrowserClient } from '@supabase/ssr';\nexport const supabase = createBrowserClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,\n);\n",
    sizeBytes: 198, language: "typescript", isBinary: false,
    aiSummary: "Browser Supabase client. anon key only — no service-role here.",
    depsOut: [], depsIn: ["src/app/careers/[slug]/apply/ApplyForm.tsx"],
    lastModifiedAt: daysAgo(7),
    lastModifiedAgentId: "a-architect",
  },
  {
    id: "f5", repoId: "r-takeover-web", branchName: "main", path: "README.md",
    content: "# takeover-web\n\nMarketing site + apply pipeline for Takeover.\n\n## Stack\n- Next.js 16 (App Router)\n- Tailwind\n- Supabase (anon + service-role split)\n",
    sizeBytes: 156, language: "markdown", isBinary: false,
    aiSummary: null,
    depsOut: [], depsIn: [],
    lastModifiedAt: daysAgo(12),
    lastModifiedAgentId: null,
  },
];

// ── Pull requests ───────────────────────────────────────────────

export const MOCK_PRS: PullRequest[] = [
  {
    id: "pr1", repoId: "r-cwa-manager", number: 247,
    title: "Light theme for Axon panel + orb canvas",
    body: "Adds [data-theme=\"light\"] overrides for the Axon stylesheet. Wires the canvas orb to read a theme-aware fade-to colour. Brand red stays vivid in both modes.",
    status: "open",
    authorUsername: null,
    authorAgentId: "a-architect",
    sourceBranch: "feature/axon-light-theme",
    targetBranch: "main",
    headSha: "9a4f2c1b3e0d5f6a7b8c9d0e1f2a3b4c5d6e7f81",
    createdAt: minutesAgo(45),
    updatedAt: minutesAgo(2),
    aiExplanation: "The user reported the Axon panel + floating orb stayed dark even after we shipped the global light mode. Root cause: panel painted a hardcoded rgba(8,8,10) gradient, and the canvas orb's body gradient stop was rgba(5,5,10). This PR routes both through theme-aware vars (--axon-glass, --axon-orb-edge-rgb) and adds a [data-theme=\"light\"] override block. The default values exactly reproduce the dark-mode behaviour, so nothing visibly changes in dark mode.",
    additions: 47, deletions: 14, changedFiles: 3, commentCount: 5,
  },
  {
    id: "pr2", repoId: "r-cwa-manager", number: 246,
    title: "Bug reports inbox with diagnostic capture",
    body: "New `bug_reports` table + Report-a-bug dropdown + inbox tab.",
    status: "merged",
    authorUsername: null,
    authorAgentId: "a-engineer-1",
    sourceBranch: "feature/bug-reports",
    targetBranch: "main",
    headSha: "7d2c0b9a1e8f3c4d5e6f7a8b9c0d1e2f3a4b5c63",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(4),
    aiExplanation: "Reporters were pasting bug descriptions into chat without any context. This PR adds a structured /reports → Bug Reports tab + a Report-a-bug item in the user dropdown that auto-captures the last 50 console lines and 20 network requests.",
    additions: 312, deletions: 22, changedFiles: 9, commentCount: 11,
  },
  {
    id: "pr3", repoId: "r-cwa-manager", number: 245,
    title: "Huddle: debounce presence-leave + restartIce on disconnected",
    body: "Stale 'in-call' indicators + missing peer streams. Three coordinated fixes.",
    status: "merged",
    authorUsername: "Ali",
    authorAgentId: null,
    sourceBranch: "fix/huddle-reliability",
    targetBranch: "main",
    headSha: "8b3e1d0a2f9c4e5b6c7d8e9f0a1b2c3d4e5f6a72",
    createdAt: hoursAgo(14),
    updatedAt: hoursAgo(3),
    aiExplanation: null,
    additions: 28, deletions: 11, changedFiles: 2, commentCount: 3,
  },
  {
    id: "pr4", repoId: "r-takeover-web", number: 89,
    title: "Apply form wiring → Supabase candidates table",
    body: "Public form on /careers/[slug]/apply now writes candidates server-side with resume upload to the private resumes bucket.",
    status: "open",
    authorUsername: null,
    authorAgentId: "a-engineer-1",
    sourceBranch: "feature/apply-pipeline",
    targetBranch: "main",
    headSha: "bbbbcccc1111222233334444555566667777888899",
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(6),
    aiExplanation: "First half of the hire-to-onboard demo flow. Public apply form posts to /api/applications, which uses the service-role client to upload the resume + insert the candidate row. Anon client only used for client-side validation.",
    additions: 184, deletions: 8, changedFiles: 6, commentCount: 4,
  },
  {
    id: "pr5", repoId: "r-axon-actions", number: 31,
    title: "Set theme voice action (light/dark/system)",
    body: "Lets Axon flip the app theme via voice — 'switch to light mode', 'use system theme', etc.",
    status: "draft",
    authorUsername: null,
    authorAgentId: "a-critic",
    sourceBranch: "feature/theme-action",
    targetBranch: "main",
    headSha: "ddddeeeeffff111122223333444455556666777788",
    createdAt: minutesAgo(20),
    updatedAt: minutesAgo(20),
    aiExplanation: "Wires the new themeMode store to a voice action. Description explicitly distinguishes from force_sleep ('dark mode' was overloaded). Two actions: set_theme(mode) and toggle_theme().",
    additions: 156, deletions: 2, changedFiles: 4, commentCount: 0,
  },
];

// ── Activity ────────────────────────────────────────────────────

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: "av1", repoId: "r-cwa-manager", agentId: "a-architect", kind: "commit",      summary: "Architect pushed light-theme PR to feature/axon-light-theme", createdAt: minutesAgo(2) },
  { id: "av2", repoId: "r-axon-actions", agentId: "a-critic",   kind: "opened_pr",   summary: "Critic opened PR #31 — Set theme voice action",              createdAt: minutesAgo(20) },
  { id: "av3", repoId: "r-cwa-manager", agentId: "a-engineer-1", kind: "merged_pr",  summary: "Engineer merged #246 — Bug reports inbox",                    createdAt: hoursAgo(4) },
  { id: "av4", repoId: "r-takeover-web", agentId: "a-engineer-1", kind: "edited_file", summary: "Engineer edited src/app/page.tsx",                            createdAt: hoursAgo(5) },
  { id: "av5", repoId: "r-cwa-manager", agentId: "a-architect", kind: "reviewed_pr", summary: "Architect approved PR #245",                                    createdAt: hoursAgo(3) },
];

// ── Helpers ─────────────────────────────────────────────────────

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60_000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60_000).toISOString();
}

// ── PR conversation: comments + reviews ─────────────────────────

export interface PrComment {
  id: string;
  prId: string;
  /** Top-level on the conversation tab when null; otherwise inline
   *  on this file/line in the Files Changed tab. */
  filePath: string | null;
  lineNumber: number | null;
  parentId: string | null;
  authorUsername: string | null;
  authorAgentId: string | null;
  body: string;
  createdAt: string;
}

export interface PrReview {
  id: string;
  prId: string;
  reviewerUsername: string | null;
  reviewerAgentId: string | null;
  state: "approved" | "changes_requested" | "commented" | "dismissed";
  body: string | null;
  createdAt: string;
}

export const MOCK_PR_COMMENTS: PrComment[] = [
  // PR #247 — light theme for Axon
  { id: "cm1", prId: "pr1", filePath: null, lineNumber: null, parentId: null,
    authorAgentId: "a-architect", authorUsername: null,
    body: "Opening this with the full reasoning in the AI explanation banner above. Headline change: --axon-orb-edge-rgb is the new lever that lets the canvas orb fade-to-edge swap by theme.",
    createdAt: minutesAgo(44) },
  { id: "cm2", prId: "pr1", filePath: null, lineNumber: null, parentId: null,
    authorAgentId: "a-critic", authorUsername: null,
    body: "Reviewed the override block. Two concerns:\n1. The `--axon-glass-inset` override is at 0.04 alpha — borderline invisible. Bump to 0.06?\n2. We're not handling the `[data-theme=\"system\"]` case; if a user picks system the orb falls back to dark always. Worth a follow-up.",
    createdAt: minutesAgo(28) },
  { id: "cm3", prId: "pr1", filePath: "src/Axon/axon.css", lineNumber: 67, parentId: null,
    authorAgentId: "a-critic", authorUsername: null,
    body: "Could you add a comment explaining why the inset value flips to rgb(20 20 24 / 0.04) instead of just `transparent`? Tabs would disappear without a wash.",
    createdAt: minutesAgo(24) },
  { id: "cm4", prId: "pr1", filePath: "src/Axon/axon.css", lineNumber: 67, parentId: "cm3",
    authorAgentId: "a-architect", authorUsername: null,
    body: "Good catch — added an inline comment in the override block.",
    createdAt: minutesAgo(15) },
  { id: "cm5", prId: "pr1", filePath: null, lineNumber: null, parentId: null,
    authorUsername: "Ali", authorAgentId: null,
    body: "Approved on look — let's merge once the cool-down on the orb halo lands.",
    createdAt: minutesAgo(4) },
];

export const MOCK_PR_REVIEWS: PrReview[] = [
  { id: "rv1", prId: "pr1", reviewerAgentId: "a-critic", reviewerUsername: null,
    state: "changes_requested",
    body: "Looks great, two minor concerns above.",
    createdAt: minutesAgo(28) },
  { id: "rv2", prId: "pr1", reviewerAgentId: null, reviewerUsername: "Ali",
    state: "approved",
    body: "Ready to ship after the comment lands.",
    createdAt: minutesAgo(4) },
];

// ── Agent permissions (autonomy matrix) ────────────────────────

export interface AgentPermission {
  id: string;
  repoId: string;
  agentId: string;
  branchPattern: string;
  canCommitDirect: boolean;
  canOpenPr: boolean;
  canReviewPr: boolean;
  canMergePr: boolean;
  canMergeOwnPr: boolean;
  canForcePush: boolean;
  notes: string | null;
}

export interface BranchProtection {
  id: string;
  repoId: string;
  branchPattern: string;
  requiredApprovals: number;
  requireHumanApproval: boolean;
  requiredApproverRoles: string[];
  requireResolvedThreads: boolean;
  blockForcePush: boolean;
  deleteAfterMerge: boolean;
}

/** Seeded as "what a sensible default org would have" — Architect
 *  has commit-direct on feature branches, Engineer must always PR,
 *  Critic can only review. Main is heavily protected. */
export const MOCK_PERMISSIONS: AgentPermission[] = [
  // r-cwa-manager
  { id: "p1", repoId: "r-cwa-manager", agentId: "a-architect", branchPattern: "feature/*",
    canCommitDirect: true, canOpenPr: true, canReviewPr: true,
    canMergePr: true, canMergeOwnPr: false, canForcePush: false,
    notes: "Architect drives design — trusted on feature branches." },
  { id: "p2", repoId: "r-cwa-manager", agentId: "a-architect", branchPattern: "main",
    canCommitDirect: false, canOpenPr: true, canReviewPr: true,
    canMergePr: true, canMergeOwnPr: false, canForcePush: false,
    notes: "Main requires PR + human sign-off." },
  { id: "p3", repoId: "r-cwa-manager", agentId: "a-engineer-1", branchPattern: "*",
    canCommitDirect: false, canOpenPr: true, canReviewPr: true,
    canMergePr: false, canMergeOwnPr: false, canForcePush: false,
    notes: "Engineer always PRs. Cannot merge own work." },
  { id: "p4", repoId: "r-cwa-manager", agentId: "a-critic", branchPattern: "*",
    canCommitDirect: false, canOpenPr: false, canReviewPr: true,
    canMergePr: false, canMergeOwnPr: false, canForcePush: false,
    notes: "Critic is review-only. Cannot author code." },

  // r-takeover-web
  { id: "p5", repoId: "r-takeover-web", agentId: "a-architect", branchPattern: "*",
    canCommitDirect: false, canOpenPr: true, canReviewPr: true,
    canMergePr: true, canMergeOwnPr: false, canForcePush: false, notes: null },
  { id: "p6", repoId: "r-takeover-web", agentId: "a-engineer-1", branchPattern: "*",
    canCommitDirect: false, canOpenPr: true, canReviewPr: true,
    canMergePr: false, canMergeOwnPr: false, canForcePush: false, notes: null },
];

export const MOCK_BRANCH_PROTECTION: BranchProtection[] = [
  { id: "bp1", repoId: "r-cwa-manager", branchPattern: "main",
    requiredApprovals: 1, requireHumanApproval: true,
    requiredApproverRoles: [], requireResolvedThreads: true,
    blockForcePush: true, deleteAfterMerge: true },
  { id: "bp2", repoId: "r-takeover-web", branchPattern: "main",
    requiredApprovals: 1, requireHumanApproval: false,
    requiredApproverRoles: ["critic"], requireResolvedThreads: false,
    blockForcePush: true, deleteAfterMerge: true },
];

// ── Convenience lookups ─────────────────────────────────────────

export const agentById = (id: string | null | undefined): AiAgent | null =>
  id ? (MOCK_AGENTS.find((a) => a.id === id) ?? null) : null;

export const repoById = (id: string | null | undefined): Repo | null =>
  id ? (MOCK_REPOS.find((r) => r.id === id) ?? null) : null;
