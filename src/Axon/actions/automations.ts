// ───────────────────────────────────────────────────────────────────
// Automations — session-scoped scheduled commands.
// Intentionally NOT persisted. Automations that survive reload would
// need a server-side scheduler; this layer gives the operator live
// session-scheduled commands the way the spec describes.
// Adding persistence later = one new backing store, no UI changes.
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

export const scheduleAutomationAction: AxonAction<
  { description: string; schedule: string; command: string; kind?: "recurring" | "reminder" },
  { id: string; intervalMs: number }
> = {
  name: "schedule_automation",
  description:
    "Schedule a recurring or one-off automation. `schedule` is a natural phrase like 'every 15 minutes', 'every hour', 'daily', 'in 3 minutes'. `command` is the natural-language instruction AXON will dispatch to itself at each fire.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Human-readable purpose." },
      schedule: { type: "string", description: "Cadence phrase." },
      command: { type: "string", description: "The command to run on each fire." },
      kind: { type: "string", enum: ["recurring", "reminder"] },
    },
    required: ["description", "schedule", "command"],
  },
  handler: async (input, ctx) => {
    const intervalMs = parseInterval(input.schedule);
    if (!intervalMs) {
      return {
        summary: `I did not recognize the schedule "${input.schedule}". Try "every 15 minutes", "hourly", "daily", or "in 3 minutes".`,
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
    if (r.kind === "reminder") clearTimeout(r._handle!);
    else clearInterval(r._handle!);
    live.delete(id);
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
    else clearInterval(r._handle!);
  }
  live.clear();
}

export function registerAutomationActions() {
  registerAction(scheduleAutomationAction);
  registerAction(listAutomationsAction);
  registerAction(cancelAutomationAction);
}
