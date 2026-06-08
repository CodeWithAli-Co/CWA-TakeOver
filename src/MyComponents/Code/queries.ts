/**
 * queries.ts — TanStack Query hooks for the /code surface.
 *
 * Reads from the Supabase tables created by:
 *   - migrations/code_init.sql         (9 core tables)
 *   - migrations/code_permissions.sql  (agent_permissions, branch_protection)
 *   - migrations/code_issues.sql       (issues, labels, label_map, comments)
 *
 * Graceful fallback strategy:
 *   Every hook falls back to the MOCK_* data in mockData.ts when the
 *   Supabase query returns empty OR errors. This lets the UI render
 *   immediately on a fresh install (no migrations applied yet) and
 *   transition seamlessly once the seed lands. Components don't have
 *   to know whether they're looking at mock or real data — the shape
 *   is identical (mockData.ts was authored against the same schema).
 *
 *   Additionally, every hook short-circuits to the mock fallback when
 *   the repo/pr id isn't a UUID — those are mock-data ids and would
 *   otherwise produce 400s from Postgres.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/routes/index.lazy";
import {
  MOCK_AGENTS,
  MOCK_REPOS,
  MOCK_COMMITS,
  MOCK_FILES,
  MOCK_PRS,
  MOCK_PR_COMMENTS,
  MOCK_PR_REVIEWS,
  MOCK_ACTIVITY,
  MOCK_PERMISSIONS,
  MOCK_BRANCH_PROTECTION,
  MOCK_LABELS,
  MOCK_ISSUES,
  type AiAgent,
  type Repo,
  type CommitRow,
  type FileRow,
  type PullRequest,
  type PrComment,
  type PrReview,
  type ActivityItem,
  type AgentPermission,
  type BranchProtection,
  type IssueLabel,
  type Issue,
} from "./mockData";

const DEFAULT_STALE_MS = 30_000;
const KEY = ["code"] as const;

function preferReal<T>(real: T[] | null | undefined, mockFallback: T[]): T[] {
  if (!real || real.length === 0) return mockFallback;
  return real;
}

/** Loose UUID test — keeps mock ids (`r-takeover-web`, `f1`) out of
 *  Supabase queries against uuid columns. */
function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Per-session circuit breaker so listing hooks (useRepos / useAgents
 *  / useActivity-without-repoId) only ping the DB once. After the
 *  first 400/404 we cache "schema not applied" in sessionStorage and
 *  every subsequent call short-circuits to MOCK data. Clears itself
 *  when the user reloads the page (next session re-probes). */
const SCHEMA_FLAG_KEY = "code-schema-applied";
type SchemaState = "applied" | "missing" | "unknown";

function readSchemaState(): SchemaState {
  try {
    const v = sessionStorage.getItem(SCHEMA_FLAG_KEY);
    if (v === "applied" || v === "missing") return v;
  } catch {
    /* SSR or private mode — fall through */
  }
  return "unknown";
}

function writeSchemaState(state: Exclude<SchemaState, "unknown">): void {
  try { sessionStorage.setItem(SCHEMA_FLAG_KEY, state); } catch {
    /* ignore */
  }
}

// ── Row mappers ───────────────────────────────────────────────

interface AgentRowDb { id: string; slug: string; display_name: string; role: AiAgent["role"]; accent_hsl: string; }
const mapAgent = (r: AgentRowDb): AiAgent => ({
  id: r.id, slug: r.slug, displayName: r.display_name, role: r.role, accentHsl: r.accent_hsl,
});

interface RepoRowDb {
  id: string; owner: string; name: string; description: string;
  status: Repo["status"]; visibility: Repo["visibility"];
  default_branch: string; primary_language: string | null;
  language_breakdown: Record<string, number> | null;
  open_pr_count: number; last_commit_at: string | null;
  last_commit_agent_id: string | null; activity_heat: number;
}
const mapRepo = (r: RepoRowDb): Repo => ({
  id: r.id, owner: r.owner, name: r.name,
  description: r.description ?? "",
  status: r.status, visibility: r.visibility,
  defaultBranch: r.default_branch,
  primaryLanguage: r.primary_language ?? "Text",
  languageBreakdown: r.language_breakdown ?? {},
  openPrCount: r.open_pr_count,
  lastCommitAt: r.last_commit_at ?? new Date().toISOString(),
  lastCommitAgentId: r.last_commit_agent_id ?? "",
  activityHeat: r.activity_heat,
});

