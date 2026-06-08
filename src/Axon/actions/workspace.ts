// ───────────────────────────────────────────────────────────────────
// Workspace actions — gives AXON safe read + write access to the
// Workspace module (docs, sheets, folders).
//
// Two design constraints:
//   1) BULK READ. AXON can read every doc in the workspace in one call
//      (tree + previews) and then deep-read specific docs by id. No
//      more page-by-page navigation.
//
//   2) SAFE WRITES. When `workspaceSafeMode` is on (default), AXON can
//      only do non-destructive operations:
//        ✓ workspace_create_doc      — net-new doc
//        ✓ workspace_append_to_doc   — adds a paragraph block at the end
//        ✓ workspace_fill_placeholders — replaces only [FILL: hint] markers
//      Any attempt to delete or overwrite existing content is refused
//      with an error explaining the safe alternative.
//
// All mutations write to the Supabase `content` column (TipTap JSON)
// and null out `y_state` so the next editor session re-initializes
// from JSON. Anyone with the doc currently open will see AXON's
// changes after a refresh. This trades real-time collaboration for
// predictability — exactly what the operator asked for.
// ───────────────────────────────────────────────────────────────────

import { companySupabase } from "@/routes/index.lazy";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { registerUndoHandler } from "../engine/undoStack";
import { AXON_SETTINGS_KEY } from "../config";
import type { JSONContent } from "@tiptap/react";

const DOC_TABLE = "workspace_documents";
const SHEET_TABLE = "workspace_spreadsheets";
const FOLDER_TABLE = "workspace_folders";

// ─── Safe-mode helper ─────────────────────────────────────────────

/** Read the workspace_safe_mode flag from persisted Axon settings.
 *  Defaults to TRUE (safe) when settings are missing or malformed —
 *  fail-safe is the only correct default for this kind of gate. */
function isSafeModeOn(): boolean {
  try {
    const raw = window.localStorage.getItem(AXON_SETTINGS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.workspaceSafeMode !== false;
  } catch {
    return true;
  }
}

/** Throw a structured refusal that AXON's brain will surface verbatim
 *  to the operator. Use when safe-mode blocks a destructive call. */
function refuseDestructive(actionName: string, alternative: string): never {
  throw new Error(
    `Refused: safe-mode is on and ${actionName} is destructive. ` +
      `Try ${alternative} instead, or disable Workspace Safe Mode in AXON settings.`,
  );
}

// ─── Input validation ─────────────────────────────────────────────
//
// AXON's brain (Claude) sometimes calls actions with missing or
// undefined params — either because it skipped a prerequisite call or
// because it hallucinated a field name. Catch those before they hit
// Supabase (which gives unfriendly errors like
// "invalid input syntax for type uuid: \"undefined\"") and throw
// actionable messages the brain can self-correct from.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(value: unknown, fieldName: string, action: string): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value === "undefined" ||
    value === "null"
  ) {
    throw new Error(
      `${action} needs a real ${fieldName}. Call workspace_overview first to get doc ids, then pass one here.`,
    );
  }
  if (!UUID_RE.test(value)) {
    throw new Error(
      `${action} got ${fieldName}=${JSON.stringify(value)} which is not a UUID. ` +
        `Call workspace_overview to get a valid doc id.`,
    );
  }
  return value;
}

function assertNonEmptyArray<T>(
  value: unknown,
  fieldName: string,
  action: string,
): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${action} needs a non-empty ${fieldName} array. Pass at least one item.`,
    );
  }
  return value as T[];
}

function assertObject(
  value: unknown,
  fieldName: string,
  action: string,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${action} needs ${fieldName} to be a key/value object.`);
  }
  return value as Record<string, string>;
}

