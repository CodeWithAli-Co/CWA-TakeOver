/**
 * TemplateManager.tsx — admin UI to create / edit / delete the
 * onboarding TEMPLATES that drive what new hires actually see.
 *
 * Why templates exist:
 *   When someone is hired, ensureOnboarding picks a template that
 *   matches their (brand, employment_type) and copies its `item_list`
 *   into a fresh onboarding_instance + onboarding_items rows. The
 *   template is the REUSABLE recipe; the instance is one hire\'s
 *   personalized copy.
 *
 *   Without templates: no checklist — just a generic auto-seeded
 *   fallback. With them: every CWA W-2 engineer gets exactly the
 *   right tasks; every Simplicity intern gets a different list;
 *   every 1099 contractor skips the "issue laptop" step. Etc.
 *
 * Lives as a tab on the Onboarding page next to "Instances".
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Save, X, ChevronUp, ChevronDown, Loader2,
  ClipboardList, Building2, GraduationCap, AlertTriangle,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";

// ── Types ──────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────

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

      // Usage: how many instances reference each template?
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
        ? `${active} ACTIVE instance${active === 1 ? "" : "s"} reference this template. Existing instances keep their copied items, but you won\'t be able to re-spawn from this template. Delete anyway?`
        : total > 0
          ? `${total} historical instance${total === 1 ? "" : "s"} reference this template. Delete?`
          : `Delete "${t.name}"?`;
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
      {/* Left — list */}
      <aside className="flex w-[340px] flex-col border-r border-border/50 bg-card/30">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Templates · {templates.length}
          </span>
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[10.5px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {loadError && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
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
          <div className="px-4 py-6 text-[12px] text-muted-foreground leading-relaxed">
            No templates yet. Click <strong>New</strong> to create one — it\'s the
            checklist new hires get when they sign in.
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {templates.map((t) => {
              const isSelected = selectedId === t.id;
              const u = usage[t.id];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => beginEdit(t)}
                    className={[
                      "w-full text-left px-3 py-2 rounded-sm border",
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "border-transparent hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <div className="text-[12.5px] font-semibold text-foreground truncate">
                      {t.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-2.5 w-2.5" />
                        {t.brand ?? "any"}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-2.5 w-2.5" />
                        {t.employment_type ?? "any"}
                      </span>
                      <span>·</span>
                      <span>{(t.item_list ?? []).length} tasks</span>
                      {u && u.total > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            {u.active} active{u.total > u.active ? ` (${u.total} all-time)` : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Right — editor */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {!draft && !selected ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-[12px] text-muted-foreground">
                Pick a template to edit, or click <strong>New</strong> to create one.
              </p>
            </div>
          </div>
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
      items: draft.items.map((it: ItemDraft, idx: number) =>
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
      items: draft.items.filter((_: ItemDraft, idx: number) => idx !== i),
    });
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.items.length) return;
    const next = [...draft.items];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, items: next });
  };

  return (
    <div className="px-6 py-5 max-w-[840px]">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-[16px] font-bold text-foreground">
          {draft.id ? "Edit template" : "New template"}
        </h2>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-sm border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-3 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Field label="Name" full>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. CWA W-2 Engineer"
            className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-[12px]"
          />
        </Field>
        <Field label="Brand">
          <select
            value={draft.brand ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, brand: e.target.value || null })
            }
            className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-[12px]"
          >
            {BRANDS.map((b) => (
              <option key={b.v ?? "any"} value={b.v ?? ""}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type">
          <select
            value={draft.employment_type ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, employment_type: e.target.value || null })
            }
            className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-[12px]"
          >
            {EMP_TYPES.map((t) => (
              <option key={t.v ?? "any"} value={t.v ?? ""}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          Tasks ({draft.items.length})
        </span>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[10.5px] font-medium hover:bg-muted/60"
        >
          <Plus className="h-2.5 w-2.5" />
          Add task
        </button>
      </div>

      <ul className="space-y-2">
        {draft.items.map((it: ItemDraft, i: number) => (
          <li
            key={i}
            className="rounded-sm border border-border bg-card/40 px-3 py-2.5 flex items-start gap-2"
          >
            <div className="flex flex-col gap-0.5 mt-1">
              <button
                type="button"
                onClick={() => moveItem(i, -1)}
                disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(i, 1)}
                disabled={i === draft.items.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                value={it.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                placeholder="Task title"
                className="w-full rounded-sm border border-border bg-background px-2 py-1 text-[12px] font-medium"
              />
              <textarea
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Optional description / instructions"
                rows={2}
                className="w-full rounded-sm border border-border bg-background px-2 py-1 text-[11.5px] text-muted-foreground resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Owner
                </span>
                <button
                  type="button"
                  onClick={() => updateItem(i, { owner: "employee" })}
                  className={[
                    "rounded-sm px-2 py-0.5 text-[10.5px] font-semibold border",
                    it.owner === "employee"
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-background text-muted-foreground border-border",
                  ].join(" ")}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => updateItem(i, { owner: "employer" })}
                  className={[
                    "rounded-sm px-2 py-0.5 text-[10.5px] font-semibold border",
                    it.owner === "employer"
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-background text-muted-foreground border-border",
                  ].join(" ")}
                >
                  Employer
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove task"
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadOnlyView({ template, onEdit }: { template: TemplateRow; onEdit: () => void }) {
  return (
    <div className="px-6 py-5 max-w-[840px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-bold text-foreground">{template.name}</h2>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-sm bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Edit
        </button>
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        {template.brand ?? "Any brand"} · {template.employment_type ?? "Any type"} ·{" "}
        {(template.item_list ?? []).length} tasks
      </p>
      <ol className="mt-4 space-y-2">
        {(template.item_list ?? []).map((it, i) => (
          <li
            key={i}
            className="rounded-sm border border-border bg-card/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[12.5px] font-semibold text-foreground">
                {it.title}
              </span>
              <span
                className={[
                  "ml-auto rounded-sm border px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider font-semibold",
                  it.owner === "employee"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border",
                ].join(" ")}
              >
                {it.owner}
              </span>
            </div>
            {it.description && (
              <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
                {it.description}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({
  label, full, children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "col-span-3 block" : "block"}>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