interface CommitRowDb {
  id: string; repo_id: string; sha: string; parent_sha: string | null;
  branch_name: string; message: string;
  author_username: string | null; author_agent_id: string | null;
  agent_reasoning: string | null; created_at: string;
  additions: number; deletions: number; changed_files: number;
}
const mapCommit = (r: CommitRowDb): CommitRow => ({
  id: r.id, repoId: r.repo_id, sha: r.sha, parentSha: r.parent_sha,
  branchName: r.branch_name, message: r.message,
  authorUsername: r.author_username, authorAgentId: r.author_agent_id,
  agentReasoning: r.agent_reasoning, createdAt: r.created_at,
  additions: r.additions, deletions: r.deletions, changedFiles: r.changed_files,
});

interface FileRowDb {
  id: string; repo_id: string; branch_name: string; path: string;
  content: string | null; size_bytes: number; language: string | null;
  is_binary: boolean; ai_summary: string | null;
  deps_out: string[] | null; deps_in: string[] | null;
  last_modified_at: string; last_modified_agent_id: string | null;
}
const mapFile = (r: FileRowDb): FileRow => ({
  id: r.id, repoId: r.repo_id, branchName: r.branch_name, path: r.path,
  content: r.content, sizeBytes: r.size_bytes,
  language: r.language ?? "text", isBinary: r.is_binary,
  aiSummary: r.ai_summary,
  depsOut: r.deps_out ?? [], depsIn: r.deps_in ?? [],
  lastModifiedAt: r.last_modified_at,
  lastModifiedAgentId: r.last_modified_agent_id,
});

interface PrRowDb {
  id: string; repo_id: string; number: number; title: string; body: string;
  status: PullRequest["status"];
  author_username: string | null; author_agent_id: string | null;
  source_branch: string; target_branch: string; head_sha: string;
  created_at: string; updated_at: string;
  ai_explanation: string | null;
  additions: number; deletions: number; changed_files: number; comment_count: number;
}
const mapPr = (r: PrRowDb): PullRequest => ({
  id: r.id, repoId: r.repo_id, number: r.number, title: r.title, body: r.body,
  status: r.status,
  authorUsername: r.author_username, authorAgentId: r.author_agent_id,
  sourceBranch: r.source_branch, targetBranch: r.target_branch, headSha: r.head_sha,
  createdAt: r.created_at, updatedAt: r.updated_at,
  aiExplanation: r.ai_explanation,
  additions: r.additions, deletions: r.deletions,
  changedFiles: r.changed_files, commentCount: r.comment_count,
});

interface PrCommentRowDb {
  id: string; pr_id: string;
  file_path: string | null; line_number: number | null;
  parent_id: string | null;
  author_username: string | null; author_agent_id: string | null;
  body: string; created_at: string;
}
const mapPrComment = (r: PrCommentRowDb): PrComment => ({
  id: r.id, prId: r.pr_id, filePath: r.file_path, lineNumber: r.line_number,
  parentId: r.parent_id,
  authorUsername: r.author_username, authorAgentId: r.author_agent_id,
  body: r.body, createdAt: r.created_at,
});

interface PrReviewRowDb {
  id: string; pr_id: string;
  reviewer_username: string | null; reviewer_agent_id: string | null;
  state: PrReview["state"]; body: string | null; created_at: string;
}
const mapPrReview = (r: PrReviewRowDb): PrReview => ({
  id: r.id, prId: r.pr_id,
  reviewerUsername: r.reviewer_username, reviewerAgentId: r.reviewer_agent_id,
  state: r.state, body: r.body, createdAt: r.created_at,
});

interface ActivityRowDb {
  id: string; repo_id: string | null; agent_id: string | null;
  kind: ActivityItem["kind"]; summary: string; created_at: string;
}
const mapActivity = (r: ActivityRowDb): ActivityItem => ({
  id: r.id, repoId: r.repo_id, agentId: r.agent_id,
  kind: r.kind, summary: r.summary, createdAt: r.created_at,
});

interface PermissionRowDb {
  id: string; repo_id: string; agent_id: string; branch_pattern: string;
  can_commit_direct: boolean; can_open_pr: boolean; can_review_pr: boolean;
  can_merge_pr: boolean; can_merge_own_pr: boolean; can_force_push: boolean;
  notes: string | null;
}
const mapPermission = (r: PermissionRowDb): AgentPermission => ({
  id: r.id, repoId: r.repo_id, agentId: r.agent_id,
  branchPattern: r.branch_pattern,
  canCommitDirect: r.can_commit_direct, canOpenPr: r.can_open_pr,
  canReviewPr: r.can_review_pr, canMergePr: r.can_merge_pr,
  canMergeOwnPr: r.can_merge_own_pr, canForcePush: r.can_force_push,
  notes: r.notes,
});

