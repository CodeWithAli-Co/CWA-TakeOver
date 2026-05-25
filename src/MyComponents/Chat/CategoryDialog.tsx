/**
 * CategoryDialog.tsx — Replace the native window.prompt with a themed
 * modal for creating a channel category. Fires `onCreate(name)` when
 * the user submits.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string) => void;
  initialValue?: string;
}

export function CategoryDialog({ open, onOpenChange, onCreate, initialValue = "" }: Props) {
  const [name, setName] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialValue);
      // Auto-focus on next frame so the input is rendered first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialValue]);

  const submit = () => {
    const v = name.trim();
    if (!v) return;
    onCreate(v);
    setName("");
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-background/60 p-4 pt-[18vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.form
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            role="dialog"
            aria-label="New category"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">New category</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            <div className="p-4 flex flex-col gap-2">
              <label className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Category name
              </label>
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Projects, Clients, Research…"
                maxLength={40}
                className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Group your channels — drag to reorder, click to collapse.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Create category
              </button>
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
