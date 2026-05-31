/**
 * SendKudosDialog.tsx — Global Send-Kudos composer.
 *
 * Opens from the Cmd+K palette ("Send kudos") or programmatically
 * via useSendKudosDialog().openDialog(). Pick a recipient from
 * the company list, type a short message, submit — writes a
 * kudos row into team_activity. Appears in everyone's TeamPulse
 * feed.
 *
 * Available to all roles. No self-kudos (current user is excluded
 * from the recipient list).
 *
 * Send path:
 *   takeOversupabase.from("team_activity").insert({
 *     actor_id: auth.uid(),     // RLS enforces this
 *     target_id: chosen.supa_id,
 *     activity_type: "kudos",
 *     description: "{actor} → {target}: {message}",
 *   })
 *
 * Wire-up: mount once in __root.tsx. Subscribes to the zustand
 * store; renders only when open=true.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HandHeart, Search, Send, Sparkles, X } from "lucide-react";
import { takeOversupabase } from "../supabase";
import { ActiveUser, useAllEmployees, type EmployeeRow } from "@/stores/query";
import { useSendKudosDialog } from "./sendKudosStore";
import { useQueryClient } from "@tanstack/react-query";

const MAX_BODY_LEN = 280;

/**
 * Pre-designed compliments — short, specific, slightly varied. The
 * operator can either pick one as-is or use it as a starting point.
 * Clicking a preset REPLACES the current body (we surface that with
 * a slight chip glow on hover so it doesn't feel destructive).
 *
 * Kept calm: no emojis, no exclamation soup. Each line reads like
 * something a thoughtful coworker would actually type.
 */
const KUDOS_PRESETS: { label: string; body: string }[] = [
  { label: "Shipped it",   body: "Great work shipping that — it landed clean and the team felt it." },
  { label: "Saved the day", body: "Thanks for jumping in when we were stuck — really saved the day." },
  { label: "Sharp call",   body: "That was a sharp call — clearer direction made the whole thing move faster." },
  { label: "Quietly killing it", body: "Quietly killing it lately — wanted to make sure that doesn't go unnoticed." },
  { label: "Great taste",  body: "The taste on this is excellent — it's exactly the bar we want." },
  { label: "Steady hand",  body: "Appreciate the steady hand through that. You kept it calm and we got there." },
];

