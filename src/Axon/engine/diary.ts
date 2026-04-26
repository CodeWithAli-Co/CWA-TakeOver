// ───────────────────────────────────────────────────────────────────
// Axon Diary — per-session markdown reflections.
//
// Every time a session ends (axonGraph.endSession lands), we write
// a reflection file to:
//
//   <activeProject>/docs/diary/YYYY-MM-DD/HH-MM-SS-<slug>.md
//
// The file captures: goal, kind (conversation / agent / ensemble),
// duration, files touched (with op), tools called, errors, vision
// notes that fired during the run, and the final summary.
//
// Why a daily folder + timestamped filename?
//   • Multiple sessions in a day stay grouped.
//   • Lex-sorting filenames inside the day folder gives chronological
//     order for free.
//   • Slug pulled from the goal makes the filename actually readable.
//
// This is the foundation of Axon's long-term memory. Future T-task:
// Improvement Loop reads recent diary entries to feed the Critic
// and Architect with "lessons learned" context.
// ───────────────────────────────────────────────────────────────────

import { axonGraph, type GraphSession, type GraphNode } from "./graphStore";

let _activeProjectPath: () => string | null = () => null;
let _enabled = false;

// Track which sessions we've already serialized so re-emits of the
// same endSession don't double-write.
const _written = new Set<string>();

export interface ConfigureDiaryOpts {
  activeProjectPath?: () => string | null;
  enabled?: boolean;
}

export function configureDiary(opts: ConfigureDiaryOpts): void {
  if (opts.activeProjectPath) _activeProjectPath = opts.activeProjectPath;
  if (typeof opts.enabled === "boolean") _enabled = opts.enabled;
}

let _unsubscribe: (() => void) | null = null;

/** Start observing the graph store. Idempotent. */
export function startDiary(): void {
  if (_unsubscribe) return;
  let lastSnapshot = axonGraph.getState();
  _unsubscribe = axonGraph.subscribe(() => {
    const next = axonGraph.getState();
    // Diff: any session that JUST got an endedAt this tick → write it.
    for (const s of next.sessions) {
      if (!s.endedAt) continue;
      if (_written.has(s.id)) continue;
      // Confirm it's a fresh ending (wasn't ended in lastSnapshot).
      const prev = lastSnapshot.sessions.find((p) => p.id === s.id);
      if (prev?.endedAt) {
        // Already had endedAt previously — skip (e.g. snapshot churn).
        _written.add(s.id);
        continue;
      }
      _written.add(s.id);
      void writeDiaryEntry(s);
    }
    lastSnapshot = next;
  });
}

export function stopDiary(): void {
  if (_unsubscribe) {
    try { _unsubscribe(); } catch { /* noop */ }
    _unsubscribe = null;
  }
}

// ── Serialization ──────────────────────────────────────────────────

