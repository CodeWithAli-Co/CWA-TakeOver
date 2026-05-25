/**
 * ShiftEditor.tsx — Create / edit dialog for a single shift.
 *
 * Three modes the parent can put us in:
 *   - `editing` is a Shift → edit that row
 *   - `prefill` is { start, userSupaId? } → open in create mode with
 *     date/time pre-populated from the grid cell that was clicked
 *   - neither → fresh blank create
 *
 * Fields:
 *   - Who          (admin chooses; non-admins are locked to themselves)
 *   - Type         (shift / meeting / break / training / off)
 *   - Title        (free text; falls back to type label when empty)
 *   - Date + start + end
 *   - Location
 *   - Notes
 *
 * Save triggers either useCreateShift or useUpdateShift. Delete is
 * available only when editing.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Trash2, Loader2, AlertCircle, Repeat, HandHelping } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Textarea } from "@/components/ui/textarea";
import { Tracker, TrackerDot } from "@/components/editorial/Tracker";
import {
  SHIFT_TYPES,
  SHIFT_TYPE_META,
  isVirtualInstance,
  type Shift,
  type ShiftType,
  type Recurrence,
} from "@/stores/shiftTypes";
import {
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useRequestCoverage,
  useCancelCoverageRequest,
  findConflictsAgainst,
} from "@/stores/shifts";

interface Employee {
  supa_id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editing: Shift | null;
  prefill: { start: Date; userSupaId?: string } | null;
  employees: Employee[];
  currentUserId: string | null;
  currentUserName: string;
  /** Used for inline conflict detection. Pass the same array the grid renders. */
  allShifts?: Shift[];
}

type RecurrenceKind = "none" | "weekdays" | "daily" | "weekly" | "custom";

interface FormState {
  userSupaId: string;
  username: string;
  type: ShiftType;
  title: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  location: string;
  notes: string;
  // v2 fields
  recurrenceKind: RecurrenceKind;
  customDays: number[];           // 0..6 (Sun..Sat) — only used with "custom"
  recurrenceUntil: string;        // YYYY-MM-DD or ""
}

const blankForm = (): FormState => ({
  userSupaId: "",
  username: "",
  type: "shift",
  title: "",
  date: new Date().toISOString().split("T")[0]!,
  startTime: "09:00",
  endTime: "17:00",
  location: "",
  notes: "",
  recurrenceKind: "none",
  customDays: [],
  recurrenceUntil: "",
});

/** Map our editor enum + custom-days picker into the Recurrence shape stored in jsonb. */
function buildRecurrence(kind: RecurrenceKind, customDays: number[], anchorDate: string): Recurrence | null {
  if (kind === "none") return null;
  if (kind === "daily") return { freq: "daily" };
  if (kind === "weekdays") return { freq: "weekly", days_of_week: [1, 2, 3, 4, 5] };
  if (kind === "weekly") {
    // Just the same weekday as the anchor.
    const dow = new Date(anchorDate + "T00:00:00").getDay();
    return { freq: "weekly", days_of_week: [dow] };
  }
  // custom — at least one day must be checked
  if (kind === "custom" && customDays.length > 0) {
    return { freq: "weekly", days_of_week: [...customDays].sort() };
  }
  return null;
}

/** Reverse-map a stored Recurrence back into our editor enum. */
function inferRecurrenceKind(r: Recurrence | null, anchorDow: number): { kind: RecurrenceKind; days: number[] } {
  if (!r) return { kind: "none", days: [] };
  if (r.freq === "daily") return { kind: "daily", days: [] };
  const days = r.days_of_week ?? [];
  if (days.length === 5 && [1,2,3,4,5].every((d) => days.includes(d))) return { kind: "weekdays", days: [] };
  if (days.length === 1 && days[0] === anchorDow) return { kind: "weekly", days: [] };
  return { kind: "custom", days };
}

