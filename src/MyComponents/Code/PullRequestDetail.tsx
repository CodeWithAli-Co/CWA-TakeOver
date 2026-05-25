/**
 * PullRequestDetail.tsx — Full PR view (Conversation / Commits /
 * Files Changed) + review actions + merge bar.
 *
 * Opens when the user clicks a PR row in the Pulls tab. Replaces
 * the list inline (single-page nav, no router push) so the back
 * button keeps the user inside the repo's tab nav.
 *
 * Each of the three sub-tabs is rendered inline below the PR
 * header. Comments + reviews are threaded — a comment with a
 * parentId nests under its parent. Inline file comments live on
 * the Files Changed tab anchored to a specific file + line.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft, GitPullRequest, GitMerge, GitPullRequestDraft, XCircle,
  Sparkles, MessageSquare, Clock, Check, FileCode,
  GitCommit, FilesIcon, FileText, ChevronDown, ChevronRight,
  Eye,
} from "lucide-react";
import {
  MOCK_PR_COMMENTS, MOCK_PR_REVIEWS, MOCK_COMMITS, MOCK_FILES,
  agentById,
  type PullRequest, type PrComment, type PrReview,
} from "./mockData";
import { CodeBlock, type DiffLineState } from "./CodeBlock";
import { CommitDetail } from "./CommitDetail";

type PrTab = "conversation" | "commits" | "files";

export function PullRequestDetail({
  pr, onBack,
}: {
  pr: PullRequest;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<PrTab>("conversation");
  const comments = MOCK_PR_COMMENTS.filter((c) => c.prId === pr.id);
  const reviews = MOCK_PR_REVIEWS.filter((r) => r.prId === pr.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <PrHeader pr={pr} onBack={onBack} />

      {/* Tab strip */}
      <nav className="shrink-0 flex items-end gap-0 px-6 border-b border-border bg-card/40">
        <PrTabBtn label="Conversation" icon={MessageSquare} badge={comments.length}
          active={tab === "conversation"} onClick={() => setTab("conversation")} />
        <PrTabBtn label="Commits" icon={GitCommit}
          active={tab === "commits"} onClick={() => setTab("commits")} />
        <PrTabBtn label="Files changed" icon={FilesIcon} badge={pr.changedFiles}
          active={tab === "files"} onClick={() => setTab("files")} />
      </nav>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "conversation" && (
          <ConversationTab pr={pr} comments={comments} reviews={reviews} />
        )}
        {tab === "commits" && <CommitsTab prId={pr.id} />}
        {tab === "files" && <FilesChangedTab pr={pr} comments={comments} />}
      </div>

      {/* Sticky merge bar — only on Conversation tab + only for open PRs */}
      {pr.status === "open" && tab === "conversation" && (
        <MergeBar pr={pr} reviews={reviews} />
      )}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────

