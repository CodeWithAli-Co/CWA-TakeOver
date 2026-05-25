/**
 * AssignmentsInbox.tsx — Admin manager for report_assignments.
 *
 * "Who owes what report, by when." Admins set assignments here
 * → assignees see them on /reports/submit → submissions hit the
 * Reports tab.
 *
 * Same Jira-style table layout as the other inbox tabs:
 *   · Toolbar (search, filter chips, density, count)
 *   · Sortable full-width table
 *   · Bulk select + cancel-many action
 *   · Slide-over editor for create + edit
 *
 * Non-admins see this as read-only — useful to see "what does
 * leadership expect from everyone" without being able to change
 * assignments.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertCircle, Plus, Trash2, Save,
  CalendarDays, RotateCcw, ArrowUp, ArrowDown, Check, X,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { SlideOver } from "./shared/SlideOver";
import { InboxToolbar, type Density } from "./shared/InboxToolbar";
import {
  REPORT_TEMPLATES,
  type ReportTypeKey,
} from "@/MyComponents/SettingNavComponents/reportTemplates";

type Status = "pending" | "submitted" | "canceled";
type Recurrence = "none" | "weekly" | "biweekly" | "monthly";

interface Assignment {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  assignee_username: string;
  type: ReportTypeKey;
  template_id: string;
  title: string;
  due_date: string;
  recurrence: Recurrence;
  status: Status;
  submitted_report_id: string | null;
  submitted_at: string | null;
  notes: string | null;
  company: string | null;
}

interface AppUserLite {
  username: string;
  role: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending", submitted: "Submitted", canceled: "Canceled",
};
const STATUS_COLOR: Record<Status, string> = {
  pending: "text-amber-400",
  submitted: "text-emerald-400",
  canceled: "text-zinc-500",
};

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "One-off", weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly",
};

const TYPE_LABEL: Record<ReportTypeKey, string> = {
  status: "Status",
  project_update: "Project",
  incident: "Incident",
  feedback: "Feedback",
  other: "Other",
};

const ADMIN_ROLES = new Set(["CEO", "COO", "CFO", "Admin", "admin"]);

type SortKey = "due" | "assignee" | "status" | "type" | "title";
type SortDir = "asc" | "desc";
interface SortState { key: SortKey; dir: SortDir; }

interface Props {
  refreshToken?: number;
}

export function AssignmentsInbox({ refreshToken }: Props = {}) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<AppUserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = ActiveUser();
  const username = (me?.[0] as any)?.username ?? "";
  const myRole = (me?.[0] as any)?.role ?? "";
  const isAdmin = ADMIN_ROLES.has(myRole);

  const [statusFilter, setStatusFilter] = useState<Status | "all">("pending");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<Recurrence | "all">("all");
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState<SortState>({ key: "due", dir: "asc" });
  const [density, setDensity] = useState<Density>(() => {
    try {
      const v = localStorage.getItem("cwa-assignments-density");
      return v === "compact" ? "compact" : "comfortable";
    } catch { return "comfortable"; }
  });
  useEffect(() => {
    try { localStorage.setItem("cwa-assignments-density", density); } catch { /* noop */ }
  }, [density]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorAssignment, setEditorAssignment] = useState<Assignment | null>(null);

  const reload = async () => {
    setLoading((cur) => (items.length === 0 ? true : cur));
    setRefreshing(true);
    setError(null);
    const [a, u] = await Promise.all([
      supabase
        .from("report_assignments")
        .select("*")
        .order("due_date", { ascending: true })
        .limit(500),
      supabase
        .from("app_users")
        .select("username, role")
        .not("username", "is", null),
    ]);
    if (a.error) {
      const msg = (a.error.message || "").toLowerCase();
      if (msg.includes("does not exist") || (a.error as any).code === "42P01") {
        setError("report_assignments table isn't set up. Run migrations/report_assignments_init.sql.");
      } else {
        setError(a.error.message);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setItems((a.data ?? []) as Assignment[]);
    setUsers((u.data ?? []) as AppUserLite[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && a.assignee_username !== assigneeFilter) return false;
      if (recurrenceFilter !== "all" && a.recurrence !== recurrenceFilter) return false;
      if (q) {
        const hay = `${a.title} ${a.assignee_username} ${a.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "assignee":
          return a.assignee_username.localeCompare(b.assignee_username) * sign;
        case "status":
          return a.status.localeCompare(b.status) * sign;
        case "type":
          return a.type.localeCompare(b.type) * sign;
        case "title":
          return a.title.localeCompare(b.title) * sign;
        case "due":
        default:
          return (Date.parse(a.due_date) - Date.parse(b.due_date)) * sign;
      }
    });
  }, [items, statusFilter, assigneeFilter, recurrenceFilter, search, sort]);

  const hasAnyFilter =
    statusFilter !== "pending" ||
    assigneeFilter !== "all" ||
    recurrenceFilter !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("pending");
    setAssigneeFilter("all");
    setRecurrenceFilter("all");
    setSearch("");
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const allSelected = visible.length > 0 && visible.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkCancel = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    if (!confirm(`Cancel ${selectedIds.size} assignment(s)?`)) return;
    const ids = [...selectedIds];
    const { error: err } = await supabase
      .from("report_assignments")
      .update({ status: "canceled" })
      .in("id", ids);
    if (err) { setError(err.message); return; }
    setSelectedIds(new Set());
    reload();
  };
  const bulkDelete = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} assignment(s)? This can't be undone.`)) return;
    const ids = [...selectedIds];
    const { error: err } = await supabase
      .from("report_assignments")
      .delete()
      .in("id", ids);
    if (err) { setError(err.message); return; }
    setSelectedIds(new Set());
    reload();
  };

  const openNew = () => {
    setEditorAssignment(null);
    setEditorOpen(true);
  };
  const openEdit = (a: Assignment) => {
    setEditorAssignment(a);
    setEditorOpen(true);
  };

  // Unique list of assignees for the filter dropdown.
  const assigneeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of items) set.add(a.assignee_username);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, assignee, or notes…"
        countLabel={`${visible.length} ${visible.length === 1 ? "assignment" : "assignments"}`}
        onClearFilters={hasAnyFilter ? clearFilters : undefined}
        density={density}
        onDensityChange={setDensity}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as Status | "all"),
            options: [
              { value: "pending",   label: "Pending" },
              { value: "submitted", label: "Submitted" },
              { value: "canceled",  label: "Canceled" },
              { value: "all",       label: "All statuses" },
            ],
          },
          {
            label: "Assignee",
            value: assigneeFilter,
            onChange: (v) => setAssigneeFilter(v),
            options: [
              { value: "all", label: "All assignees" },
              ...assigneeOptions.map((u) => ({ value: u, label: u })),
            ],
          },
          {
            label: "Recurrence",
            value: recurrenceFilter,
            onChange: (v) => setRecurrenceFilter(v as Recurrence | "all"),
            options: [
              { value: "all",      label: "All cadences" },
              { value: "none",     label: "One-off" },
              { value: "weekly",   label: "Weekly" },
              { value: "biweekly", label: "Biweekly" },
              { value: "monthly",  label: "Monthly" },
            ],
          },
        ]}
      />

      {/* New-assignment + bulk action row */}
      {isAdmin && (
        <div className="shrink-0 border-b border-border bg-card/30 px-5 py-2 flex items-center gap-3">
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New assignment
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-[11.5px] font-semibold text-foreground">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[10.5px] font-semibold text-primary hover:text-primary/80"
              >
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={bulkCancel}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:text-foreground hover:bg-muted/60"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-[11.5px] text-amber-200">{error}</p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading assignments…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-12 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-zinc-950">
                <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="mt-4 text-[13px] font-semibold text-foreground tracking-tight">
                {hasAnyFilter ? "No matches" : "No assignments yet"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
                {hasAnyFilter
                  ? "Try widening the filters."
                  : "Use \"New assignment\" to tell someone they owe a specific report by a specific date."}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
              <tr className="text-left">
                {isAdmin && (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                  </th>
                )}
                <Th width="w-28" label="Due" sortKey="due" sort={sort} onClick={toggleSort} />
                <Th label="Title" sortKey="title" sort={sort} onClick={toggleSort} />
                <Th width="w-36" label="Assignee" sortKey="assignee" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Type" sortKey="type" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Cadence" />
                <Th width="w-24" label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <Row
                  key={a.id}
                  assignment={a}
                  density={density}
                  selected={selectedIds.has(a.id)}
                  showCheckbox={isAdmin}
                  onToggleSelect={() => toggleOne(a.id)}
                  onOpen={() => openEdit(a)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {refreshing && (
        <div className="shrink-0 border-t border-border px-5 py-1.5 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing…
        </div>
      )}

      <AssignmentEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editorAssignment}
        currentUsername={username}
        canEdit={isAdmin}
        users={users}
        onSaved={() => {
          setEditorOpen(false);
          reload();
        }}
      />
    </div>
  );
}

// ── Th ──────────────────────────────────────────────────────────

function Th({
  label, width, sortKey, sort, onClick,
}: {
  label?: string;
  width?: string;
  sortKey?: SortKey;
  sort?: SortState;
  onClick?: (k: SortKey) => void;
}) {
  if (!label) return <th className={`${width ?? ""} px-2 py-2`} />;
  const sortable = !!sortKey && !!onClick;
  const isActive = sort?.key === sortKey;
  return (
    <th className={`${width ?? ""} px-2 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80`}>
      {sortable ? (
        <button
          type="button"
          onClick={() => onClick!(sortKey!)}
          className={[
            "inline-flex items-center gap-1 transition-colors",
            isActive ? "text-foreground" : "hover:text-foreground",
          ].join(" ")}
        >
          {label}
          {isActive && (sort!.dir === "asc"
            ? <ArrowUp className="h-2.5 w-2.5" />
            : <ArrowDown className="h-2.5 w-2.5" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

// ── Row ─────────────────────────────────────────────────────────

function Row({
  assignment, density, selected, showCheckbox, onToggleSelect, onOpen,
}: {
  assignment: Assignment;
  density: Density;
  selected: boolean;
  showCheckbox: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const py = density === "compact" ? "py-1.5" : "py-2.5";
  const today = startOfDay(new Date());
  const isOverdue =
    assignment.status === "pending" && new Date(assignment.due_date) < today;
  return (
    <tr
      onClick={onOpen}
      className={[
        "border-b border-border/40 cursor-pointer transition-colors",
        selected ? "bg-primary/[0.06] hover:bg-primary/[0.10]" : "hover:bg-muted/30",
      ].join(" ")}
    >
      {showCheckbox && (
        <td
          className={`px-3 ${py}`}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 cursor-pointer accent-primary"
          />
        </td>
      )}
      <td className={`px-2 ${py}`}>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] tabular-nums ${
          isOverdue ? "text-red-400 font-semibold" : "text-foreground/80"
        }`}>
          <CalendarDays className="h-3 w-3 opacity-60" />
          {formatDue(assignment.due_date)}
        </span>
      </td>
      <td className={`px-2 ${py} min-w-0`}>
        <span className="text-[12.5px] font-medium text-foreground tracking-tight truncate block max-w-[420px]">
          {assignment.title}
        </span>
      </td>
      <td className={`px-2 ${py} text-foreground/90 truncate`}>
        {assignment.assignee_username}
      </td>
      <td className={`px-2 ${py} text-foreground/80`}>
        {TYPE_LABEL[assignment.type]}
      </td>
      <td className={`px-2 ${py} text-muted-foreground inline-flex items-center gap-1`}>
        {assignment.recurrence !== "none" && <RotateCcw className="h-3 w-3 opacity-60" />}
        {RECURRENCE_LABEL[assignment.recurrence]}
      </td>
      <td className={`px-2 ${py}`}>
        <span className={`uppercase font-semibold text-[10.5px] tracking-wider ${STATUS_COLOR[assignment.status]}`}>
          {STATUS_LABEL[assignment.status]}
        </span>
      </td>
    </tr>
  );
}

// ── Editor (slide-over) ────────────────────────────────────────

function AssignmentEditor({
  open, onClose, initial, canEdit, currentUsername, users, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Assignment | null;
  canEdit: boolean;
  currentUsername: string;
  users: AppUserLite[];
  onSaved: () => void;
}) {
  const isNew = !initial;

  const [assignee, setAssignee] = useState("");
  const [type, setType] = useState<ReportTypeKey>("status");
  const [templateId, setTemplateId] = useState("weekly-checkin");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Re-seed editor state whenever it opens with a different
  // assignment, or transitions between new/edit.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAssignee(initial.assignee_username);
      setType(initial.type);
      setTemplateId(initial.template_id);
      setTitle(initial.title);
      setDueDate(initial.due_date);
      setRecurrence(initial.recurrence);
      setNotes(initial.notes ?? "");
    } else {
      // Defaults for a brand-new assignment.
      setAssignee(users[0]?.username ?? "");
      setType("status");
      setTemplateId("weekly-checkin");
      const first = REPORT_TEMPLATES.status[0];
      setTitle(first?.defaultTitle ?? "");
      const wk = new Date(); wk.setDate(wk.getDate() + 7);
      setDueDate(wk.toISOString().slice(0, 10));
      setRecurrence("weekly");
      setNotes("");
    }
    setErr(null);
  }, [open, initial, users]);

  // Auto-seed title when template changes (if title is empty or
  // matches the previous template default).
  useEffect(() => {
    const tpl = REPORT_TEMPLATES[type]?.find((t) => t.id === templateId);
    if (!tpl) return;
    const allDefaults = new Set(
      Object.values(REPORT_TEMPLATES).flat().map((t) => t.defaultTitle).filter(Boolean),
    );
    if (!title.trim() || allDefaults.has(title.trim())) {
      setTitle(tpl.defaultTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, templateId]);

  const save = async () => {
    setErr(null);
    if (!assignee) { setErr("Pick an assignee."); return; }
    if (!title.trim()) { setErr("Title is required."); return; }
    if (!dueDate) { setErr("Pick a due date."); return; }
    setSaving(true);
    const payload = {
      assignee_username: assignee,
      type,
      template_id: templateId,
      title: title.trim(),
      due_date: dueDate,
      recurrence,
      notes: notes.trim() || null,
      created_by: initial?.created_by ?? currentUsername,
    };
    const result = initial
      ? await supabase.from("report_assignments").update(payload).eq("id", initial.id)
      : await supabase.from("report_assignments").insert(payload);
    setSaving(false);
    if (result.error) { setErr(result.error.message); return; }
    onSaved();
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm("Delete this assignment? This can't be undone.")) return;
    setSaving(true);
    const { error } = await supabase.from("report_assignments").delete().eq("id", initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  const templatesForType = REPORT_TEMPLATES[type] ?? [];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {isNew ? "New assignment" : "Edit assignment"}
          </p>
          <p className="mt-1 text-[14px] font-semibold tracking-tight text-foreground leading-tight truncate">
            {title || "Untitled"}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          {!isNew && canEdit && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-semibold text-foreground/80 hover:text-foreground hover:bg-muted/60"
          >
            Close
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {isNew ? "Create" : "Save changes"}
            </button>
          )}
        </div>
      }
    >
      <div className="px-6 py-6 space-y-5">
        {!canEdit && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200">
            Read-only — only CEO / COO / CFO / Admin can change assignments.
          </div>
        )}

        <Field label="Assignee">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={!canEdit}
            className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
          >
            {users.length === 0 && <option value="">No users found</option>}
            {users.map((u) => (
              <option key={u.username} value={u.username}>
                {u.username}{u.role ? ` · ${u.role}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value as ReportTypeKey;
                setType(next);
                const first = REPORT_TEMPLATES[next]?.[0];
                if (first) setTemplateId(first.id);
              }}
              disabled={!canEdit}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
            >
              {(Object.keys(TYPE_LABEL) as ReportTypeKey[]).map((k) => (
                <option key={k} value={k}>{TYPE_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Template">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={!canEdit}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
            >
              {templatesForType.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. Weekly check-in"
            maxLength={140}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 disabled:opacity-60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
            />
          </Field>
          <Field label="Cadence">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              disabled={!canEdit}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
            >
              {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((k) => (
                <option key={k} value={k}>{RECURRENCE_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        </div>
        {recurrence !== "none" && (
          <p className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3" />
            After each submission, a new assignment auto-spawns {recurrence === "weekly" ? "7 days" : recurrence === "biweekly" ? "14 days" : "30 days"} later.
          </p>
        )}

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
            rows={3}
            placeholder="Context, format hints, what you're looking for…"
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 disabled:opacity-60 leading-relaxed"
          />
        </Field>

        {!isNew && initial?.submitted_at && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-200 flex items-start gap-2">
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Submitted on {new Date(initial.submitted_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </div>
        )}

        {err && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-300">
            {err}
          </p>
        )}
      </div>
    </SlideOver>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

// ── helpers ─────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  const today = startOfDay(new Date());
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < -1) return `${Math.abs(diff)}d ago`;
  if (diff === -1) return "yesterday";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `in ${diff}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
