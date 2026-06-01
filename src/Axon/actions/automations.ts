// ───────────────────────────────────────────────────────────────────
// Automations — scheduled commands that survive reloads.
//
// Two concepts in one store:
//   1. Recurring — setInterval, runs forever until cancelled.
//   2. Reminder  — setTimeout, runs once then self-deletes.
//
// Persistence: on every push / cancel we mirror a serializable record
// to localStorage (key `axon:automations:v1`). On mount, the provider
// calls `hydrateAutomations()` which restores both kinds:
//   · Recurring: restart the interval with the original cadence.
//   · Reminder : if the nextFire time is still in the future, schedule
//     with the remaining delay; otherwise drop the entry (a missed
//     reminder is better than a surprise fire 2 days late).
//
// The persisted shape never includes timer handles — those are recreated
// locally on each hydrate.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction, Automation } from "../types";
import { registerAction } from "./registry";

// Registry of live automations. Populated by the provider on first use.
const live: Map<string, Automation> = new Map();
let executor:
  | ((command: string, modality: "voice" | "text") => Promise<void>)
  | null = null;

export function _bindAutomationExecutor(
  exec: (command: string, modality: "voice" | "text") => Promise<void>
) {
  executor = exec;
  // Auto-hydrate the moment the executor wires up. If hydrate is called
  // before an executor exists, the restored fires would just no-op.
  hydrateAutomations();
}

// ─── persistence ──────────────────────────────────────────────────

const STORAGE_KEY = "axon:automations:v1";

type PersistedAutomation = Omit<Automation, "_handle">;

/** Write the live registry to localStorage. Called on every mutation. */
function persistAutomations() {
  if (typeof window === "undefined") return;
  try {
    const snapshot: PersistedAutomation[] = Array.from(live.values()).map(
      ({ _handle: _, ...rest }) => rest,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[AXON] automation persist failed:", err);
    }
  }
}

/** Rehydrate persisted automations. Safe to call multiple times — a
 *  guard + id-check prevents double-scheduling. Intended to be called
 *  from _bindAutomationExecutor once the executor is ready. */
let hydrated = false;
export function hydrateAutomations() {
  if (hydrated || typeof window === "undefined" || !executor) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedAutomation[];
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    // Collect on-next-open entries so we can fire them after the
    // main rehydrate loop finishes — that way the rest of the
    // automation registry is fully restored before we dispatch the
    // delayed commands (avoids race conditions with recurring fires
    // that should already be live).
    const onNextOpenQueue: PersistedAutomation[] = [];

    for (const rec of parsed) {
      if (!rec || live.has(rec.id)) continue;
      if (rec.kind === "on-next-open") {
        // Don't restore a timer — fire-once on this hydrate. We pull
        // the record out of localStorage *before* firing so reloading
        // mid-day can't re-deliver the same reminder.
        onNextOpenQueue.push(rec);
        continue;
      }
      if (rec.kind === "reminder") {
        // Skip reminders whose fire time has passed — we'd rather miss a
        // late fire than spam the operator on reload with a stack of
        // backlogged reminders.
        const delay = rec.nextFire - now;
        if (delay <= 0) continue;
        const fire = async () => {
          if (!executor) return;
          try {
            await executor(rec.command, "text");
          } catch (e) {
            console.warn("[AXON] automation fire failed:", e);
          }
          live.delete(rec.id);
          persistAutomations();
        };
        const handle = window.setTimeout(fire, delay);
        live.set(rec.id, { ...rec, _handle: handle });
      } else {
        // Recurring: restart the interval fresh. nextFire gets recomputed
        // from "now" so a long-offline app doesn't cause a burst catch-up.
        const fire = async () => {
          if (!executor) return;
          try {
            await executor(rec.command, "text");
          } catch (e) {
            console.warn("[AXON] automation fire failed:", e);
          }
        };
        const handle = window.setInterval(fire, rec.intervalMs);
        live.set(rec.id, {
          ...rec,
          nextFire: now + rec.intervalMs,
          _handle: handle,
        });
      }
    }
    // Re-persist to prune stale reminders that we just dropped.
    persistAutomations();

    // Fire any on-next-open entries now. Small delay so the panel /
    // route shell has a chance to mount before we open the panel and
    // dispatch the command. Each fire is guarded so one bad command
    // can't block the rest.
    if (onNextOpenQueue.length > 0) {
      window.setTimeout(async () => {
        for (const rec of onNextOpenQueue) {
          if (!executor) break;
          try {
            await executor(rec.command, "text");
          } catch (e) {
            console.warn("[AXON] on-next-open fire failed:", e);
          }
        }
      }, 1500);
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[AXON] automation hydrate failed:", err);
    }
  }
}

