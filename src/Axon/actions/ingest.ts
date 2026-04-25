// ───────────────────────────────────────────────────────────────────
// External data ingestion — read URLs and GitHub PRs.
//
// Until now AXON could only see what was inside Takeover. These two
// actions extend its eyes outward:
//
//   · fetch_url        — generic GET, returns the body (text-only,
//                        truncated to keep the LLM context healthy).
//   · read_github_pr   — opinionated wrapper that returns title, body,
//                        author, state, and a compact diff stat using
//                        the GitHub REST API + an optional stored PAT.
//
// These actions are read-only; they don't push anything. They feed
// the brain so the operator can ask "what does this PR say?", "what's
// on this docs page?", or "is this issue still open?".
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { getCredentialValue } from "../engine/credentials";

/** Cap on inlined body length per fetch. Anthropic context is finite —
 *  truncating here keeps a single read from blowing the operator's
 *  per-turn token budget. */
const BODY_CAP = 8_000;

// ─── fetch_url ───────────────────────────────────────────────────

export const fetchUrlAction: AxonAction<
  {
    url: string;
    headers?: Record<string, string>;
    /** Optional credential key whose VALUE will be used as a Bearer
     *  token. Use this for protected APIs. */
    bearerKey?: string;
  },
  { ok: boolean; status: number; body: string; truncated: boolean }
> = {
  name: "fetch_url",
  description:
    "GET an arbitrary URL and return the response body. Use to read public web pages, JSON APIs, or anything reachable over HTTP. The body is truncated at 8KB to fit the LLM context. Pass `bearerKey` (a credential key) to authenticate against private APIs.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string" },
      headers: {
        type: "object",
        description: "Optional request headers (e.g. Accept).",
      },
      bearerKey: {
        type: "string",
        description:
          "Optional credential key. If provided, sends `Authorization: Bearer <value>`.",
      },
    },
    required: ["url"],
  },
  handler: async ({ url, headers, bearerKey }) => {
    if (!/^https?:\/\//i.test(url)) {
      return { summary: `Refusing to fetch a non-HTTP(S) URL: ${url}` };
    }

    const reqHeaders: Record<string, string> = { ...(headers ?? {}) };
    if (bearerKey) {
      const token = getCredentialValue(bearerKey);
      if (!token) {
        return {
          summary: `No credential under "${bearerKey}". Use set_credential first.`,
        };
      }
      reqHeaders.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: reqHeaders,
      });
      const fullBody = await res.text().catch(() => "");
      const truncated = fullBody.length > BODY_CAP;
      const body = truncated ? fullBody.slice(0, BODY_CAP) : fullBody;
      return {
        summary: `Fetched ${url} (${res.status}, ${fullBody.length} bytes${truncated ? ", truncated to 8KB" : ""}).`,
        data: { ok: res.ok, status: res.status, body, truncated },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Couldn't fetch ${url}: ${msg}` };
    }
  },
};

// ─── read_github_pr ──────────────────────────────────────────────
// Calls api.github.com/repos/{owner}/{repo}/pulls/{number}.
// Optional PAT (default key `github:pat`) lifts the unauthenticated
// rate limit and unlocks private repos.

export const readGithubPrAction: AxonAction<
  {
    owner: string;
    repo: string;
    number: number;
    tokenKey?: string;
  },
  {
    title?: string;
    state?: string;
    author?: string;
    body?: string;
    additions?: number;
    deletions?: number;
    changedFiles?: number;
    url?: string;
  }
> = {
  name: "read_github_pr",
  description:
    "Read a GitHub pull request — returns title, state (open/closed/merged), author, body summary, and diff stats (additions / deletions / files changed). Use when the operator says 'what's PR #123 about', 'is that PR merged', 'who wrote that PR'. A PAT (credential key 'github:pat') is optional but recommended.",
  input_schema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      number: { type: "number" },
      tokenKey: {
        type: "string",
        description: "Credential key holding a GitHub PAT. Defaults to 'github:pat'.",
      },
    },
    required: ["owner", "repo", "number"],
  },
  handler: async ({ owner, repo, number, tokenKey }) => {
    const key = tokenKey ?? "github:pat";
    const token = getCredentialValue(key);

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`;
    try {
      const res = await fetch(apiUrl, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          summary: `GitHub returned ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}.`,
        };
      }
      const json = (await res.json()) as Record<string, unknown>;
      const title = json.title as string | undefined;
      const state = json.merged ? "merged" : (json.state as string | undefined);
      const author = (json.user as { login?: string } | undefined)?.login;
      const rawBody = (json.body as string | undefined) ?? "";
      const body =
        rawBody.length > 1500 ? rawBody.slice(0, 1500) + "…" : rawBody;
      const additions = json.additions as number | undefined;
      const deletions = json.deletions as number | undefined;
      const changedFiles = json.changed_files as number | undefined;
      const htmlUrl = json.html_url as string | undefined;

      const summary =
        `${owner}/${repo}#${number} (${state ?? "?"}) — "${title ?? ""}" by ${author ?? "?"}` +
        (typeof additions === "number"
          ? `. +${additions}/-${deletions} across ${changedFiles} file${changedFiles === 1 ? "" : "s"}.`
          : ".");

      return {
        summary,
        data: {
          title,
          state,
          author,
          body,
          additions,
          deletions,
          changedFiles,
          url: htmlUrl,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Couldn't reach GitHub: ${msg}` };
    }
  },
};

export function registerIngestActions() {
  registerAction(fetchUrlAction);
  registerAction(readGithubPrAction);
}
