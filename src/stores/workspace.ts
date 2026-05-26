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
} from "./workspaceTypes";
import type { JSONContent } from "@tiptap/react";

const DOC_TABLE = "workspace_documents";
const SHEET_TABLE = "workspace_spreadsheets";

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
          .select("id, title, owner, visibility, icon, updated_at, updated_by, archived")
          .order("updated_at", { ascending: false }),
        supabase
          .from(SHEET_TABLE)
          .select("id, title, owner, visibility, icon, updated_at, updated_by, archived")
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
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [qc]);
}
