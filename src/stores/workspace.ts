/**
 * workspace.ts — Supabase query + mutation hooks for the /workspace
 * product (docs + spreadsheets, with collaboration scaffolding for
 * later phases).
 *
 * Query keys (one tree, namespaced by resource type):
 *   workspace                              // root
 *   workspace, documents                   // list
 *   workspace, documents, byId             // group
 *   workspace, documents, byId, <id>       // single doc
 *   workspace, spreadsheets                // list
 *   workspace, spreadsheets, byId, <id>
 *   workspace, resources                   // union list (landing page)
 *
 * Reads land in their own keys so a single update only invalidates the
 * affected slice. Writes use setQueryData for the optimistic-feeling
 * "editor stays open during save" behavior, and invalidate the list
 * keys so the landing page picks up new rows.
 */

import { useEffect } from "react";
import {
  useQuery, useMutation, useQueryClient, type UseQueryOptions,
} from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import type {
  WorkspaceDocument,
  WorkspaceSpreadsheet,
  WorkspaceResource,
  WorkspaceVisibility,
  WorkspaceCollaborator,
  WorkspaceComment,
  WorkspaceResourceKind,
  WorkspaceRole,
  CommentAnchor,
  WorkspaceVersion,
  WorkspaceFolder,
  WorkspaceFolderCounts,
} from "./workspaceTypes";
import type { JSONContent } from "@tiptap/react";

const DOC_TABLE = "workspace_documents";
const SHEET_TABLE = "workspace_spreadsheets";
const COLLAB_TABLE = "workspace_collaborators";
const COMMENT_TABLE = "workspace_comments";
const VERSION_TABLE = "workspace_versions";
const FOLDER_TABLE = "workspace_folders";
const FOLDER_COUNTS_VIEW = "workspace_folder_counts";

// ============================================================
// Query keys
// ============================================================
export const workspaceKeys = {
  all:              ["workspace"] as const,
  documents:        ["workspace", "documents"] as const,
  document:         (id: string) => ["workspace", "documents", "byId", id] as const,
  spreadsheets:     ["workspace", "spreadsheets"] as const,
  spreadsheet:      (id: string) => ["workspace", "spreadsheets", "byId", id] as const,
  resources:        ["workspace", "resources"] as const,
  folders:          ["workspace", "folders"] as const,
  folderCounts:     ["workspace", "folders", "counts"] as const,
  collaborators:    (kind: WorkspaceResourceKind, id: string) =>
                      ["workspace", "collaborators", kind, id] as const,
  comments:         (kind: WorkspaceResourceKind, id: string) =>
                      ["workspace", "comments", kind, id] as const,
  versions:         (kind: WorkspaceResourceKind, id: string) =>
                      ["workspace", "versions", kind, id] as const,
};