interface BranchProtectionRowDb {
  id: string; repo_id: string; branch_pattern: string;
  required_approvals: number; require_human_approval: boolean;
  required_approver_roles: string[] | null;
  require_resolved_threads: boolean; block_force_push: boolean; delete_after_merge: boolean;
}
const mapBranchProtection = (r: BranchProtectionRowDb): BranchProtection => ({
  id: r.id, repoId: r.repo_id, branchPattern: r.branch_pattern,
  requiredApprovals: r.required_approvals,
  requireHumanApproval: r.require_human_approval,
  requiredApproverRoles: r.required_approver_roles ?? [],
  requireResolvedThreads: r.require_resolved_threads,
  blockForcePush: r.block_force_push, deleteAfterMerge: r.delete_after_merge,
});

interface LabelRowDb { id: string; repo_id: string; name: string; color_hsl: string; }
const mapLabel = (r: LabelRowDb): IssueLabel => ({
  id: r.id, repoId: r.repo_id, name: r.name, colorHsl: r.color_hsl,
});

interface IssueRowDb {
  id: string; repo_id: string; number: number; title: string; body: string;
  status: Issue["status"];
  author_username: string | null; author_agent_id: string | null;
  assignee_username: string | null; assignee_agent_id: string | null;
  ai_reason: string | null; created_at: string; updated_at: string;
  closed_at: string | null; comment_count: number;
}
const mapIssue = (r: IssueRowDb, labelIds: string[] = []): Issue => ({
  id: r.id, repoId: r.repo_id, number: r.number, title: r.title, body: r.body,
  status: r.status,
  authorUsername: r.author_username, authorAgentId: r.author_agent_id,
  assigneeUsername: r.assignee_username, assigneeAgentId: r.assignee_agent_id,
  aiReason: r.ai_reason, createdAt: r.created_at, updatedAt: r.updated_at,
  closedAt: r.closed_at, commentCount: r.comment_count, labelIds,
});

// ── Hooks ──────────────────────────────────────────────────────

export function useAgents() {
  return useQuery({
    queryKey: [...KEY, "agents"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AiAgent[]> => {
      if (readSchemaState() === "missing") return MOCK_AGENTS;
      const { data, error } = await companySupabase
  .from("ai_agents")
        .select("id, slug, display_name, role, accent_hsl");
      if (error) {
        writeSchemaState("missing");
        return MOCK_AGENTS;
      }
      writeSchemaState("applied");
      return preferReal((data as AgentRowDb[] | null)?.map(mapAgent), MOCK_AGENTS);
    },
  });
}

export function useRepos() {
  return useQuery({
    queryKey: [...KEY, "repos"],
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<Repo[]> => {
      // Skip the network entirely once we've confirmed the schema
      // hasn't been applied this session.
      if (readSchemaState() === "missing") return MOCK_REPOS;
      const { data, error } = await companySupabase
  .from("repos")
        .select("id, owner, name, description, status, visibility, default_branch, primary_language, language_breakdown, open_pr_count, last_commit_at, last_commit_agent_id, activity_heat")
        .order("last_commit_at", { ascending: false, nullsFirst: false });
      if (error) {
        writeSchemaState("missing");
        return MOCK_REPOS;
      }
      writeSchemaState("applied");
      return preferReal((data as RepoRowDb[] | null)?.map(mapRepo), MOCK_REPOS);
    },
  });
}

export function useRepo(repoId: string | null | undefined) {
  const { data: repos } = useRepos();
  return (repos ?? MOCK_REPOS).find((r) => r.id === repoId) ?? null;
}

export function useCommits(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "commits", repoId ?? ""],
    enabled: !!repoId,
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<CommitRow[]> => {
      if (!repoId) return [];
      const fallback = MOCK_COMMITS.filter((c) => c.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("commits")
        .select("id, repo_id, sha, parent_sha, branch_name, message, author_username, author_agent_id, agent_reasoning, created_at, additions, deletions, changed_files")
        .eq("repo_id", repoId)
        .order("created_at", { ascending: false });
      if (error) return fallback;
      return preferReal((data as CommitRowDb[] | null)?.map(mapCommit), fallback);
    },
  });
}

export function useFiles(repoId: string | null | undefined, branchName: string = "main") {
  return useQuery({
    queryKey: [...KEY, "files", repoId ?? "", branchName],
    enabled: !!repoId,
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<FileRow[]> => {
      if (!repoId) return [];
      const fallback = MOCK_FILES.filter((f) => f.repoId === repoId && f.branchName === branchName);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("files")
        .select("id, repo_id, branch_name, path, content, size_bytes, language, is_binary, ai_summary, deps_out, deps_in, last_modified_at, last_modified_agent_id")
        .eq("repo_id", repoId)
        .eq("branch_name", branchName)
        .order("path", { ascending: true });
      if (error) return fallback;
      return preferReal((data as FileRowDb[] | null)?.map(mapFile), fallback);
    },
  });
}

