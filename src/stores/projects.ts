/**
 * projects.ts — Supabase query + mutation hooks for /projects.
 *
 * Mirrors the conventions of `workspace.ts`:
 *   · One key-tree for everything (projectsKeys)
 *   · Read hooks return raw rows; the component owns presentation
 *   · Write hooks invalidate the right slice(s)
 *   · A single useProjectsRealtime() subscriber that any mounted
 *     /projects page can call.
 *
 * RLS does the heavy lifting for the C-level / member gating. The
 * client still surfaces the same checks in the UI (button state,
 * disabled affordances) so non-C-level users see the right thing
 * before they get a 403.
 *
 * See migrations/projects_baseline.sql for the table contract.
 */

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { companySupabase } from "@/routes/index.lazy";

// ============================================================
// Tables
// ============================================================
const PROJECTS_TABLE = "cwa_projects";
const MEMBERS_TABLE  = "cwa_project_members";
const ACTIVITY_TABLE = "cwa_project_activity";

// ============================================================
// Types
// ============================================================
export type ProjectStatus =
  | "to_do"
  | "in_progress"
  | "review"
  | "completed"
  | "on_hold";

export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type ProjectVisibility = "private" | "org";

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  visibility: ProjectVisibility;
  owner_supa_id: string;
  owner_username: string | null;
  due: string | null;        // ISO date (yyyy-mm-dd) or null
  progress: number;          // 0..100
  tasks_done: number;
  tasks_total: number;
  tags: string[];
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type ProjectMemberRole = "owner" | "lead" | "member" | "viewer";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_supa_id: string;
  username: string | null;
  role: ProjectMemberRole;
  added_at: string;
  added_by: string | null;
}

export type ProjectActivityKind =
  | "comment"
  | "status"
  | "member"
  | "axon"
  | "system";

export interface ProjectActivity {
  id: string;
  project_id: string;
  kind: ProjectActivityKind;
  actor_supa_id: string | null;
  actor_username: string | null;
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Query keys
// ============================================================
export const projectsKeys = {
  all:        ["projects"] as const,
  list:       (opts: { includeArchived?: boolean } = {}) =>
                ["projects", "list", opts.includeArchived ?? false] as const,
  one:        (id: string) => ["projects", "byId", id] as const,
  members:    (id: string) => ["projects", "members", id] as const,
  activity:   (id: string) => ["projects", "activity", id] as const,
};

// ============================================================
// List
// ============================================================
export function useProjects(opts: { includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: projectsKeys.list(opts),
    queryFn: async (): Promise<Project[]> => {
      let q = companySupabase
        .from(PROJECTS_TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (!opts.includeArchived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

// ============================================================
// Single project
// ============================================================
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectsKeys.one(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await companySupabase
  .from(PROJECTS_TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Project | null;
    },
  });
}

// ============================================================
// Members
// ============================================================
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectsKeys.members(projectId ?? ""),
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMember[]> => {
      const { data, error } = await companySupabase
  .from(MEMBERS_TABLE)
        .select("*")
        .eq("project_id", projectId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectMember[];
    },
  });
}

// ============================================================
// Activity feed
// ============================================================
export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: projectsKeys.activity(projectId ?? ""),
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectActivity[]> => {
      const { data, error } = await companySupabase
  .from(ACTIVITY_TABLE)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ProjectActivity[];
    },
  });
}

// ============================================================
// Mutations
// ============================================================

export interface CreateProjectInput {
  title: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  visibility?: ProjectVisibility;
  owner_supa_id: string;
  owner_username?: string | null;
  due?: string | null;
  tags?: string[];
  created_by?: string | null;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const insert = {
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "to_do",
        priority: input.priority ?? "medium",
        visibility: input.visibility ?? "org",
        owner_supa_id: input.owner_supa_id,
        owner_username: input.owner_username ?? null,
        due: input.due ?? null,
        tags: input.tags ?? [],
        created_by: input.created_by ?? null,
        updated_by: input.created_by ?? null,
      };
      const { data, error } = await companySupabase
  .from(PROJECTS_TABLE)
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      // Owner is auto-added as a member by the trigger — we still
      // append a "project created" activity row so the drawer has
      // something to show on first open.
      await companySupabase.from(ACTIVITY_TABLE).insert({
        project_id: data.id,
        kind: "system",
        actor_supa_id: input.owner_supa_id,
        actor_username: input.owner_username ?? null,
        body: "Project created.",
      });
      return data as Project;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: projectsKeys.all });
      if (row?.id) {
        qc.setQueryData(projectsKeys.one(row.id), row);
      }
    },
  });
}

