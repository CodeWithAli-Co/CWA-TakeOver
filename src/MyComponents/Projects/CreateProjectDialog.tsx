/**
 * CreateProjectDialog.tsx — Centered modal for spinning up a new
 * project. Mounted from ProjectsPage and only rendered when the
 * caller knows the actor is C-level (defense-in-depth: RLS would
 * reject anyway, but the UI shouldn't even offer the affordance).
 *
 * Fields:
 *   · Title (required)
 *   · Description
 *   · Owner (defaults to current user, pickable from all employees)
 *   · Due date (defaults to +14 days)
 *   · Priority (4-way pill row)
 *
 * On submit it calls useCreateProject and notifies the parent with
 * the new id so the drawer can open onto it immediately.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Flag, AlertCircle, Loader2 } from "lucide-react";
import { useCreateProject, type ProjectPriority } from "@/stores/projects";
import { useAllEmployees } from "@/stores/query";
import { PRIORITY_META } from "./projectStyles";

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
  me: any | null;
}

export function CreateProjectDialog({ onClose, onCreated, me }: Props) {
  const myId: string = me?.supa_id ?? "";
  const myUsername: string = me?.username ?? "";

  const { data: employees = [] } = useAllEmployees();
  const createMut = useCreateProject();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [ownerId, setOwnerId] = useState<string>(myId);
  const [due, setDue] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !!ownerId && !createMut.isPending;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const owner = employees.find((e) => e.supa_id === ownerId);
    try {
      const created = await createMut.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        owner_supa_id: ownerId,
        owner_username: owner?.username ?? myUsername,
        due,
        created_by: myUsername || null,
      });
      onCreated(created.id);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-[520px] rounded-xl border-xs border-border-soft shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
      >
        <div className="px-5 py-3.5 border-b border-xs border-border-soft flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <Plus size={14} strokeWidth={2.6} />
            </div>
            <h2 id="create-project-title" className="text-[14px] font-bold text-foreground">
              New project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Native Linux build matrix"
              className="w-full bg-background/60 border-xs border-border-soft rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/45"
            />
          </div>

          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={3}
              className="w-full bg-background/60 border-xs border-border-soft rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/45 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
                Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full bg-background/60 border-xs border-border-soft rounded-md px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-primary/45"
              >
                {employees.length === 0 && myId && (
                  <option value={myId}>{myUsername || "Me"}</option>
                )}
                {employees.map((e) => (
                  <option key={e.supa_id} value={e.supa_id}>
                    {e.username}{e.role ? ` · ${e.role}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
                Due date
              </label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full bg-background/60 border-xs border-border-soft rounded-md px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-primary/45"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
              Priority
            </label>
            <div className="flex items-center gap-1.5 list-none p-0 m-0">
              {(["low", "medium", "high", "critical"] as ProjectPriority[]).map((p) => {
                const meta = PRIORITY_META[p];
                const active = p === priority;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={
                      "list-none inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors border " +
                      (active
                        ? meta.chip + " border-current/20"
                        : "border-border-soft text-text-secondary hover:text-foreground hover:bg-foreground/[0.05]")
                    }
                  >
                    <Flag size={9} strokeWidth={3} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="text-[11.5px] text-red-500 bg-red-500/10 border-xs border-red-500/30 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-xs border-border-soft flex items-center justify-between gap-2 bg-popover/40">
          <span className="text-[10.5px] text-text-tertiary inline-flex items-center gap-1.5">
            <AlertCircle size={10} />
            C-level only — RLS enforces server-side
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-semibold text-text-secondary hover:text-foreground border-xs border-border-soft rounded-md px-3 py-1.5 hover:bg-foreground/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={
                "inline-flex items-center gap-1.5 text-[12px] font-bold rounded-md px-3 py-1.5 transition-colors " +
                (canSubmit
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-foreground/[0.06] text-text-tertiary cursor-not-allowed")
              }
            >
              {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.6} />}
              Create project
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
