// ───────────────────────────────────────────────────────────────────
// Memory actions — let AXON read/write to the persistent store via
// tool use. "Remember that I prefer tasks due Friday" → write pref.
//
// The READ side (recall / recap / forget_specific / list_memory) was
// added in Polish D after we noticed operators could write to memory
// but had no first-class way to query it -- everything depended on
// Claude pulling from the preamble at the right moment. Now operators
// can ask "what do you remember about Cesar" and get a direct answer.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  addNote,
  loadMemory,
  saveMemory,
  setPref,
  type PersistentMemory,
} from "../engine/memory";

export const rememberNoteAction: AxonAction<
  { text: string; kind?: "topic" | "preference" | "note" },
  { saved: boolean }
> = {
  name: "remember_note",
  description:
    "Persist a short note that AXON will recall in future sessions. Use for ongoing topics (e.g., 'we're planning the Q2 roadmap') or small observations that should survive reload. Keep notes under 240 characters. Do NOT persist sensitive data.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The note content." },
      kind: { type: "string", enum: ["topic", "preference", "note"] },
    },
    required: ["text"],
  },
  handler: async ({ text, kind = "note" }, ctx) => {
    const m = loadMemory();
    const next = addNote(m, kind, text);
    saveMemory(next);
    ctx.logActivity({
      actionName: "remember_note",
      params: { text, kind },
      summary: `Saved ${kind}: ${text.slice(0, 60)}`,
    });
    return { summary: "Got it. I'll remember that.", data: { saved: true } };
  },
};

export const setPreferenceAction: AxonAction<
  { key: string; value: string },
  { saved: boolean }
> = {
  name: "set_preference",
  description:
    "Save a key-value preference that survives reload. Example: set_preference({ key: 'default_task_deadline', value: 'end of week' }).",
  input_schema: {
    type: "object",
    properties: {
      key: { type: "string" },
      value: { type: "string" },
    },
    required: ["key", "value"],
  },
  handler: async ({ key, value }, ctx) => {
    const m = loadMemory();
    const next = setPref(m, key, value);
    saveMemory(next);
    ctx.logActivity({
      actionName: "set_preference",
      params: { key, value },
      summary: `Saved preference ${key}`,
    });
    return { summary: `Saved. ${key} is now ${value}.`, data: { saved: true } };
  },
};

export const forgetAllAction: AxonAction<
  Record<string, never>,
  { cleared: boolean }
> = {
  name: "forget_all_memory",
  description:
    "Clear ALL persistent memory — notes and preferences. Destructive; the system will confirm first.",
  input_schema: { type: "object", properties: {} },
  mutating: true,
  requiresConfirmation: true,
  handler: async (_input, ctx) => {
    const ok = await ctx.requestConfirmation("Wipe all of AXON's persistent memory?");
    if (!ok) return { summary: "Cancelled.", data: { cleared: false } };
    saveMemory({
      notes: [],
      lastSeen: Date.now(),
      prefs: {},
      sessionSummaries: [],
      decisions: [],
      defers: [],
    });
    ctx.logActivity({
      actionName: "forget_all_memory",
      params: {},
      summary: "Cleared persistent memory",
      confirmed: true,
    });
    return { summary: "Memory wiped.", data: { cleared: true } };
  },
};

// ═══════════════════════════════════════════════════════════════════
// READ-SIDE ACTIONS
// ═══════════════════════════════════════════════════════════════════

/** Tokenize a query into normalized words for substring + fuzzy match. */
function queryTokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3); // drop "of", "to", etc.
}

/** Test whether a memory text matches the query. AND across tokens
 *  (every query word must appear), substring-OK. Tight enough that
 *  "Cesar" doesn't match "ceseariot wines" but loose enough that
 *  "cesar pipeline" matches "Cesar Sosa Santos pipeline situation". */
