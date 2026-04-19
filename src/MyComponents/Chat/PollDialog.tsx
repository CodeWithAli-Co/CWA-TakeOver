/**
 * PollDialog.tsx — Modal for composing a new poll.
 * Opens via the /poll slash command or a composer button.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { encodePollMarker, type PollDefinition } from "./PollMessage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Submit the encoded poll marker + question back to the composer so
   * it can be sent as a normal message. */
  onSubmit: (markerPlusQuestion: string) => void;
  initialQuestion?: string;
}

export function PollDialog({ open, onOpenChange, onSubmit, initialQuestion = "" }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multi, setMulti] = useState(false);

  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMulti(false);
  };

  const canSubmit =
    question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const addOption = () => setOptions((o) => [...o, ""]);
  const removeOption = (i: number) => setOptions((o) => o.filter((_, j) => j !== i));
  const updateOption = (i: number, v: string) =>
    setOptions((o) => o.map((x, j) => (j === i ? v : x)));

  const submit = () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!canSubmit) return;
    const poll: PollDefinition = {
      question: question.trim(),
      options: cleanOptions,
      multi,
    };
    const marker = encodePollMarker(poll);
    // Include a human-readable summary after the marker so DBs that can't
    // render the poll still show the question.
    onSubmit(`${marker}\n${poll.question}`);
    reset();
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Create poll</h3>
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

            <div className="flex flex-col gap-3 p-4">
              {/* Question */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  Question
                </label>
                <input
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What should we build first?"
                  className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Options */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  Options
                </label>
                <div className="flex flex-col gap-1.5">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="font-mono text-[9.5px] text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <input
                        value={o}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          aria-label="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 10 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="self-start inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add option
                  </button>
                )}
              </div>

              {/* Multi */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={multi}
                  onChange={(e) => setMulti(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-[12px] text-foreground">Allow multiple answers</span>
              </label>
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
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Post poll
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
