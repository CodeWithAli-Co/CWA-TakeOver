/**
 * TemplateManager.tsx — admin UI to create / edit / delete the
 * onboarding TEMPLATES that drive what new hires actually see.
 *
 * Why templates exist:
 *   When someone is hired, ensureOnboarding picks a template that
 *   matches their (brand, employment_type) and copies its `item_list`
 *   into a fresh onboarding_instance + onboarding_items rows. The
 *   template is the REUSABLE recipe; the instance is one hire’s
 *   personalized copy.
 *
 *   Without templates: no checklist — just a generic auto-seeded
 *   fallback. With them: every CWA W-2 engineer gets exactly the
 *   right tasks; every Simplicity intern gets a different list;
 *   every 1099 contractor skips the "issue laptop" step.
 *
 * Lives as a tab on the Onboarding page next to "Instances".
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Save, X, ChevronUp, ChevronDown, Loader2,
  ClipboardList, Building2, GraduationCap, AlertTriangle,
  Sparkles, FileText, Users, Briefcase,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";

// ── Constants ─────────────────────────────────────────

const BRANDS = [
  { v: null, label: "Any brand" },
  { v: "codeWithAli", label: "CodeWithAli" },
  { v: "simplicity", label: "SimplicityFunds" },
] as const;

const EMP_TYPES = [
  { v: null, label: "Any type" },
  { v: "w2_full_time", label: "W-2 · Full time" },
  { v: "w2_part_time", label: "W-2 · Part time" },
  { v: "1099_contractor", label: "1099 Contractor" },
  { v: "intern", label: "Intern" },
] as const;

// ── Types ──────────────────────────────────────────────

interface ItemDraft {
  title: string;
  description: string;
  owner: "employer" | "employee";
}

interface DraftShape {
  id: string | null;
  name: string;
  brand: string | null;
  employment_type: string | null;
  items: ItemDraft[];
}

interface TemplateRow {
  id: string;
  name: string;
  brand: string | null;
  employment_type: string | null;
  item_list: Array<{
    title: string;
    description?: string;
    owner: "employer" | "employee";
    position?: number;
  }> | null;
  created_at?: string | null;
}

interface UsageCounts {
  [templateId: string]: { active: number; total: number };
}

const brandLabel = (v: string | null) =>
  BRANDS.find((b) => b.v === v)?.label ?? "Any brand";
const empTypeLabel = (v: string | null) =>
  EMP_TYPES.find((t) => t.v === v)?.label ?? "Any type";

// ── Component ──────────────────────────────────────

export function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [usage, setUsage] = useState<UsageCounts>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const tplRes = await supabase
        .from("onboarding_templates")
        .select("id, name, brand, employment_type, item_list, created_at")
        .order("name", { ascending: true });
      if (tplRes.error) throw tplRes.error;
      setTemplates((tplRes.data ?? []) as TemplateRow[]);

      const instRes = await supabase
        .from("onboarding_instances")
        .select("template_id, status");
      if (!instRes.error && instRes.data) {
        const u: UsageCounts = {};
        for (const r of instRes.data as Array<{ template_id: string | null; status: string }>) {
          if (!r.template_id) continue;
          const slot = u[r.template_id] ?? { active: 0, total: 0 };
          slot.total += 1;
          if (r.status === "active") slot.active += 1;
          u[r.template_id] = slot;
        }
        setUsage(u);
      }
    } catch (e) {
      setLoadError((e as Error).message ?? "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const beginEdit = (t: TemplateRow) => {
    setSelectedId(t.id);
    setDraft({
      id: t.id,
      name: t.name,
      brand: t.brand,
      employment_type: t.employment_type,
      items: (t.item_list ?? []).map((i) => ({
        title: i.title,
        description: i.description ?? "",
        owner: i.owner,
      })),
    });
    setSaveError(null);
  };

  const beginCreate = () => {
    setSelectedId(null);
    setDraft({
      id: null,
      name: "",
      brand: null,
      employment_type: null,
      items: [{ title: "", description: "", owner: "employee" }],
    });
    setSaveError(null);
  };

  const cancelDraft = () => {
    setDraft(null);
    setSaveError(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    const cleanItems = draft.items
      .filter((i) => i.title.trim().length > 0)
      .map((i, idx) => ({
        title: i.title.trim(),
        description: i.description.trim() || undefined,
        owner: i.owner,
        position: idx + 1,
      }));
    if (cleanItems.length === 0) {
      setSaveError("Add at least one task before saving.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        brand: draft.brand,
        employment_type: draft.employment_type,
        item_list: cleanItems,
      };
      if (draft.id) {
        const upd = await supabase
          .from("onboarding_templates")
          .update(payload)
          .eq("id", draft.id);
        if (upd.error) throw upd.error;
      } else {
        const ins = await supabase
          .from("onboarding_templates")
          .insert(payload)
          .select("id")
          .single();
        if (ins.error) throw ins.error;
        setSelectedId((ins.data as any).id);
      }
      setDraft(null);
      await refresh();
    } catch (e) {
      setSaveError((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (t: TemplateRow) => {
    const u = usage[t.id];
    const active = u?.active ?? 0;
    const total = u?.total ?? 0;
    const warning =
      active > 0
        ? `${active} ACTIVE instance${active === 1 ? "" : "s"} reference this template. Existing instances keep their copied items, but you won’t be able to re-spawn from this template. Delete anyway?`
        : total > 0
          ? `${total} historical instance${total === 1 ? "" : "s"} reference this template. Delete?`
          : `Delete “${t.name}”?`;
    if (!window.confirm(warning)) return;
    const del = await supabase.from("onboarding_templates").delete().eq("id", t.id);
    if (del.error) {
      alert(`Delete failed: ${del.error.message}`);
      return;
    }
    if (selectedId === t.id) {
      setSelectedId(null);
      setDraft(null);
    }
    await refresh();
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Left column — sidebar with template cards */}
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-border/40 bg-card/30">
        {/* Search-row + New button at the top */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11.5px] text-muted-foreground/80 pl-7 block py-1.5 select-none">
              {templates.length} {templates.length === 1 ? "recipe" : "recipes"}
            </span>
          </div>
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shrink-0"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {loadError && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              {loadError.toLowerCase().includes("does not exist")
                ? "onboarding_templates table missing. Run migrations/onboarding_init.sql."
                : loadError}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </div>
        ) : templates.length === 0 && !loadError ? (
          <SidebarEmpty onCreate={beginCreate} />
        ) : (
          <ul className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {templates.map((t) => {
              const isSelected = selectedId === t.id || draft?.id === t.id;
              const u = usage[t.id];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => beginEdit(t)}
                    data-active={isSelected}
                    className="group w-full text-left px-3 py-2.5 rounded-lg border border-border/50 bg-card/40 hover:bg-card hover:border-border transition-all data-[active=true]:border-primary/50 data-[active=true]:bg-primary/[0.06] data-[active=true]:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-semibold text-foreground truncate flex-1 min-w-0">
                        {t.name}
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {(t.item_list ?? []).length}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip icon={Building2} label={brandLabel(t.brand)} />
                      <Chip icon={Briefcase} label={empTypeLabel(t.employment_type)} />
                    </div>
                    {u && u.total > 0 && (
                      <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {u.active} active
                        {u.total > u.active && (
                          <span className="text-muted-foreground/60">· {u.total} all-time</span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Right column — editor / preview / empty */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {!draft && !selected ? (
          <CenterEmpty onCreate={beginCreate} hasTemplates={templates.length > 0} />
        ) : draft ? (
          <DraftEditor
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            saveError={saveError}
            onSave={saveDraft}
            onCancel={cancelDraft}
            onDelete={
              draft.id
                ? () => {
                    const t = templates.find((x) => x.id === draft.id);
                    if (t) deleteTemplate(t);
                  }
                : undefined
            }
          />
        ) : selected ? (
          <ReadOnlyView template={selected} onEdit={() => beginEdit(selected)} />
        ) : null}
      </main>
    </div>
  );
}

// ── Sidebar empty state ───────────────────────────

function SidebarEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-5 py-8">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
        <FileText className="h-5 w-5" />
      </div>
      <h3 className="text-[14px] font-bold text-foreground mb-1.5">No templates yet</h3>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">
        Create one and every new hire who matches its brand + employment type
        lands into it automatically. No more manual provisioning.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors w-full justify-center shadow-sm"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Create your first template
      </button>
    </div>
  );
}

// ── Center empty state ────────────────────────────

function CenterEmpty({ onCreate, hasTemplates }: { onCreate: () => void; hasTemplates: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="text-center max-w-[420px]">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
          <ClipboardList className="h-5 w-5" />
        </div>
        <h2 className="text-[16px] font-bold text-foreground tracking-tight">
          {hasTemplates ? "Pick a template" : "Templates power onboarding"}
        </h2>
        <p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed">
          {hasTemplates
            ? "Select a template from the left to view its tasks, or create a new one."
            : "A template is a reusable checklist. When a new hire signs in for the first time, the system picks the template that matches their brand + employment type and copies its tasks into their personal onboarding."}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          {hasTemplates ? "New template" : "Create your first template"}
        </button>
      </div>
    </div>
  );
}

// ── Draft editor ───────────────────────────────────

function DraftEditor({
  draft, setDraft, saving, saveError, onSave, onCancel, onDelete,
}: {
  draft: DraftShape;
  setDraft: (v: DraftShape) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const updateItem = (i: number, patch: Partial<ItemDraft>) =>
    setDraft({
      ...draft,
      items: draft.items.map((it, idx) =>
        idx === i ? { ...it, ...patch } : it,
      ),
    });
  const addItem = () =>
    setDraft({
      ...draft,
      items: [...draft.items, { title: "", description: "", owner: "employee" }],
    });
  const removeItem = (i: number) =>
    setDraft({
      ...draft,
      items: draft.items.filter((_, idx) => idx !== i),
    });
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.items.length) return;
    const next = [...draft.items];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, items: next });
  };

  return (
    <div className="mx-auto max-w-[820px] px-7 py-6">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            {draft.id ? "Edit template" : "New template"}
          </p>
          <h2 className="mt-0.5 text-[20px] font-bold text-foreground tracking-tight truncate">
            {draft.name.trim() || "Untitled template"}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground mb-6 leading-relaxed">
        Define the checklist new hires get when they match this template’s brand + employment type.
      </p>

      {saveError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
          <p className="text-[12px] text-destructive">{saveError}</p>
        </div>
      )}

      {/* Metadata card */}
      <Card>
        <SectionHeader icon={FileText} title="Identity" subtitle="How this template is named and matched." />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name" full>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. CWA W-2 Engineer"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </Field>
          <Field label="Brand" icon={Building2}>
            <select
              value={draft.brand ?? ""}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              {BRANDS.map((b) => (
                <option key={b.v ?? "any"} value={b.v ?? ""}>{b.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Employment type" icon={Briefcase}>
            <select
              value={draft.employment_type ?? ""}
              onChange={(e) => setDraft({ ...draft, employment_type: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              {EMP_TYPES.map((t) => (
                <option key={t.v ?? "any"} value={t.v ?? ""}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {/* Tasks card */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <SectionHeader
              icon={ClipboardList}
              title={`Tasks · ${draft.items.length}`}
              subtitle="Each task becomes a checkable item on the hire’s checklist."
              compact
            />
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/60 transition-colors shrink-0"
          >
            <Plus className="h-3 w-3" />
            Add task
          </button>
        </div>

        <ul className="space-y-1.5">
          {draft.items.map((it, i) => (
            <li
              key={i}
              className="rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 hover:border-border transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Reorder + index */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground/60 font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(i, 1)}
                      disabled={i === draft.items.length - 1}
                      className="text-muted-foreground/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Inputs */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    value={it.title}
                    onChange={(e) => updateItem(i, { title: e.target.value })}
                    placeholder="Task title (e.g. Sign NDA, Provision laptop)"
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                  <textarea
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Optional instructions, links, or context"
                    rows={1}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11.5px] text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                      Owner
                    </span>
                    <OwnerToggle
                      value={it.owner}
                      onChange={(o) => updateItem(i, { owner: o })}
                    />
                  </div>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-muted-foreground/60 hover:text-destructive transition-colors shrink-0 p-1"
                  aria-label="Remove task"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {draft.items.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 bg-card/20 px-4 py-6 text-center">
            <p className="text-[12px] text-muted-foreground">No tasks yet. Add one above.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Read-only template view ───────────────────────

function ReadOnlyView({ template, onEdit }: { template: TemplateRow; onEdit: () => void }) {
  return (
    <div className="mx-auto max-w-[820px] px-7 py-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            Template
          </p>
          <h2 className="mt-0.5 text-[20px] font-bold text-foreground tracking-tight truncate">
            {template.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md bg-primary px-3.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          Edit
        </button>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <Chip icon={Building2} label={brandLabel(template.brand)} large />
        <Chip icon={Briefcase} label={empTypeLabel(template.employment_type)} large />
        <Chip icon={ClipboardList} label={`${(template.item_list ?? []).length} tasks`} large />
      </div>

      <Card>
        <SectionHeader icon={ClipboardList} title="Tasks" subtitle="What new hires matching this template will see." />
        <ol className="space-y-1.5">
          {(template.item_list ?? []).map((it, i) => (
            <li
              key={i}
              className="rounded-lg border border-border/60 bg-card/30 px-3.5 py-2.5 hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] tabular-nums text-muted-foreground/60 font-mono shrink-0 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] font-semibold text-foreground flex-1">
                  {it.title}
                </span>
                <OwnerBadge owner={it.owner} />
              </div>
              {it.description && (
                <p className="mt-2 ml-9 text-[11.5px] text-muted-foreground leading-relaxed">
                  {it.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ── Reusable bits ────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 mb-3">
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon, title, subtitle, compact,
}: {
  icon: typeof FileText;
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "mb-3"}>
      <div className="flex items-center gap-2">
        <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3 w-3" />
        </div>
        <h3 className="text-[12.5px] font-semibold text-foreground">{title}</h3>
      </div>
      {subtitle && (
        <p className="mt-1 ml-8 text-[11.5px] text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Field({
  label, icon: Icon, full, children,
}: {
  label: string;
  icon?: typeof FileText;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "col-span-3 block" : "block"}>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold flex items-center gap-1">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Chip({
  icon: Icon, label, large,
}: {
  icon: typeof FileText;
  label: string;
  large?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 text-muted-foreground font-medium",
        large ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]",
      ].join(" ")}
    >
      <Icon className={large ? "h-3 w-3" : "h-2.5 w-2.5"} />
      {label}
    </span>
  );
}

function OwnerToggle({
  value, onChange,
}: {
  value: "employee" | "employer";
  onChange: (v: "employee" | "employer") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {(["employee", "employer"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          data-active={value === opt}
          className="rounded-sm px-2.5 py-0.5 text-[10.5px] font-semibold capitalize text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/15 data-[active=true]:text-primary transition-colors"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function OwnerBadge({ owner }: { owner: "employee" | "employer" }) {
  const isEmp = owner === "employee";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold border shrink-0",
        isEmp
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border",
      ].join(" ")}
    >
      {isEmp ? <GraduationCap className="h-2.5 w-2.5" /> : <Building2 className="h-2.5 w-2.5" />}
      {owner}
    </span>
  );
}