function PrHeader({ pr, onBack }: { pr: PullRequest; onBack: () => void }) {
  const author = pr.authorAgentId ? agentById(pr.authorAgentId) : null;
  const StatusIcon =
    pr.status === "merged" ? GitMerge
  : pr.status === "draft"  ? GitPullRequestDraft
  : pr.status === "closed" ? XCircle
  : GitPullRequest;
  const statusLabel = pr.status[0].toUpperCase() + pr.status.slice(1);
  const statusBg =
    pr.status === "merged" ? "bg-violet-500/15 text-violet-300 border-violet-500/40"
  : pr.status === "draft"  ? "bg-muted text-muted-foreground border-border"
  : pr.status === "closed" ? "bg-muted/70 text-muted-foreground border-border"
  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";

  return (
    <header className="shrink-0 border-b border-border bg-card/40 px-6 py-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-7 w-7 mt-0.5 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to pull requests"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground leading-snug">
            {pr.title}
            <span className="ml-2 font-normal text-muted-foreground">#{pr.number}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${statusBg}`}>
              <StatusIcon className="h-3 w-3" />
              {statusLabel}
            </span>
            <span className="text-muted-foreground">
              {author ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: `hsl(${author.accentHsl})` }} />
                  <span className="text-foreground/85 font-medium">{author.displayName}</span>
                </span>
              ) : (
                <span className="text-foreground/85 font-medium">{pr.authorUsername}</span>
              )}
              {" "}wants to merge{" "}
              <span className="rounded bg-muted px-1.5 font-mono text-[10.5px] text-foreground/85">{pr.sourceBranch}</span>
              {" "}into{" "}
              <span className="rounded bg-muted px-1.5 font-mono text-[10.5px] text-foreground/85">{pr.targetBranch}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(pr.createdAt)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-emerald-400 font-mono text-[11px]">+{pr.additions}</span>
            <span className="text-red-400 font-mono text-[11px]">−{pr.deletions}</span>
            <span className="text-muted-foreground">across {pr.changedFiles} files</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function PrTabBtn({
  label, icon: Icon, active, onClick, badge,
}: {
  label: string;
  icon: typeof GitCommit;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-muted px-1.5 font-mono text-[9.5px] tabular-nums text-foreground/85">
          {badge}
        </span>
      )}
      <span
        aria-hidden="true"
        className={[
          "absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-all",
          active ? "bg-primary opacity-100" : "bg-transparent opacity-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── Conversation tab ────────────────────────────────────────────

function ConversationTab({
  pr, comments, reviews,
}: {
  pr: PullRequest;
  comments: PrComment[];
  reviews: PrReview[];
}) {
  // Top-level comments only — replies render nested under their parent.
  const topLevel = comments.filter((c) => c.parentId === null && c.filePath === null);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, PrComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return map;
  }, [comments]);

  // Body + AI explanation merged into a "PR description" card at the top.
  return (
    <div className="max-w-[860px] mx-auto px-6 py-6 space-y-4">
      {/* Description + AI explanation */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
            Description
          </span>
        </div>
        <div className="px-4 py-4 space-y-4">
          {pr.body && (
            <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {pr.body}
            </p>
          )}
          {pr.aiExplanation && (
            <div className="rounded-md border border-primary/30 bg-primary/[0.05] p-3">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3 w-3" />
                AI Explanation · why this PR
              </p>
              <p className="mt-2 text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {pr.aiExplanation}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Conversation thread + review states inline */}
      {topLevel.map((c) => (
        <CommentCard key={c.id} comment={c} replies={repliesByParent.get(c.id) ?? []} />
      ))}

      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}

      {/* New comment composer */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
            Add a comment
          </span>
        </div>
        <div className="p-3">
          <textarea
            rows={3}
            placeholder="Leave a comment…"
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentCard({
  comment, replies,
}: {
  comment: PrComment;
  replies: PrComment[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <CommentHead comment={comment} />
      <div className="px-4 py-3">
        <p className="text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>
      </div>
      {replies.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
          {replies.map((r) => (
            <div key={r.id} className="border-l-2 border-primary/40 pl-3">
              <CommentHead comment={r} compact />
              <p className="mt-1.5 text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentHead({ comment, compact }: { comment: PrComment; compact?: boolean }) {
  const agent = agentById(comment.authorAgentId);
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "px-4 py-2.5 border-b border-border bg-muted/30"}`}>
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold uppercase"
        style={agent
          ? { background: `hsl(${agent.accentHsl} / 0.18)`, color: `hsl(${agent.accentHsl})` }
          : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
      >
        {agent ? agent.displayName[0] : (comment.authorUsername?.[0] ?? "?")}
      </div>
      <span className="text-[12px] font-semibold text-foreground">
        {agent ? agent.displayName : comment.authorUsername}
      </span>
      <span className="text-[10.5px] text-muted-foreground">commented {timeAgo(comment.createdAt)}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: PrReview }) {
  const agent = agentById(review.reviewerAgentId);
  const stateMeta = {
    approved:           { Icon: Check,    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", label: "approved" },
    changes_requested:  { Icon: XCircle,  cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",        label: "requested changes" },
    commented:          { Icon: Eye,      cls: "border-border bg-muted/40 text-muted-foreground",           label: "commented" },
    dismissed:          { Icon: XCircle,  cls: "border-border bg-muted/40 text-muted-foreground",           label: "dismissed" },
  }[review.state];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${stateMeta.cls.split(" ")[0]}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${stateMeta.cls}`}>
        <stateMeta.Icon className="h-3.5 w-3.5" />
        <span className="text-[12px] font-semibold">
          {agent ? agent.displayName : review.reviewerUsername} {stateMeta.label}
        </span>
        <span className="ml-auto text-[10.5px] opacity-80">{timeAgo(review.createdAt)}</span>
      </div>
      {review.body && (
        <div className="px-4 py-3">
          <p className="text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{review.body}</p>
        </div>
      )}
    </div>
  );
}

// ── Commits tab ─────────────────────────────────────────────────

function CommitsTab({ prId: _prId }: { prId: string }) {
  // For the mock — show all commits on the source branch up to head.
  // Real wiring would filter to commits between target..source.
  const commits = MOCK_COMMITS.slice(0, 3);
  const [openCommitId, setOpenCommitId] = useState<string | null>(null);
  const openCommit = openCommitId
    ? commits.find((c) => c.id === openCommitId) ?? null
    : null;

  if (openCommit) {
    return <CommitDetail commit={openCommit} onBack={() => setOpenCommitId(null)} />;
  }

  return (
    <div className="max-w-[860px] mx-auto px-6 py-6 space-y-2">
      {commits.map((c) => {
        const agent = agentById(c.authorAgentId);
        return (
          <div
            key={c.id}
            onClick={() => setOpenCommitId(c.id)}
            className="cursor-pointer rounded-lg border border-border bg-card hover:border-foreground/30 transition-colors p-3 flex items-start gap-3"
          >
            <GitCommit className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground tracking-tight">
                {c.message}
              </p>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{c.sha.slice(0, 7)}</span>
                <span className="opacity-50">·</span>
                {agent ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${agent.accentHsl})` }} />
                    {agent.displayName}
                  </span>
                ) : (
                  <span>{c.authorUsername}</span>
                )}
                <span className="opacity-50">·</span>
                <span>{timeAgo(c.createdAt)}</span>
                <span className="ml-auto inline-flex items-center gap-2 text-foreground/80">
                  <span className="text-emerald-400">+{c.additions}</span>
                  <span className="text-red-400">−{c.deletions}</span>
                  <span className="text-muted-foreground">{c.changedFiles} files</span>
                </span>
              </div>
              {c.agentReasoning && (
                <details
                  className="mt-2 group"
                  // Stop click propagation so opening the AI reasoning
                  // disclosure doesn't also navigate into the commit
                  // detail view (the row wrapper above is now clickable).
                  onClick={(e) => e.stopPropagation()}
                >
                  <summary className="cursor-pointer text-[11px] text-primary inline-flex items-center gap-1 list-none">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    <Sparkles className="h-3 w-3" />
                    AI reasoning
                  </summary>
                  <p className="mt-2 ml-4 text-[12px] text-foreground/85 leading-relaxed border-l-2 border-primary/30 pl-3">
                    {c.agentReasoning}
                  </p>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Files Changed tab ───────────────────────────────────────────

function FilesChangedTab({
  pr, comments,
}: {
  pr: PullRequest;
  comments: PrComment[];
}) {
  // For the mock — pick a couple of files for this repo as the
  // "changed files" set.
  const files = MOCK_FILES.filter((f) => f.repoId === pr.repoId).slice(0, 3);
  const inlineComments = comments.filter((c) => c.filePath !== null);

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-3">
      <div className="text-[11.5px] text-muted-foreground">
        Showing <span className="font-semibold text-foreground/90">{files.length}</span> changed files
        {" · "}
        <span className="text-emerald-400">+{pr.additions}</span>
        {" "}
        <span className="text-red-400">−{pr.deletions}</span>
      </div>
      {files.map((f) => {
        const fileComments = inlineComments.filter((c) => c.filePath === f.path);
        return <FileDiffCard key={f.id} file={f} comments={fileComments} />;
      })}
    </div>
  );
}

function FileDiffCard({
  file, comments,
}: {
  file: typeof MOCK_FILES[number];
  comments: PrComment[];
}) {
  const [open, setOpen] = useState(true);
  // Synthesize a per-line diff state map for the mock. Real wiring
  // would derive this from a parsed unified-diff. Keying off
  // `file.id` makes the choice deterministic per file so the
  // colours don't reshuffle on every render.
  const lineCount = (file.content ?? "").split("\n").length;
  const lineStates = useMemo<Record<number, DiffLineState>>(() => {
    const states: Record<number, DiffLineState> = {};
    // Deterministic-ish: hash file id into a few line numbers.
    const hash = [...file.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    if (lineCount > 2) states[2 + (hash % 2)] = "add";
    if (lineCount > 4) states[4] = "del";
    if (lineCount > 6) states[6] = "add";
    return states;
  }, [file.id, lineCount]);

  const addCount = Object.values(lineStates).filter((s) => s === "add").length;
  const delCount = Object.values(lineStates).filter((s) => s === "del").length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[11.5px] text-foreground/90">{file.path}</span>
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-emerald-400">+{addCount}</span>
          <span className="text-red-400">−{delCount}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="overflow-x-auto bg-background px-2">
            <CodeBlock
              code={file.content ?? ""}
              language={file.language}
              lineStates={lineStates}
            />
          </div>
          {comments.length > 0 && (
            <div className="border-t border-border bg-muted/20 p-3 space-y-3">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                Inline review comments
              </p>
              {comments.map((c) => {
                const agent = agentById(c.authorAgentId);
                return (
                  <div key={c.id} className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold uppercase"
                        style={agent ? { background: `hsl(${agent.accentHsl} / 0.18)`, color: `hsl(${agent.accentHsl})` } : undefined}
                      >
                        {agent ? agent.displayName[0] : (c.authorUsername?.[0] ?? "?")}
                      </div>
                      <span className="text-[12px] font-semibold text-foreground">
                        {agent ? agent.displayName : c.authorUsername}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        line {c.lineNumber}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {c.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Merge bar ───────────────────────────────────────────────────

function MergeBar({ pr, reviews }: { pr: PullRequest; reviews: PrReview[] }) {
  const approvals = reviews.filter((r) => r.state === "approved").length;
  const changesRequested = reviews.some((r) => r.state === "changes_requested");
  const canMerge = approvals >= 1 && !changesRequested;
  void pr;
  return (
    <div className="shrink-0 border-t border-border bg-card/60 backdrop-blur px-6 py-3">
      <div className="max-w-[860px] mx-auto flex items-center gap-3">
        <div className="flex-1 text-[11.5px]">
          {changesRequested ? (
            <span className="text-amber-400 font-semibold">
              Changes requested — address comments before merging.
            </span>
          ) : approvals >= 1 ? (
            <span className="text-emerald-400 font-semibold">
              {approvals} approval{approvals === 1 ? "" : "s"} · ready to merge
            </span>
          ) : (
            <span className="text-muted-foreground">
              Needs at least 1 approval to merge.
            </span>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <XCircle className="h-3.5 w-3.5" />
          Request changes
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          disabled={!canMerge}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitMerge className="h-3.5 w-3.5" />
          Merge pull request
        </button>
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

void FileText;