export function ShiftEditor({
  isOpen,
  onClose,
  editing,
  prefill,
  employees,
  currentUserId,
  currentUserName,
  allShifts = [],
}: Props) {
  const createMut = useCreateShift();
  const updateMut = useUpdateShift();
  const deleteMut = useDeleteShift();
  const requestCoverage = useRequestCoverage();
  const cancelCoverage = useCancelCoverageRequest();

  const [form, setForm] = useState<FormState>(blankForm);
  const [err, setErr] = useState<string | null>(null);

  // Sync form whenever the dialog opens or its source data changes.
  useEffect(() => {
    if (!isOpen) return;
    setErr(null);

    if (editing) {
      const s = new Date(editing.starts_at);
      const e = new Date(editing.ends_at);
      const anchorDow = s.getDay();
      const { kind, days } = inferRecurrenceKind(editing.recurrence, anchorDow);
      setForm({
        userSupaId: editing.user_supa_id,
        username: editing.username,
        type: editing.type,
        title: editing.title ?? "",
        date: toLocalDateInput(s),
        startTime: toLocalTimeInput(s),
        endTime: toLocalTimeInput(e),
        location: editing.location ?? "",
        notes: editing.notes ?? "",
        recurrenceKind: kind,
        customDays: days,
        recurrenceUntil: editing.recurrence_until ?? "",
      });
      return;
    }

    const seed = blankForm();
    if (prefill?.start) {
      seed.date = toLocalDateInput(prefill.start);
      seed.startTime = toLocalTimeInput(prefill.start);
      // Default to a 1-hour slot starting at the clicked hour.
      const end = new Date(prefill.start);
      end.setHours(end.getHours() + 1);
      seed.endTime = toLocalTimeInput(end);
    }
    const targetId = prefill?.userSupaId ?? currentUserId ?? employees[0]?.supa_id ?? "";
    const target =
      employees.find((e) => e.supa_id === targetId) ??
      (currentUserId ? { supa_id: currentUserId, username: currentUserName, role: "" } : null);
    seed.userSupaId = target?.supa_id ?? "";
    seed.username = target?.username ?? "";
    setForm(seed);
  }, [isOpen, editing, prefill, employees, currentUserId, currentUserName]);

  // ─── Conflict detection ──────────────────────────────────────
  // Runs against the same shifts the grid is rendering, so the warning
  // appears the moment the user nudges the time into someone else's
  // slot — no Supabase round-trip.
  const conflicts = useMemo(() => {
    if (!form.userSupaId || !form.date || form.startTime >= form.endTime) return [];
    const starts_at = combineLocal(form.date, form.startTime);
    const ends_at   = combineLocal(form.date, form.endTime);
    return findConflictsAgainst(allShifts, form.userSupaId, starts_at, ends_at, editing?.id);
  }, [allShifts, editing?.id, form.userSupaId, form.date, form.startTime, form.endTime]);

  const typeMeta = SHIFT_TYPE_META[form.type];

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.supa_id === form.userSupaId) ?? null,
    [employees, form.userSupaId],
  );

  const niceDate = useMemo(() => {
    if (!form.date) return "";
    return new Date(form.date + "T00:00:00")
      .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      .toUpperCase();
  }, [form.date]);

  const handleSave = async () => {
    setErr(null);
    if (!form.userSupaId) {
      setErr("Pick an employee.");
      return;
    }
    if (form.startTime >= form.endTime) {
      setErr("End time must be after start time.");
      return;
    }
    const starts_at = combineLocal(form.date, form.startTime);
    const ends_at   = combineLocal(form.date, form.endTime);

    // Build recurrence payload from the picker state.
    const recurrence = buildRecurrence(form.recurrenceKind, form.customDays, form.date);
    const recurrence_until = recurrence && form.recurrenceUntil ? form.recurrenceUntil : null;

    try {
      if (editing) {
        // Editing a virtual instance — bounce to the master.
        const targetId = isVirtualInstance(editing) ? editing.recurrence_parent_id ?? editing.id : editing.id;
        await updateMut.mutateAsync({
          id: targetId,
          user_supa_id: form.userSupaId,
          username: selectedEmployee?.username ?? form.username,
          type: form.type,
          title: form.title || null,
          starts_at,
          ends_at,
          location: form.location || null,
          notes: form.notes || null,
          recurrence,
          recurrence_until,
        });
      } else {
        await createMut.mutateAsync({
          user_supa_id: form.userSupaId,
          username: selectedEmployee?.username ?? form.username,
          type: form.type,
          title: form.title || null,
          starts_at,
          ends_at,
          location: form.location || null,
          notes: form.notes || null,
          // ShiftCreate accepts these as optional partials.
          ...(recurrence ? { recurrence: recurrence as any, recurrence_until: recurrence_until as any } : {}),
        } as any);
      }
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const isRecurring = !!editing.recurrence || isVirtualInstance(editing);
    const msg = isRecurring
      ? "Delete this recurring shift series? All future instances will disappear."
      : "Delete this shift? This cannot be undone.";
    if (!confirm(msg)) return;
    try {
      const targetId = isVirtualInstance(editing) ? editing.recurrence_parent_id ?? editing.id : editing.id;
      await deleteMut.mutateAsync(targetId);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Delete failed.");
    }
  };

  const handleToggleCoverage = async () => {
    if (!editing) return;
    const targetId = isVirtualInstance(editing) ? editing.recurrence_parent_id ?? editing.id : editing.id;
    try {
      if (editing.coverage_requested_at) {
        await cancelCoverage.mutateAsync(targetId);
      } else {
        await requestCoverage.mutateAsync(targetId);
      }
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Coverage update failed.");
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  const deleting = deleteMut.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-xl border-border-strong overflow-hidden p-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.06), transparent 60%), hsl(var(--card))",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${typeMeta.accent}, transparent)`,
            boxShadow: `0 0 12px ${typeMeta.accent}`,
          }}
        />

        <div className="px-7 pt-7 pb-3">
          <DialogHeader className="space-y-3">
            <Tracker tone="muted" size="sm">
              <TrackerDot color={typeMeta.accent} />
              {editing ? "EDIT SHIFT" : "NEW SHIFT"} — {typeMeta.label.toUpperCase()}
              {niceDate ? ` — ${niceDate}` : ""}
            </Tracker>
            <DialogTitle
              className="font-black text-foreground leading-none"
              style={{
                fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
                fontSize: "clamp(22px, 2.2vw, 28px)",
                letterSpacing: "-0.02em",
              }}
            >
              {editing ? "Edit shift." : "New shift."}
            </DialogTitle>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Pick the person, the time, and the type. Shifts created here show
              up in the calendar and the timesheet — same row, same source.
            </p>
          </DialogHeader>
        </div>

        <div className="px-7 pb-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* WHO */}
          <Field label="Who">
            <select
              value={form.userSupaId}
              onChange={(e) => {
                const u = employees.find((x) => x.supa_id === e.target.value);
                setForm({ ...form, userSupaId: e.target.value, username: u?.username ?? "" });
              }}
              className="w-full px-3 py-2.5 bg-secondary/40 border border-border-strong text-foreground rounded-md text-[14px] font-semibold focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
            >
              {employees.length === 0 && <option value="">(no employees)</option>}
              {employees.map((emp) => (
                <option key={emp.supa_id} value={emp.supa_id}>
                  {emp.username} — {emp.role}
                </option>
              ))}
            </select>
          </Field>

          {/* TYPE */}
          <Field label="Type">
            <div className="grid grid-cols-5 gap-2">
              {SHIFT_TYPES.map((t) => {
                const m = SHIFT_TYPE_META[t];
                const isActive = form.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    data-active={isActive}
                    className={[
                      "relative rounded-md border px-2 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] transition-all",
                      isActive
                        ? "text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
                    ].join(" ")}
                    style={
                      isActive
                        ? {
                            background: `${m.accent}18`,
                            borderColor: `${m.accent}66`,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${m.accent}33, 0 6px 16px -8px ${m.accent}66`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                      style={{
                        background: m.accent,
                        boxShadow: isActive ? `0 0 6px ${m.accent}` : undefined,
                      }}
                    />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* TITLE */}
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={`e.g., ${typeMeta.label === "Shift" ? "Morning shift" : typeMeta.label}`}
              className="bg-secondary/40 border-border-strong text-foreground placeholder:text-muted-foreground/60 h-10 text-[14px] font-medium focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          {/* DATE + TIMES */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Start">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>

          {/* CONFLICT WARNING — surfaces inline if anyone overlaps. */}
          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex items-start gap-2 text-[12px]">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-200 mb-1">
                  {conflicts.length === 1 ? "Overlaps with another shift" : `Overlaps with ${conflicts.length} other shifts`}
                </p>
                <ul className="space-y-0.5">
                  {conflicts.slice(0, 3).map((c) => (
                    <li key={c.id} className="text-amber-100/80 truncate">
                      · {c.title || SHIFT_TYPE_META[c.type].label} ({toLocalTimeInput(new Date(c.starts_at))}–{toLocalTimeInput(new Date(c.ends_at))})
                    </li>
                  ))}
                  {conflicts.length > 3 && (
                    <li className="text-amber-200/60">…and {conflicts.length - 3} more</li>
                  )}
                </ul>
                <p className="mt-1 text-[11px] text-amber-200/70">
                  You can still save — this is a warning, not a block.
                </p>
              </div>
            </div>
          )}

          {/* REPEATS — recurrence picker. */}
          <Field label="Repeats">
            <div className="grid grid-cols-5 gap-1.5">
              {(["none","weekdays","daily","weekly","custom"] as RecurrenceKind[]).map((k) => {
                const isActive = form.recurrenceKind === k;
                const label = k === "none" ? "Never" : k.charAt(0).toUpperCase() + k.slice(1);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, recurrenceKind: k })}
                    className={[
                      "rounded-md border px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1",
                      isActive
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
                    ].join(" ")}
                  >
                    {k !== "none" && <Repeat className="w-2.5 h-2.5" />}
                    {label}
                  </button>
                );
              })}
            </div>

            {form.recurrenceKind === "custom" && (
              <div className="mt-2 flex items-center gap-1">
                {["S","M","T","W","T","F","S"].map((dl, i) => {
                  const on = form.customDays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          customDays: on
                            ? form.customDays.filter((d) => d !== i)
                            : [...form.customDays, i],
                        })
                      }
                      aria-pressed={on}
                      className={[
                        "w-7 h-7 rounded-md text-[10.5px] font-bold transition-all",
                        on
                          ? "bg-primary/20 border border-primary/60 text-primary"
                          : "bg-secondary/40 border border-border-strong text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {dl}
                    </button>
                  );
                })}
              </div>
            )}

            {form.recurrenceKind !== "none" && (
              <div className="mt-2 grid grid-cols-2 gap-2 items-end">
                <div>
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.12em] mb-1 block">
                    Until <span className="text-muted-foreground/60 normal-case ml-1">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.recurrenceUntil}
                    onChange={(e) => setForm({ ...form, recurrenceUntil: e.target.value })}
                    className="bg-secondary/40 border-border-strong text-foreground h-9 text-[12.5px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-snug">
                  Master row generates instances on the fly. Editing the master changes every future occurrence.
                </p>
              </div>
            )}
          </Field>

          {/* LOCATION */}
          <Field label="Location" optional>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Office, remote, client site..."
              className="bg-secondary/40 border-border-strong text-foreground placeholder:text-muted-foreground/60 h-10 text-[13px] focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          {/* NOTES */}
          <Field label="Notes" optional>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Anything to flag for this shift..."
              className="bg-secondary/40 border-border-strong text-foreground placeholder:text-muted-foreground/60 min-h-[70px] text-[13px] focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          {err && (
            <p className="text-[12px] text-primary font-medium">{err}</p>
          )}
        </div>

        <DialogFooter className="border-t border-border px-7 py-4 bg-secondary/20 gap-2">
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 h-9 text-[11.5px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors mr-auto disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </button>
          )}
          {editing && editing.user_supa_id === currentUserId && !isVirtualInstance(editing) && (
            <button
              type="button"
              onClick={handleToggleCoverage}
              disabled={saving || deleting || requestCoverage.isPending || cancelCoverage.isPending}
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-3 h-9 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40",
                editing.coverage_requested_at
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "border-border-strong text-muted-foreground hover:text-foreground hover:bg-secondary",
              ].join(" ")}
            >
              {(requestCoverage.isPending || cancelCoverage.isPending) ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <HandHelping className="w-3 h-3" />
              )}
              {editing.coverage_requested_at ? "Cancel coverage" : "Needs cover"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="inline-flex items-center justify-center rounded-md border border-border-strong px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.userSupaId || saving || deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: "0 4px 12px -2px rgba(239,68,68,0.5)" }}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {editing ? "Save changes" : "Create shift"}
                <ChevronRight className="w-3 h-3" strokeWidth={3} />
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Helpers
// ============================================================

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
        {label}
        {optional && (
          <span className="text-muted-foreground/60 font-medium normal-case ml-1">
            (optional)
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function toLocalDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine YYYY-MM-DD + HH:mm into a local ISO timestamp string. */
function combineLocal(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}
