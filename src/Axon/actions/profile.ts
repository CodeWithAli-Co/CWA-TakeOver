// ───────────────────────────────────────────────────────────────────
// Operator profile actions -- the "Axon knows you" surface.
//
// Lets the operator teach Axon structured facts about themselves
// through natural language ("remember my wife's name is Sarah", "I
// usually take lunch at 1pm", "I'm focused on closing the seed
// round"). Distinct from the freeform `remember_note` because each
// profile field has KNOWN SEMANTICS the preamble logic uses to
// surface it at the right moment.
//
// Pairs with engine/profilePreamble.ts -- this module captures facts,
// that module decides when to inject them.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  loadMemory,
  saveMemory,
  setProfileField,
  setProfileExtra,
  clearProfileField,
  type OperatorProfile,
} from "../engine/memory";

// Known field names. Keeping this in sync with the OperatorProfile
// interface so the action's enum validation matches the storage shape.
const KNOWN_FIELDS = [
  "partner_name",
  "family",
  "location",
  "timezone",
  "workday_start",
  "workday_end",
  "lunch_time",
  "focus_block",
  "exercise",
  "comm_style",
  "current_focus",
] as const;

type KnownField = (typeof KNOWN_FIELDS)[number];

// Fields that store ARRAYS rather than strings. The set_profile
// action splits comma-separated input into arrays for these.
const ARRAY_FIELDS = ["avoid_topics", "stressors", "wins"] as const;
type ArrayField = (typeof ARRAY_FIELDS)[number];

// All settable field names (known string fields + array fields).
const ALL_FIELDS = [...KNOWN_FIELDS, ...ARRAY_FIELDS] as const;

// ── set_profile ────────────────────────────────────────────────────
//
// Operator: "Remember my wife's name is Sarah" → set_profile({ field:
// "partner_name", value: "Sarah" }). For array-type fields, the
// operator's value can be either a single item or a comma-separated
// list -- the action splits on commas.

export const setProfileAction: AxonAction<
  { field: string; value: string },
  { ok: boolean; field: string }
> = {
  name: "set_profile",
  description:
    "Save a structured fact about the operator that survives across sessions. Use for known personal/routine fields like partner_name, family, lunch_time, workday_start, current_focus, comm_style, etc. Distinct from remember_note because these fields have known semantics that surface at relevant moments (lunch_time only near lunch, partner_name only in personal conversations). Use for: 'remember my wife's name is X', 'I usually start work at Y', 'I'm focused on Z this quarter', 'avoid bringing up A'.",
  input_schema: {
    type: "object",
    properties: {
      field: {
        type: "string",
        description:
          "The field name. One of: partner_name, family, location, timezone, workday_start, workday_end, lunch_time, focus_block, exercise, comm_style, current_focus, avoid_topics, stressors, wins. If none of these fits, use set_profile_extra instead.",
        enum: ALL_FIELDS as readonly string[] as string[],
      },
      value: {
        type: "string",
        description:
          "The value to store. For array fields (avoid_topics, stressors, wins), comma-separate multiple values: 'crypto, NFTs, web3'.",
      },
    },
    required: ["field", "value"],
  },
  mutating: true,
  handler: async ({ field, value }, ctx) => {
    const f = field as keyof OperatorProfile;
    const m = loadMemory();
    let next;
    if ((ARRAY_FIELDS as readonly string[]).includes(field)) {
      // Comma-split for array fields. Trim + drop empties so "x, y, "
      // doesn't yield ["x", "y", ""].
      const items = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      next = setProfileField(m, f, items as never);
    } else {
      next = setProfileField(m, f, value.trim() as never);
    }
    saveMemory(next);
    ctx.logActivity({
      actionName: "set_profile",
      params: { field, value },
      summary: `Profile.${field} = ${value.slice(0, 80)}`,
    });
    return {
      summary: `Got it. ${field}: ${value}.`,
      data: { ok: true, field },
    };
  },
};

// ── set_profile_extra ──────────────────────────────────────────────
//
// Escape hatch for facts that don't fit a known field. Stored under
// profile.extras and only surfaced when the operator explicitly asks
// "what do you know about me" -- not in the contextual preamble.

export const setProfileExtraAction: AxonAction<
  { key: string; value: string },
  { ok: boolean }