/** Read the doc id from the current URL (if on a /workspace/docs/<id> page). */
function currentDocIdFromUrl(): string | null {
  try {
    const m = window.location.pathname.match(
      /\/workspace\/docs\/([0-9a-f-]{36})/i,
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Reports whether the doc we're about to write is the one the user
 *  is actively viewing. Used to add a soft warning to the action
 *  summary — NOT a refusal. The user explicitly wants AXON to write
 *  in the background while they work; the data-loss risk only fires
 *  if they're actively typing in the same doc, which is rare.
 *
 *  ONLY workspace_replace_doc_content still treats this as a hard
 *  refusal because losing the whole doc on a stale save would be
 *  catastrophic. Append + fill are additive and recoverable. */
function describeOpenConflict(docId: string): string | null {
  const open = currentDocIdFromUrl();
  if (open && open === docId) {
    return "You have this doc open — if you keep typing, your editor's next save may overwrite my changes. Navigate away or refresh after I finish.";
  }
  return null;
}

/** Hard refusal — used ONLY for destructive replace where stale-save
 *  data loss would wipe the whole doc. */
function assertNotCurrentlyOpenStrict(docId: string, action: string): void {
  const open = currentDocIdFromUrl();
  if (open && open === docId) {
    throw new Error(
      `${action} refused: you have this doc open right now. ` +
        `Navigate away (or close the tab) first — otherwise your live editor will overwrite my changes on the next keystroke. ` +
        `This is a destructive operation; the safer path is to navigate away then re-run.`,
    );
  }
}

// ─── Persistable undo handlers ────────────────────────────────────

registerUndoHandler<{ docId: string; title: string }>(
  "workspace.delete-created-doc",
  async ({ docId, title }) => {
    const { error } = await companySupabase
      .from(DOC_TABLE)
      .delete()
      .eq("id", docId);
    if (error) throw new Error(error.message);
    return `Reverted — deleted doc "${title}".`;
  },
);

registerUndoHandler<{
  docId: string;
  previousContent: JSONContent;
  previousYState: string | null;
}>(
  "workspace.restore-content",
  async ({ docId, previousContent, previousYState }) => {
    const { error } = await companySupabase
      .from(DOC_TABLE)
      .update({ content: previousContent, y_state: previousYState })
      .eq("id", docId);
    if (error) throw new Error(error.message);
    return `Reverted — restored previous doc content.`;
  },
);

// ─── JSONContent helpers ──────────────────────────────────────────

/** Walk a TipTap JSON tree and concatenate all text into a single
 *  string. Used for previews + keyword search. */
function flattenText(node: JSONContent | null | undefined): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content
    .map(flattenText)
    .join(node.type === "paragraph" ? " " : "\n");
}

/** Build a short preview from a doc's content. ~200 chars, single line. */
function buildPreview(
  content: JSONContent | null | undefined,
  maxChars = 200,
): string {
  const text = flattenText(content).replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "…";
}

/** Append paragraph or heading blocks to the END of the doc's content.
 *  Pure — returns new JSONContent.
 *
 *  Defensive about TipTap invariants:
 *    - Text nodes MUST have non-empty `text` (TipTap throws otherwise).
 *      Empty text → emit an empty paragraph block instead.
 *    - Always ensure the doc ends with a paragraph so the editor can
 *      place the cursor (avoids "TextSelection endpoint not pointing
 *      into a node with inline content" warnings).
 */
function appendParagraphs(
  current: JSONContent | null | undefined,
  paragraphs: { text: string; heading?: 1 | 2 | 3 }[],
): JSONContent {
  const root: JSONContent =
    current && current.type === "doc"
      ? { ...current, content: [...(current.content ?? [])] }
      : { type: "doc", content: [] };

  for (const p of paragraphs) {
    const trimmed = (p.text ?? "").trim();
    if (p.heading && trimmed) {
      root.content!.push({
        type: "heading",
        attrs: { level: p.heading },
        content: [{ type: "text", text: trimmed }],
      });
    } else if (trimmed) {
      root.content!.push({
        type: "paragraph",
        content: [{ type: "text", text: p.text }],
      });
    } else {
      // Empty paragraph block — TipTap-legal, gives the user a visual
      // line break without violating the no-empty-text-node invariant.
      root.content!.push({ type: "paragraph" });
    }
  }

  // Ensure trailing paragraph for safe cursor placement.
  const last = root.content![root.content!.length - 1];
  if (!last || (last.type !== "paragraph" && last.type !== "heading")) {
    root.content!.push({ type: "paragraph" });
  }
  return root;
}

/** Walk JSONContent and replace every text node containing a
 *  `[FILL: hint here]` marker with the supplied value for that hint.
 *  Returns { content, replacedCount, hintsSeen }. Pure. */
function fillPlaceholders(
  current: JSONContent | null | undefined,
  values: Record<string, string>,
): { content: JSONContent; replacedCount: number; hintsSeen: string[] } {
  const hintsSeen: string[] = [];
  let replacedCount = 0;
  const re = /\[FILL:\s*([^\]]+?)\s*\]/gi;

  function walk(node: JSONContent): JSONContent | null {
    if (node.type === "text" && typeof node.text === "string") {
      const text = node.text;
      // Capture all hints first so we can report them even if we don't fill
      const matches = [...text.matchAll(re)];
      for (const m of matches) hintsSeen.push(m[1].trim());
      const replaced = text.replace(re, (_match, hint) => {
        const key = String(hint).trim();
        const lookup = values[key] ?? values[key.toLowerCase()];
        if (lookup !== undefined) {
          replacedCount++;
          // Replace with the value but treat empty string as a literal
          // placeholder removal — drop the node downstream by returning "".
          return String(lookup);
        }
        return _match;
      });
      // TipTap invariant: text nodes can't be empty. Returning null
      // here is filtered out by the parent walker.
      if (replaced === "") return null;
      return { ...node, text: replaced };
    }
    if (node.content) {
      const newContent = node.content
        .map(walk)
        .filter((c): c is JSONContent => c !== null);
      return { ...node, content: newContent };
    }
    return node;
  }

  const out = (current && walk(current)) || { type: "doc", content: [] };
  return { content: out, replacedCount, hintsSeen };
}

// ═════════════════════════════════════════════════════════════════
// READ actions
// ═════════════════════════════════════════════════════════════════

// ─── workspace_overview ───────────────────────────────────────────
/** Returns the entire workspace as a flat list with title + folder +
 *  short preview per doc. Designed to be ONE call, not 50 round-trips. */
export const workspaceOverviewAction: AxonAction<
  { includeArchived?: boolean; folderId?: string | null; maxDocs?: number },
  {
    folders: { id: string; name: string; parent_folder_id: string | null }[];
    docs: {
      id: string;
      title: string;
      folder_id: string | null;
      updated_at: string;
      preview: string;
    }[];
    sheets: {
      id: string;
      title: string;
      folder_id: string | null;
      updated_at: string;
    }[];
    totalDocs: number;
    truncated: boolean;
  }
> = {
  name: "workspace_overview",
  description:
    "List every workspace doc + sheet with title + ~200-char preview. Call this FIRST to get doc ids for any other workspace action.",
  input_schema: {
    type: "object",
    properties: {
      includeArchived: {
        type: "boolean",
        description: "Include archived docs/sheets.",
      },
      folderId: {
        type: "string",
        description: "Filter to one folder id (omit for all).",
      },
      maxDocs: {
        type: "number",
        description: "Cap on docs returned (default 200).",
      },
    },
  },
  handler: async (input) => {
    const cap = Math.max(1, Math.min(500, input.maxDocs ?? 200));
    const [foldersRes, docsRes, sheetsRes] = await Promise.all([
      companySupabase
        .from(FOLDER_TABLE)
        .select("id, name, parent_folder_id")
        .order("position", { ascending: true }),
      companySupabase
        .from(DOC_TABLE)
        .select("id, title, folder_id, updated_at, archived, content")
        .order("updated_at", { ascending: false }),
      companySupabase
        .from(SHEET_TABLE)
        .select("id, title, folder_id, updated_at, archived")
        .order("updated_at", { ascending: false }),
    ]);
    if (foldersRes.error) throw new Error(foldersRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);
    if (sheetsRes.error) throw new Error(sheetsRes.error.message);

    const allDocs = (docsRes.data ?? []) as any[];
    let docsFiltered = allDocs.filter(
      (d) => input.includeArchived || !d.archived,
    );
    if (input.folderId !== undefined)
      docsFiltered = docsFiltered.filter((d) => d.folder_id === input.folderId);
    const totalDocs = docsFiltered.length;
    const truncated = totalDocs > cap;
    const docs = docsFiltered.slice(0, cap).map((d) => ({
      id: d.id,
      title: d.title,
      folder_id: d.folder_id ?? null,
      updated_at: d.updated_at,
      preview: buildPreview(d.content),
    }));

    const sheets = (sheetsRes.data ?? [])
      .filter((s: any) => input.includeArchived || !s.archived)
      .map((s: any) => ({
        id: s.id,
        title: s.title,
        folder_id: s.folder_id ?? null,
        updated_at: s.updated_at,
      }));

    return {
      summary: `Read overview: ${docs.length} docs, ${sheets.length} sheets, ${foldersRes.data?.length ?? 0} folders${truncated ? ` (truncated from ${totalDocs})` : ""}.`,
      data: {
        folders: (foldersRes.data ?? []) as any,
        docs,
        sheets,
        totalDocs,
        truncated,
      },
    };
  },
};

// ─── workspace_current_doc ────────────────────────────────────────
/** Returns the doc id of the doc the operator is CURRENTLY viewing,
 *  derived from the URL. Lets AXON skip workspace_overview when the
 *  user clearly means "this doc". Returns null when not on a doc page. */
export const workspaceCurrentDocAction: AxonAction<
  Record<string, never>,
  { docId: string | null; title: string | null }
> = {
  name: "workspace_current_doc",
  description:
    "Get the id of the doc the operator is viewing right now. Use this BEFORE workspace_overview when the user says 'this doc' or 'the doc I'm in'.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    let docId: string | null = null;
    try {
      const path = window.location.pathname;
      const m = path.match(/\/workspace\/docs\/([0-9a-f-]{36})/i);
      if (m) docId = m[1];
    } catch {
      /* SSR / no window */
    }

    if (!docId) {
      return {
        summary: "Not on a doc page right now.",
        data: { docId: null, title: null },
      };
    }
    const { data, error } = await companySupabase
      .from(DOC_TABLE)
      .select("title")
      .eq("id", docId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      summary: data
        ? `Currently viewing "${data.title}".`
        : "On a doc page but couldn't read the title.",
      data: { docId, title: data?.title ?? null },
    };
  },
};

