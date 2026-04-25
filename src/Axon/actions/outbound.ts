// ───────────────────────────────────────────────────────────────────
// Outbound integration actions — Discord, GitHub, generic webhooks.
//
// Foundation: every outbound action looks up its target by credential
// key (see engine/credentials.ts). The operator registers credentials
// once via `set_credential`, then voice-fires the outbound action and
// AXON resolves the URL/token at run-time.
//
// Why this is the elite-tier upgrade:
//   "Outbound reach" was the #1 gap Axon flagged in its self-audit.
//   Right now it can only push/pull inside Takeover; with these three
//   primitives it can fan out to Discord, file GitHub issues, fire
//   any webhook, and chain those into bigger workflows.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { getCredentialValue } from "../engine/credentials";

// ─── send_webhook ────────────────────────────────────────────────
// Generic POST primitive. Operator must have stored the URL under a
// credential key first (e.g. set_credential webhook:zapier-tasks ...).

export const sendWebhookAction: AxonAction<
  {
    credentialKey: string;
    payload?: Record<string, unknown>;
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
  },
  { ok: boolean; status: number; body?: string }
> = {
  name: "send_webhook",
  description:
    "Fire an HTTP POST/PUT to a URL stored as a credential. The operator must have run set_credential first to register the URL under a key (convention: 'webhook:<label>'). Use for arbitrary outbound integrations like Zapier, n8n, Make.com, or custom backend endpoints.",
  input_schema: {
    type: "object",
    properties: {
      credentialKey: {
        type: "string",
        description:
          "The key under which the destination URL is stored. e.g. 'webhook:zapier-tasks'.",
      },
      payload: {
        type: "object",
        description:
          "JSON body to send. Defaults to an empty object if omitted.",
      },
      method: {
        type: "string",
        enum: ["POST", "PUT"],
        description: "HTTP method. Defaults to POST.",
      },
      headers: {
        type: "object",
        description: "Optional extra request headers.",
      },
    },
    required: ["credentialKey"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (
    { credentialKey, payload, method, headers },
    ctx,
  ) => {
    const url = getCredentialValue(credentialKey);
    if (!url) {
      return {
        summary: `No credential stored under "${credentialKey}". Run set_credential first.`,
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would ${method ?? "POST"} to ${credentialKey}.`,
        data: { ok: true, status: 0 },
      };
    }

    try {
      const res = await fetch(url, {
        method: method ?? "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify(payload ?? {}),
      });
      const body = await res.text().catch(() => "");
      const ok = res.ok;
      ctx.logActivity({
        actionName: "send_webhook",
        // Don't log the URL or body — only the key + status.
        params: { credentialKey, status: res.status },
        summary: ok
          ? `Webhook delivered (${res.status})`
          : `Webhook failed (${res.status})`,
        result: { status: res.status },
      });
      return {
        summary: ok
          ? `Webhook delivered to ${credentialKey} (${res.status}).`
          : `Webhook returned ${res.status} — payload may not have been accepted.`,
        data: { ok, status: res.status, body: body.slice(0, 500) },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Webhook failed to send: ${msg}` };
    }
  },
};

// ─── send_discord_message ────────────────────────────────────────
// Wraps send_webhook with Discord's payload shape. The credential is
// expected to be a Discord webhook URL (set up in a Discord channel
// under Channel Settings → Integrations → Webhooks).

export const sendDiscordMessageAction: AxonAction<
  {
    credentialKey: string;
    content: string;
    username?: string;
  },
  { ok: boolean; status: number }
> = {
  name: "send_discord_message",
  description:
    "Post a message to a Discord channel via a stored webhook URL. The operator should have registered the webhook with set_credential under a key like 'discord:announcements'. Use when the operator says 'send to Discord', 'tell the team in Discord', 'post in #announcements'.",
  input_schema: {
    type: "object",
    properties: {
      credentialKey: {
        type: "string",
        description:
          "Credential key for the Discord webhook URL. Convention: 'discord:<channel-label>'.",
      },
      content: {
        type: "string",
        description: "Message body. Discord markdown is supported.",
      },
      username: {
        type: "string",
        description:
          "Optional override for the bot name shown in Discord. Defaults to the webhook's configured name.",
      },
    },
    required: ["credentialKey", "content"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ credentialKey, content, username }, ctx) => {
    const url = getCredentialValue(credentialKey);
    if (!url) {
      return {
        summary: `No Discord webhook stored under "${credentialKey}". Set one up first via set_credential.`,
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would post to ${credentialKey}: "${content.slice(0, 60)}..."`,
        data: { ok: true, status: 0 },
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          username: username ?? "AXON",
        }),
      });
      const ok = res.ok;
      ctx.logActivity({
        actionName: "send_discord_message",
        params: { credentialKey, len: content.length },
        summary: ok
          ? `Discord message delivered`
          : `Discord rejected (${res.status})`,
      });
      return {
        summary: ok
          ? `Posted to Discord (${credentialKey}).`
          : `Discord returned ${res.status}.`,
        data: { ok, status: res.status },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Couldn't reach Discord: ${msg}` };
    }
  },
};

// ─── create_github_issue ─────────────────────────────────────────
// Posts to api.github.com/repos/{owner}/{repo}/issues using a stored
// PAT. The PAT credential should be registered as 'github:pat' (or any
// key the operator chooses).

export const createGithubIssueAction: AxonAction<
  {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
    tokenKey?: string;
  },
  {
    issueNumber?: number;
    url?: string;
    ok: boolean;
  }
> = {
  name: "create_github_issue",
  description:
    "File a GitHub issue against a repo. Requires a Personal Access Token stored as a credential (default key 'github:pat'). Use when the operator says 'file an issue', 'open a bug', 'log this on GitHub'. Captures the issue number and URL on success.",
  input_schema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "GitHub org or user." },
      repo: { type: "string", description: "Repository name." },
      title: { type: "string" },
      body: { type: "string" },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Label names to apply (must already exist in the repo).",
      },
      assignees: {
        type: "array",
        items: { type: "string" },
        description: "GitHub usernames to assign.",
      },
      tokenKey: {
        type: "string",
        description: "Credential key holding the PAT. Defaults to 'github:pat'.",
      },
    },
    required: ["owner", "repo", "title"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (
    { owner, repo, title, body, labels, assignees, tokenKey },
    ctx,
  ) => {
    const key = tokenKey ?? "github:pat";
    const token = getCredentialValue(key);
    if (!token) {
      return {
        summary: `No GitHub token stored under "${key}". Run set_credential first.`,
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would file "${title}" on ${owner}/${repo}.`,
        data: { ok: true },
      };
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            body: body ?? "",
            labels,
            assignees,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          summary: `GitHub returned ${res.status}: ${
            (data as any)?.message ?? "no message"
          }`,
          data: { ok: false },
        };
      }
      const issueNumber: number | undefined = (data as any)?.number;
      const url: string | undefined = (data as any)?.html_url;
      ctx.logActivity({
        actionName: "create_github_issue",
        params: { owner, repo, title },
        summary: `Filed ${owner}/${repo}#${issueNumber}`,
        result: { issueNumber, url },
      });
      return {
        summary: `Filed issue ${owner}/${repo}#${issueNumber}: "${title}". ${url ?? ""}`,
        data: { issueNumber, url, ok: true },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Couldn't reach GitHub: ${msg}` };
    }
  },
};

export function registerOutboundActions() {
  registerAction(sendWebhookAction);
  registerAction(sendDiscordMessageAction);
  registerAction(createGithubIssueAction);
}
