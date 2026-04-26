// ───────────────────────────────────────────────────────────────────
// Tiny line-diff utility — pure, no dependencies.
//
// Builds a Longest-Common-Subsequence (LCS) line table between two
// strings, then walks it back to produce a unified diff with
// equal / inserted / deleted line segments. Performance is O(n*m)
// in lines, which is fine for files we cap at 64KB elsewhere.
//
// Returned shape is friendly to a virtualized renderer: each "hunk"
// has the surrounding equal lines you want for context, with the
// changed lines flagged. Caller decides how to paint them.
// ───────────────────────────────────────────────────────────────────

export type DiffLineKind = "eq" | "add" | "del";

export interface DiffLine {
  kind: DiffLineKind;
  /** Original line text (no trailing newline). */
  text: string;
  /** Line number in the BEFORE file (1-indexed). undefined for adds. */
  beforeLineNo?: number;
  /** Line number in the AFTER file (1-indexed). undefined for deletes. */
  afterLineNo?: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export interface DiffResult {
  lines: DiffLine[];
  summary: DiffSummary;
}

/** Split into lines without dropping a trailing empty line, so the
 *  diff doesn't look like the file got "shorter" by 1 just because
 *  it ends with a newline. */
function splitLines(s: string): string[] {
  if (s === "") return [];
  return s.split(/\r?\n/);
}

/** Standard LCS table — rows = before, cols = after. */
function buildLcs(a: string[], b: string[]): Uint32Array {
  const n = a.length;
  const m = b.length;
  const dp = new Uint32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i * w + j] = dp[(i + 1) * w + (j + 1)] + 1;
      } else {
        const down = dp[(i + 1) * w + j];
        const right = dp[i * w + (j + 1)];
        dp[i * w + j] = down >= right ? down : right;
      }
    }
  }
  return dp;
}

/** Walk the LCS table to produce a unified diff. */
export function diffLines(before: string, after: string): DiffResult {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;
  const dp = buildLcs(a, b);
  const w = m + 1;

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({
        kind: "eq",
        text: a[i],
        beforeLineNo: i + 1,
        afterLineNo: j + 1,
      });
      unchanged++;
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      out.push({
        kind: "del",
        text: a[i],
        beforeLineNo: i + 1,
      });
      removed++;
      i++;
    } else {
      out.push({
        kind: "add",
        text: b[j],
        afterLineNo: j + 1,
      });
      added++;
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: "del", text: a[i], beforeLineNo: i + 1 });
    removed++;
    i++;
  }
  while (j < m) {
    out.push({ kind: "add", text: b[j], afterLineNo: j + 1 });
    added++;
    j++;
  }

  return { lines: out, summary: { added, removed, unchanged } };
}

/** Compress runs of equal lines down to N lines of leading/trailing
 *  context per change region, replacing the middle with a stub line.
 *  Keeps the diff visually focused on the changes. Returns the same
 *  DiffLine[] shape with extra `eq` "skipped" markers. */
export interface CompactOpts {
  /** Lines of equal context kept on each side of a change. Default 3. */
  context?: number;
}
export interface CompactedDiff {
  lines: Array<DiffLine | { kind: "skip"; count: number }>;
  summary: DiffSummary;
}

export function compactDiff(input: DiffResult, opts: CompactOpts = {}): CompactedDiff {
  const ctx = opts.context ?? 3;
  const lines = input.lines;

  // Identify change indices.
  const changedIdx: number[] = [];
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].kind !== "eq") changedIdx.push(k);
  }

  // No changes? Return everything; nothing to compact.
  if (changedIdx.length === 0) {
    return { lines: lines.slice(), summary: input.summary };
  }

  // Build a mask of which equal lines we keep (those within ctx of any change).
  const keep = new Array<boolean>(lines.length).fill(false);
  for (const idx of changedIdx) {
    const lo = Math.max(0, idx - ctx);
    const hi = Math.min(lines.length - 1, idx + ctx);
    for (let k = lo; k <= hi; k++) keep[k] = true;
  }

  const out: CompactedDiff["lines"] = [];
  let skipRun = 0;
  for (let k = 0; k < lines.length; k++) {
    if (keep[k]) {
      if (skipRun > 0) {
        out.push({ kind: "skip", count: skipRun });
        skipRun = 0;
      }
      out.push(lines[k]);
    } else {
      skipRun++;
    }
  }
  if (skipRun > 0) {
    out.push({ kind: "skip", count: skipRun });
  }
  return { lines: out, summary: input.summary };
}
