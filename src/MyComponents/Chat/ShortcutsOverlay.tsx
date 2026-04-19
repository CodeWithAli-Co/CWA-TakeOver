/**
 * ShortcutsOverlay.tsx — Press `?` anywhere to see the chat/app
 * keyboard shortcut cheat-sheet. Mounted globally so it works on any
 * route.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

interface Shortcut {
  combo: string[];
  label: string;
}

interface Group {
  name: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    name: "Global",
    items: [
      { combo: ["?"], label: "Show this cheat-sheet" },
      { combo: ["⌘", "K"], label: "Quick search" },
      { combo: ["⌘", "."], label: "Talk to Axon (push-to-talk)" },
      { combo: ["Esc"], label: "Dismiss modal / clear reply" },
    ],
  },
  {
    name: "Messaging",
    items: [
      { combo: ["Enter"], label: "Send message" },
      { combo: ["Shift", "Enter"], label: "Newline" },
      { combo: ["↑"], label: "Edit last message you sent" },
      { combo: ["@"], label: "Mention someone" },
      { combo: [":"], label: "Emoji shortcode (e.g. :smile:)" },
    ],
  },
  {
    name: "Slash commands",
    items: [
      { combo: ["/me"], label: "Italic action message" },
      { combo: ["/code"], label: "Send as code block" },
      { combo: ["/poll"], label: "Create a poll" },
      { combo: ["/remind"], label: "Remind yourself in N minutes" },
      { combo: ["/here"], label: "Notify everyone online" },
      { combo: ["/status"], label: "Set presence label" },
      { combo: ["/giphy"], label: "Attach a giphy search" },
      { combo: ["/axon"], label: "Ask Axon to draft a reply" },
    ],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't trigger while typing in inputs/textareas.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const inField =
        tag === "input" ||
        tag === "textarea" ||
        (t && (t as HTMLElement).isContentEditable);
      if (inField) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" />
                <h3 className="text-[13.5px] font-semibold">Keyboard shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
              {GROUPS.map((g) => (
                <section key={g.name} className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                    {g.name}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {g.items.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-foreground/90">
                          {s.label}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {s.combo.map((k, j) => (
                            <kbd
                              key={j}
                              className="rounded-md border border-border bg-muted/40 px-1.5 py-[2px] font-mono text-[10px] text-foreground/80 shadow-sm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <footer className="border-t border-border bg-muted/20 px-5 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              press <kbd className="mx-1 rounded bg-muted px-1 py-[1px] text-foreground">?</kbd> to toggle · Esc to close
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