function matchesQuery(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = text.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

/** Search all memory channels for entries that match the query.
 *  Returns hits in {kind, text, ts} shape so the caller doesn't have
 *  to discriminate per source. Sorted newest-first. */
interface RecallHit {
  kind: "note" | "decision" | "defer" | "preference" | "session";
  text: string;
  ts: number;
}

function searchMemory(m: PersistentMemory, query: string): RecallHit[] {
  const tokens = queryTokens(query);
  const hits: RecallHit[] = [];
  for (const n of m.notes)
    if (matchesQuery(n.text, tokens)) hits.push({ kind: "note", text: n.text, ts: n.ts });
  for (const d of m.decisions)
    if (matchesQuery(d.text, tokens)) hits.push({ kind: "decision", text: d.text, ts: d.ts });
  for (const f of m.defers)
    if (matchesQuery(f.text, tokens)) hits.push({ kind: "defer", text: f.text, ts: f.ts });
  for (const [k, v] of Object.entries(m.prefs))
    if (matchesQuery(`${k} ${v}`, tokens))
      hits.push({ kind: "preference", text: `${k}: ${v}`, ts: 0 });
  for (const s of m.sessionSummaries)
    if (matchesQuery(s.summary, tokens))
      hits.push({ kind: "session", text: s.summary, ts: s.ts });
  // Newest first. Preferences (ts=0) sort last, which is fine -- they
  // never feel "stale" the way a 2-week-old note might.
  hits.sort((a, b) => b.ts - a.ts);
  return hits;
}

function humanizeAgo(ms: number): string {
  if (ms <= 0) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── recall ─────────────────────────────────────────────────────────
//
// Operator: "What do you remember about Cesar?" / "What did we decide
// about the pricing model?" / "Did I save anything about Blaze?"
//
// Searches every memory channel for the query, returns a spoken
// summary of the top matches. Returns gracefully when nothing matches
// rather than fabricating context.

export const recallAction: AxonAction<
  { query: string },
  { hits: RecallHit[] }
> = {
  name: "recall",
  description:
    "Search persistent memory for anything matching a query and return what you find. Use when the operator asks 'what do you remember about X', 'what did we decide about Y', 'did I save anything about Z', 'recall my notes on...', or similar query-style memory lookups. Returns the actual stored text -- don't invent details that aren't in the hits.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "What to search for. Usually a person's name, a project, a topic, or a specific concept the operator referenced.",
      },
    },
    required: ["query"],
  },
  handler: async ({ query }, _ctx) => {
    const m = loadMemory();
    const hits = searchMemory(m, query).slice(0, 5);

    if (hits.length === 0) {
      return {
        summary: `Nothing in memory matches "${query}". Either we haven't talked about it, or it aged out.`,
        data: { hits: [] },
      };
    }

    const now = Date.now();
    const lines = hits.map((h) => {
      const tag =
        h.kind === "decision" ? "Decision" :
        h.kind === "defer" ? "Deferred" :
        h.kind === "preference" ? "Preference" :
        h.kind === "session" ? "Session recap" :
        "Note";
      const when = h.ts ? `, ${humanizeAgo(now - h.ts)}` : "";
      return `${tag}${when}: ${h.text}`;
    });

    const head =
      hits.length === 1
        ? `One thing on "${query}".`
        : `${hits.length} things on "${query}".`;
    return {
      summary: `${head} ${lines.join(" -- ")}`,
      data: { hits },
    };
  },
};

// ── recap ──────────────────────────────────────────────────────────
//
// Operator: "What were we just talking about?" / "Where were we?" /
// "Bring me back up to speed."
//
// Different from recall -- recap doesn't take a query, it surfaces the
// most recent material across every channel so the operator can re-orient
// after a context switch (came back from lunch, opened the app fresh,
// got pulled into a different page).

export const recapAction: AxonAction<
  Record<string, never>,
  { items: RecallHit[] }
> = {
  name: "recap",
  description:
    "Briefly remind the operator what they were working on. Use when the operator asks 'what were we just talking about', 'where were we', 'bring me back up to speed', 'remind me what I was doing', or returns to the app after a break. Returns the most recent decisions, defers, and notes -- not a full session reconstruction.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, _ctx) => {
    const m = loadMemory();
    // Pull the most recent 2 of each channel that has anything, but
    // cap the total at 5 -- a recap is supposed to be a short jog, not
    // a debrief.
    const items: RecallHit[] = [];
    for (const d of m.decisions.slice(-2))
      items.push({ kind: "decision", text: d.text, ts: d.ts });
    for (const f of m.defers.slice(-2))
      items.push({ kind: "defer", text: f.text, ts: f.ts });
    for (const n of m.notes.slice(-2))
      items.push({ kind: "note", text: n.text, ts: n.ts });
    items.sort((a, b) => b.ts - a.ts);
    const trimmed = items.slice(0, 5);

    if (trimmed.length === 0) {
      // No memory channels populated. Fall back to a friendly "we
      // haven't gotten into anything yet" so Axon doesn't go blank.
      return {
        summary:
          "Nothing logged yet -- we haven't recorded any decisions or notes I can recap from. What were you working on?",
        data: { items: [] },
      };
    }

    const now = Date.now();
    const lines = trimmed.map((h) => {
      const tag =
        h.kind === "decision" ? "Decision" :
        h.kind === "defer" ? "Deferred" :
        "Note";
      return `${tag} ${humanizeAgo(now - h.ts)}: ${h.text}`;
    });
    return {
      summary: `Recent surface: ${lines.join(" -- ")}.`,
      data: { items: trimmed },
    };
  },
};

// ── forget_specific ────────────────────────────────────────────────
//
// Operator: "Forget that note about Cesar." / "Drop the decision about
// the Friday ship date." / "Clear what I said about Blaze."
//
// Surgical version of forget_all. Searches for matches via the same
// query path as recall, removes them, reports how many it killed.

