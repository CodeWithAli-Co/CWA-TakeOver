// ───────────────────────────────────────────────────────────────────
// AXON — Live Diff Overlay.
//
// A floating side panel that lives outside the Command Panel so the
// operator SEES Axon's file edits in real time without having to
// open anything. It listens to the graph store for new write/modify
// file events and slides in from the right edge with a unified
// diff. Auto-dismisses after a quiet period unless the operator
// pinned it. Click any file node in the Mind Map to re-open the
// diff for that node, pinned.
//
// Cross-tab events drive this:
//   • The graph store emits a node every time codegen.ts writes or
//     modifies a file.
//   • This component finds the most-recent such node, captures it
//     locally, and slides into view.
//   • The store's subscribe + useSyncExternalStore wiring means the
//     panel re-renders the moment any new event lands.
//
// Visual language:
//   • Floats above the canvas (z-index 9998 — under the Orb).
//   • Glass card with brand-accent rim glow.
//   • Header — file path, op chip, +N / −M counts, duration, pin,
//     close.
//   • Body — unified diff with green/red rails and gutter line
//     numbers. Skipped equal-line runs render as dashed dividers.
//   • Width 460px, min height 220px, max height 70vh, rounded 14px.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { axonGraph, type GraphNode } from "../engine/graphStore";
import { compactDiff, diffLines } from "../engine/diffUtil";

// Fade-out delay after a fresh event lands. Pinned panels ignore this.
// Bumped from 7s → 14s so the operator can actually read what was typed.
const AUTO_HIDE_MS = 14000;

// Tool names that mean "Axon is writing code" — drives the live-coder
// panel to pop the moment the agent decides to write/modify a file.
const CODING_TOOL_NAMES = new Set([
  "generate_file",
  "modify_file",
  "scaffold_feature",
  "add_page",
]);

function isFileWriteNode(n: GraphNode): boolean {
  return n.kind === "file" && (n.fileOp === "write" || n.fileOp === "modify");
}

function findLatestWrite(nodes: GraphNode[]): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (isFileWriteNode(nodes[i])) return nodes[i];
  }
  return null;
}

/** Find an in-flight coding tool node (state === "running" + a coding
 *  tool name). Used to pop the panel BEFORE any file write completes. */
function findRunningCodingTool(nodes: GraphNode[]): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (
      n.kind === "tool" &&
      n.state === "running" &&
      typeof n.toolName === "string" &&
      CODING_TOOL_NAMES.has(n.toolName)
    ) {
      return n;
    }
  }
  return null;
}

/** Best-guess target file path from a coding tool's input meta. The
 *  agent passes path / filePath / target depending on the action. */
