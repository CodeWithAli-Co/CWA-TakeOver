/**
 * searchHelpers.ts — Pure helpers for client-side workspace search.
 *
 * We flatten TipTap JSONContent into a single plain-text string so the
 * landing page filter can match against doc bodies without us shipping
 * a Postgres full-text index yet. Linear in doc length, ~negligible
 * for typical doc sizes; we'd want a `tsvector` + GIN index once a
 * single user has hundreds of docs or multi-MB bodies. For Phase 6
 * the client-side path keeps the implementation small.
 */

import type { JSONContent } from "@tiptap/react";

/**
 * Walk a TipTap JSON tree and concatenate every text node's value.
 * Inserts a space between sibling blocks so neighboring words from
 * different paragraphs stay tokenizable.
 */
export function extractDocText(content: JSONContent | null | undefined): string {
  if (!content) return "";
  const out: string[] = [];
  walk(content, out);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function walk(node: JSONContent, out: string[]) {
  if (typeof node.text === "string") out.push(node.text);
  if (Array.isArray(node.content)) {
    for (const c of node.content) walk(c, out);
  }
}

/** Case-insensitive substring match used by the landing page filter. */
export function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}
