// ───────────────────────────────────────────────────────────────────
// Axon Live Mind Map — graph store.
//
// The single source of truth for what Axon is thinking / touching /
// running, in real time. The agent loop in agent.ts and the action
// executor in executor.ts emit events into this store; the Mind Map
// canvas subscribes and renders the graph.
//
// Sessions
//   A "session" is one operator-initiated run — either a conversational
//   turn (brain.ts) or an autonomous goal (agent.ts). Each session
//   gets its own graph; the most recent session is the one rendered
//   live, but past sessions stay in history so the operator can scrub
//   back through them.
//
// Node kinds — drives the visual treatment in the canvas:
//   • root      — the operator's prompt / goal (always one per session)
//   • plan      — a step Axon emitted while planning (Architect output)
//   • tool      — a tool_use call to the action registry
//   • file      — a file Axon touched (find / read / write / modify)
//   • thought   — a textual reasoning beat from the brain (between turns)
//   • error     — a failed tool call
//   • summary   — Axon's final spoken summary (terminal node)
//
// Edges — directed. Source → target with an optional kind + label.
//
// The store is intentionally lightweight: pure data, no React. The
// canvas reads via useSyncExternalStore so it sees every update with
// no React re-render cost on the rest of the app.
// ───────────────────────────────────────────────────────────────────

export type GraphNodeKind =
  | "root"
  | "plan"
  | "tool"
  | "file"
  | "thought"
  | "error"
  | "summary";

export type FileOp = "find" | "search" | "read" | "list" | "write" | "modify" | "delete";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  /** Short label rendered on the node (e.g. "find_file", "src/foo.tsx"). */
  label: string;
  /** Long-form details surfaced on hover / click. */
  detail?: string;
  /** Time the node was created — drives ordering + replay scrubbing. */
  createdAt: number;
  /** When `kind === "tool"` or `"file"`, the wall-clock duration in ms. */
  durationMs?: number;
  /** Lifecycle. `running` pulses; `done`/`error` settles. */
  state: "running" | "done" | "error";
  /** Free-form metadata for tooltips + replay UI. */
  meta?: Record<string, unknown>;
  /** For file nodes — the operation kind and full path. */
  fileOp?: FileOp;
  filePath?: string;
  /** Tool name when kind === "tool". */
  toolName?: string;
  /** Iteration index inside the agent loop (for layout layering). */
  iter?: number;
  /** Error message when state === "error". */
  error?: string;
  /** Layout position — set lazily by the renderer's force-directed pass. */
  x?: number;
  y?: number;
  /** For file write/modify events: file content BEFORE write. */
  before?: string;
  /** For file write/modify events: file content AFTER write. */
  after?: string;
  /** True when before/after was capped to fit the size limit. */
  diffTruncated?: boolean;
  /** True when this node was created during a simulation run — the
   *  agent proposed the action but did NOT actually execute it. Mind
   *  Map renders simulated nodes with a dashed border + SIM badge. */
  simulated?: boolean;
}

const DIFF_PAYLOAD_CAP = 64 * 1024;
function capPayload(s: string | undefined): { text?: string; truncated: boolean } {
  if (typeof s !== "string") return { text: undefined, truncated: false };
  if (s.length <= DIFF_PAYLOAD_CAP) return { text: s, truncated: false };
  return { text: s.slice(0, DIFF_PAYLOAD_CAP), truncated: true };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** Optional label rendered along the edge. */
  label?: string;
  createdAt: number;
}

