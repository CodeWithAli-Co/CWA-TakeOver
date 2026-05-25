/**
 * CommitDetail.tsx — Single-commit detail page.
 *
 * Opens when the user clicks a commit row inside the PR
 * detail's Commits sub-tab. Shows the full commit message,
 * author + parent SHA, the AI reasoning the agent gave for
 * making the commit, and a file-by-file diff using the
 * syntax-highlighted CodeBlock.
 *
 * Stays inside the PR detail view (no router push) — click
 * the back button to return to the commits list.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft, GitCommit, Sparkles, Clock, ChevronDown, ChevronRight,
  FileCode,
} from "lucide-react";
import {
  MOCK_FILES,
  agentById,
  type CommitRow,
} from "./mockData";
import { CodeBlock, type DiffLineState } from "./CodeBlock";

interface Props {
  commit: CommitRow;
  onBack: () => void;
}

export function CommitDetail({ commit, onBack }: Props) {
  const author = agentById(commit.authorAgentId);

  // For the mock, pick the first N files for this repo as the
  // commit's changed files. Real wiring would query the commit's
  // diff (or a stored `commit_files` join). Each file gets its
  // own deterministic per-line diff state.
  const files = useMemo(
    () => MOCK_FILES.filter((f) => f.repoId === commit.repoId).slice(0, commit.changedFiles),
    [commit.repoId, commit.changedFiles],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/40 px-6 py-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-7 w-7 mt-0.5 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Back to commits"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <GitCommit className="h-4 w-4 mt-1.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            {/* Message — first line bold, rest in muted prose */}
            <CommitMessage message={commit.message} />
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground/90">
                {commit.sha.slice(0, 7)}
              </span>
              {commit.parentSha && (
                <>
                  <span className="opacity-50">parent</span>
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 text-foreground/80">
                    {commit.parentSha.slice(0, 7)}
                  </span>
                </>
              )}
              <span className="opacity-50">·</span>
              <span>{commit.branchName}</span>
              <span className="opacity-50">·</span>
              {author ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${author.accentHsl})` }} />
                  <span className="text-foreground/85">{author.displayName}</span>
                </span>
              ) : (
                <span className="text-foreground/85">{commit.authorUsername}</span>
              )}
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1 normal-case">
                <Clock className="h-3 w-3" />
                {new Date(commit.createdAt).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>
              <span className="opacity-50">·</span>
              <span>
                <span className="text-emerald-400">+{commit.additions}</span>{" "}
                <span className="text-red-400">−{commit.deletions}</span>{" "}
                <span>across {commit.changedFiles} file{commit.changedFiles === 1 ? "" : "s"}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-4">
          {/* AI reasoning panel — only for agent-authored commits */}
          {author && commit.agentReasoning && (
            <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-4">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3 w-3" />
                AI Reasoning · why this commit
              </p>
              <p className="mt-2 text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {commit.agentReasoning}
              </p>
            </div>
          )}

          {/* Diffstat summary */}
          <div className="text-[11.5px] text-muted-foreground">
            Showing <span className="font-semibold text-foreground/90">{files.length}</span> changed file{files.length === 1 ? "" : "s"}
            {" · "}
            <span className="text-emerald-400">+{commit.additions}</span>
            {" "}
            <span className="text-red-400">−{commit.deletions}</span>
          </div>

          {/* File-by-file diff */}
          {files.map((file) => (
            <CommitFileDiff key={file.id} file={file} commitSha={commit.sha} />
          ))}
          {files.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-[12px] text-muted-foreground">
              No file snapshots seeded for this repo yet — real diffs land when the
              commit_files mapping is wired up.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Commit message renderer ─────────────────────────────────────
// Convention: first line is the subject (bold), blank line, then
// optional body paragraphs. We split + render to match Git's
// standard commit-message shape.

function CommitMessage({ message }: { message: string }) {
  const lines = message.split("\n");
  const subject = lines[0];
  const body = lines.slice(1).join("\n").trim();
  return (
    <>
      <h1 className="text-[18px] font-semibold tracking-tight text-foreground leading-snug">
        {subject}
      </h1>
      {body && (
        <p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {body}
        </p>
      )}
    </>
  );
}

// ── Per-file diff card ──────────────────────────────────────────

function CommitFileDiff({
  file, commitSha,
}: {
  file: typeof MOCK_FILES[number];
  commitSha: string;
}) {
  const [open, setOpen] = useState(true);

  // Synthesize a deterministic diff state map keyed by file id +
  // commit sha so different commits show different-looking diffs
  // on the same file.
  const lineCount = (file.content ?? "").split("\n").length;
  const lineStates = useMemo<Record<number, DiffLineState>>(() => {
    const states: Record<number, DiffLineState> = {};
    const seed = [...file.id, ...commitSha.slice(0, 4)]
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    if (lineCount > 1) states[1 + (seed % Math.max(1, lineCount - 1))] = "add";
    if (lineCount > 3) states[3] = "del";
    if (lineCount > 5) states[5] = "add";
    return states;
  }, [file.id, commitSha, lineCount]);

  const addCount = Object.values(lineStates).filter((s) => s === "add").length;
  const delCount = Object.values(lineStates).filter((s) => s === "del").length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[11.5px] text-foreground/90">{file.path}</span>
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-emerald-400">+{addCount}</span>
          <span className="text-red-400">−{delCount}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto bg-background px-2">
          <CodeBlock
            code={file.content ?? ""}
            language={file.language}
            lineStates={lineStates}
          />
        </div>
      )}
    </div>
  );
}
