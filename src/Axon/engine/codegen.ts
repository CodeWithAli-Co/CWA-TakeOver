// ───────────────────────────────────────────────────────────────────
// Code-generation engine — Claude as a code writer for the operator.
//
// Architecture:
//   • Workspace root is a Tauri filesystem path the operator picks via
//     dialog (or sets explicitly with set_workspace).
//   • All file I/O is constrained to that root — no escapes via "..".
//   • Code generation calls Anthropic directly (separate from the
//     conversation brain) so it can produce raw code blocks without
//     the spoken-prose system prompt clouding output.
//
// The actions in actions/code.ts wire these helpers up as voice tools.
// ───────────────────────────────────────────────────────────────────

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";

// Tauri plugins are dynamic-imported so this module can also be parsed
// in non-Tauri contexts (tests, storybook). At runtime in the desktop
// app, they resolve normally.
async function fs() {
  return await import("@tauri-apps/plugin-fs");
}
async function dialogPlugin() {
  return await import("@tauri-apps/plugin-dialog");
}
async function pathPlugin() {
  return await import("@tauri-apps/api/path");
}

// ── workspace path safety ─────────────────────────────────────────────

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/g, "");
}

/** Reject any path that escapes its workspace root or contains traversal. */
export function safeJoin(workspace: string, relative: string): string {
  const wsNorm = normalizeSlashes(workspace);
  const rel = normalizeSlashes(relative).replace(/^\/+/, "");
  if (rel.includes("..")) {
    throw new Error("Path traversal not allowed.");
  }
  if (rel.length === 0) return wsNorm;
  return `${wsNorm}/${rel}`;
}

/** Pop a folder picker; returns the chosen absolute path or null. */
export async function pickWorkspaceDirectory(): Promise<string | null> {
  const { open } = await dialogPlugin();
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select AXON code-generation workspace",
  });
  if (!result || Array.isArray(result)) return null;
  return result;
}

export async function ensureWorkspaceExists(workspace: string): Promise<boolean> {
  const { exists } = await fs();
  try {
    return await exists(workspace);
  } catch {
    return false;
  }
}

export async function listWorkspace(
  workspace: string,
  rel: string = "",
): Promise<Array<{ name: string; isDir: boolean; path: string }>> {
  const { readDir } = await fs();
  const target = safeJoin(workspace, rel);
  const entries = await readDir(target);
  const out: Array<{ name: string; isDir: boolean; path: string }> = [];
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    out.push({ name: e.name, isDir: e.isDirectory ?? false, path: childRel });
  }
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function readWorkspaceFile(
  workspace: string,
  rel: string,
): Promise<string> {
  const { readTextFile } = await fs();
  return await readTextFile(safeJoin(workspace, rel));
}

export async function writeWorkspaceFile(
  workspace: string,
  rel: string,
  content: string,
): Promise<void> {
  const { writeTextFile, mkdir, exists } = await fs();
  const { dirname } = await pathPlugin();
  const fullPath = safeJoin(workspace, rel);
  const parent = await dirname(fullPath);
  // Make sure parent dirs exist.
  if (!(await exists(parent))) {
    await mkdir(parent, { recursive: true });
  }
  await writeTextFile(fullPath, content);
}

export async function deleteWorkspaceFile(
  workspace: string,
  rel: string,
): Promise<void> {
  const { remove } = await fs();
  await remove(safeJoin(workspace, rel));
}

// ── claude code-writer ────────────────────────────────────────────────

const CODE_WRITER_SYSTEM = `You are a senior code-writer agent embedded in AXON. The operator dictates a feature or fix by voice; you produce code.

OUTPUT FORMAT — STRICT:
- Reply with EXACTLY one fenced code block. No prose before or after the block.
- The fence opens with three backticks plus the file's language identifier (e.g. \`\`\`tsx, \`\`\`ts, \`\`\`py, \`\`\`rs, \`\`\`html, \`\`\`css, \`\`\`json).
- Inside the block, output only the file's contents. No explanation comments unless they are useful in the source itself.

GUIDELINES:
- Match the project's existing style if context is given.
- Prefer clean, idiomatic, production-grade code over clever one-liners.
- Always include necessary imports and exports.
- Keep files self-contained unless the operator explicitly mentions splitting.
- Default to TypeScript + React for unspecified UI work in this app.`;