export interface GraphSession {
  id: string;
  /** "conversation" (single brain turn) or "agent" (multi-step run). */
  kind: "conversation" | "agent";
  /** The operator's prompt or goal. */
  prompt: string;
  startedAt: number;
  endedAt?: number;
  /** Summary text when the session resolves. */
  summary?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Currently-active node id (the one that's pulsing). */
  activeNodeId?: string;
}

interface AxonGraphState {
  sessions: GraphSession[];
  /** ID of the session being rendered. Defaults to the latest. */
  currentSessionId: string | null;
  /** When non-null, replay scrubber controls which event index is "current".
   *  -1 means "live" (render everything). */
  replayIndex: number;
}

// ── module-level state + listeners ─────────────────────────────────

const state: AxonGraphState = {
  sessions: [],
  currentSessionId: null,
  replayIndex: -1,
};

const listeners = new Set<() => void>();
const MAX_SESSIONS = 25;

// React useSyncExternalStore uses Object.is on snapshots — without
// fresh wrappers, the canvas/diff overlay never re-render even though
// state mutated. On every emit():
//   1) Replace the current session with a shallow-copy whose
//      nodes/edges arrays are also fresh slices. The inner GraphNode
//      objects are shared so live state mutations (running → done)
//      propagate.
//   2) Replace state.sessions with a fresh slice.
//   3) Invalidate the snapshot wrapper.
let _snapshot: AxonGraphState | null = null;

function emit() {
  if (state.currentSessionId) {
    const idx = state.sessions.findIndex((s) => s.id === state.currentSessionId);
    if (idx >= 0) {
      const cur = state.sessions[idx];
      state.sessions[idx] = {
        ...cur,
        nodes: cur.nodes.slice(),
        edges: cur.edges.slice(),
      };
    }
  }
  state.sessions = state.sessions.slice();
  _snapshot = null;
  for (const fn of listeners) fn();
}

function getCurrentSession(): GraphSession | null {
  if (!state.currentSessionId) return null;
  return state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
}

function getOrCreateSession(): GraphSession {
  const cur = getCurrentSession();
  if (cur && !cur.endedAt) return cur;
  // No live session — start an ad-hoc one. This shouldn't happen in
  // normal operation (startSession is called explicitly) but it keeps
  // events from being dropped if a tool fires unexpectedly.
  return axonGraph.startSession({ kind: "conversation", prompt: "" });
}

// ── public API ─────────────────────────────────────────────────────

export const axonGraph = {
  getState: (): AxonGraphState => {
    if (_snapshot === null) {
      _snapshot = {
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        replayIndex: state.replayIndex,
      };
    }
    return _snapshot;
  },

  /** React subscription hook — pairs with useSyncExternalStore. */
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  /** Begin a new session. Returns the session id so the caller can
   *  match later events to it. */
  startSession(args: {
    kind: "conversation" | "agent";
    prompt: string;
  }): GraphSession {
    const id = sessionId();
    const session: GraphSession = {
      id,
      kind: args.kind,
      prompt: args.prompt,
      startedAt: Date.now(),
      nodes: [],
      edges: [],
    };
    // Root node — always the first node and the visual center.
    const root: GraphNode = {
      id: nodeId("root"),
      kind: "root",
      label: args.kind === "agent" ? "Goal" : "Prompt",
      detail: args.prompt,
      createdAt: Date.now(),
      state: "running",
    };
    session.nodes.push(root);
    session.activeNodeId = root.id;
    state.sessions.push(session);
    if (state.sessions.length > MAX_SESSIONS) {
      state.sessions = state.sessions.slice(-MAX_SESSIONS);
    }
    state.currentSessionId = id;
    state.replayIndex = -1;
    emit();
    return session;
  },

  /** Mark the current session done, attaching the final summary. */
  endSession(args: { summary?: string; failed?: boolean }) {
    const s = getCurrentSession();
    if (!s) return;
    s.endedAt = Date.now();
    s.summary = args.summary;
    // Settle the root.
    const root = s.nodes[0];
    if (root) root.state = args.failed ? "error" : "done";
    // Drop the active node so the canvas stops pulsing.
    s.activeNodeId = undefined;

    // Append a summary terminal node so the timeline has a clean end.
    if (args.summary) {
      const sum: GraphNode = {
        id: nodeId("summary"),
        kind: "summary",
        label: "Summary",
        detail: args.summary,
        createdAt: Date.now(),
        state: args.failed ? "error" : "done",
      };
      s.nodes.push(sum);
      // Connect to the most recent non-root node, or root if nothing
      // else fired (e.g. a no-op turn).
      const tail = s.nodes
        .slice(0, -1)
        .reverse()
        .find((n) => n.kind !== "root");
      if (tail) {
        s.edges.push({
          id: edgeId(tail.id, sum.id),
          from: tail.id,
          to: sum.id,
          createdAt: Date.now(),
        });
      } else if (root) {
        s.edges.push({
          id: edgeId(root.id, sum.id),
          from: root.id,
          to: sum.id,
          createdAt: Date.now(),
        });
      }
    }
    emit();
  },

  /** Append a plan step from the Architect (or from agent.ts when it
   *  emits a textual plan beat). All plan nodes hang off the root. */
  addPlan(label: string, detail?: string): GraphNode | null {
    const s = getCurrentSession();
    if (!s) return null;
    const root = s.nodes[0];
    const node: GraphNode = {
      id: nodeId("plan"),
      kind: "plan",
      label,
      detail,
      createdAt: Date.now(),
      state: "done",
    };
    s.nodes.push(node);
    if (root) {
      s.edges.push({
        id: edgeId(root.id, node.id),
        from: root.id,
        to: node.id,
        createdAt: Date.now(),
      });
    }
    emit();
    return node;
  },

  /** Append a thought beat — Claude's inter-turn text content. */
  addThought(text: string): GraphNode | null {
    const s = getCurrentSession();
    if (!s) return null;
    const node: GraphNode = {
      id: nodeId("thought"),
      kind: "thought",
      label: text.slice(0, 56) + (text.length > 56 ? "…" : ""),
      detail: text,
      createdAt: Date.now(),
      state: "done",
    };
    const parent = s.activeNodeId ?? s.nodes[0]?.id;
    s.nodes.push(node);
    if (parent) {
      s.edges.push({
        id: edgeId(parent, node.id),
        from: parent,
        to: node.id,
        createdAt: Date.now(),
      });
    }
    emit();
    return node;
  },

  /** Mark the start of a tool call. Returns the node id so endTool
   *  can finalize state + duration. */
  startTool(args: {
    toolName: string;
    iter?: number;
    input?: Record<string, unknown>;
    simulated?: boolean;
  }): GraphNode | null {
    const s = getOrCreateSession();
    const node: GraphNode = {
      id: nodeId("tool"),
      kind: "tool",
      label: args.toolName,
      detail: args.input ? JSON.stringify(args.input).slice(0, 320) : undefined,
      createdAt: Date.now(),
      state: "running",
      toolName: args.toolName,
      iter: args.iter,
      meta: args.input,
      simulated: args.simulated,
    };
    const parent = s.activeNodeId ?? s.nodes[0]?.id;
    s.nodes.push(node);
    if (parent) {
      s.edges.push({
        id: edgeId(parent, node.id),
        from: parent,
        to: node.id,
        createdAt: Date.now(),
      });
    }
    s.activeNodeId = node.id;
    emit();
    return node;
  },

  /** Finalize a tool call. */
  endTool(args: {
    nodeId: string;
    ok: boolean;
    summary?: string;
    error?: string;
    durationMs?: number;
  }) {
    const s = getCurrentSession();
    if (!s) return;
    const node = s.nodes.find((n) => n.id === args.nodeId);
    if (!node) return;
    node.state = args.ok ? "done" : "error";
    node.durationMs = args.durationMs;
    if (args.summary) node.detail = args.summary;
    if (args.error) node.error = args.error;
    // Snap active back to the previous active so child file/error
    // nodes appended during the call stayed nested under the tool.
    if (s.activeNodeId === node.id) s.activeNodeId = undefined;
    emit();
  },

  /** A file-touch event — emitted by codegen.ts ops. Threads under the
   *  currently-active tool node when one exists, else hangs off the
   *  session root. */
  addFile(args: {
    op: FileOp;
    path: string;
    detail?: string;
    before?: string;
    after?: string;
  }): GraphNode | null {
    const s = getOrCreateSession();
    const baseLabel = args.path.split(/[\\/]/).slice(-2).join("/") || args.path;
    const beforeCap = capPayload(args.before);
    const afterCap = capPayload(args.after);
    const node: GraphNode = {
      id: nodeId("file"),
      kind: "file",
      label: baseLabel,
      detail: args.detail ?? `${args.op}: ${args.path}`,
      createdAt: Date.now(),
      state: "done",
      fileOp: args.op,
      filePath: args.path,
      before: beforeCap.text,
      after: afterCap.text,
      diffTruncated: beforeCap.truncated || afterCap.truncated,
    };
    const parent = s.activeNodeId ?? s.nodes[0]?.id;
    s.nodes.push(node);
    if (parent) {
      s.edges.push({
        id: edgeId(parent, node.id),
        from: parent,
        to: node.id,
        createdAt: Date.now(),
      });
    }
    emit();
    return node;
  },

  /** Replay scrubbing. -1 means live; otherwise show only events at
   *  index <= replayIndex within the current session's combined timeline. */
  setReplayIndex(idx: number) {
    state.replayIndex = idx;
    emit();
  },

  /** Switch the session being rendered. */
  setCurrentSession(sessionId: string | null) {
    state.currentSessionId = sessionId;
    state.replayIndex = -1;
    emit();
  },

  /** Drop everything. Used by the operator's "Clear" button. */
  clearAll() {
    state.sessions = [];
    state.currentSessionId = null;
    state.replayIndex = -1;
    emit();
  },
};

// ── id helpers ─────────────────────────────────────────────────────

let _seq = 0;
function nodeId(kind: string): string {
  _seq += 1;
  return `${kind}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}
function edgeId(from: string, to: string): string {
  _seq += 1;
  return `e_${from}_${to}_${_seq.toString(36)}`;
}
function sessionId(): string {
  _seq += 1;
  return `s_${Date.now().toString(36)}_${_seq.toString(36)}`;
}