export function usePullRequests(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "prs", repoId ?? ""],
    enabled: !!repoId,
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<PullRequest[]> => {
      if (!repoId) return [];
      const fallback = MOCK_PRS.filter((p) => p.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("pull_requests")
        .select("id, repo_id, number, title, body, status, author_username, author_agent_id, source_branch, target_branch, head_sha, created_at, updated_at, ai_explanation, additions, deletions, changed_files, comment_count")
        .eq("repo_id", repoId)
        .order("updated_at", { ascending: false });
      if (error) return fallback;
      return preferReal((data as PrRowDb[] | null)?.map(mapPr), fallback);
    },
  });
}

export function usePullRequest(prId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "pr", prId ?? ""],
    enabled: !!prId,
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<PullRequest | null> => {
      if (!prId) return null;
      const fallback = MOCK_PRS.find((p) => p.id === prId) ?? null;
      if (!isUuid(prId)) return fallback;
      const { data, error } = await companySupabase
  .from("pull_requests")
        .select("id, repo_id, number, title, body, status, author_username, author_agent_id, source_branch, target_branch, head_sha, created_at, updated_at, ai_explanation, additions, deletions, changed_files, comment_count")
        .eq("id", prId)
        .maybeSingle();
      if (error || !data) return fallback;
      return mapPr(data as PrRowDb);
    },
  });
}

export function usePrComments(prId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "pr-comments", prId ?? ""],
    enabled: !!prId,
    staleTime: 15_000,
    queryFn: async (): Promise<PrComment[]> => {
      if (!prId) return [];
      const fallback = MOCK_PR_COMMENTS.filter((c) => c.prId === prId);
      if (!isUuid(prId)) return fallback;
      const { data, error } = await companySupabase
  .from("pr_comments")
        .select("id, pr_id, file_path, line_number, parent_id, author_username, author_agent_id, body, created_at")
        .eq("pr_id", prId)
        .order("created_at", { ascending: true });
      if (error) return fallback;
      return preferReal((data as PrCommentRowDb[] | null)?.map(mapPrComment), fallback);
    },
  });
}

export function usePrReviews(prId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "pr-reviews", prId ?? ""],
    enabled: !!prId,
    staleTime: 15_000,
    queryFn: async (): Promise<PrReview[]> => {
      if (!prId) return [];
      const fallback = MOCK_PR_REVIEWS.filter((r) => r.prId === prId);
      if (!isUuid(prId)) return fallback;
      const { data, error } = await companySupabase
  .from("pr_reviews")
        .select("id, pr_id, reviewer_username, reviewer_agent_id, state, body, created_at")
        .eq("pr_id", prId)
        .order("created_at", { ascending: false });
      if (error) return fallback;
      return preferReal((data as PrReviewRowDb[] | null)?.map(mapPrReview), fallback);
    },
  });
}

export function useActivity(repoId?: string | null) {
  return useQuery({
    queryKey: [...KEY, "activity", repoId ?? "all"],
    staleTime: 15_000,
    queryFn: async (): Promise<ActivityItem[]> => {
      const fallback = repoId
        ? MOCK_ACTIVITY.filter((a) => a.repoId === repoId)
        : MOCK_ACTIVITY;
      if (repoId && !isUuid(repoId)) return fallback;
      if (readSchemaState() === "missing") return fallback;
      let q = companySupabase
        .from("code_activity")
        .select("id, repo_id, agent_id, kind, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (repoId) q = q.eq("repo_id", repoId);
      const { data, error } = await q;
      if (error) {
        writeSchemaState("missing");
        return fallback;
      }
      return preferReal((data as ActivityRowDb[] | null)?.map(mapActivity), fallback);
    },
  });
}

export function usePermissions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "permissions", repoId ?? ""],
    enabled: !!repoId,
    staleTime: 60_000,
    queryFn: async (): Promise<AgentPermission[]> => {
      if (!repoId) return [];
      const fallback = MOCK_PERMISSIONS.filter((p) => p.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("agent_permissions")
        .select("id, repo_id, agent_id, branch_pattern, can_commit_direct, can_open_pr, can_review_pr, can_merge_pr, can_merge_own_pr, can_force_push, notes")
        .eq("repo_id", repoId);
      if (error) return fallback;
      return preferReal((data as PermissionRowDb[] | null)?.map(mapPermission), fallback);
    },
  });
}