// ============================================================
// Combined list — docs + sheets merged for the landing page.
// ============================================================
export function useWorkspaceResources(
  opts: { includeArchived?: boolean } = {},
) {
  return useQuery({
    queryKey: [...workspaceKeys.resources, opts.includeArchived ?? false],
    queryFn: async (): Promise<WorkspaceResource[]> => {
      // Two parallel queries — Supabase doesn't natively UNION tables.
      const [docsRes, sheetsRes] = await Promise.all([
        supabase
          .from(DOC_TABLE)
          .select("id, title, owner, visibility, icon, folder_id, updated_at, updated_by, archived")
          .order("updated_at", { ascending: false }),
        supabase
          .from(SHEET_TABLE)
          .select("id, title, owner, visibility, icon, folder_id, updated_at, updated_by, archived")
          .order("updated_at", { ascending: false }),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (sheetsRes.error) throw sheetsRes.error;

      const docs: WorkspaceResource[] = (docsRes.data ?? [])
        .filter((r: any) => opts.includeArchived || !r.archived)
        .map((r: any) => ({ kind: "document", ...r }));
      const sheets: WorkspaceResource[] = (sheetsRes.data ?? [])
        .filter((r: any) => opts.includeArchived || !r.archived)
        .map((r: any) => ({ kind: "spreadsheet", ...r }));

      // Merge + re-sort by updated_at desc.
      return [...docs, ...sheets].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      );
    },
  });
}

// ============================================================
// Documents
// ============================================================
export function useDocument(
  id: string | null | undefined,
  options: Omit<UseQueryOptions<WorkspaceDocument | null>, "queryKey" | "queryFn"> = {},
) {
  return useQuery({
    queryKey: workspaceKeys.document(id ?? ""),
    enabled: !!id && (options.enabled ?? true),
    queryFn: async (): Promise<WorkspaceDocument | null> => {
      const { data, error } = await supabase
        .from(DOC_TABLE)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as WorkspaceDocument | null) ?? null;
    },
    ...options,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      owner: string;
      title?: string;
      content?: JSONContent;
      visibility?: WorkspaceVisibility;
    }): Promise<WorkspaceDocument> => {
      const { data, error } = await supabase
        .from(DOC_TABLE)
        .insert({
          owner: vars.owner,
          title: vars.title ?? "Untitled",
          content: vars.content ?? { type: "doc", content: [] },
          visibility: vars.visibility ?? "private",
          updated_by: vars.owner,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceDocument;
    },
    onSuccess: (doc) => {
      qc.setQueryData(workspaceKeys.document(doc.id), doc);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
      qc.invalidateQueries({ queryKey: workspaceKeys.documents });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "visibility" | "icon" | "archived">>;
      updatedBy: string;
    }): Promise<WorkspaceDocument> => {
      const { data, error } = await supabase
        .from(DOC_TABLE)
        .update({ ...vars.patch, updated_by: vars.updatedBy })
        .eq("id", vars.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceDocument;
    },
    onSuccess: (doc) => {
      qc.setQueryData(workspaceKeys.document(doc.id), doc);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from(DOC_TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
      qc.invalidateQueries({ queryKey: workspaceKeys.documents });
    },
  });
}

// ============================================================
// Spreadsheets
// ============================================================
export function useSpreadsheet(id: string | null | undefined) {
  return useQuery({
    queryKey: workspaceKeys.spreadsheet(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<WorkspaceSpreadsheet | null> => {
      const { data, error } = await supabase
        .from(SHEET_TABLE)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as WorkspaceSpreadsheet | null) ?? null;
    },
  });
}

export function useCreateSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      owner: string;
      title?: string;
      visibility?: WorkspaceVisibility;
    }): Promise<WorkspaceSpreadsheet> => {
      const { data, error } = await supabase
        .from(SHEET_TABLE)
        .insert({
          owner: vars.owner,
          title: vars.title ?? "Untitled",
          snapshot: {},
          visibility: vars.visibility ?? "private",
          updated_by: vars.owner,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceSpreadsheet;
    },
    onSuccess: (sheet) => {
      qc.setQueryData(workspaceKeys.spreadsheet(sheet.id), sheet);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
      qc.invalidateQueries({ queryKey: workspaceKeys.spreadsheets });
    },
  });
}

export function useUpdateSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      patch: Partial<Pick<WorkspaceSpreadsheet, "title" | "snapshot" | "visibility" | "icon" | "archived">>;
      updatedBy: string;
    }): Promise<WorkspaceSpreadsheet> => {
      const { data, error } = await supabase
        .from(SHEET_TABLE)
        .update({ ...vars.patch, updated_by: vars.updatedBy })
        .eq("id", vars.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceSpreadsheet;
    },
    onSuccess: (sheet) => {
      qc.setQueryData(workspaceKeys.spreadsheet(sheet.id), sheet);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
    },
  });
}

export function useDeleteSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from(SHEET_TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
      qc.invalidateQueries({ queryKey: workspaceKeys.spreadsheets });
    },
  });
}

// ============================================================
// Collaborators
// ============================================================
export function useCollaborators(
  kind: WorkspaceResourceKind,
  resourceId: string | null | undefined,
) {
  return useQuery({
    queryKey: workspaceKeys.collaborators(kind, resourceId ?? ""),
    enabled: !!resourceId,
    queryFn: async (): Promise<WorkspaceCollaborator[]> => {
      const { data, error } = await supabase
        .from(COLLAB_TABLE)
        .select("*")
        .eq("resource_type", kind)
        .eq("resource_id", resourceId!)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkspaceCollaborator[];
    },
  });
}