const CODE_MODIFIER_SYSTEM = `You are a senior code-modifier agent embedded in AXON. The operator describes a change; you receive the current file and return the FULL revised file.

OUTPUT FORMAT — STRICT:
- Reply with EXACTLY one fenced code block. No prose before or after the block.
- The fence opens with three backticks plus the file's language identifier.
- Inside the block, output the COMPLETE new file contents — not a diff, not a partial snippet.

GUIDELINES:
- Preserve unchanged code byte-for-byte when possible.
- Don't drop comments, imports, or sections you weren't asked to touch.
- If the change is impossible without more info, return the original file unchanged.`;

interface ClaudeCodeResponse {
  /** Extracted code (fence stripped). */
  code: string;
  /** Detected language tag (e.g. "tsx"). */
  language: string;
  /** Raw text returned by Claude (for debugging). */
  raw: string;
}

function extractCodeBlock(raw: string): { code: string; language: string } {
  // Greedy: find first fenced block.
  const match = raw.match(/```([\w+\-.]*)\n([\s\S]*?)```/);
  if (match) {
    return { language: (match[1] || "").trim(), code: match[2].trim() + "\n" };
  }
  // No fence — return whole reply (fallback).
  return { language: "", code: raw.trim() + "\n" };
}

async function callClaude(
  system: string,
  user: string,
  maxTokens = 8000,
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing — set VITE_ANTHROPIC_API_KEY.");
  }
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 240)}`);
  }
  const json = await res.json();
  const block = (json?.content ?? []).find((p: any) => p.type === "text");
  return block?.text ?? "";
}

/** Generate a full file from a brief. */
export async function generateFile(args: {
  brief: string;
  filename: string;
  language?: string;
  context?: string;
}): Promise<ClaudeCodeResponse> {
  const langHint = args.language ? `Target language: ${args.language}.\n` : "";
  const ctx = args.context ? `\nProject context:\n${args.context}\n` : "";
  const user = `Filename: ${args.filename}
${langHint}${ctx}
Operator's request:
"""${args.brief}"""

Produce the full file contents.`;
  const raw = await callClaude(CODE_WRITER_SYSTEM, user, 8000);
  const { code, language } = extractCodeBlock(raw);
  return { code, language, raw };
}

/** Modify an existing file based on a brief. */
export async function modifyFile(args: {
  brief: string;
  filename: string;
  current: string;
  language?: string;
}): Promise<ClaudeCodeResponse> {
  const langHint = args.language ? `Language: ${args.language}.` : "";
  const user = `Filename: ${args.filename}
${langHint}

Operator's change request:
"""${args.brief}"""

Current file contents:
\`\`\`
${args.current}
\`\`\`

Return the complete revised file.`;
  const raw = await callClaude(CODE_MODIFIER_SYSTEM, user, 12000);
  const { code, language } = extractCodeBlock(raw);
  return { code, language, raw };
}

/** Generate a multi-file scaffold for a feature.
 *  Returns a JSON list of files to write — relies on Claude returning
 *  a single fenced ```json block. */
export async function scaffoldFeature(args: {
  brief: string;
  basePath: string;
  context?: string;
}): Promise<{ files: Array<{ path: string; content: string }>; raw: string }> {
  const SCAFFOLD_SYSTEM = `You are a feature scaffolder. Given a brief, return ONE fenced \`\`\`json block whose payload is:

{ "files": [ { "path": "relative/path.ext", "content": "..." } ] }

GUIDELINES:
- Paths are relative to the scaffold base path provided by the operator.
- Each "content" is the FULL file body. Escape newlines as \\n in JSON strings — do NOT inline raw newlines.
- Keep total scaffold to 5 files or fewer unless the request demands more.
- Don't include any prose outside the JSON block.`;

  const ctx = args.context ? `\nContext:\n${args.context}\n` : "";
  const user = `Base path (relative to workspace): ${args.basePath}
${ctx}
Brief: """${args.brief}"""

Return the JSON scaffold.`;
  const raw = await callClaude(SCAFFOLD_SYSTEM, user, 12000);
  const { code: jsonText } = extractCodeBlock(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `Scaffold response wasn't valid JSON: ${(e as Error).message}. Raw start: ${jsonText.slice(0, 120)}`,
    );
  }
  if (!parsed?.files || !Array.isArray(parsed.files)) {
    throw new Error("Scaffold response missing `files` array.");
  }
  const files: Array<{ path: string; content: string }> = parsed.files.map((f: any) => ({
    path: String(f.path),
    content: String(f.content),
  }));
  return { files, raw };
}