export const forgetSpecificAction: AxonAction<
  { query: string },
  { removed: number }
> = {
  name: "forget_specific",
  description:
    "Remove a specific note, decision, defer, or preference from memory. Use when the operator says 'forget that note about X', 'drop the decision about Y', 'clear what I saved about Z'. Searches every channel and deletes matches. Does NOT require confirmation -- the operator already asked.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to find and delete. Same syntax as `recall`.",
      },
    },
    required: ["query"],
  },
  mutating: true,
  handler: async ({ query }, ctx) => {
    const tokens = queryTokens(query);
    const m = loadMemory();

    const keepNotes = m.notes.filter((n) => !matchesQuery(n.text, tokens));
    const keepDecisions = m.decisions.filter(
      (d) => !matchesQuery(d.text, tokens),
    );
    const keepDefers = m.defers.filter((d) => !matchesQuery(d.text, tokens));
    const keepPrefs = Object.fromEntries(
      Object.entries(m.prefs).filter(
        ([k, v]) => !matchesQuery(`${k} ${v}`, tokens),
      ),
    );

    const removed =
      (m.notes.length - keepNotes.length) +
      (m.decisions.length - keepDecisions.length) +
      (m.defers.length - keepDefers.length) +
      (Object.keys(m.prefs).length - Object.keys(keepPrefs).length);

    if (removed === 0) {
      return {
        summary: `Nothing in memory matches "${query}", so there's nothing to forget.`,
        data: { removed: 0 },
      };
    }

    saveMemory({
      ...m,
      notes: keepNotes,
      decisions: keepDecisions,
      defers: keepDefers,
      prefs: keepPrefs,
    });
    ctx.logActivity({
      actionName: "forget_specific",
      params: { query },
      summary: `Forgot ${removed} memory entr${removed === 1 ? "y" : "ies"} matching "${query}"`,
    });
    return {
      summary: `Forgotten. ${removed} entr${removed === 1 ? "y" : "ies"} cleared.`,
      data: { removed },
    };
  },
};

// ── list_memory ────────────────────────────────────────────────────
//
// Operator: "What do you remember?" / "Show me my notes." /
// "Run through what's in memory."
//
// Catalog view. Doesn't take a query -- just summarizes counts by
// channel and surfaces the 3 newest items overall.

export const listMemoryAction: AxonAction<
  Record<string, never>,
  { counts: Record<string, number> }
> = {
  name: "list_memory",
  description:
    "Summarize what's in persistent memory: count by channel + the 3 most recent items. Use when the operator asks 'what do you remember', 'show me my notes', 'what's in memory', or wants a quick catalog without a specific query.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, _ctx) => {
    const m = loadMemory();
    const counts = {
      notes: m.notes.length,
      decisions: m.decisions.length,
      defers: m.defers.length,
      preferences: Object.keys(m.prefs).length,
      sessions: m.sessionSummaries.length,
    };
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    if (total === 0) {
      return {
        summary: "Memory is empty. We haven't saved any notes, decisions, or preferences yet.",
        data: { counts },
      };
    }

    // Surface the 3 newest items across notes / decisions / defers so
    // the operator gets a flavor of what's stored, not just counts.
    const recent: RecallHit[] = [
      ...m.notes.map((n) => ({ kind: "note" as const, text: n.text, ts: n.ts })),
      ...m.decisions.map((d) => ({ kind: "decision" as const, text: d.text, ts: d.ts })),
      ...m.defers.map((f) => ({ kind: "defer" as const, text: f.text, ts: f.ts })),
    ]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3);

    const parts: string[] = [];
    parts.push(
      `${total} item${total === 1 ? "" : "s"} in memory -- ${counts.notes} note${counts.notes === 1 ? "" : "s"}, ${counts.decisions} decision${counts.decisions === 1 ? "" : "s"}, ${counts.defers} deferred, ${counts.preferences} preference${counts.preferences === 1 ? "" : "s"}.`,
    );
    if (recent.length > 0) {
      const now = Date.now();
      const recentLine = recent
        .map(
          (h) =>
            `${h.kind === "decision" ? "Decision" : h.kind === "defer" ? "Deferred" : "Note"} ${humanizeAgo(now - h.ts)}: ${h.text}`,
        )
        .join(" -- ");
      parts.push(`Most recent: ${recentLine}.`);
    }
    return {
      summary: parts.join(" "),
      data: { counts },
    };
  },
};

export function registerMemoryActions() {
  registerAction(rememberNoteAction);
  registerAction(setPreferenceAction);
  registerAction(forgetAllAction);
  // Read-side actions (Polish D).
  registerAction(recallAction);
  registerAction(recapAction);
  registerAction(forgetSpecificAction);
  registerAction(listMemoryAction);
}