export function useBranchProtection(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "branch-protection", repoId ?? ""],
    enabled: !!repoId,
    staleTime: 60_000,
    queryFn: async (): Promise<BranchProtection[]> => {
      if (!repoId) return [];
      const fallback = MOCK_BRANCH_PROTECTION.filter((bp) => bp.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("branch_protection")
        .select("id, repo_id, branch_pattern, required_approvals, require_human_approval, required_approver_roles, require_resolved_threads, block_force_push, delete_after_merge")
        .eq("repo_id", repoId);
      if (error) return fallback;
      return preferReal((data as BranchProtectionRowDb[] | null)?.map(mapBranchProtection), fallback);
    },
  });
}

export function useLabels(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "labels", repoId ?? ""],
    enabled: !!repoId,
    staleTime: 60_000,
    queryFn: async (): Promise<IssueLabel[]> => {
      if (!repoId) return [];
      const fallback = MOCK_LABELS.filter((l) => l.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const { data, error } = await companySupabase
  .from("issue_labels")
        .select("id, repo_id, name, color_hsl")
        .eq("repo_id", repoId);
      if (error) return fallback;
      return preferReal((data as LabelRowDb[] | null)?.map(mapLabel), fallback);
    },
  });
}

export function useIssues(repoId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "issues", repoId ?? ""],
    enabled: !!repoId,
    staleTime: DEFAULT_STALE_MS,
    queryFn: async (): Promise<Issue[]> => {
      if (!repoId) return [];
      const fallback = MOCK_ISSUES.filter((i) => i.repoId === repoId);
      if (!isUuid(repoId)) return fallback;
      const [issuesRes, mapRes] = await Promise.all([
        supabase
          .from("issues")
          .select("id, repo_id, number, title, body, status, author_username, author_agent_id, assignee_username, assignee_agent_id, ai_reason, created_at, updated_at, closed_at, comment_count")
          .eq("repo_id", repoId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("issue_label_map")
          .select("issue_id, label_id, issues!inner(repo_id)")
          .eq("issues.repo_id", repoId),
      ]);
      if (issuesRes.error || mapRes.error) return fallback;
      const issues = issuesRes.data ?? [];
      if (issues.length === 0) return fallback;
      const labelIndex = new Map<string, string[]>();
      for (const row of (mapRes.data ?? []) as { issue_id: string; label_id: string }[]) {
        const arr = labelIndex.get(row.issue_id) ?? [];
        arr.push(row.label_id);
        labelIndex.set(row.issue_id, arr);
      }
      return (issues as IssueRowDb[]).map((r) => mapIssue(r, labelIndex.get(r.id) ?? []));
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────

export interface SaveFileInput {
  repoId: string;
  branchName: string;
  path: string;
  content: string;
  language?: string | null;
  fileId?: string | null;
}

export function useSaveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveFileInput): Promise<string> => {
      // Mock-data repo ids aren't UUIDs and Supabase's uuid columns
      // reject them with 22P02. Surface a friendly error.
      if (!isUuid(input.repoId)) {
        throw new Error(
          "This repo isn't in Supabase yet — apply migrations/code_init.sql, code_permissions.sql, code_issues.sql, code_seed.sql, then refresh.",
        );
      }

      const row = {
        repo_id: input.repoId,
        branch_name: input.branchName,
        path: input.path,
        content: input.content,
        size_bytes: new TextEncoder().encode(input.content).length,
        language: input.language ?? guessLanguageFromPath(input.path),
        is_binary: false,
        last_modified_at: new Date().toISOString(),
      };

      // Update by id only when fileId is a real UUID. For mock file
      // rows on a seeded repo, fall through to the upsert path which
      // uses the (repo_id, branch_name, path) unique index.
      if (input.fileId && isUuid(input.fileId)) {
        const { data, error } = await companySupabase
    .from("files")
          .update(row)
          .eq("id", input.fileId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return (data?.id as string | undefined) ?? input.fileId;
      }
      const { data, error } = await companySupabase
  .from("files")
        .upsert(row, { onConflict: "repo_id,branch_name,path" })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("File save returned no row id");
      return data.id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({
        queryKey: [...KEY, "files", vars.repoId, vars.branchName],
      });
    },
  });
}

function guessLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    py: "python", rs: "rust",
    md: "markdown", mdx: "markdown",
    yml: "yaml", yaml: "yaml",
    sh: "bash", json: "json", sql: "sql",
    toml: "toml", html: "html", css: "css",
  };
  return map[ext] ?? "text";
}
