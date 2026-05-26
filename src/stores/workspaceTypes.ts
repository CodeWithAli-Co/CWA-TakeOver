/**
 * workspaceTypes.ts — Type definitions for the /workspace product.
 *
 * Three resource types — Document, Spreadsheet, and a shared
 * WorkspaceResource union used by the landing page list. Plus the
 * collaboration model (Collaborator, Comment, Version) for the later
 * phases (sharing, comments, version history).
 *
 * Schema lives in migrations/workspace_schema.sql.
 */

import type { JSONContent } from "@tiptap/react";

// ── Visibility / roles ──────────────────────────────────────────────
export type WorkspaceVisibility = "private" | "shared" | "public";
export type WorkspaceRole = "viewer" | "commenter" | "editor";

// ── Folders ────────────────────────────────────────────────────────
// Shared across the workspace — every authenticated user sees the
// same folder tree. parent_folder_id is recursive (no depth limit).
// NULL parent_folder_id = top-level folder.
export interface WorkspaceFolder {
  id: string;
  name: string;
  owner: string;
  parent_folder_id: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Aggregated counts from the workspace_folder_counts view —
 *  lets the sidebar render "Funding · 4" cheaply. */
export interface WorkspaceFolderCounts {
  folder_id: string;
  doc_count: number;
  sheet_count: number;
  total_count: number;
}

// ── Documents ──────────────────────────────────────────────────────
export interface WorkspaceDocument {
  id: string;
  title: string;
  /** TipTap doc JSON. Empty placeholder is { type: "doc", content: [] }.
   *  Kept in sync with y_state on every save so non-collab readers
   *  (landing list, search) don't have to load Y.js. */
  content: JSONContent;
  /** Base64-encoded Y.Doc binary — authoritative for collaboration.
   *  When present, preferred over `content` for editor bootstrap so
   *  reconnecting clients don't double-up edits. */
  y_state: string | null;
  owner: string;
  visibility: WorkspaceVisibility;
  icon: string | null;
  archived: boolean;
  /** Folder this doc belongs to. NULL = lives at the workspace root. */
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

// ── Spreadsheets ───────────────────────────────────────────────────
export interface WorkspaceSpreadsheet {
  id: string;
  title: string;
  /** Univer snapshot JSON. Opaque to us — Univer owns the shape. */
  snapshot: Record<string, unknown>;
  owner: string;
  visibility: WorkspaceVisibility;
  icon: string | null;
  archived: boolean;
  /** Folder this sheet belongs to. NULL = lives at the workspace root. */
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

// ── Union for the landing list ─────────────────────────────────────
export type WorkspaceResourceKind = "document" | "spreadsheet";

export interface WorkspaceResource {
  kind: WorkspaceResourceKind;
  id: string;
  title: string;
  owner: string;
  visibility: WorkspaceVisibility;
  icon: string | null;
  folder_id: string | null;
  updated_at: string;
  updated_by: string | null;
}

// ── Collaboration (used by later phases) ──────────────────────────
export interface WorkspaceCollaborator {
  id: string;
  resource_type: WorkspaceResourceKind;
  resource_id: string;
  username: string;
  role: WorkspaceRole;
  added_by: string | null;
  added_at: string;
}

/**
 * Doc-anchored comment: {from, to} character offsets within the editor.
 * Sheet-anchored comment: {sheet_id, cell_a1}.
 * The UI is responsible for interpreting based on resource_type.
 */
export type CommentAnchor =
  | { kind: "doc-range"; from: number; to: number }
  | { kind: "sheet-cell"; sheet_id: string; cell_a1: string };

export interface WorkspaceComment {
  id: string;
  resource_type: WorkspaceResourceKind;
  resource_id: string;
  parent_id: string | null;
  author: string;
  body: string;
  anchor: CommentAnchor | null;
  status: "open" | "resolved";
  kind: "comment" | "suggestion";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceVersion {
  id: string;
  resource_type: WorkspaceResourceKind;
  resource_id: string;
  snapshot: unknown;
  label: string | null;
  created_by: string;
  created_at: string;
}