export function useAddCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      kind: WorkspaceResourceKind;
      resourceId: string;
      username: string;
      role: WorkspaceRole;
      addedBy: string;
    }): Promise<WorkspaceCollaborator> => {
      const { data, error } = await supabase
        .from(COLLAB_TABLE)
        .insert({
          resource_type: vars.kind,
          resource_id: vars.resourceId,
          username: vars.username,
          role: vars.role,
          added_by: vars.addedBy,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceCollaborator;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.collaborators(row.resource_type, row.resource_id),
      });
    },
  });
}

export function useUpdateCollaboratorRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      kind: WorkspaceResourceKind;
      resourceId: string;
      role: WorkspaceRole;
    }): Promise<WorkspaceCollaborator> => {
      const { data, error } = await supabase
        .from(COLLAB_TABLE)
        .update({ role: vars.role })
        .eq("id", vars.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceCollaborator;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.collaborators(row.resource_type, row.resource_id),
      });
    },
  });
}

export function useRemoveCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      kind: WorkspaceResourceKind;
      resourceId: string;
    }): Promise<void> => {
      const { error } = await supabase.from(COLLAB_TABLE).delete().eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.collaborators(vars.kind, vars.resourceId),
      });
    },
  });
}

// ============================================================
// Comments
// ============================================================
export function useComments(
  kind: WorkspaceResourceKind,
  resourceId: string | null | undefined,
) {
  return useQuery({
    queryKey: workspaceKeys.comments(kind, resourceId ?? ""),
    enabled: !!resourceId,
    queryFn: async (): Promise<WorkspaceComment[]> => {
      const { data, error } = await supabase
        .from(COMMENT_TABLE)
        .select("*")
        .eq("resource_type", kind)
        .eq("resource_id", resourceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkspaceComment[];
    },
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      kind: WorkspaceResourceKind;
      resourceId: string;
      author: string;
      body: string;
      anchor?: CommentAnchor | null;
      parentId?: string | null;
      commentKind?: "comment" | "suggestion";
    }): Promise<WorkspaceComment> => {
      const { data, error } = await supabase
        .from(COMMENT_TABLE)
        .insert({
          resource_type: vars.kind,
          resource_id: vars.resourceId,
          author: vars.author,
          body: vars.body,
          anchor: vars.anchor ?? null,
          parent_id: vars.parentId ?? null,
          kind: vars.commentKind ?? "comment",
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceComment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.comments(row.resource_type, row.resource_id),
      });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      kind: WorkspaceResourceKind;
      resourceId: string;
      body?: string;
      status?: "open" | "resolved";
    }): Promise<WorkspaceComment> => {
      const patch: any = {};
      if (vars.body !== undefined) patch.body = vars.body;
      if (vars.status !== undefined) patch.status = vars.status;
      const { data, error } = await supabase
        .from(COMMENT_TABLE)
        .update(patch)
        .eq("id", vars.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceComment;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.comments(row.resource_type, row.resource_id),
      });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      kind: WorkspaceResourceKind;
      resourceId: string;
    }): Promise<void> => {
      const { error } = await supabase.from(COMMENT_TABLE).delete().eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.comments(vars.kind, vars.resourceId),
      });
    },
  });
}

// ============================================================
// Version history
// ============================================================
export function useVersions(
  kind: WorkspaceResourceKind,
  resourceId: string | null | undefined,
) {
  return useQuery({
    queryKey: workspaceKeys.versions(kind, resourceId ?? ""),
    enabled: !!resourceId,
    queryFn: async (): Promise<WorkspaceVersion[]> => {
      const { data, error } = await supabase
        .from(VERSION_TABLE)
        .select("*")
        .eq("resource_type", kind)
        .eq("resource_id", resourceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceVersion[];
    },
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      kind: WorkspaceResourceKind;
      resourceId: string;
      snapshot: unknown;
      createdBy: string;
      label?: string | null;
    }): Promise<WorkspaceVersion> => {
      const { data, error } = await supabase
        .from(VERSION_TABLE)
        .insert({
          resource_type: vars.kind,
          resource_id: vars.resourceId,
          snapshot: vars.snapshot,
          created_by: vars.createdBy,
          label: vars.label ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceVersion;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: workspaceKeys.versions(row.resource_type, row.resource_id),
      });
    },
  });
}

/**
 * Restore a document to a previous version. We write to BOTH `content`
 * and `y_state` — clearing y_state forces the next mount to re-bootstrap
 * from the restored content JSON (so connected clients that refresh see
 * the rolled-back doc). Live collaborators won't auto-sync; they have
 * to reload to pick up the restored state.
 */