export interface UpdateProjectPatch {
  title?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  visibility?: ProjectVisibility;
  owner_supa_id?: string;
  owner_username?: string | null;
  due?: string | null;
  progress?: number;
  tasks_done?: number;
  tasks_total?: number;
  tags?: string[];
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      patch: UpdateProjectPatch;
      updatedBy?: string | null;
    }) => {
      const { data, error } = await companySupabase
  .from(PROJECTS_TABLE)
        .update({ ...args.patch, updated_by: args.updatedBy ?? null })
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(projectsKeys.one(row.id), row);
      qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

/**
 * Soft-archive (default). Sets archived=true and archived_at=now().
 * The row stays in the table and a C-level can restore or hard-
 * delete from the archive view.
 */
export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await companySupabase
  .from(PROJECTS_TABLE)
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await companySupabase
  .from(PROJECTS_TABLE)
        .update({ archived: false, archived_at: null })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

/**
 * Hard delete. RLS gates this to C-level — non-C-level callers will
 * receive a 403 and the catch block will surface the error.
 */
export function useHardDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await companySupabase
  .from(PROJECTS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: projectsKeys.one(id) });
      qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

// ── Members ─────────────────────────────────────────────────
export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      project_id: string;
      user_supa_id: string;
      username?: string | null;
      role?: ProjectMemberRole;
      added_by?: string | null;
    }) => {
      const { data, error } = await companySupabase
  .from(MEMBERS_TABLE)
        .insert({
          project_id: args.project_id,
          user_supa_id: args.user_supa_id,
          username: args.username ?? null,
          role: args.role ?? "member",
          added_by: args.added_by ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      // Activity row so the drawer reflects the addition.
      await companySupabase.from(ACTIVITY_TABLE).insert({
        project_id: args.project_id,
        kind: "member",
        actor_supa_id: args.added_by ?? null,
        actor_username: null,
        body: `Added ${args.username ?? args.user_supa_id} to the project.`,
      });
      return data as ProjectMember;
    },
    onSuccess: (row) => {
      if (row?.project_id) {
        qc.invalidateQueries({ queryKey: projectsKeys.members(row.project_id) });
        qc.invalidateQueries({ queryKey: projectsKeys.activity(row.project_id) });
      }
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      project_id: string;
      member_id: string;
      removed_username?: string | null;
      removed_by?: string | null;
    }) => {
      const { error } = await companySupabase
  .from(MEMBERS_TABLE)
        .delete()
        .eq("id", args.member_id);
      if (error) throw error;
      await companySupabase.from(ACTIVITY_TABLE).insert({
        project_id: args.project_id,
        kind: "member",
        actor_supa_id: args.removed_by ?? null,
        actor_username: null,
        body: `Removed ${args.removed_username ?? "a member"} from the project.`,
      });
      return args;
    },
    onSuccess: (args) => {
      qc.invalidateQueries({ queryKey: projectsKeys.members(args.project_id) });
      qc.invalidateQueries({ queryKey: projectsKeys.activity(args.project_id) });
    },
  });
}

// ── Activity ────────────────────────────────────────────────
export function useAppendProjectActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      project_id: string;
      kind?: ProjectActivityKind;
      body: string;
      actor_supa_id?: string | null;
      actor_username?: string | null;
      meta?: Record<string, unknown>;
    }) => {
      const { data, error } = await companySupabase
  .from(ACTIVITY_TABLE)
        .insert({
          project_id: args.project_id,
          kind: args.kind ?? "comment",
          actor_supa_id: args.actor_supa_id ?? null,
          actor_username: args.actor_username ?? null,
          body: args.body,
          meta: args.meta ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectActivity;
    },
    onSuccess: (row) => {
      if (row?.project_id) {
        qc.invalidateQueries({ queryKey: projectsKeys.activity(row.project_id) });
      }
    },
  });
}

// ============================================================
// Realtime — mount once from the page component.
// ============================================================
export function useProjectsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = companySupabase
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: PROJECTS_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as Project | undefined;
          if (row?.id) qc.invalidateQueries({ queryKey: projectsKeys.one(row.id) });
          qc.invalidateQueries({ queryKey: projectsKeys.all });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: MEMBERS_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as ProjectMember | undefined;
          if (row?.project_id) {
            qc.invalidateQueries({ queryKey: projectsKeys.members(row.project_id) });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: ACTIVITY_TABLE },
        (payload) => {
          const row = (payload.new ?? payload.old) as ProjectActivity | undefined;
          if (row?.project_id) {
            qc.invalidateQueries({ queryKey: projectsKeys.activity(row.project_id) });
          }
        },
      )
      .subscribe();
    return () => {
      void companySupabase.removeChannel(ch);
    };
  }, [qc]);
}