function slugify(s: string): string {
  return (s || "session")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-")
    .slice(0, 60) || "session";
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function fmtDayFolder(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${pad(sec)}s`;
}

interface FileTouch {
  op: string;
  path: string;
  durationMs?: number;
}

function summarize(s: GraphSession): {
  files: FileTouch[];
  tools: GraphNode[];
  visions: GraphNode[];
  errors: GraphNode[];
  thoughts: GraphNode[];
  critique: GraphNode | undefined;
} {
  const files: FileTouch[] = [];
  const tools: GraphNode[] = [];
  const visions: GraphNode[] = [];
  const errors: GraphNode[] = [];
  const thoughts: GraphNode[] = [];
  let critique: GraphNode | undefined;
  for (const n of s.nodes) {
    if (n.kind === "file" && n.fileOp && n.filePath) {
      files.push({ op: n.fileOp, path: n.filePath, durationMs: n.durationMs });
    } else if (n.kind === "tool") {
      tools.push(n);
    } else if (n.kind === "vision") {
      visions.push(n);
    } else if (n.kind === "error" || n.state === "error") {
      errors.push(n);
    } else if (n.kind === "thought") {
      thoughts.push(n);
    } else if (n.kind === "critique") {
      critique = n;
    }
  }
  return { files, tools, visions, errors, thoughts, critique };
}

function buildMarkdown(s: GraphSession): string {
  const ended = s.endedAt ?? Date.now();
  const duration = s.startedAt ? ended - s.startedAt : 0;
  const sum = summarize(s);
  const isEnsemble = s.prompt?.startsWith("[ensemble]") ?? false;

  const lines: string[] = [];
  lines.push(`# Axon Session — ${new Date(s.startedAt).toLocaleString()}`);
  lines.push("");
  lines.push(`**Kind:** ${s.kind}${isEnsemble ? " (ensemble)" : ""}`);
  lines.push(`**Duration:** ${fmtDuration(duration)}`);
  lines.push(
    `**Status:** ${s.nodes[0]?.state === "error" ? "❌ failed" : "✅ done"}`,
  );
  lines.push("");

  // Goal / prompt
  const goal = (s.prompt ?? "").replace(/^\[ensemble\]\s*/, "");
  lines.push("## Goal");
  lines.push("");
  lines.push(goal || "_(no prompt recorded)_");
  lines.push("");

  // Final summary
  if (s.summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(s.summary);
    lines.push("");
  }

  // Critic verdict (ensemble only)
  if (sum.critique) {
    lines.push("## Critic verdict");
    lines.push("");
    lines.push("```");
    lines.push(sum.critique.detail ?? sum.critique.label);
    lines.push("```");
    lines.push("");
  }

  // Files touched
  if (sum.files.length > 0) {
    lines.push("## Files touched");
    lines.push("");
    for (const f of sum.files) {
      const dur = f.durationMs ? ` _(${fmtDuration(f.durationMs)})_` : "";
      lines.push(`- \`${f.op.toUpperCase()}\` \`${f.path}\`${dur}`);
    }
    lines.push("");
  }

  // Tools
  if (sum.tools.length > 0) {
    lines.push("## Tools called");
    lines.push("");
    for (const t of sum.tools) {
      const tag = t.state === "error" ? "❌" : "✓";
      const detail = t.detail ? ` — ${t.detail.slice(0, 120)}` : "";
      lines.push(`- ${tag} \`${t.toolName ?? t.label}\`${detail}`);
    }
    lines.push("");
  }

  // Vision notes
  if (sum.visions.length > 0) {
    lines.push("## Vision notes");
    lines.push("");
    for (const v of sum.visions) {
      const when = new Date(v.createdAt).toLocaleTimeString();
      lines.push(`- _${when}_ — ${v.detail ?? v.label}`);
    }
    lines.push("");
  }

  // Errors
  if (sum.errors.length > 0) {
    lines.push("## Blockers / errors");
    lines.push("");
    for (const e of sum.errors) {
      lines.push(`- ${e.error ?? e.detail ?? e.label}`);
    }
    lines.push("");
  }

  // Inner monologue (thoughts) — last 8, skip "📝 Edited externally" beats
  const speakable = sum.thoughts
    .filter((t) => !(t.label || "").startsWith("📝 "))
    .slice(-8);
  if (speakable.length > 0) {
    lines.push("## Reasoning beats");
    lines.push("");
    for (const t of speakable) {
      lines.push(`> ${t.detail ?? t.label}`);
      lines.push("");
    }
  }

  // External activity (FS watcher beats during this session)
  const external = sum.thoughts.filter((t) =>
    (t.label || "").startsWith("📝 "),
  );
  if (external.length > 0) {
    lines.push("## External edits during session");
    lines.push("");
    for (const t of external) lines.push(`- ${t.label}`);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(
    `_Generated by Axon Diary · session id ${s.id} · ${sum.files.length} files / ${sum.tools.length} tools / ${sum.visions.length} vision notes_`,
  );
  return lines.join("\n");
}

// ── File write ─────────────────────────────────────────────────────

async function writeDiaryEntry(s: GraphSession): Promise<void> {
  if (!_enabled) return;
  const root = _activeProjectPath();
  if (!root) return;

  // Don't bother writing diaries for empty sessions (just a root and
  // no real activity).
  if (s.nodes.length <= 1) return;

  const dayFolder = fmtDayFolder(s.startedAt);
  const clock = fmtClock(s.startedAt);
  const goal = (s.prompt ?? "").replace(/^\[ensemble\]\s*/, "");
  const slug = slugify(goal);
  const filename = `${clock}-${slug}.md`;
  // Forward slashes — Tauri's fs plugin normalizes both ways but FS
  // joins are simpler with this convention.
  const dirPath = `${root.replace(/\\/g, "/")}/docs/diary/${dayFolder}`;
  const filePath = `${dirPath}/${filename}`;
  const md = buildMarkdown(s);

  let mkdir: any;
  let writeTextFile: any;
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
    mkdir = (mod as any).mkdir ?? (mod as any).createDir;
    writeTextFile = (mod as any).writeTextFile;
  } catch {
    return;
  }
  if (!mkdir || !writeTextFile) return;

  try {
    await mkdir(dirPath, { recursive: true });
  } catch {
    /* directory may already exist; writeTextFile will tell us if not */
  }
  try {
    await writeTextFile(filePath, md);
    // Surface the write as a thought so the operator sees it landed.
    axonGraph.addThought(`📔 Diary: docs/diary/${dayFolder}/${filename}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[AXON diary] failed to write entry:", e);
  }
}

// Test-only export so a smoke test can write without waiting for a
// real session to finish.
export async function _writeDiaryForTesting(s: GraphSession): Promise<void> {
  await writeDiaryEntry(s);
}
