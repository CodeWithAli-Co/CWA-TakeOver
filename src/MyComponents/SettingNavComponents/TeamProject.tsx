/**
 * TeamProject.tsx — real projects + members, replacing the dummy
 * preset data that used to ship here.
 *
 * CEO / COO / CFO / Admin can:
 *   · Create projects scoped to a company (CodeWithAli or Simplicity)
 *   · Edit project name / description / status
 *   · Add / remove members from app_users (either company,
 *     elevated roles can mix members across brands on a project)
 *   · Delete projects (cascades to project_members)
 *
 * Everyone else sees the project list read-only.
 *
 * RLS enforces the elevated-role gate server-side; this UI just
 * reflects the same rule so non-admins don't see edit affordances.
 */

import { useEffect, useMemo, useState } from "react";
import {
  FolderKanban, Plus, Search, X, Loader2, AlertCircle, Trash2,
  Users, Pencil, Check, Building2, Circle,
} from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";

// ── Types ───────────────────────────────────────────────────────

type ProjectStatus = "active" | "paused" | "completed" | "cancelled";
type CompanyKey = "codewithali" | "simplicity";

interface Project {
  id: string;
  name: string;
  description: string | null;
  company: CompanyKey;
  status: ProjectStatus;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectMember {
  project_id: string;
  user_id: string;
  role: "member" | "lead";
}

interface AppUserLite {
  supa_id: string;
  username: string;
  role: string;
  company: string | null;
  avatarURL: string | null;
}

// ── Main component ──────────────────────────────────────────────

export default function TeamsAndProjects() {
  const { data: currentUser } = ActiveUser();
  const myRole = currentUser?.[0]?.role ?? "";
  const canEdit = ["CEO", "COO", "CFO", "Admin"].includes(myRole);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<AppUserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<CompanyKey | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Load ────────────────────────────────────────────────────
  const reload = async () => {
    setLoading(true);
    setError(null);

    const [p, m, u] = await Promise.all([
      companySupabase
        .from("projects")
        .select("id, name, description, company, status, owner_user_id, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      companySupabase
        .from("project_members")
        .select("project_id, user_id, role"),
      companySupabase
        .from("employee")
        .select("supa_id, username, role, company, avatarURL")
        .not("supa_id", "is", null)
        .order("username"),
    ]);

    if (p.error) {
      const msg = (p.error.message || "").toLowerCase();
      if (msg.includes("does not exist") || (p.error as any).code === "42P01") {
        setError(
          "Projects tables aren't set up yet. Run migrations/projects_init.sql on your Supabase project.",
        );
      } else {
        setError(p.error.message);
      }
      setLoading(false);
      return;
    }
    setProjects((p.data ?? []) as Project[]);
    setMembers((m.data ?? []) as ProjectMember[]);
    setUsers((u.data ?? []) as AppUserLite[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(
    () =>
      projects.filter((p) => companyFilter === "all" || p.company === companyFilter),
    [projects, companyFilter],
  );

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const selectedMembers = useMemo(
    () => members.filter((m) => m.project_id === selectedId),
    [members, selectedId],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
              Projects
            </h2>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">
            {canEdit
              ? "Create projects, pick members, track status. Leadership-only editing."
              : "Projects you can see. Ask leadership to add or change any of these."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setSelectedId(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-[11.5px] text-amber-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-3 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading projects…
        </div>
      ) : filtered.length === 0 && !isCreating ? (
        <EmptyState canEdit={canEdit} onCreate={() => setIsCreating(true)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <div className="space-y-2">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                memberCount={members.filter((m) => m.project_id === p.id).length}
                selected={p.id === selectedId}
                onClick={() => {
                  setSelectedId(p.id);
                  setIsCreating(false);
                }}
              />
            ))}
          </div>
          <aside className="lg:sticky lg:top-4 self-start">
            {isCreating ? (
              <CreateProjectPanel
                users={users}
                onCancel={() => setIsCreating(false)}
                onSaved={async () => {
                  setIsCreating(false);
                  await reload();
                }}
              />
            ) : selected ? (
              <ProjectDetailPanel
                project={selected}
                members={selectedMembers}
                users={users}
                canEdit={canEdit}
                onChanged={reload}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Pick a project to view details.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  canEdit, onCreate,
}: {
  canEdit: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center">
      <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="mt-3 text-[13px] font-semibold text-foreground">
        No projects yet.
      </p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        {canEdit
          ? "Start by creating your first project. You'll pick members from the current roster."
          : "Leadership hasn't set any projects up yet."}
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create a project
        </button>
      )}
    </div>
  );
}

function CompanyFilter({
  value, onChange,
}: {
  value: CompanyKey | "all";
  onChange: (v: CompanyKey | "all") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card/40 p-1 text-[11px]">
      {([
        ["all", "All", "#64748b"],
        ["codewithali", "CWA", "#DC2626"],
        ["simplicity", "Simplicity", "#059669"],
      ] as const).map(([v, label, dot]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v as CompanyKey | "all")}
          className={[
            "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-semibold transition-colors",
            value === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
          {label}
        </button>
      ))}
    </div>
  );
}

function ProjectCard({
  project, memberCount, selected, onClick,
}: {
  project: Project;
  memberCount: number;
  selected: boolean;
  onClick: () => void;
}) {
  const brandColor = project.company === "simplicity" ? "#059669" : "#DC2626";
  const brandLabel = project.company === "simplicity" ? "Simplicity" : "CodeWithAli";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-lg border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border bg-card/40 hover:border-border hover:bg-card/60",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: brandColor }}
              title={brandLabel}
            />
            <h3 className="text-[13.5px] font-semibold text-foreground truncate">
              {project.name}
            </h3>
          </div>
          {project.description && (
            <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2 leading-snug">
              {project.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[10.5px] text-muted-foreground">
            <StatusPill status={project.status} />
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
            <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const cfg: Record<ProjectStatus, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
    paused:    { label: "Paused",    cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    completed: { label: "Completed", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
    cancelled: { label: "Cancelled", cls: "border-border/40 bg-muted/10 text-muted-foreground" },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold ${c.cls}`}>
      <Circle className="h-1.5 w-1.5 fill-current" />
      {c.label}
    </span>
  );
}

function CreateProjectPanel({
  users, onCancel, onSaved,
}: {
  users: AppUserLite[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState<CompanyKey>("codewithali");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr("Project needs a name.");
      return;
    }
    setSaving(true);
    setErr(null);

    const ins = await companySupabase
.from("projects")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        company,
      })
      .select("id")
      .single();

    if (ins.error) {
      setErr(ins.error.message);
      setSaving(false);
      return;
    }

    if (memberIds.size > 0) {
      const rows = Array.from(memberIds).map((user_id) => ({
        project_id: (ins.data as any).id,
        user_id,
        role: "member" as const,
      }));
      const mi = await companySupabase.from("project_members").insert(rows);
      if (mi.error) {
        setErr(`Project created but couldn't add members: ${mi.error.message}`);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">New project</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Q4 Marketing Site Redesign"
          className="w-full rounded-md border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What this project is, who's it for, success criteria."
          className="w-full resize-none rounded-md border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Company</label>
        <div className="inline-flex rounded-md border border-border bg-background/50 p-1">
          {([["codewithali", "CodeWithAli", "#DC2626"], ["simplicity", "Simplicity", "#059669"]] as const).map(
            ([v, label, dot]) => (
              <button
                key={v}
                type="button"
                onClick={() => setCompany(v)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-[11.5px] font-semibold transition-colors",
                  company === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <MemberPicker
        users={users}
        selectedIds={memberIds}
        onToggle={(id) => {
          const next = new Set(memberIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          setMemberIds(next);
        }}
      />

      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {err}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {saving ? "Creating…" : "Create project"}
        </button>
      </div>
    </div>
  );
}

function ProjectDetailPanel({
  project, members, users, canEdit, onChanged, onClose,
}: {
  project: Project;
  members: ProjectMember[];
  users: AppUserLite[];
  canEdit: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Project>(project);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const memberIds = new Set(members.map((m) => m.user_id));
  const memberUsers = users.filter((u) => memberIds.has(u.supa_id));

  useEffect(() => { setDraft(project); setEditing(false); }, [project.id]);

  const saveEdit = async () => {
    setBusy(true); setErr(null);
    const { error } = await companySupabase
.from("projects")
      .update({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        status: draft.status,
        company: draft.company,
      })
      .eq("id", project.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    onChanged();
  };

  const toggleMember = async (userId: string) => {
    setBusy(true); setErr(null);
    if (memberIds.has(userId)) {
      const { error } = await companySupabase
  .from("project_members")
        .delete()
        .eq("project_id", project.id)
        .eq("user_id", userId);
      if (error) { setErr(error.message); setBusy(false); return; }
    } else {
      const { error } = await companySupabase
  .from("project_members")
        .insert({ project_id: project.id, user_id: userId, role: "member" });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    setBusy(false);
    onChanged();
  };

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}"? Member assignments are removed too. This can't be undone.`)) return;
    setBusy(true); setErr(null);
    const { error } = await companySupabase.from("projects").delete().eq("id", project.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onClose();
    onChanged();
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {editing ? (
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-[14px] font-semibold text-foreground outline-none focus:border-primary/50"
            />
          ) : (
            <h3 className="text-[14px] font-semibold text-foreground truncate">{project.name}</h3>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <StatusPill status={editing ? draft.status : project.status} />
            <span>· {memberUsers.length} {memberUsers.length === 1 ? "member" : "members"}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing ? (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Description</label>
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-background/50 px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })}
                className="w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary/50"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">Company</label>
              <select
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value as CompanyKey })}
                className="w-full rounded-md border border-border bg-background/50 px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary/50"
              >
                <option value="codewithali">CodeWithAli</option>
                <option value="simplicity">Simplicity</option>
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          {project.description && (
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{project.company === "simplicity" ? "Simplicity" : "CodeWithAli"}</span>
            <span>· Created {new Date(project.created_at).toLocaleDateString()}</span>
          </div>
        </>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-foreground/80 mb-2">Members</label>
        {canEdit ? (
          <MemberPicker
            users={users}
            selectedIds={memberIds}
            onToggle={toggleMember}
            compact
          />
        ) : memberUsers.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic">No members assigned.</p>
        ) : (
          <ul className="space-y-1.5">
            {memberUsers.map((u) => (
              <li key={u.supa_id} className="flex items-center gap-2 text-[12px]">
                <Avatar user={u} />
                <span className="text-foreground">{u.username}</span>
                <span className="text-muted-foreground">· {u.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {err}
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={deleteProject}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          {editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDraft(project); setEditing(false); setErr(null); }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy || !draft.name.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MemberPicker({
  users, selectedIds, onToggle, compact,
}: {
  users: AppUserLite[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div className="space-y-2">
      {!compact && (
        <label className="block text-[11px] font-semibold text-foreground/80">Team members</label>
      )}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or role…"
          className="w-full rounded-md border border-border bg-background/50 pl-7 pr-2 py-1.5 text-[12px] placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
        />
      </div>
      <div className={`${compact ? "max-h-48" : "max-h-52"} overflow-y-auto space-y-1 rounded-md border border-border bg-background/40 p-1`}>
        {filtered.length === 0 ? (
          <p className="p-3 text-center text-[11px] text-muted-foreground italic">No matches.</p>
        ) : (
          filtered.map((u) => {
            const on = selectedIds.has(u.supa_id);
            return (
              <button
                key={u.supa_id}
                type="button"
                onClick={() => onToggle(u.supa_id)}
                className={[
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors",
                  on ? "bg-primary/[0.12] text-primary-foreground" : "text-foreground/90 hover:bg-muted/60",
                ].join(" ")}
              >
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium truncate">{u.username}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    {u.role} · {u.company === "simplicity" ? "Simplicity" : "CodeWithAli"}
                  </p>
                </div>
                {on && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      <p className="text-[10.5px] text-muted-foreground">
        {selectedIds.size} selected
      </p>
    </div>
  );
}

function Avatar({ user }: { user: AppUserLite }) {
  const initials = (user.username ?? "??").slice(0, 2).toUpperCase();
  return user.avatarURL ? (
    <img
      src={user.avatarURL}
      alt={user.username}
      className="h-6 w-6 rounded-sm object-cover shrink-0"
    />
  ) : (
    <div className="h-6 w-6 rounded-sm bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0">
      {initials}
    </div>
  );
}