export function useRestoreDocumentVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      docId: string;
      snapshot: unknown;
      restoredBy: string;
    }): Promise<WorkspaceDocument> => {
      const { data, error } = await supabase
        .from(DOC_TABLE)
        .update({
          content: vars.snapshot,
          y_state: null,
          updated_by: vars.restoredBy,
        })
        .eq("id", vars.docId)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceDocument;
    },
    onSuccess: (doc) => {
      qc.setQueryData(workspaceKeys.document(doc.id), doc);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
    },
  });
}

export function useRestoreSpreadsheetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      sheetId: string;
      snapshot: unknown;
      restoredBy: string;
    }): Promise<WorkspaceSpreadsheet> => {
      const { data, error } = await supabase
        .from(SHEET_TABLE)
        .update({
          snapshot: vars.snapshot,
          updated_by: vars.restoredBy,
        })
        .eq("id", vars.sheetId)
        .select("*")
        .single();
      if (error) throw error;
      return data as WorkspaceSpreadsheet;
    },
    onSuccess: (sheet) => {
      qc.setQueryData(workspaceKeys.spreadsheet(sheet.id), sheet);
      qc.invalidateQueries({ queryKey: workspaceKeys.resources });
    },
  });
}

/**
 * Combined list of recent edits across docs + sheets for the activity
 * feed widget. Uses the same data the landing list already fetches —
 * we just expose a wrapper that limits + sorts in a feed-friendly way.
 */
export function useRecentActivity(limit = 12) {
  return useQuery({
    queryKey: [...workspaceKeys.resources, "activity", limit],
    queryFn: async (): Promise<WorkspaceResource[]> => {
      const [docs, sheets] = await Promise.all([
        supabase
          .from(DOC_TABLE)
          .select("id, title, owner, visibility, icon, updated_at, updated_by, archived")
          .eq("archived", false)
          .order("updated_at", { ascending: false })
          .limit(limit),
        supabase
          .from(SHEET_TABLE)
          .select("id, title, owner, visibility, icon, updated_at, updated_by, archived")
          .eq("archived", false)
          .order("updated_at", { ascending: false })
          .limit(limit),
      ]);
      if (docs.error) throw docs.error;
      if (sheets.error) throw sheets.error;
      const merged = [
        ...((docs.data ?? []) as any[]).map((r) => ({ ...r, kind: "document" as const })),
        ...((sheets.data ?? []) as any[]).map((r) => ({ ...r, kind: "spreadsheet" as const })),
      ];
      return merged
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, limit);
    },
  });
}