function parseInterval(spec: string): number | null {
  const s = spec.toLowerCase().trim();
  // Allowed forms: "every monday", "every hour", "every 15 minutes", "in 3 minutes"
  if (s === "daily" || s === "every day") return 24 * 60 * 60 * 1000;
  if (s === "hourly" || s === "every hour") return 60 * 60 * 1000;
  if (s === "weekly" || s.startsWith("every monday") || s.startsWith("every week")) return 7 * 24 * 60 * 60 * 1000;

  const m = s.match(/^(?:every|in)\s+(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days)$/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    const mult =
      unit.startsWith("sec") ? 1000 :
      unit.startsWith("min") ? 60 * 1000 :
      unit.startsWith("hour") ? 60 * 60 * 1000 :
      24 * 60 * 60 * 1000;
    return n * mult;
  }
  return null;
}

/**
 * Detect natural phrases that should map to the `on-next-open` kind —
 * "remind me when I open the app", "bring this up tomorrow morning",
 * "next time I'm here", etc.
 *
 * These reminders DON'T set a timer at schedule time. Instead they
 * persist and fire once on the next `hydrateAutomations()` call.
 * That makes them immune to the "app was closed when the timer fired"
 * failure mode that ordinary reminders have.
 *
 * We're loose with phrasing because the LLM picks the exact words,
 * and we'd rather over-match here than ask the user to learn syntax.
 */
function isOnNextOpenPhrase(spec: string): boolean {
  const s = spec.toLowerCase().trim();
  // Explicit forms first — cheapest checks.
  if (s === "on-next-open" || s === "next open" || s === "on next open") return true;
  if (s === "next session" || s === "next time" || s === "next launch") return true;
  // "when (I|you|he|she|they) open(s)? (the app)?"
  if (/^when\s+(i|you|he|she|they)\s+open(s)?(\s+the\s+app)?/.test(s)) return true;
  // "tomorrow morning", "tomorrow when I'm back" — anything starting
  // with "tomorrow" that doesn't pin a specific time we can parse.
  if (s.startsWith("tomorrow") && !/\d/.test(s)) return true;
  // Generic "when I am back / when I'm here".
  if (/^when\s+(i'?m|you'?re)\s+(back|here|in)/.test(s)) return true;
  return false;
}

export const scheduleAutomationAction: AxonAction<
  { description: string; schedule: string; command: string; kind?: "recurring" | "reminder" },
  { id: string; intervalMs: number }