// ─── workspace_read_doc ───────────────────────────────────────────
/** Full content of one doc. */
export const workspaceReadDocAction: AxonAction<
  { docId: string },
  {
    id: string;
    title: string;
    updated_at: string;
    text: string;
    folder_id: string | null;
  }
> = {
  name: "workspace_read_doc",
  description:
    "Read the full text of one doc. docId must come from workspace_overview.",
  input_schema: {
    type: "object",
    properties: { docId: { type: "string", description: "UUID of the doc." } },
    required: ["docId"],
  },
  handler: async (input) => {
    const docId = assertId(input?.docId, "docId", "workspace_read_doc");
    const { data, error } = await companySupabase
      .from(DOC_TABLE)
      .select("id, title, updated_at, folder_id, content")
      .eq("id", docId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No doc with id ${docId}.`);
    const text = flattenText((data as any).content);
    return {
      summary: `Read "${data.title}" (${text.length} chars).`,
      data: {
        id: data.id,
        title: data.title,
        updated_at: data.updated_at,
        folder_id: (data as any).folder_id ?? null,
        text,
      },
    };
  },
};

// ─── workspace_search ─────────────────────────────────────────────
/** Keyword search across all doc text. Returns matches ranked by hit count. */
export const workspaceSearchAction: AxonAction<
  { query: string; maxResults?: number },
  { matches: { docId: string; title: string; hits: number; snippet: string }[] }
> = {
  name: "workspace_search",
  description:
    "Keyword search across all docs. Returns top matches by hit count with a snippet.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search terms, case-insensitive." },
      maxResults: { type: "number", description: "Cap (default 12, max 30)." },
    },
    required: ["query"],
  },
  handler: async (input) => {
    if (typeof input?.query !== "string" || !input.query.trim()) {
      throw new Error("workspace_search needs a non-empty query string.");
    }
    const cap = Math.max(1, Math.min(30, input.maxResults ?? 12));
    const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return { summary: "Empty search query.", data: { matches: [] } };
    }
    const { data, error } = await companySupabase
      .from(DOC_TABLE)
      .select("id, title, content, archived");
    if (error) throw new Error(error.message);

    const ranked = ((data ?? []) as any[])
      .filter((d) => !d.archived)
      .map((d) => {
        const text = flattenText(d.content);
        const lower = text.toLowerCase();
        let hits = 0;
        let firstHit = -1;
        for (const t of terms) {
          const idx = lower.indexOf(t);
          if (idx >= 0) {
            hits++;
            if (firstHit < 0 || idx < firstHit) firstHit = idx;
          }
        }
        if (hits === 0) return null;
        const start = Math.max(0, firstHit - 40);
        const end = Math.min(text.length, firstHit + 160);
        const snippet =
          (start > 0 ? "…" : "") +
          text.slice(start, end).replace(/\s+/g, " ") +
          (end < text.length ? "…" : "");
        return { docId: d.id, title: d.title, hits, snippet };
      })
      .filter(
        (
          x,
        ): x is {
          docId: string;
          title: string;
          hits: number;
          snippet: string;
        } => x !== null,
      )
      .sort((a, b) => b.hits - a.hits)
      .slice(0, cap);

    return {
      summary: `Search for "${input.query}" → ${ranked.length} doc${ranked.length === 1 ? "" : "s"} matched.`,
      data: { matches: ranked },
    };
  },
};

// ═════════════════════════════════════════════════════════════════
// SAFE WRITE actions (also work in destructive mode)
// ═════════════════════════════════════════════════════════════════

// ─── workspace_create_doc ─────────────────────────────────────────
/** Create a new doc with optional initial paragraphs. Always allowed
 *  in safe mode — creation is by definition non-destructive. */
export const workspaceCreateDocAction: AxonAction<
  { title: string; paragraphs?: string[]; folderId?: string | null },
  { docId: string; title: string }
> = {
  name: "workspace_create_doc",
  description:
    "Create a new doc with initial body paragraphs. Use for background report writing — operator does not need to be on the doc. Always safe. IMPORTANT: every paragraph string must be REAL prose; do not pass empty strings or placeholders like '...' or 'TBD'.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Doc title." },
      paragraphs: {
        type: "array",
        items: { type: "string" },
        description:
          "Body paragraphs as full prose strings. Each becomes a paragraph block. Must contain actual content — empty strings are rejected.",
      },
      folderId: { type: "string", description: "Optional folder UUID." },
    },
    required: ["title"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    if (typeof input?.title !== "string" || !input.title.trim()) {
      throw new Error("workspace_create_doc needs a non-empty title.");
    }
    const title = input.title.trim();

    // Filter to meaningful prose ONLY. Empty strings, whitespace, and
    // dot-placeholders ("...", "tbd", "lorem ipsum") all get dropped.
    // If the caller passed an array but nothing survived, that's a
    // content-generation failure — throw so AXON re-tries with real
    // prose instead of silently shipping a blank doc.
    const rawArr = Array.isArray(input.paragraphs) ? input.paragraphs : [];
    const paragraphs = rawArr.filter((p): p is string => {
      if (typeof p !== "string") return false;
      const t = p.trim();
      if (t.length < 3) return false; // drop "", " ", "."
      if (/^[\.…\-_=*]+$/.test(t)) return false; // drop "...", "---", etc.
      if (/^(tbd|tba|todo|placeholder|fill in|fill me|n\/a)$/i.test(t))
        return false;
      return true;
    });
    if (rawArr.length > 0 && paragraphs.length === 0) {
      throw new Error(
        `workspace_create_doc refused: you passed ${rawArr.length} paragraph(s) but none contained real prose. ` +
          `Re-call with full sentence strings — every paragraph must be the actual body content you want in the doc, not "", "...", "TBD", or a placeholder.`,
      );
    }

    const folderId =
      typeof input.folderId === "string" && UUID_RE.test(input.folderId)
        ? input.folderId
        : null;
    const content = appendParagraphs(
      { type: "doc", content: [] },
      paragraphs.map((p) => ({ text: p })),
    );
    const { data, error } = await companySupabase
      .from(DOC_TABLE)
      .insert({
        title,
        content,
        owner: ctx.operator.supa_id,
        visibility: "private",
        folder_id: folderId ?? null,
        updated_by: ctx.operator.supa_id,
      })
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);

    ctx.pushUndo({
      actionName: "workspace_create_doc",
      label: `Delete doc "${title}"`,
      descriptor: {
        kind: "workspace.delete-created-doc",
        payload: { docId: data.id, title },
      },
    });

    return {
      summary: `Created doc "${title}"${paragraphs?.length ? ` with ${paragraphs.length} paragraph${paragraphs.length === 1 ? "" : "s"}` : ""}.`,
      data: { docId: data.id, title: data.title },
    };
  },
};

// ─── workspace_append_to_doc ──────────────────────────────────────
/** Append one or more paragraphs to the END of an existing doc.
 *  Safe — never modifies existing content. */
export const workspaceAppendAction: AxonAction<
  { docId: string; paragraphs: string[]; heading?: string },
  { docId: string; title: string; appendedBlocks: number }
> = {
  name: "workspace_append_to_doc",
  description:
    "Append paragraphs to the END of a doc. Use to extend reports, log notes, or write a long doc section-by-section in the background. Each paragraph must be REAL prose — empty strings or placeholders like '...' will be rejected. Safe — never modifies content above. docId from workspace_overview or workspace_current_doc.",
  input_schema: {
    type: "object",
    properties: {
      docId: {
        type: "string",
        description: "Doc UUID from workspace_overview.",
      },
      paragraphs: {
        type: "array",
        items: { type: "string" },
        description: "Paragraphs to append.",
      },
      heading: {
        type: "string",
        description: "Optional H2 heading before paragraphs.",
      },
    },
    required: ["docId", "paragraphs"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const docId = assertId(input?.docId, "docId", "workspace_append_to_doc");
    const openWarning = describeOpenConflict(docId);
    const paragraphsRaw = assertNonEmptyArray<unknown>(
      input?.paragraphs,
      "paragraphs",
      "workspace_append_to_doc",
    );
    const paragraphs = paragraphsRaw.filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (paragraphs.length === 0) {
      throw new Error(
        "workspace_append_to_doc: paragraphs must be non-empty strings.",
      );
    }
    const heading =
      typeof input?.heading === "string" && input.heading.trim()
        ? input.heading.trim()
        : undefined;

    // Read current state for undo + append.
    const { data: current, error: readErr } = await companySupabase
      .from(DOC_TABLE)
      .select("title, content, y_state")
      .eq("id", docId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const blocks: { text: string; heading?: 1 | 2 | 3 }[] = [];
    if (heading) blocks.push({ text: heading, heading: 2 });
    for (const p of paragraphs) blocks.push({ text: p });

    const nextContent = appendParagraphs(
      current.content as JSONContent,
      blocks,
    );

    const { error: writeErr } = await companySupabase
      .from(DOC_TABLE)
      .update({
        content: nextContent,
        // Null out y_state so any open editor session re-initializes from
        // the JSON content on next mount; otherwise the editor's stale
        // Y.Doc state would overwrite our changes on its next debounced save.
        y_state: null,
        updated_by: ctx.operator.supa_id,
      })
      .eq("id", docId);
    if (writeErr) throw new Error(writeErr.message);

    ctx.pushUndo({
      actionName: "workspace_append_to_doc",
      label: `Undo append to "${current.title}"`,
      descriptor: {
        kind: "workspace.restore-content",
        payload: {
          docId,
          previousContent: current.content,
          previousYState: current.y_state ?? null,
        },
      },
    });

    const summary = openWarning
      ? `Appended ${blocks.length} block${blocks.length === 1 ? "" : "s"} to "${current.title}". ⚠ ${openWarning}`
      : `Appended ${blocks.length} block${blocks.length === 1 ? "" : "s"} to "${current.title}". Open the doc to see the changes.`;

    return {
      summary,
      data: { docId, title: current.title, appendedBlocks: blocks.length },
    };
  },
};

// ─── workspace_fill_placeholders ──────────────────────────────────
/** Find `[FILL: hint]` markers in a doc and replace them with values.
 *  Safe — only modifies text within the marker syntax. */
export const workspaceFillAction: AxonAction<
  { docId: string; values: Record<string, string> },
  {
    docId: string;
    title: string;
    replacedCount: number;
    hintsSeen: string[];
    hintsUnfilled: string[];
  }
> = {
  name: "workspace_fill_placeholders",
  description:
    "Replace [FILL: hint] markers in a doc with values. E.g. values={total_raise: '$1.5M'} fills [FILL: total_raise]. Safe.",
  input_schema: {
    type: "object",
    properties: {
      docId: {
        type: "string",
        description: "Doc UUID from workspace_overview.",
      },
      values: {
        type: "object",
        description: "Map of hint → replacement text.",
      },
    },
    required: ["docId", "values"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const docId = assertId(
      input?.docId,
      "docId",
      "workspace_fill_placeholders",
    );
    const openWarning = describeOpenConflict(docId);
    const values = assertObject(
      input?.values,
      "values",
      "workspace_fill_placeholders",
    );
    const { data: current, error: readErr } = await companySupabase
      .from(DOC_TABLE)
      .select("title, content, y_state")
      .eq("id", docId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const {
      content: nextContent,
      replacedCount,
      hintsSeen,
    } = fillPlaceholders(current.content as JSONContent, values);

    if (replacedCount === 0) {
      const seen = Array.from(new Set(hintsSeen));
      return {
        summary:
          seen.length === 0
            ? `No [FILL: …] markers found in "${current.title}".`
            : `Found ${seen.length} marker${seen.length === 1 ? "" : "s"} but none matched the supplied values: ${seen.join(", ")}.`,
        data: {
          docId,
          title: current.title,
          replacedCount: 0,
          hintsSeen: seen,
          hintsUnfilled: seen,
        },
      };
    }

    const { error: writeErr } = await companySupabase
      .from(DOC_TABLE)
      .update({
        content: nextContent,
        y_state: null,
        updated_by: ctx.operator.supa_id,
      })
      .eq("id", docId);
    if (writeErr) throw new Error(writeErr.message);

    const seen = Array.from(new Set(hintsSeen));
    const unfilled = seen.filter(
      (h) => !(h in values) && !(h.toLowerCase() in values),
    );

    ctx.pushUndo({
      actionName: "workspace_fill_placeholders",
      label: `Undo placeholder fills in "${current.title}"`,
      descriptor: {
        kind: "workspace.restore-content",
        payload: {
          docId,
          previousContent: current.content,
          previousYState: current.y_state ?? null,
        },
      },
    });

    return {
      summary: `Filled ${replacedCount} placeholder${replacedCount === 1 ? "" : "s"} in "${current.title}"${unfilled.length ? ` (${unfilled.length} unfilled: ${unfilled.join(", ")})` : ""}.${openWarning ? ` ⚠ ${openWarning}` : ""}`,
      data: {
        docId,
        title: current.title,
        replacedCount,
        hintsSeen: seen,
        hintsUnfilled: unfilled,
      },
    };
  },
};

// ═════════════════════════════════════════════════════════════════
// DESTRUCTIVE actions — refused in safe mode
// ═════════════════════════════════════════════════════════════════

// ─── workspace_replace_doc_content ────────────────────────────────
/** Replace a doc's entire content with new text. REFUSED in safe mode. */
export const workspaceReplaceAction: AxonAction<
  { docId: string; paragraphs: string[] },
  { docId: string; title: string }
> = {
  name: "workspace_replace_doc_content",
  description:
    "DESTRUCTIVE: replace a doc's entire content. Refused in safe mode. Prefer workspace_append_to_doc.",
  input_schema: {
    type: "object",
    properties: {
      docId: {
        type: "string",
        description: "Doc UUID from workspace_overview.",
      },
      paragraphs: {
        type: "array",
        items: { type: "string" },
        description: "Full new content.",
      },
    },
    required: ["docId", "paragraphs"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (input, ctx) => {
    if (isSafeModeOn()) {
      refuseDestructive(
        "workspace_replace_doc_content",
        "workspace_append_to_doc (additive) or workspace_fill_placeholders (only fills [FILL: …] markers)",
      );
    }
    const docId = assertId(
      input?.docId,
      "docId",
      "workspace_replace_doc_content",
    );
    assertNotCurrentlyOpenStrict(docId, "workspace_replace_doc_content");
    const paragraphsRaw = assertNonEmptyArray<unknown>(
      input?.paragraphs,
      "paragraphs",
      "workspace_replace_doc_content",
    );
    const paragraphs = paragraphsRaw.filter(
      (p): p is string => typeof p === "string",
    );
    if (paragraphs.length === 0) {
      throw new Error(
        "workspace_replace_doc_content: paragraphs must contain at least one string.",
      );
    }

    const { data: current, error: readErr } = await companySupabase
      .from(DOC_TABLE)
      .select("title, content, y_state")
      .eq("id", docId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const nextContent = appendParagraphs(
      { type: "doc", content: [] },
      paragraphs.map((p) => ({ text: p })),
    );

    const { error: writeErr } = await companySupabase
      .from(DOC_TABLE)
      .update({
        content: nextContent,
        y_state: null,
        updated_by: ctx.operator.supa_id,
      })
      .eq("id", docId);
    if (writeErr) throw new Error(writeErr.message);

    ctx.pushUndo({
      actionName: "workspace_replace_doc_content",
      label: `Undo content replace on "${current.title}"`,
      descriptor: {
        kind: "workspace.restore-content",
        payload: {
          docId,
          previousContent: current.content,
          previousYState: current.y_state ?? null,
        },
      },
    });

    return {
      summary: `Replaced content of "${current.title}".`,
      data: { docId, title: current.title },
    };
  },
};

// ─── workspace_delete_doc ─────────────────────────────────────────
export const workspaceDeleteAction: AxonAction<
  { docId: string },
  { docId: string; title: string }
> = {
  name: "workspace_delete_doc",
  description:
    "DESTRUCTIVE: delete a doc permanently. Refused in safe mode. Prefer archiving.",
  input_schema: {
    type: "object",
    properties: {
      docId: {
        type: "string",
        description: "Doc UUID from workspace_overview.",
      },
    },
    required: ["docId"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async (input, _ctx) => {
    if (isSafeModeOn()) {
      refuseDestructive(
        "workspace_delete_doc",
        "archiving (set the archived flag on the doc instead)",
      );
    }
    const docId = assertId(input?.docId, "docId", "workspace_delete_doc");
    const { data: current, error: readErr } = await companySupabase
      .from(DOC_TABLE)
      .select("title")
      .eq("id", docId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const { error } = await companySupabase
      .from(DOC_TABLE)
      .delete()
      .eq("id", docId);
    if (error) throw new Error(error.message);
    return {
      summary: `Deleted doc "${current.title}".`,
      data: { docId, title: current.title },
    };
  },
};

// ═════════════════════════════════════════════════════════════════
// Registration
// ═════════════════════════════════════════════════════════════════

export function registerWorkspaceActions() {
  registerAction(workspaceCurrentDocAction);
  registerAction(workspaceOverviewAction);
  registerAction(workspaceReadDocAction);
  registerAction(workspaceSearchAction);
  registerAction(workspaceCreateDocAction);
  registerAction(workspaceAppendAction);
  registerAction(workspaceFillAction);
  registerAction(workspaceReplaceAction);
  registerAction(workspaceDeleteAction);
}

// Public helper so other action files can check safe-mode the same way.
export { isSafeModeOn };
