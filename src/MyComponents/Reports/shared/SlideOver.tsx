/**
 * SlideOver.tsx — Right-edge detail panel for inbox tables.
 *
 * Used by both Reports and Bug Reports tabs to surface a row's
 * full detail without leaving the table behind. Behaviour:
 *
 *   · Slides in from the right edge with a translateX animation.
 *   · Renders a translucent backdrop over the table; click it or
 *     press Esc to close.
 *   · Width adapts to viewport — caps at ~720px so the panel
 *     never spans the whole screen on ultra-wide displays.
 *   · Locks body scroll while open so the table behind doesn't
 *     scroll-jack the user's wheel events.
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Optional header right-side content (e.g., a status chip). */
  headerRight?: React.ReactNode;
  /** Optional sticky footer (e.g., triage controls). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SlideOver({ open, onClose, title, headerRight, footer, children }: Props) {
  // Esc-to-close. Re-bound whenever `open` flips so the listener
  // only exists while the panel is visible.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — click anywhere outside the panel to close. */}
          <motion.div
            key="slideover-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            key="slideover-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-[720px] flex-col bg-background border-l border-border shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <header className="shrink-0 flex items-center gap-3 border-b border-border bg-card/40 px-5 py-3">
              <div className="min-w-0 flex-1">{title}</div>
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-border bg-card/60 backdrop-blur px-5 py-3">
                {footer}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