> = {
  name: "schedule_automation",
  description:
    "Schedule a recurring or one-off automation, or pin a reminder for the next app launch.\n\n`schedule` accepts:\n  · cadences: 'every 15 minutes', 'every hour', 'daily', 'every monday'\n  · one-off delays: 'in 3 minutes', 'in 2 hours'\n  · on-next-open phrases: 'on next open', 'tomorrow morning', 'when I open the app', 'next session'\n\nFor on-next-open phrases the reminder is persisted with no timer and fires once on the next time the app launches — use this when the user says 'bring this up tomorrow' or 'remind me next time I'm here'. It survives app close and won't get pruned if the user sleeps past a wall-clock time.\n\n`command` is the natural-language instruction AXON will dispatch to itself at each fire.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Human-readable purpose." },
      schedule: { type: "string", description: "Cadence or open-trigger phrase." },
      command: { type: "string", description: "The command to run on each fire." },
      kind: {
        type: "string",
        enum: ["recurring", "reminder", "on-next-open"],
        description:
          "Force a specific kind. Optional — usually inferred from the schedule phrase.",
      },
    },
    required: ["description", "schedule", "command"],
  },
  handler: async (input, ctx) => {
    // ── on-next-open branch ────────────────────────────────────────
    // "bring this up tomorrow when I open the app", "next session",
    // "remind me when I'm back" — all collapse to the same shape:
    // persist a record with no timer; fire once on the next hydrate.
    const isOpenKind =
      input.kind === "on-next-open" || isOnNextOpenPhrase(input.schedule);

    if (isOpenKind) {
      const id = `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const record: Automation = {
        id,
        description: input.description,
        intervalMs: 0,
        command: input.command,
        // nextFire isn't meaningful here, but we set it to creation
        // time so list views can still sort/show "scheduled at".
        nextFire: Date.now(),
        createdAt: Date.now(),
        kind: "on-next-open",
        _handle: undefined,
      };
      live.set(id, record);
      persistAutomations();

      ctx.logActivity({
        actionName: "schedule_automation",
        params: input as Record<string, unknown>,
        summary: `Pinned reminder for next open: ${input.description}`,
        result: { id, intervalMs: 0 },
      });

      return {
        summary: `Pinned for next launch — "${input.description}". I'll bring it up the next time you open the app.`,
        data: { id, intervalMs: 0 },
      };
    }

    // ── ordinary (recurring / one-off reminder) branch ─────────────
    const intervalMs = parseInterval(input.schedule);
    if (!intervalMs) {
      return {
        summary: `I did not recognize the schedule "${input.schedule}". Try "every 15 minutes", "hourly", "daily", "in 3 minutes", or natural phrases like "on next open" / "tomorrow morning".`,
      };
    }

    const id = `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const kind = input.kind ?? (input.schedule.startsWith("in ") ? "reminder" : "recurring");

    const fire = async () => {
      if (!executor) return;
      try {
        await executor(input.command, "text");
      } catch (e) {
        console.warn("[AXON] automation fire failed:", e);
      }
      if (kind === "reminder") {
        live.delete(id);
        persistAutomations();
      }
    };

    const handle =
      kind === "reminder"
        ? window.setTimeout(fire, intervalMs)
        : window.setInterval(fire, intervalMs);

    const record: Automation = {
      id,
      description: input.description,
      intervalMs,
      command: input.command,
      nextFire: Date.now() + intervalMs,
      createdAt: Date.now(),
      kind,
      _handle: handle,
    };
    live.set(id, record);
    persistAutomations();

    ctx.logActivity({
      actionName: "schedule_automation",
      params: input as Record<string, unknown>,
      summary: `Scheduled ${kind} automation: ${input.description}`,
      result: { id, intervalMs },
    });

    return {
      summary: `Scheduled ${kind === "reminder" ? "reminder" : "automation"} — "${input.description}".`,
      data: { id, intervalMs },
    };
  },
};

export const listAutomationsAction: AxonAction<
  Record<string, never>,
  { automations: Omit<Automation, "_handle">[] }
> = {
  name: "list_automations",
  description: "List active session automations.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const list = Array.from(live.values()).map(({ _handle: _, ...rest }) => rest);
    const summary = list.length === 0 ? "No active automations." : `${list.length} active automation${list.length === 1 ? "" : "s"}.`;
    return { summary, data: { automations: list } };
  },
};

export const cancelAutomationAction: AxonAction<
  { id: string },
  { cancelled: boolean }
> = {
  name: "cancel_automation",
  description: "Cancel a scheduled automation by id.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  handler: async ({ id }, ctx) => {
    const r = live.get(id);
    if (!r) return { summary: `No automation with id ${id}.`, data: { cancelled: false } };
    // on-next-open records carry no timer — just drop them.
    if (r.kind === "reminder") clearTimeout(r._handle!);
    else if (r.kind === "recurring") clearInterval(r._handle!);
    live.delete(id);
    persistAutomations();
    ctx.logActivity({
      actionName: "cancel_automation",
      params: { id },
      summary: `Cancelled automation ${id}`,
    });
    return { summary: `Automation cancelled.`, data: { cancelled: true } };
  },
};

export function _getLiveAutomations(): Automation[] {
  return Array.from(live.values());
}

export function _cancelAllAutomations() {
  for (const r of live.values()) {
    if (r.kind === "reminder") clearTimeout(r._handle!);
    else if (r.kind === "recurring") clearInterval(r._handle!);
    // on-next-open carries no handle.
  }
  live.clear();
  persistAutomations();
}

export function registerAutomationActions() {
  registerAction(scheduleAutomationAction);
  registerAction(listAutomationsAction);
  registerAction(cancelAutomationAction);
}
