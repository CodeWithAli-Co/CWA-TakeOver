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
const AUTO_HIDE_MS = 7000;

function isFileWriteNode(n: GraphNode): boolean {
  return n.kind === "file" && (n.fileOp === "write" || n.fileOp === "modify");
}

function findLatestWrite(nodes: GraphNode[]): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (isFileWriteNode(nodes[i])) return nodes[i];
  }
  return null;
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

  if (!showing || !diff) return null;

  const pathLabel = showing.filePath ?? showing.label;
  const opLabel =
    showing.fileOp === "modify" ? "MODIFIED" : showing.fileOp === "write" ? "CREATED" : (showing.fileOp ?? "TOUCHED").toUpperCase();
  const opTone =
    showing.fileOp === "modify" ? "amber" : showing.fileOp === "write" ? "teal" : "neutral";
  const durLabel = showing.durationMs !== undefined ? formatDuration(showing.durationMs) : null;

  return (
    <aside
      className="axon-diff-overlay"
      data-visible={visible}
      data-pinned={pinned}
      aria-hidden={!visible}
    >
      <header className="axon-diff-head">
        <div className="axon-diff-head-row">
          <span className={`axon-diff-op axon-diff-op--${opTone}`}>{opLabel}</span>
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
                  setPinnedId(showing.id);
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
        <div className="axon-diff-meta">
          <span className="axon-diff-stat axon-diff-stat--add">+{diff.summary.added}</span>
          <span className="axon-diff-stat axon-diff-stat--del">−{diff.summary.removed}</span>
          <span className="axon-diff-stat axon-diff-stat--eq">{diff.summary.unchanged} unchanged</span>
          {durLabel && <span className="axon-diff-stat axon-diff-stat--dur">{durLabel}</span>}
          {showing.diffTruncated && (
            <span className="axon-diff-stat axon-diff-stat--trunc" title="File too large — diff is partial">
              truncated
            </span>
          )}
        </div>
      </header>

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
    </aside>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
