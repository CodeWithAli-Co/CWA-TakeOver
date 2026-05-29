/**
 * DeleteResourceDialog.tsx — Confirmation modal for archiving or
 * permanently deleting a workspace doc/sheet.
 *
 * Two-tier policy:
 *   · Default for everyone: archive. Sets archived=true. The doc
 *     stays in the database, drops out of /workspace listings, and
 *     can be recovered later. Reversible.
 *   · C-level only (CEO/COO/CFO/Admin): an additional "Delete
 *     permanently" toggle that calls the real DELETE on the row.
 *     The dialog requires the operator to type the doc title to
 *     enable the destructive button (cheap typo guard).
 *
 * The caller passes both the archive mutation and the hard-delete
 * mutation — keeps this component agnostic between docs and sheets.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Archive, Trash2, X, ShieldAlert } from "lucide-react";
import { ActiveUser } from "@/stores/query";

const C_LEVEL_ROLES = new Set(["CEO", "COO", "CFO", "Admin"]);

interface DeleteResourceDialogProps {
  open: boolean;
  onClose: () => void;
  kind: "document" | "spreadsheet";
  title: string;
  /** Soft-delete mutation — archives the row. Required. */
  onArchive: () => Promise<void> | void;
  /** Hard-delete mutation — destroys the row. Only invoked from the
   *  C-level path; the dialog handles its own gating. */
  onHardDelete: () => Promise<void> | void;
}

export function DeleteResourceDialog({
  open,
  onClose,
  kind,
  title,
  onArchive,
  onHardDelete,
}: DeleteResourceDialogProps) {
  const { data: meRows } = ActiveUser();
  const role: string | undefined = (meRows?.[0] as any)?.role ?? undefined;
  const isCLevel = !!role && C_LEVEL_ROLES.has(role);

  const [permanent, setPermanent] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPermanent(false);
      setTyped("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const noun = kind === "document" ? "document" : "spreadsheet";

  // Confirm gate. For archive — single click. For permanent — must
  // type the title exactly to enable the button.
  const canConfirm =
    !busy && (permanent ? typed.trim() === title.trim() : true);

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      if (permanent) {
        await onHardDelete();
      } else {
        await onArchive();
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Operation failed.");
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[230] flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] rounded-xl border-xs border-border-soft bg-card shadow-2xl overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-resource-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-xs border-border-soft bg-popover/60">
              <div className="flex items-center gap-2.5">
                <div
                  className={
                    "h-8 w-8 rounded-md flex items-center justify-center shrink-0 " +
                    (permanent
                      ? "bg-red-500/15 text-red-500"
                      : "bg-amber-500/15 text-amber-500")
                  }
                >
                  {permanent ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h2
                    id="delete-resource-title"
                    className="text-[14px] font-semibold text-foreground"
                  >
                    {permanent
                      ? `Permanently delete ${noun}?`
                      : `Archive ${noun}?`}
                  </h2>
                  <p className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-[340px]">
                    {title || "Untitled"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !busy && onClose()}
                disabled={busy}
                aria-label="Close"
                className="h-7 w-7 flex items-center justify-center rounded-md text-text-tertiary hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {!permanent ? (
                <p className="text-[12.5px] text-foreground/80 leading-relaxed">
                  This {noun} will be moved out of the workspace listing,
                  but the content stays in the database. A C-level
                  operator can recover or permanently delete it later.
                </p>
              ) : (
                <>
                  <div className="rounded-md bg-red-500/10 border-xs border-red-500/30 px-3 py-2.5 text-[12px] text-red-600 dark:text-red-300 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      This will destroy the row, its Y.js state, comments,
                      and version history. <strong>It cannot be undone.</strong>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-1.5">
                      Type the title to confirm
                    </label>
                    <input
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={title}
                      className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-red-500/40"
                    />
                  </div>
                </>
              )}

              {/* C-level escalation toggle */}
              {isCLevel && (
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={permanent}
                    onChange={(e) => {
                      setPermanent(e.target.checked);
                      setTyped("");
                      setError(null);
                    }}
                    className="mt-[3px] h-3.5 w-3.5 accent-red-500"
                  />
                  <span className="text-[12px] text-foreground/85 leading-snug">
                    <span className="font-semibold">Delete permanently</span>{" "}
                    instead of archiving.
                    <span className="block text-[10.5px] text-text-tertiary mt-0.5">
                      C-level only. The row is destroyed.
                    </span>
                  </span>
                </label>
              )}

              {error && (
                <div className="text-[11.5px] text-red-500 bg-red-500/10 border-xs border-red-500/30 rounded-md px-2.5 py-1.5">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-xs border-border-soft bg-popover/40">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="text-[12px] text-foreground/75 hover:text-foreground border-xs border-border-soft rounded-md px-3 py-1.5 hover:bg-foreground/[0.04] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={
                  "inline-flex items-center gap-1.5 text-[12px] font-semibold text-white rounded-md px-3 py-1.5 transition-colors " +
                  (permanent
                    ? "bg-red-500 hover:bg-red-500/90 disabled:bg-red-500/40"
                    : "bg-amber-500 hover:bg-amber-500/90 disabled:bg-amber-500/40") +
                  " disabled:cursor-not-allowed"
                }
              >
                {permanent ? (
                  <Trash2 className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                {busy
                  ? "Working…"
                  : permanent
                    ? "Delete forever"
                    : "Archive"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
