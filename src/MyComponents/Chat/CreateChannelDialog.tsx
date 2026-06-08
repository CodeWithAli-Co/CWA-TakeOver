/**
 * CreateChannelDialog.tsx — Admin-only "new themed channel" flow.
 *
 * Inserts a row into `dm_groups` where `subscribers` = every employee,
 * so it behaves as a company-wide discussion channel (distinct from a
 * focused DM). A `#` prefix on the name helps the sidebar section these
 * apart from DMs once we style that, but the channel shows up today via
 * the existing sidebar list.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, Loader2, X } from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";
import { useAppStore } from "@/stores/store";
import { getActiveCompanyLabel } from "@/stores/query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** All employee usernames — used as the initial subscriber set. */
  allEmployees: string[];
  /** The current user (always gets subscribed). */
  currentUsername: string;
}

export function CreateChannelDialog({
  open, onOpenChange, allEmployees, currentUsername,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setGroupName } = useAppStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/^#+/, "");
    if (!trimmed) {
      setError("Name required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const channelName = `#${trimmed}`;
      const subscribers = Array.from(
        new Set([currentUsername, ...allEmployees.filter(Boolean)]),
      );
      const { error: insertErr } = await companySupabase
  .from("dm_groups")
        .insert({
          name: channelName,
          subscribers,
          // description/company included optimistically — dropped if columns
          // don't exist (similar fallback to chat insert).
          description: description.trim() || null,
          company: getActiveCompanyLabel(),
        });
      if (insertErr) {
        // Retry without description/company for schemas missing them
        const minimal = await companySupabase
    .from("dm_groups")
          .insert({ name: channelName, subscribers });
        if (minimal.error) {
          setError(minimal.error.message);
          return;
        }
      }
      setName("");
      setDescription("");
      setGroupName(channelName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/60 p-4 pt-[16vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Create channel"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Create channel</h3>
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

            <form onSubmit={submit} className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  Name
                </span>
                <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 focus-within:border-foreground/30">
                  <span className="text-[13px] text-muted-foreground">#</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="fundraising"
                    className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                    autoFocus
                    maxLength={40}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  Description (optional)
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this channel is for"
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                  maxLength={120}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                All current employees are subscribed as initial members. You
                can trim the roster later.
              </p>
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Create channel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
