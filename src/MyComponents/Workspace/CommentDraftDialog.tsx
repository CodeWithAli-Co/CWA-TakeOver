/**
 * CommentDraftDialog.tsx — Small composer that asks for the
 * first message of a new comment thread BEFORE the thread row
 * is created.
 *
 * Why this exists: the previous flow created a comment row with
 * body="" the moment the user clicked "Comment" in the bubble
 * menu, then forced them to reply to their own empty thread to
 * actually say something. This dialog flips that — type your
 * comment, click Comment, and the thread is created with your
 * message already attached.
 *
 * Esc / outside click / Cancel all discard without creating the
 * row. Submit calls onSubmit(body); the caller wires that to a
 * createComment mutation and then applies the editor mark.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";

interface CommentDraftDialogProps {
  open: boolean;
  /** The selected text the comment will anchor to. Shown as a
   *  small quote in the dialog so the user can confirm what
   *  they're commenting on. */
  selectedText: string;
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void> | void;
}

export function CommentDraftDialog({
  open,
  selectedText,
  onCancel,
  onSubmit,
}: CommentDraftDialogProps) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state on open; autofocus the textarea.
  useEffect(() => {
    if (open) {
      setBody("");
      setBusy(false);
      setError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onCancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, body]);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create comment.");
      setBusy(false);
    }
  }

  // Truncate the quoted selection for the preview chip — full text
  // is preserved on the comment row itself via the anchor.
  const quotedPreview =
    selectedText.length > 140
      ? selectedText.slice(0, 137) + "…"
      : selectedText;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[225] flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm"
          onClick={() => !busy && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-xl border-xs border-border-soft bg-card shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comment-draft-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-xs border-border-soft bg-popover/60">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <h2
                  id="comment-draft-title"
                  className="text-[13px] font-semibold text-foreground"
                >
                  New comment
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                aria-label="Close"
                className="h-6 w-6 flex items-center justify-center rounded-md text-text-tertiary hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-3">
              {/* Quoted selection */}
              <div className="text-[11px] text-text-tertiary">
                On
              </div>
              <blockquote className="border-l-2 border-amber-500/60 pl-2.5 text-[12px] text-foreground/75 italic leading-snug">
                &ldquo;{quotedPreview}&rdquo;
              </blockquote>

              {/* Composer */}
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                disabled={busy}
                className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-2 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 resize-none"
              />

              {error && (
                <div className="text-[11.5px] text-red-500 bg-red-500/10 border-xs border-red-500/30 rounded-md px-2.5 py-1.5">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-xs border-border-soft bg-popover/40">
              <span className="text-[10px] text-text-tertiary">
                ⌘↵ to send · Esc to cancel
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="text-[11.5px] text-foreground/75 hover:text-foreground border-xs border-border-soft rounded-md px-2.5 py-1 hover:bg-foreground/[0.04] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className={
                    "inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-md px-2.5 py-1 transition-colors " +
                    (canSubmit
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-foreground/[0.06] text-text-tertiary cursor-not-allowed")
                  }
                >
                  <Send className="h-3 w-3" />
                  {busy ? "Posting…" : "Comment"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
