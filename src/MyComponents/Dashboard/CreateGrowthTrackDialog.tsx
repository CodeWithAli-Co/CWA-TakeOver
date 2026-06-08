/**
 * CreateGrowthTrackDialog.tsx — Global Create/Edit-Growth-Track
 * composer for managers (C-level acting as managers until the
 * manager_id relationship lands).
 *
 * Opens from the Cmd+K palette ("Create growth track") or via
 * useCreateGrowthTrackDialog().openDialog(). C-level gates the
 * verb in the palette; the modal renders for everyone but the
 * RLS policy rejects writes from non-managers.
 *
 * Behavior:
 *   · Pick an employee from the dropdown.
 *   · If they already have an approved track, prefill from it
 *     (edit mode). Otherwise blank (create mode).
 *   · Fill in role_title, next_milestone, milestone_steps
 *     (dynamic list — add / remove rows), optional axon_note,
 *     pacing_status select.
 *   · Submit upserts: if track exists, UPDATE in place; else
 *     INSERT. Always manager_approved=true so it renders
 *     immediately on the employee's dashboard.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import {
  useAllEmployees,
  useGrowthTrackForUser,
  type GrowthMilestoneStep,
} from "@/stores/query";
import { useCreateGrowthTrackDialog } from "./createGrowthTrackStore";
import { useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/routes/index.lazy";

type PacingStatus = "on_track" | "attention_needed" | "ahead";

interface DraftStep extends Omit<GrowthMilestoneStep, "id"> {
  // Temporary client-only id for React key + reorder. Replaced
  // with a real uuid on submit if it's a new step.
  _key: string;
  id?: string;
}

function makeStepKey(): string {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}
function makeStepId(): string {
  // crypto.randomUUID() is available in modern browsers + Tauri.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return makeStepKey();
}

export function CreateGrowthTrackDialog() {
  const { open, prefilledEmployeeId, closeDialog } = useCreateGrowthTrackDialog();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading: loadingEmployees } =
    useAllEmployees(false);

  const [chosenUserId, setChosenUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState("");
  const [nextMilestone, setNextMilestone] = useState("");
  const [axonNote, setAxonNote] = useState("");
  const [pacing, setPacing] = useState<PacingStatus>("on_track");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const roleRef = useRef<HTMLInputElement>(null);

  const chosenEmployee = useMemo(
    () => employees.find((e) => e.supa_id === chosenUserId) ?? null,
    [employees, chosenUserId],
  );

  // Look up the picked employee's existing track (if any) so we
  // can prefill an "edit" flow instead of always inserting blank.
  const { data: existingTrack, isLoading: loadingExisting } =
    useGrowthTrackForUser(chosenUserId);

  // ── Open / close lifecycle ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    if (prefilledEmployeeId) setChosenUserId(prefilledEmployeeId);
  }, [open, prefilledEmployeeId]);

  useEffect(() => {
    if (!open) {
      setChosenUserId(null);
      setCurrentRole("");
      setNextMilestone("");
      setAxonNote("");
      setPacing("on_track");
      setSteps([]);
      setError(null);
      setSaving(false);
      previousFocusRef.current?.focus?.();
    }
  }, [open]);

  // Prefill from existing track when an employee with one is picked.
  useEffect(() => {
    if (!open || !chosenUserId) return;
    if (existingTrack) {
      setCurrentRole(existingTrack.role_title ?? "");
      setNextMilestone(existingTrack.next_milestone ?? "");
      setAxonNote(existingTrack.axon_note ?? "");
      setPacing((existingTrack.pacing_status as PacingStatus) ?? "on_track");
      const draft: DraftStep[] = (existingTrack.milestone_steps ?? []).map(
        (s) => ({
          _key: makeStepKey(),
          id: s.id,
          label: s.label,
          completed: !!s.completed,
          due_date: s.due_date ?? null,
        }),
      );
      setSteps(draft);
    } else if (!loadingExisting) {
      // New track for this employee — pre-seed their current role
      // from app_users.role and leave the rest blank.
      const emp = employees.find((e) => e.supa_id === chosenUserId);
      setCurrentRole(emp?.role ?? "");
      setNextMilestone("");
      setAxonNote("");
      setPacing("on_track");
      setSteps([]);
    }
    requestAnimationFrame(() => roleRef.current?.focus());
  }, [open, chosenUserId, existingTrack, loadingExisting, employees]);

  // ── Step list mutators ────────────────────────────────────
  function addStep() {
    setSteps((s) => [
      ...s,
      { _key: makeStepKey(), label: "", completed: false, due_date: null },
    ]);
  }
  function removeStep(key: string) {
    setSteps((s) => s.filter((x) => x._key !== key));
  }
  function patchStep(key: string, patch: Partial<DraftStep>) {
    setSteps((s) =>
      s.map((x) => (x._key === key ? { ...x, ...patch } : x)),
    );
  }

  const trimmedRole = currentRole.trim();
  const trimmedMilestone = nextMilestone.trim();
  const validSteps = steps.filter((s) => s.label.trim().length > 0);

  const canSubmit =
    !!chosenUserId &&
    trimmedRole.length > 0 &&
    trimmedMilestone.length > 0 &&
    !saving;

  async function submit() {
    if (!canSubmit || !chosenUserId) return;
    setSaving(true);
    setError(null);

    const milestone_steps: GrowthMilestoneStep[] = validSteps.map((s) => ({
      id: s.id || makeStepId(),
      label: s.label.trim(),
      completed: s.completed,
      due_date: s.due_date || null,
    }));

    const { data: auth } = await companySupabase.auth.getUser();
    const authoredBy = auth?.user?.id;

    let upsertError: string | null = null;
    if (existingTrack) {
      const { error: err } = await companySupabase
  .from("growth_tracks")
        .update({
          role_title: trimmedRole,
          next_milestone: trimmedMilestone,
          milestone_steps,
          axon_note: axonNote.trim() || null,
          pacing_status: pacing,
          manager_approved: true,
          authored_by: authoredBy ?? null,
        })
        .eq("id", existingTrack.id);
      if (err) upsertError = err.message;
    } else {
      const { error: err } = await companySupabase.from("growth_tracks").insert({
        user_id: chosenUserId,
        role_title: trimmedRole,
        next_milestone: trimmedMilestone,
        milestone_steps,
        axon_note: axonNote.trim() || null,
        pacing_status: pacing,
        manager_approved: true,
        authored_by: authoredBy ?? null,
      });
      if (err) upsertError = err.message;
    }

    if (upsertError) {
      setError(upsertError);
      setSaving(false);
      return;
    }

    // Refresh the impacted caches.
    void queryClient.invalidateQueries({ queryKey: ["growth_tracks"] });
    closeDialog();
  }

  // Keyboard handling — Esc to close, Cmd/Ctrl+Enter to submit.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canSubmit, chosenUserId, currentRole, nextMilestone, axonNote, pacing, steps, existingTrack]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 bg-background/70 backdrop-blur-sm overflow-y-auto"
          onClick={closeDialog}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] rounded-xl border-xs border-border-soft bg-card shadow-2xl overflow-hidden mb-10"
            role="dialog"
            aria-modal="true"
            aria-label="Create or edit growth track"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-xs border-border-soft bg-popover/60">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-semibold text-foreground">
                  {existingTrack ? "Edit growth track" : "Create growth track"}
                </span>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="h-6 w-6 flex items-center justify-center rounded-md text-text-tertiary hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Employee picker */}
              <div>
                <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                  Employee
                </label>
                <select
                  value={chosenUserId ?? ""}
                  onChange={(e) => setChosenUserId(e.target.value || null)}
                  className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary/40"
                  disabled={loadingEmployees}
                >
                  <option value="" disabled>
                    {loadingEmployees ? "Loading team…" : "Pick an employee"}
                  </option>
                  {employees.map((e) => (
                    <option key={e.supa_id} value={e.supa_id}>
                      {e.username}
                      {e.role ? ` · ${e.role}` : ""}
                    </option>
                  ))}
                </select>
                {chosenEmployee && existingTrack && (
                  <p className="mt-1 text-[10px] text-text-tertiary italic">
                    Editing the existing approved track for{" "}
                    {chosenEmployee.username}.
                  </p>
                )}
              </div>

              {chosenUserId && (
                <>
                  {/* Role + pacing on one row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                        Current role
                      </label>
                      <input
                        ref={roleRef}
                        value={currentRole}
                        onChange={(e) => setCurrentRole(e.target.value)}
                        placeholder="Senior Engineer"
                        className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                        Pacing
                      </label>
                      <select
                        value={pacing}
                        onChange={(e) => setPacing(e.target.value as PacingStatus)}
                        className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary/40"
                      >
                        <option value="on_track">On track</option>
                        <option value="ahead">Ahead</option>
                        <option value="attention_needed">Attention</option>
                      </select>
                    </div>
                  </div>

                  {/* Next milestone */}
                  <div>
                    <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                      Next milestone
                    </label>
                    <input
                      value={nextMilestone}
                      onChange={(e) => setNextMilestone(e.target.value)}
                      placeholder="Lead first enterprise pilot"
                      className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40"
                    />
                  </div>

                  {/* Steps */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        Steps
                      </label>
                      <button
                        type="button"
                        onClick={addStep}
                        className="flex items-center gap-1 text-[10.5px] text-foreground/70 hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        Add step
                      </button>
                    </div>
                    {steps.length === 0 ? (
                      <p className="text-[11px] text-text-tertiary italic px-1 py-2">
                        No steps yet. Steps are the concrete checklist that
                        gets the employee to the milestone.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {steps.map((s) => (
                          <li
                            key={s._key}
                            className="flex items-center gap-2 rounded-md bg-foreground/[0.025] border-xs border-border-soft px-2 py-1.5"
                          >
                            <input
                              type="checkbox"
                              checked={s.completed}
                              onChange={(e) =>
                                patchStep(s._key, { completed: e.target.checked })
                              }
                              className="h-3.5 w-3.5 accent-success"
                              title="Mark as completed"
                            />
                            <input
                              value={s.label}
                              onChange={(e) =>
                                patchStep(s._key, { label: e.target.value })
                              }
                              placeholder="Step description"
                              className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-text-tertiary outline-none"
                            />
                            <input
                              type="date"
                              value={s.due_date ?? ""}
                              onChange={(e) =>
                                patchStep(s._key, {
                                  due_date: e.target.value || null,
                                })
                              }
                              className="bg-transparent text-[10.5px] text-text-tertiary outline-none"
                              title="Due date (optional)"
                            />
                            <button
                              type="button"
                              onClick={() => removeStep(s._key)}
                              className="text-text-tertiary hover:text-destructive"
                              title="Remove step"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Axon note */}
                  <div>
                    <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                      Axon note (optional)
                    </label>
                    <textarea
                      value={axonNote}
                      onChange={(e) => setAxonNote(e.target.value)}
                      placeholder="Short italicized commentary that appears on the employee's card"
                      rows={2}
                      className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 resize-none"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="text-[11px] text-destructive bg-destructive/10 border-xs border-destructive/30 rounded-md px-2.5 py-1.5">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-xs border-border-soft bg-popover/40">
              <span className="text-[10px] text-text-tertiary">
                ⌘↵ to save · Esc to close
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={`flex items-center gap-1.5 text-[11.5px] font-semibold rounded-md px-3 py-1.5 transition-colors ${
                  canSubmit
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-foreground/[0.06] text-text-tertiary cursor-not-allowed"
                }`}
              >
                <Save className="h-3 w-3" />
                {saving ? "Saving…" : existingTrack ? "Update track" : "Save track"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