export function SendKudosDialog() {
  const { open, prefilledTargetId, closeDialog } = useSendKudosDialog();
  const queryClient = useQueryClient();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const myName: string = me?.username ?? "";

  const { data: employees = [], isLoading: loadingEmployees } =
    useAllEmployees(true);

  const [pickerQuery, setPickerQuery] = useState("");
  const [chosen, setChosen] = useState<EmployeeRow | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const pickerRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Filtered + sorted candidates for the typeahead.
  const candidates = useMemo<EmployeeRow[]>(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 8);
    return employees
      .filter(
        (e) =>
          e.username?.toLowerCase().includes(q) ||
          e.role?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [employees, pickerQuery]);

  // ── Open / close lifecycle ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Apply prefill if requested
    if (prefilledTargetId) {
      const found = employees.find((e) => e.supa_id === prefilledTargetId);
      if (found) {
        setChosen(found);
      }
    }

    requestAnimationFrame(() => {
      if (chosen || prefilledTargetId) {
        bodyRef.current?.focus();
      } else {
        pickerRef.current?.focus();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset state on close so the next open is fresh.
      setPickerQuery("");
      setChosen(null);
      setBody("");
      setError(null);
      setSending(false);
      setActiveIdx(0);
      previousFocusRef.current?.focus?.();
    }
  }, [open]);

  // ── Keyboard handling ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
        return;
      }
      // Cmd/Ctrl + Enter submits from anywhere.
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit();
        return;
      }
      // Arrow nav in the picker
      if (!chosen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, Math.max(candidates.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
          const pick = candidates[activeIdx];
          if (pick) {
            e.preventDefault();
            setChosen(pick);
            setPickerQuery("");
            requestAnimationFrame(() => bodyRef.current?.focus());
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chosen, candidates, activeIdx, body]);

  const trimmed = body.trim();
  const canSubmit = !!chosen && trimmed.length > 0 && !sending;

  async function submit() {
    if (!canSubmit || !chosen) return;
    setSending(true);
    setError(null);

    const description = `${myName || "Someone"} → ${chosen.username}: ${trimmed}`;

    const { error: err } = await takeOversupabase.from("team_activity").insert({
      target_id: chosen.supa_id,
      activity_type: "kudos",
      description,
      metadata: { message: trimmed },
      // actor_id is set by RLS WITH CHECK — we still pass auth.uid
      // explicitly because the column is NOT NULL.
      actor_id: (await takeOversupabase.auth.getUser()).data.user?.id,
    });

    if (err) {
      setError(err.message);
      setSending(false);
      return;
    }

    // Refresh the pulse feed so the new kudos shows up immediately.
    void queryClient.invalidateQueries({ queryKey: ["team_activity"] });
    closeDialog();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 bg-background/70 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-xl border-xs border-border-soft bg-card shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Send kudos"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-xs border-border-soft bg-popover/60">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <HandHeart className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-semibold text-foreground">
                  Send kudos
                </span>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="h-6 w-6 flex items-center justify-center rounded-md text-text-tertiary hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Recipient picker — replaced by a "chosen" chip once selected */}
              {!chosen ? (
                <div>
                  <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary block mb-1.5">
                    To
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary" />
                    <input
                      ref={pickerRef}
                      value={pickerQuery}
                      onChange={(e) => {
                        setPickerQuery(e.target.value);
                        setActiveIdx(0);
                      }}
                      placeholder={
                        loadingEmployees ? "Loading team…" : "Search by name or role"
                      }
                      className="w-full bg-background/40 border-xs border-border-soft rounded-md pl-7 pr-2 py-1.5 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40"
                    />
                  </div>
                  {candidates.length > 0 && (
                    /* list-none + p-0 + m-0 to kill the white bullet
                     *  markers the global CSS leaks into nested lists,
                     *  and to drop the default left-padding that made
                     *  the rows look indented. */
                    <ul className="list-none p-0 m-0 mt-1.5 max-h-[200px] overflow-y-auto rounded-md border-xs border-border-soft bg-background/30">
                      {candidates.map((c, i) => (
                        <li key={c.supa_id} className="list-none">
                          <button
                            type="button"
                            onClick={() => {
                              setChosen(c);
                              setPickerQuery("");
                              requestAnimationFrame(() =>
                                bodyRef.current?.focus(),
                              );
                            }}
                            onMouseEnter={() => setActiveIdx(i)}
                            className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between text-[11.5px] transition-colors ${
                              i === activeIdx
                                ? "bg-foreground/[0.06] text-foreground"
                                : "text-foreground/80 hover:bg-foreground/[0.04]"
                            }`}
                          >
                            <span className="font-medium">{c.username}</span>
                            {c.role && (
                              <span className="text-[10px] text-text-tertiary">
                                {c.role}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md bg-foreground/[0.04] border-xs border-border-soft px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      To
                    </span>
                    <span className="text-[12.5px] font-medium text-foreground">
                      {chosen.username}
                    </span>
                    {chosen.role && (
                      <span className="text-[10px] text-text-tertiary">
                        · {chosen.role}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(null);
                      requestAnimationFrame(() => pickerRef.current?.focus());
                    }}
                    className="text-[10px] text-text-tertiary hover:text-foreground"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    Message
                  </label>
                  {chosen && (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      <Sparkles className="h-2.5 w-2.5 text-primary/70" />
                      Quick presets
                    </span>
                  )}
                </div>

                {/* Preset compliment chips — only after a recipient is
                 *  picked, so the dialog leads with "who" not "what".
                 *  Clicking a preset replaces the current draft. */}
                {chosen && (
                  <div className="flex flex-wrap gap-1 mb-2 list-none p-0 m-0">
                    {KUDOS_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setBody(p.body.slice(0, MAX_BODY_LEN));
                          requestAnimationFrame(() => bodyRef.current?.focus());
                        }}
                        className="
                          inline-flex items-center text-[10.5px] font-medium
                          px-2 py-1 rounded-md
                          bg-foreground/[0.04] hover:bg-primary/[0.10]
                          border-xs border-border-soft hover:border-primary/30
                          text-foreground/75 hover:text-foreground
                          transition-colors
                        "
                        title={p.body}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LEN))}
                  placeholder="What did they do that mattered?"
                  rows={3}
                  className="w-full bg-background/40 border-xs border-border-soft rounded-md px-2.5 py-2 text-[12.5px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 resize-none"
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-text-tertiary">
                  <span>Posts to Team Pulse · public to the whole company</span>
                  <span className={trimmed.length > MAX_BODY_LEN - 20 ? "text-warning" : ""}>
                    {trimmed.length}/{MAX_BODY_LEN}
                  </span>
                </div>
              </div>

              {error && (
                <div className="text-[11px] text-destructive bg-destructive/10 border-xs border-destructive/30 rounded-md px-2.5 py-1.5">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-xs border-border-soft bg-popover/40">
              <span className="text-[10px] text-text-tertiary">
                ⌘↵ to send · Esc to close
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={`flex items-center gap-1.5 text-[11.5px] font-semibold rounded-md px-3 py-1.5 transition-colors ${
                  canSubmit
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-foreground/[0.06] text-text-tertiary cursor-not-allowed"
                }`}
              >
                <Send className="h-3 w-3" />
                {sending ? "Sending…" : "Send kudos"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