function extractTargetPath(n: GraphNode): string {
  const meta = (n.meta ?? {}) as Record<string, unknown>;
  const candidates = ["path", "filePath", "target", "file", "destination"];
  for (const k of candidates) {
    const v = meta[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

export function DiffOverlay() {
  const state = useSyncExternalStore(axonGraph.subscribe, axonGraph.getState, axonGraph.getState);

  // Operator-pinned node id wins over the auto-tracked latest one.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Local "shown" id — the node currently being displayed. We keep
  // this even after a session ends so the overlay doesn't suddenly
  // vanish when Axon settles.
  const [shownId, setShownId] = useState<string | null>(null);
  // Visible flag — drives the slide-in animation.
  const [visible, setVisible] = useState(false);
  // Pinned panel never auto-hides.
  const [pinned, setPinned] = useState(false);

  const hideTimer = useRef<number | null>(null);

  // External "open by id" hook — the Mind Map calls this when the
  // operator clicks a write/modify file node.
  useEffect(() => {
    (window as any).__axonOpenDiff = (nodeId: string) => {
      setPinnedId(nodeId);
      setShownId(nodeId);
      setVisible(true);
      setPinned(true);
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    return () => {
      delete (window as any).__axonOpenDiff;
    };
  }, []);

  // Track the latest write/modify across all sessions and pop the
  // overlay when one shows up.
  const allNodes: GraphNode[] = useMemo(() => {
    const out: GraphNode[] = [];
    for (const s of state.sessions) {
      for (const n of s.nodes) out.push(n);
    }
    return out;
  }, [state.sessions]);

  const latest = useMemo(() => findLatestWrite(allNodes), [allNodes]);

  // Live coder — tracks an in-flight coding tool call so the panel
  // pops the moment Axon decides to write a file, not after it
  // finishes. We keep a ref to the running tool node id and the
  // typewriter playback state.
  const liveTool = useMemo(() => findRunningCodingTool(allNodes), [allNodes]);
  const [liveToolId, setLiveToolId] = useState<string | null>(null);
  const [liveTargetPath, setLiveTargetPath] = useState<string>("");
  // Pop the moment a coding tool enters running.
  useEffect(() => {
    if (!liveTool) return;
    if (liveTool.id === liveToolId) return;
    setLiveToolId(liveTool.id);
    setLiveTargetPath(extractTargetPath(liveTool));
    setVisible(true);
    setPinned(false);
    setPinnedId(null);
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, [liveTool?.id, liveToolId]);

  // Once the coding tool ends and a fresh file write/modify lands,
  // mark the live session over so the diff view can take over. We
  // do this by clearing liveToolId when the running state flips.
  useEffect(() => {
    if (!liveToolId) return;
    const node = allNodes.find((n) => n.id === liveToolId);
    if (!node || node.state !== "running") {
      setLiveToolId(null);
    }
  }, [allNodes, liveToolId]);

  // Typewriter playback over the latest write's `after` content.
  // Triggered when the file node arrives with content; reveals lines
  // 1 → N at ~25ms each (capped so a 1000-line file finishes in
  // ~6s — fast enough to feel "live coding", slow enough to read).
  const [typedLineCount, setTypedLineCount] = useState(0);
  const [typeTargetId, setTypeTargetId] = useState<string | null>(null);
  useEffect(() => {
    if (!latest || latest.id === typeTargetId) return;
    const text = latest.after ?? "";
    if (!text) return;
    setTypeTargetId(latest.id);
    setTypedLineCount(0);
    const totalLines = text.split("\n").length;
    // Total animation budget — 5s for files up to ~250 lines, longer
    // files speed up so the playback never drags past 6s.
    const budgetMs = Math.min(6000, Math.max(1500, totalLines * 22));
    const stepMs = Math.max(8, budgetMs / Math.max(1, totalLines));
    let i = 0;
    const handle = window.setInterval(() => {
      i += 1;
      setTypedLineCount(i);
      if (i >= totalLines) {
        window.clearInterval(handle);
      }
    }, stepMs);
    return () => window.clearInterval(handle);
  }, [latest?.id, typeTargetId]);

  useEffect(() => {
    if (pinnedId) return; // pinned mode — don't auto-track
    if (!latest) return;
    if (latest.id === shownId) return;
    setShownId(latest.id);
    setVisible(true);
    setPinned(false);
    // Reset auto-hide.
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Only hide if still not pinned at the moment the timer fires.
      setVisible((prev) => (prev ? false : prev));
      hideTimer.current = null;
    }, AUTO_HIDE_MS);
  }, [latest?.id, pinnedId, shownId]);

  // When the user clicks "pin", cancel auto-hide.
  useEffect(() => {
    if (!pinned) return;
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, [pinned]);

  const showing = useMemo<GraphNode | null>(() => {
    const id = pinnedId ?? shownId;
    if (!id) return null;
    return allNodes.find((n) => n.id === id) ?? null;
  }, [pinnedId, shownId, allNodes]);

  // Compute the diff. Memoized on the showing node so we don't redo
  // LCS on every render.
  const diff = useMemo(() => {
    if (!showing || showing.kind !== "file") return null;
    const before = showing.before ?? "";
    const after = showing.after ?? "";
    if (before === "" && after === "") return null;
    const raw = diffLines(before, after);
    return compactDiff(raw, { context: 3 });
  }, [showing?.id, showing?.before, showing?.after]);

  // Decide which mode the panel is in:
  //   • liveTool active        → show "Axon is coding…" status + cursor
  //   • typewriter still going → show typewriter view of `after`
  //   • file diff ready        → existing diff view
  const isLive = !!liveTool;
  const totalLines = useMemo(
    () => (latest?.after ? latest.after.split("\n").length : 0),
    [latest?.after],
  );
  const isTyping = !!latest && typedLineCount < totalLines;

  // Bail only when there's nothing to show AT ALL — neither a live
  // session nor a completed diff. The previous early return was too
  // aggressive: it hid the panel during the tool's running window.
  if (!isLive && !isTyping && (!showing || !diff)) return null;

  // Header derives from whichever mode we're in.
  const targetForHeader = isLive
    ? { path: liveTargetPath || "(file)", op: "WRITING" as const, tone: "live" as const, dur: null as string | null }
    : showing
      ? {
          path: showing.filePath ?? showing.label,
          op:
            showing.fileOp === "modify"
              ? "MODIFIED"
              : showing.fileOp === "write"
                ? "CREATED"
                : (showing.fileOp ?? "TOUCHED").toUpperCase(),
          tone:
            showing.fileOp === "modify"
              ? ("amber" as const)
              : showing.fileOp === "write"
                ? ("teal" as const)
                : ("neutral" as const),
          dur:
            showing.durationMs !== undefined
              ? formatDuration(showing.durationMs)
              : null,
        }
      : { path: "", op: "TOUCHED", tone: "neutral" as const, dur: null };

  const pathLabel = targetForHeader.path;
  const opLabel = targetForHeader.op;
  const opTone = targetForHeader.tone;
  const durLabel = targetForHeader.dur;

  return (
    <aside
      className="axon-diff-overlay"
      data-visible={visible}
      data-pinned={pinned}
      aria-hidden={!visible}
    >
      <header className="axon-diff-head">
        <div className="axon-diff-head-row">
          <span
            className={`axon-diff-op axon-diff-op--${opTone === "live" ? "live" : opTone}`}
            style={
              opTone === "live"
                ? {
                    color: "rgb(56, 189, 248)",
                    background: "rgba(56, 189, 248, 0.10)",
                    borderColor: "rgba(56, 189, 248, 0.55)",
                  }
                : undefined
            }
          >
            {opLabel}
          </span>
          <span className="axon-diff-path" title={pathLabel}>
            {pathLabel}
          </span>
          <span className="axon-diff-actions">
            <button
              className="axon-diff-iconbtn"
              data-active={pinned}
              onClick={() => {
                if (pinned) {
                  // Unpinning — clear pinned id but keep showing the
                  // current node briefly so the panel doesn't vanish
                  // mid-glance. Restart the auto-hide timer.
                  setPinned(false);
                  setPinnedId(null);
                  if (hideTimer.current) window.clearTimeout(hideTimer.current);
                  hideTimer.current = window.setTimeout(() => {
                    setVisible(false);
                    hideTimer.current = null;
                  }, AUTO_HIDE_MS);
                } else {
                  setPinned(true);
                  if (showing) setPinnedId(showing.id);
                }
              }}
              title={pinned ? "Unpin (auto-hide)" : "Pin (stay open)"}
              aria-label={pinned ? "Unpin diff" : "Pin diff"}
            >
              {pinned ? "📌" : "📍"}
            </button>
            <button
              className="axon-diff-iconbtn"
              onClick={() => {
                setVisible(false);
                setPinnedId(null);
                setPinned(false);
                if (hideTimer.current) {
                  window.clearTimeout(hideTimer.current);
                  hideTimer.current = null;
                }
              }}
              title="Close"
              aria-label="Close diff"
            >
              ✕
            </button>
          </span>
        </div>
        {!isLive && diff && (
          <div className="axon-diff-meta">
            <span className="axon-diff-stat axon-diff-stat--add">+{diff.summary.added}</span>
            <span className="axon-diff-stat axon-diff-stat--del">−{diff.summary.removed}</span>
            <span className="axon-diff-stat axon-diff-stat--eq">{diff.summary.unchanged} unchanged</span>
            {durLabel && <span className="axon-diff-stat axon-diff-stat--dur">{durLabel}</span>}
            {showing?.diffTruncated && (
              <span className="axon-diff-stat axon-diff-stat--trunc" title="File too large — diff is partial">
                truncated
              </span>
            )}
          </div>
        )}
      </header>

      {(isLive || isTyping) && (
        <LiveCoderBody
          isLive={isLive}
          path={pathLabel}
          fullText={latest?.after ?? ""}
          revealedLines={typedLineCount}
        />
      )}

      {!isLive && !isTyping && diff && (
        <div className="axon-diff-body">
          {diff.lines.length === 0 ? (
            <div className="axon-diff-empty">No textual change.</div>
          ) : (
            <ol className="axon-diff-lines">
            {diff.lines.map((ln, idx) => {
              if (ln.kind === "skip") {
                return (
                  <li key={`skip-${idx}`} className="axon-diff-line axon-diff-line--skip">
                    <span className="axon-diff-gutter axon-diff-gutter--skip">⋯</span>
                    <span className="axon-diff-skip-label">
                      {ln.count} unchanged line{ln.count === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              }
              return (
                <li
                  key={`${ln.kind}-${idx}`}
                  className={`axon-diff-line axon-diff-line--${ln.kind}`}
                >
                  <span className="axon-diff-lineno axon-diff-lineno--before">
                    {ln.beforeLineNo ?? ""}
                  </span>
                  <span className="axon-diff-lineno axon-diff-lineno--after">
                    {ln.afterLineNo ?? ""}
                  </span>
                  <span className="axon-diff-gutter">
                    {ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : " "}
                  </span>
                  <span className="axon-diff-code">{ln.text || " "}</span>
                </li>
              );
            })}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}

// ── Live coder body — typewriter playback over `after` content. ────
function LiveCoderBody({
  isLive,
  path,
  fullText,
  revealedLines,
}: {
  isLive: boolean;
  path: string;
  fullText: string;
  revealedLines: number;
}) {
  const allLines = useMemo(() => fullText.split("\n"), [fullText]);
  const visibleLines = useMemo(
    () => allLines.slice(0, Math.max(0, revealedLines)),
    [allLines, revealedLines],
  );
  const totalLines = allLines.length;
  const progress = totalLines > 0 ? Math.min(1, revealedLines / totalLines) : 0;

  // Auto-scroll the stream to the bottom as new lines reveal.
  const streamRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [revealedLines]);

  return (
    <div className="axon-live-coder">
      <div className="axon-live-coder-status">
        <span className="axon-live-coder-dot" />
        {isLive ? (
          <span>Axon is coding{path ? ` — ${path}` : "…"}</span>
        ) : (
          <span>
            Streaming {revealedLines} / {totalLines} lines · {Math.round(progress * 100)}%
          </span>
        )}
      </div>
      <div ref={streamRef} className="axon-live-coder-stream">
        {visibleLines.length === 0 && isLive && (
          <div className="axon-live-coder-line">
            <span className="axon-live-coder-ln">·</span>
            <span className="axon-live-coder-text">
              Composing the file
              <span className="axon-live-coder-cursor" />
            </span>
          </div>
        )}
        {visibleLines.map((line, i) => {
          const isLast = i === visibleLines.length - 1 && revealedLines < totalLines;
          return (
            <div key={i} className="axon-live-coder-line">
              <span className="axon-live-coder-ln">{i + 1}</span>
              <span className="axon-live-coder-text">
                {line || " "}
                {isLast && <span className="axon-live-coder-cursor" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
