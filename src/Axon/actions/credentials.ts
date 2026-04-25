// ───────────────────────────────────────────────────────────────────
// Credential-management actions.
//
// `set_credential` and `forget_credential` give the operator a voice
// path to register / revoke webhook URLs and API tokens. Used by every
// outbound integration (T7.1-T7.6) to look up where to send / what to
// authenticate with.
//
// Sensitive in nature, so:
//   · `set_credential` is mutating + requires confirmation
//   · `forget_credential` is mutating + requires confirmation
//   · The audit log captures only the key, never the value
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  getCredential,
  setCredential,
  forgetCredential,
  listCredentials,
} from "../engine/credentials";
import { registerUndoHandler } from "../engine/undoStack";

// ─── Undo handler — restores a forgotten credential by replaying the
//     previously-stored value. Useful for "undo that" after an
//     accidental forget_credential.

registerUndoHandler<{
  key: string;
  value: string;
  note?: string;
}>("credential.restore", async ({ key, value, note }) => {
  setCredential(key, value, note);
  return `Restored credential "${key}".`;
});

// ─── set_credential ──────────────────────────────────────────────

export const setCredentialAction: AxonAction<
  { key: string; value: string; note?: string },
  { key: string; updated: boolean }
> = {
  name: "set_credential",
  description:
    "Register a credential (webhook URL, API token, secret) under a named key for AXON's outbound integrations. Convention: '<kind>:<label>' e.g. 'discord:announcements', 'github:pat', 'webhook:zapier-tasks'. Destructive — confirms before overwriting an existing key.",
  input_schema: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description:
          "Namespaced identifier. Convention is '<kind>:<label>' (e.g. 'discord:announcements').",
      },
      value: {
        type: "string",
        description: "The webhook URL, API token, or secret.",
      },
      note: {
        type: "string",
        description: "Optional human-readable note ('My personal Discord').",
      },
    },
    required: ["key", "value"],
  },
  mutating: true,
  handler: async ({ key, value, note }, ctx) => {
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey) return { summary: "A non-empty key is required." };

    const existing = getCredential(cleanKey);
    if (existing) {
      const ok = await ctx.requestConfirmation(
        `Overwrite existing credential "${cleanKey}"?`,
      );
      if (!ok) return { summary: "Credential update cancelled." };
    }

    setCredential(cleanKey, value, note);

    ctx.logActivity({
      actionName: "set_credential",
      // Never log the value — only the key.
      params: { key: cleanKey, hasNote: !!note },
      summary: existing
        ? `Updated credential "${cleanKey}"`
        : `Stored credential "${cleanKey}"`,
    });

    return {
      summary: existing
        ? `Updated credential "${cleanKey}".`
        : `Stored credential "${cleanKey}". Use it via 'send_webhook', 'send_discord_message', or similar outbound actions.`,
      data: { key: cleanKey, updated: !!existing },
    };
  },
};

// ─── forget_credential ───────────────────────────────────────────

export const forgetCredentialAction: AxonAction<
  { key: string },
  { forgotten: boolean }
> = {
  name: "forget_credential",
  description:
    "Remove a stored credential by key. Destructive — confirms first. Reversible via 'undo that' (the value is captured in the undo descriptor before deletion).",
  input_schema: {
    type: "object",
    properties: {
      key: { type: "string" },
    },
    required: ["key"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ key }, ctx) => {
    const cleanKey = key.trim().toLowerCase();
    const existing = getCredential(cleanKey);
    if (!existing) {
      return { summary: `No credential stored under "${cleanKey}".` };
    }

    const removed = forgetCredential(cleanKey);
    if (!removed) {
      return { summary: `Failed to remove "${cleanKey}".` };
    }

    // Capture the full credential in the undo descriptor so the
    // restoration path can replay it exactly.
    ctx.pushUndo({
      actionName: "forget_credential",
      label: `forget credential "${cleanKey}"`,
      descriptor: {
        kind: "credential.restore",
        payload: {
          key: existing.key,
          value: existing.value,
          note: existing.note,
        },
      },
    });

    ctx.logActivity({
      actionName: "forget_credential",
      params: { key: cleanKey },
      summary: `Forgot credential "${cleanKey}"`,
    });

    return {
      summary: `Forgot credential "${cleanKey}". Say 'undo that' if it was a mistake.`,
      data: { forgotten: true },
    };
  },
};

// ─── list_credentials ────────────────────────────────────────────

export const listCredentialsAction: AxonAction<
  { prefix?: string },
  { keys: string[]; count: number }
> = {
  name: "list_credentials",
  description:
    "List the keys of all stored credentials (without revealing values). Optional `prefix` to filter — e.g. 'discord:' returns only Discord webhooks.",
  input_schema: {
    type: "object",
    properties: {
      prefix: { type: "string" },
    },
  },
  handler: async ({ prefix }) => {
    const items = listCredentials(prefix);
    if (items.length === 0) {
      return {
        summary: prefix
          ? `No credentials matching prefix "${prefix}".`
          : "No credentials stored yet.",
        data: { keys: [], count: 0 },
      };
    }
    const keys = items.map((c) => c.key);
    return {
      summary:
        items.length === 1
          ? `1 credential: ${keys[0]}.`
          : `${items.length} credentials: ${keys.slice(0, 5).join(", ")}${
              items.length > 5 ? ", and more" : ""
            }.`,
      data: { keys, count: items.length },
    };
  },
};

export function registerCredentialActions() {
  registerAction(setCredentialAction);
  registerAction(forgetCredentialAction);
  registerAction(listCredentialsAction);
}