// ============================================================
// Realtime — invalidate keys on remote edits.
// Mount once in a parent component (WorkspacePage / detail pages).
// ============================================================
export function useWorkspaceRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("workspace-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DOC_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as WorkspaceDocument | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: workspaceKeys.document(row.id) });
          qc.invalidateQueries({ queryKey: workspaceKeys.resources });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SHEET_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as WorkspaceSpreadsheet | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: workspaceKeys.spreadsheet(row.id) });
          qc.invalidateQueries({ queryKey: workspaceKeys.resources });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COLLAB_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as WorkspaceCollaborator | undefined;
          if (row) {
            qc.invalidateQueries({
              queryKey: workspaceKeys.collaborators(row.resource_type, row.resource_id),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMMENT_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as WorkspaceComment | undefined;
          if (row) {
            qc.invalidateQueries({
              queryKey: workspaceKeys.comments(row.resource_type, row.resource_id),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: VERSION_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as WorkspaceVersion | undefined;
          if (row) {
            qc.invalidateQueries({
              queryKey: workspaceKeys.versions(row.resource_type, row.resource_id),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: FOLDER_TABLE },
        () => {
          qc.invalidateQueries({ queryKey: workspaceKeys.folders });
          qc.invalidateQueries({ queryKey: workspaceKeys.folderCounts });
          qc.invalidateQueries({ queryKey: workspaceKeys.resources });
        },
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [qc]);
}

// ============================================================
// Folders — list, create, rename, move, delete
// ============================================================

/** Flat list of all folders. The UI walks the parent_folder_id
 *  pointers to build the tree. Sorted by position within each
 *  parent level, with stable fallback to created_at. */
export function useFolders() {
  return useQuery({
    queryKey: workspaceKeys.folders,
    queryFn: async (): Promise<WorkspaceFolder[]> => {
      const { data, error } = await supabase
        .from(FOLDER_TABLE)
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkspaceFolder[];
    },
    staleTime: 30_000,
  });
}

/** Aggregated counts per folder, served by the workspace_folder_counts
 *  view defined in the migration. Returns a Map<folder_id, totals>
 *  for O(1) lookup in the tree renderer. */
export function useFolderCounts() {
  return useQuery({
    queryKey: workspaceKeys.folderCounts,
    queryFn: async (): Promise<Map<string, WorkspaceFolderCounts>> => {
      const { data, error } = await supabase
        .from(FOLDER_COUNTS_VIEW)
        .select("*");
      if (error) throw error;
      const m = new Map<string, WorkspaceFolderCounts>();
      for (const row of (data ?? []) as WorkspaceFolderCounts[]) {
        m.set(row.folder_id, row);
      }
      return m;
    },
    staleTime: 30_000,
  });
}

function useFolderInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: workspaceKeys.folders });
    qc.invalidateQueries({ queryKey: workspaceKeys.folderCounts });
    qc.invalidateQueries({ queryKey: workspaceKeys.resources });
  };
}

export function useCreateFolder() {
  const invalidate = useFolderInvalidate();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      owner: string;
      parent_folder_id?: string | null;
      icon?: string | null;
      color?: string | null;
    }) => {
      // Sibling position = max(position) + 1 among siblings.
      const { data: siblings } = await supabase
        .from(FOLDER_TABLE)
        .select("position")
        .eq("parent_folder_id", input.parent_folder_id ?? null)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (siblings?.[0]?.position ?? 0) + 1;

      const { data, error } = await supabase
        .from(FOLDER_TABLE)
        .insert({
          name: input.name,
          owner: input.owner,
          parent_folder_id: input.parent_folder_id ?? null,
          icon: input.icon ?? null,
          color: input.color ?? null,
          position: nextPos,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkspaceFolder;
    },
    onSuccess: invalidate,
  });
}

export function useRenameFolder() {
  const invalidate = useFolderInvalidate();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from(FOLDER_TABLE)
        .update({ name: input.name })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Move a folder to a different parent (or root if newParent is null).
 *  Lightweight guard: refuses to set parent_folder_id to a descendant
 *  of self, which would create a cycle. The DB has no recursive check
 *  so we enforce client-side. */
export function useMoveFolder() {
  const invalidate = useFolderInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; newParentId: string | null }) => {
      if (input.id === input.newParentId) {
        throw new Error("A folder can't be its own parent.");
      }
      // Cycle guard
      if (input.newParentId) {
        const folders =
          qc.getQueryData<WorkspaceFolder[]>(workspaceKeys.folders) ?? [];
        const descendants = collectDescendantIds(folders, input.id);
        if (descendants.has(input.newParentId)) {
          throw new Error("Can't move a folder into its own descendant.");
        }
      }
      const { error } = await supabase
        .from(FOLDER_TABLE)
        .update({ parent_folder_id: input.newParentId })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useFolderInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      // ON DELETE CASCADE on workspace_folders takes care of child folders.
      // ON DELETE SET NULL on workspace_documents.folder_id /
      // workspace_spreadsheets.folder_id falls the contained resources
      // back to the workspace root instead of vaporizing them.
      const { error } = await supabase
        .from(FOLDER_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Move a doc or sheet into / out of a folder. Pass null to drop it
 *  back to the root. */
export function useMoveResourceToFolder() {
  const invalidate = useFolderInvalidate();
  return useMutation({
    mutationFn: async (input: {
      kind: WorkspaceResourceKind;
      id: string;
      folder_id: string | null;
    }) => {
      const table = input.kind === "document" ? DOC_TABLE : SHEET_TABLE;
      const { error } = await supabase
        .from(table)
        .update({ folder_id: input.folder_id })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Walks the folder list and returns every id that is a descendant
 *  of `rootId` (excluding rootId itself). Used by the move-folder
 *  cycle guard. */
function collectDescendantIds(folders: WorkspaceFolder[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    const p = f.parent_folder_id ?? "__root__";
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p)!.push(f.id);
  }
  const out = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return out;
}
