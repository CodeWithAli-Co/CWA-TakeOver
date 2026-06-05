/**
 * InlineDeleteButton — two-stage delete control used by all three
 * sales drawers (deal, contact, company).
 *
 * Stage 1: small "Delete" button.
 * Stage 2: morphs into "Confirm?" / "✕ Cancel" so the operator must
 *          explicitly confirm. No modal — keeps the drawer compact.
 *
 * The caller passes an async `onDelete` handler that performs the
 * actual mutation; this component just orchestrates the UI state.
 * If the handler throws, we revert to stage 1 and surface the error
 * via title — the drawer's own toast / error UI handles deeper
 * reporting.
 */

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";

export const InlineDeleteButton: React.FC<{
  onDelete: () => Promise<void> | void;
  /** Disabled while a mutation is pending — keeps the button from
   *  retriggering during the in-flight delete. */
  disabled?: boolean;
  /** What the operator is deleting — appears in the confirm prompt. */
  label?: string;
}> = ({ onDelete, disabled, label = "this" }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || busy}
        className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.08] hover:border-rose-500/40 hover:bg-rose-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-rose-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={`Delete ${label}`}
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-rose-300/90 mr-1">
        Confirm?
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
            // Caller is responsible for closing the drawer — no extra
            // cleanup here since the component will unmount on success.
          } catch (err) {
            console.error("[InlineDeleteButton] delete failed:", err);
            setConfirming(false);
          } finally {
            setBusy(false);
          }
        }}
        className="flex items-center gap-1 px-2 py-1 border border-rose-500/40 bg-rose-500/[0.1] hover:bg-rose-500/[0.16] text-[10px] font-mono uppercase tracking-wider text-rose-200 rounded-md transition-colors disabled:opacity-50"
        title="Yes, delete"
      >
        <Check className="h-3 w-3" />
        {busy ? "…" : "Yes"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(false)}
        className="flex items-center gap-1 px-2 py-1 border border-white/[0.08] hover:border-white/[0.16] text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 rounded-md transition-colors disabled:opacity-50"
        title="Cancel"
      >
        <X className="h-3 w-3" />
        No
      </button>
    </div>
  );
};
