/**
 * lib/github.ts — minimal browser-side GitHub REST client.
 *
 * GitHub's REST API supports CORS for authenticated requests, so
 * we can call it from the Tauri webview with no proxy. Auth is a
 * fine-grained PAT in the `Authorization: Bearer …` header.
 *
 * Endpoints used:
 *   · GET /user                                — verify auth
 *   · GET /user/repos                          — list repos
 *   · GET /repos/{owner}/{repo}/pulls          — list PRs
 *   · GET /repos/{owner}/{repo}/issues         — list issues
 *
 * Rate limit: 5,000 req/hr per authenticated user. Plenty for
 * dashboard polling.
 */

const BASE_URL = "https://api.github.com";

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string;
  language: string | null;
  default_branch: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  user: { login: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string };
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  html_url: string;
  /** GitHub returns PRs in /issues responses too — `pull_request`
   *  is the discriminator. Filter on the caller side. */
  pull_request?: unknown;
}

async function githubFetch<T>(
  token: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    // GitHub returns { message, documentation_url } on errors.
    let msg = `GitHub ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = `GitHub: ${body.message}`;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Verify the token + return the authenticated user. */
export async function githubMe(token: string): Promise<GitHubUser> {
  return githubFetch<GitHubUser>(token, "/user");
}

/** List repos the PAT can access. Default sort: most recently
 *  pushed first. Cap 50 per call. */
export async function githubListRepos(
  token: string,
  opts?: {
    perPage?: number;
    sort?: "created" | "updated" | "pushed" | "full_name";
    affiliation?: "owner" | "collaborator" | "organization_member";
  },
): Promise<GitHubRepo[]> {
  return githubFetch<GitHubRepo[]>(token, "/user/repos", {
    per_page: String(Math.min(opts?.perPage ?? 30, 50)),
    sort: opts?.sort ?? "pushed",
    direction: "desc",
    ...(opts?.affiliation && { affiliation: opts.affiliation }),
  });
}

/** List PRs for a specific repo. Default state: open. */
export async function githubListPRs(
  token: string,
  owner: string,
  repo: string,
  opts?: { state?: "open" | "closed" | "all"; perPage?: number },
): Promise<GitHubPR[]> {
  return githubFetch<GitHubPR[]>(
    token,
    `/repos/${owner}/${repo}/pulls`,
    {
      state: opts?.state ?? "open",
      per_page: String(Math.min(opts?.perPage ?? 30, 50)),
    },
  );
}

/**
 * Constant-time exact repo count + most-recently-pushed repo.
 *
 * GitHub's REST API doesn't expose a "total repo count" field,
 * but `/user/repos?per_page=1&sort=pushed` returns:
 *   · One row in the body — the most-recently-pushed repo
 *   · A `Link` header whose `rel="last"` URL has `page=N` where
 *     N equals the total page count, which because per_page=1
 *     equals the total repo count.
 *
 * One network call, no pagination, accurate even at 500+ repos.
 * Falls back to the body length if no Link header (which means
 * the user has ≤1 repo and no pagination is needed).
 */
export async function githubRepoSummary(
  token: string,
): Promise<{ totalCount: number; mostRecent: GitHubRepo | null }> {
  const url = new URL(`${BASE_URL}/user/repos`);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("sort", "pushed");
  url.searchParams.set("direction", "desc");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    let msg = `GitHub ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = `GitHub: ${body.message}`;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const repos = (await res.json()) as GitHubRepo[];
  const mostRecent = repos[0] ?? null;

  // Parse the Link header — format is:
  //   <url>; rel="next", <url>; rel="last"
  // We only need rel="last".
  let totalCount = repos.length;
  const linkHeader = res.headers.get("Link");
  if (linkHeader) {
    const m = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
    if (m && m[1]) {
      try {
        const lastUrl = new URL(m[1]);
        const lastPage = lastUrl.searchParams.get("page");
        if (lastPage) {
          const n = parseInt(lastPage, 10);
          if (Number.isFinite(n) && n > 0) totalCount = n;
        }
      } catch {
        // malformed URL, keep the fallback count
      }
    }
  }

  return { totalCount, mostRecent };
}

/** List issues for a specific repo. GitHub's /issues endpoint
 *  ALSO returns PRs — we filter them out so the caller gets
 *  pure issues. */
export async function githubListIssues(
  token: string,
  owner: string,
  repo: string,
  opts?: { state?: "open" | "closed" | "all"; perPage?: number },
): Promise<GitHubIssue[]> {
  const rows = await githubFetch<GitHubIssue[]>(
    token,
    `/repos/${owner}/${repo}/issues`,
    {
      state: opts?.state ?? "open",
      per_page: String(Math.min(opts?.perPage ?? 30, 50)),
    },
  );
  return rows.filter((r) => !r.pull_request);
}
