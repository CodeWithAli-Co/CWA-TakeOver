/**
 * DMPickerDialog.tsx — "I want to talk to ONE person" flow. Skips the
 * group-chat naming step entirely. Pick a teammate → auto-creates (or
 * finds an existing) canonical 2-person DM and switches to it.
 *
 * Canonical DM name: `dm::<alice>::<bob>` where the two usernames are
 * alphabetically sorted, so both parties always resolve the same
 * channel regardless of who initiated it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, MessageSquare, Check } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";
import { groupAvatarInitials, groupAvatarStyle } from "./ChatSidebar";

interface Employee {
  username: string;
  role?: string;
  avatarName?: string;
  supa_id?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: Employee[];
  currentUsername: string;
  /** Called after the DM is opened so ChatLayout can refetch groups. */
  onOpened?: () => void;
}

/** Canonical channel name for a 1-on-1 DM between two users. */
export function canonicalDMName(a: string, b: string): string {
  const [x, y] = [a, b].map((s) => (s || "").trim()).sort();
  return `dm::${x}::${y}`;
}

/** Pretty label: show the OTHER person's name, not the canonical form. */
export function prettyDMLabel(name: string, currentUsername: string): string | null {
  const m = name.match(/^dm::(.+?)::(.+)$/);
  if (!m) return null;
  const [, a, b] = m;
  return a === currentUsername ? b : a;
}

export function DMPickerDialog({
  open, onOpenChange, employees, currentUsername, onOpened,
}: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setGroupName = useAppStore((s) => s.setGroupName);

  useEffect(() => {
    if (open) {
      setQuery("");
      setBusy(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const candidates = useMemo(() => {
    const list = (employees || []).filter(
      (e) => e?.username && e.username !== currentUsername,
    );
    const needle = query.trim().toLowerCase();
    if (!needle) return list.slice(0, 40);
    return list
      .filter((e) => e.username.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [employees, query, currentUsername]);

  const openDMWith = async (target: Employee) => {
    setBusy(target.username);
    const name = canonicalDMName(currentUsername, target.username);
    try {
      // Idempotent upsert: if the canonical row already exists, we just
      // pick it up.
      const { data: existing } = await supabase
        .from("dm_groups")
        .select("id, name, subscribers")
        .eq("name", name)
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from("dm_groups").insert({
          name,
          subscribers: [currentUsername, target.username],
        });
        if (error && !/duplicate key|unique/i.test(error.message)) {
          console.warn("[dm-picker] create failed:", error.message);
        }
      } else {
        // If subscribers drifted, heal them silently.
        const subs: string[] = existing[0]?.subscribers ?? [];
        if (
          !subs.includes(currentUsername) ||
          !subs.includes(target.username)
        ) {
          const merged = Array.from(
            new Set([...subs, currentUsername, target.username]),
          );
          await supabase.from("dm_groups").update({ subscribers: merged }).eq("name", name);
        }
      }

      setGroupName(name);
      onOpened?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[dm-picker] openDMWith failed:", err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Start a direct message"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">New direct message</h3>
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

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a teammate…"
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="max-h-[46vh] overflow-y-auto px-2 pb-2">
              {candidates.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                  No teammates match "{query}".
                </p>
              ) : (
                <ul className="flex flex-col">
                  {candidates.map((p) => (
                    <li key={p.username}>
                      <button
                        type="button"
                        onClick={() => openDMWith(p)}
                        disabled={!!busy}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                      >
                        <div
                          className="h-8 w-8 rounded-md border border-border flex items-center justify-center font-semibold text-[11px] shadow-sm"
                          style={groupAvatarStyle(p.username)}
                        >
                          {groupAvatarInitials(p.username)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium text-foreground">
                            {p.username}
                          </div>
                          {p.role && (
                            <div className="truncate font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                              {p.role}
                            </div>
                          )}
                        </div>
                        {busy === p.username && (
                          <Check className="h-4 w-4 text-primary animate-pulse" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
              1-on-1 DM · channel created automatically
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