> = {
  name: "set_profile_extra",
  description:
    "Save an ad-hoc fact about the operator that doesn't fit one of the standard profile fields. Use when the operator wants something remembered that isn't partner/family/routine/style. Examples: 'remember I'm allergic to peanuts', 'I drive a 2018 Civic', 'my dog's name is Mochi'. Stored separately from the contextual fields so it doesn't get injected into every conversation.",
  input_schema: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Short snake_case key for the fact -- 'allergy', 'dog_name', etc.",
      },
      value: { type: "string", description: "The fact value." },
    },
    required: ["key", "value"],
  },
  mutating: true,
  handler: async ({ key, value }, ctx) => {
    const m = loadMemory();
    const next = setProfileExtra(m, key, value);
    saveMemory(next);
    ctx.logActivity({
      actionName: "set_profile_extra",
      params: { key, value },
      summary: `Profile extra: ${key} = ${value.slice(0, 80)}`,
    });
    return {
      summary: `Saved. I'll remember ${key}: ${value}.`,
      data: { ok: true },
    };
  },
};

// ── clear_profile ──────────────────────────────────────────────────
//
// Operator: "forget my workday start time" / "drop the lunch time".

export const clearProfileAction: AxonAction<
  { field: string },
  { ok: boolean }
> = {
  name: "clear_profile",
  description:
    "Remove a profile field so it stops getting surfaced. Use when the operator says 'forget X', 'drop my Y', 'I don't want you remembering Z'. For ad-hoc extras (set via set_profile_extra), use forget_specific instead.",
  input_schema: {
    type: "object",
    properties: {
      field: {
        type: "string",
        description: "Profile field name to clear.",
        enum: ALL_FIELDS as readonly string[] as string[],
      },
    },
    required: ["field"],
  },
  mutating: true,
  handler: async ({ field }, ctx) => {
    const f = field as keyof OperatorProfile;
    const m = loadMemory();
    const next = clearProfileField(m, f);
    saveMemory(next);
    ctx.logActivity({
      actionName: "clear_profile",
      params: { field },
      summary: `Cleared profile.${field}`,
    });
    return {
      summary: `Cleared ${field} from your profile.`,
      data: { ok: true },
    };
  },
};

// ── show_profile ───────────────────────────────────────────────────
//
// Operator: "what do you know about me?" Returns a complete readout.
// Different from `list_memory` which covers notes/decisions/defers --
// this is specifically the profile.

export const showProfileAction: AxonAction<
  Record<string, never>,
  { profile: OperatorProfile; filled_count: number }
> = {
  name: "show_profile",
  description:
    "Return everything Axon knows about the operator as a structured profile. Use when the operator asks 'what do you know about me', 'what's in my profile', 'show me what you remember about me personally'.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, _ctx) => {
    const m = loadMemory();
    const p = m.profile;
    const entries: string[] = [];

    // Walk in display order: identity → routine → style → goals → extras.
    if (p.partner_name) entries.push(`Partner: ${p.partner_name}`);
    if (p.family) entries.push(`Family: ${p.family}`);
    if (p.location) entries.push(`Location: ${p.location}`);
    if (p.timezone) entries.push(`Timezone: ${p.timezone}`);
    if (p.workday_start) entries.push(`Workday start: ${p.workday_start}`);
    if (p.workday_end) entries.push(`Workday end: ${p.workday_end}`);
    if (p.lunch_time) entries.push(`Lunch: ${p.lunch_time}`);
    if (p.focus_block) entries.push(`Focus block: ${p.focus_block}`);
    if (p.exercise) entries.push(`Exercise: ${p.exercise}`);
    if (p.comm_style) entries.push(`Comm style: ${p.comm_style}`);
    if (p.avoid_topics?.length) entries.push(`Avoid: ${p.avoid_topics.join(", ")}`);
    if (p.current_focus) entries.push(`Current focus: ${p.current_focus}`);
    if (p.stressors?.length) entries.push(`Stressors: ${p.stressors.join("; ")}`);
    if (p.wins?.length) entries.push(`Wins: ${p.wins.join("; ")}`);
    if (p.extras) {
      for (const [k, v] of Object.entries(p.extras)) {
        entries.push(`${k}: ${v}`);
      }
    }

    if (entries.length === 0) {
      return {
        summary:
          "Nothing in the structured profile yet. Tell me things like 'remember my wife's name is Sarah' or 'I usually take lunch at 1', and I'll save them.",
        data: { profile: p, filled_count: 0 },
      };
    }

    return {
      summary: `Here's what I know about you: ${entries.join(" -- ")}.`,
      data: { profile: p, filled_count: entries.length },
    };
  },
};

export function registerProfileActions() {
  registerAction(setProfileAction);
  registerAction(setProfileExtraAction);
  registerAction(clearProfileAction);
  registerAction(showProfileAction);
}
