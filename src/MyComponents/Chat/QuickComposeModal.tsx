/**
 * QuickComposeModal.tsx — Cmd+Shift+M global composer.
 *
 * Opens from anywhere in the app. Lets the operator pick a
 * channel or DM via typeahead and fire a message without
 * navigating to /chat. Returns focus to wherever they were
 * when they pressed the shortcut.
 *
 * Send path:
 *   - "#General"          → supabase.from("cwa_chat").insert(...)
 *   - "@user" / dm name   → supabase.from("cwa_dm_chat").insert(...)
 *
 * Wire-up: mounted once in __root.tsx. Subscribes to the
 * useQuickCompose zustand store; rendered only when open=true.
 * The Cmd+Shift+M keyboard binding lives in __root.tsx so this
 * component stays presentation-focused.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, AtSign, Send, X, ChevronUp, ChevronDown, Clock } from "lucide-react";
import supabase from "../supabase";
import { ActiveUser, DMGroups } from "@/stores/query";
import {
  useQuickCompose,
  readRecentTargets,
  pushRecentTarget,
} from "./quickComposeStore";

// ── Target types ──────────────────────────────────────────────

type TargetKind = "channel" | "dm";

interface Target {
  kind: TargetKind;
  /** Display label (e.g. "General", "Marcus + Ali"). */
  name: string;
  /** Storage value: dm_group name or "General". */
  id: string;
}

// Channels list — hardcoded for now (General is the only one
// in the cwa_chat table). When a real channels table lands, this
// becomes a query. Keeping it inline keeps the modal self-contained.
const STATIC_CHANNELS: Target[] = [
  { kind: "channel", name: "General", id: "General" },
];

// ── Component ─────────────────────────────────────────────────

export function QuickComposeModal() {
  const { open, prefilledTarget, prefilledBody, closeCompose } = useQuickCompose();
  const { data: userRows } = ActiveUser();
  const user = userRows?.[0];
  // DMGroups uses useSuspenseQuery, so it'd suspend on first hit.
  // The modal can render before any chat page has been visited,
  // which means we may suspend. Acceptable for now — the typeahead
  // just shows the channels list while DMs hydrate. If suspense
  // becomes a UX issue, swap to useQuery here.
  const { data: dmGroups } = DMGroups(user?.username ?? "");

  const targets = useMemo<Target[]>(() => {
    const dms: Target[] = (dmGroups ?? []).map((g: any) => ({
      kind: "dm" as const,
      name: g.group_name ?? g.name ?? String(g.id ?? ""),
      id: g.group_name ?? g.name ?? String(g.id ?? ""),
    }));
    return [...STATIC_CHANNELS, ...dms.filter((t) => t.id)];
  }, [dmGroups]);

  const [pickerQuery, setPickerQuery] = useState("");
  const [chosen, setChosen] = useState<Target | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const pickerRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Open/close lifecycle ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // Capture the element that had focus so we can restore it on close.
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setRecent(readRecentTargets());

    // Apply any prefill from the Cmd+K /msg verb route.
    if (prefilledTarget) {
      const found = targets.find((t) => matchesTarget(t, prefilledTarget));
      if (found) {
        setChosen(found);
        setPickerQuery("");
      } else {
        setPickerQuery(prefilledTarget);
        setChosen(null);
      }
    }
    if (prefilledBody) setBody(prefilledBody);

    requestAnimationFrame(() => {
      if (prefilledTarget && prefilledBody) {
        // Power-user: both filled by Cmd+K. Focus body for review.
        bodyRef.current?.focus();
      } else if (chosen) {
        bodyRef.current?.focus();
      } else {
        pickerRef.current?.focus();
      }
    });
    return () => {
      // On close: restore focus.
      previousFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset state when the modal closes (next open starts clean).
  useEffect(() => {
    if (!open) {
      setPickerQuery("");
      setChosen(null);
      setBody("");
      setError(null);
      setSending(false);
      setActiveIdx(0);
    }
  }, [open]);

  // ── Filtered target list ────────────────────────────────────
  const filtered = useMemo(() => {
    const q = pickerQuery.replace(/^[#@]/, "").toLowerCase().trim();
    const recentTargets = recent
      .map((id) => targets.find((t) => t.id === id))
      .filter((t): t is Target => !!t);
    const others = targets.filter((t) => !recent.includes(t.id));

    const matches = (t: Target) =>
      !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);

    const recentMatches = recentTargets.filter(matches);
    const otherMatches = others.filter(matches);
    return { recent: recentMatches, others: otherMatches };
  }, [targets, recent, pickerQuery]);

  const flatList: Target[] = [...filtered.recent, ...filtered.others];

  // Keep activeIdx in range as the list filters down.
  useEffect(() => {
    if (activeIdx >= flatList.length) setActiveIdx(Math.max(0, flatList.length - 1));
  }, [flatList.length, activeIdx]);

  // ── Submit ──────────────────────────────────────────────────
  const send = async () => {
    if (sending) return;
    if (!chosen) {
      setError("Pick a channel or DM first.");
      return;
    }
    if (!body.trim()) {
      setError("Type a message.");
      return;
    }
    if (!user) {
      setError("Not signed in.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      if (chosen.kind === "channel") {
        const { error: insertErr } = await supabase.from("cwa_chat").insert({
          sent_by: user.username,
          message: body.trim(),
          userAvatar: user.avatarURL,
        });
        if (insertErr) throw insertErr;
      } else {
        const { error: insertErr } = await supabase.from("cwa_dm_chat").insert({
          dm_group: chosen.id,
          sent_by: user.username,
          message: body.trim(),
          userAvatar: user.avatarURL,
        });
        if (insertErr) throw insertErr;
      }
      pushRecentTarget(chosen.id);
      closeCompose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  // ── Keyboard ────────────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCompose();
      return;
    }
    // ↑↓ navigation in the picker only when the picker is focused
    // AND the user hasn't chosen a target yet.
    if (!chosen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (flatList.length === 0) return;
      setActiveIdx((cur) => {
        if (e.key === "ArrowDown") return (cur + 1) % flatList.length;
        return (cur - 1 + flatList.length) % flatList.length;
      });
      return;
    }
    if (!chosen && e.key === "Enter") {
      e.preventDefault();
      const pick = flatList[activeIdx];
      if (pick) {
        setChosen(pick);
        setPickerQuery("");
        requestAnimationFrame(() => bodyRef.current?.focus());
      }
      return;
    }
    // In the body textarea, Enter sends, Shift+Enter newlines.
    if (chosen && e.key === "Enter" && !e.shiftKey && document.activeElement === bodyRef.current) {
      e.preventDefault();
      void send();
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={closeCompose}
          onKeyDown={onKeyDown}
          style={{
            position: "fixed", inset: 0, zIndex: 5000,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: "12vh", background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
          }}
        >
          <motion.div
            initial={{ y: -8, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border"
            style={{
              width: "min(520px, 92vw)", borderRadius: 12,
              boxShadow: "0 24px 48px -12px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div className="border-b border-border" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>
                  Quick send
                </span>
                <span className="text-muted-foreground" style={{ fontSize: 10.5, marginLeft: "auto" }}>
                  {chosen ? "Enter to send · Shift+Enter for newline" : "↑↓ to pick · Enter to choose"} · Esc to cancel
                </span>
              </div>
            </div>

            {/* Target picker */}
            <div style={{ padding: "10px 14px" }}>
              {chosen ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TargetChip target={chosen} />
                  <button
                    type="button"
                    onClick={() => { setChosen(null); requestAnimationFrame(() => pickerRef.current?.focus()); }}
                    className="text-muted-foreground hover:text-foreground"
                    style={{ marginLeft: 4, padding: 2, borderRadius: 4 }}
                    aria-label="Change target"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <input
                  ref={pickerRef}
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => { setPickerQuery(e.target.value); setActiveIdx(0); }}
                  placeholder="Channel or DM (# or @)"
                  className="bg-background border border-border text-foreground placeholder:text-muted-foreground"
                  style={{
                    width: "100%", padding: "8px 10px",
                    borderRadius: 8, fontSize: 13, outline: "none",
                  }}
                />
              )}
            </div>

            {/* Typeahead results — only while no target chosen */}
            {!chosen && flatList.length > 0 && (
              <div
                className="border-t border-border bg-background/40"
                style={{ maxHeight: 220, overflowY: "auto", padding: "4px 6px" }}
              >
                {filtered.recent.length > 0 && (
                  <SectionHeader label="Recent" icon={Clock} />
                )}
                {filtered.recent.map((t, i) => (
                  <TargetRow
                    key={`recent-${t.id}`}
                    target={t}
                    active={i === activeIdx}
                    onChoose={() => { setChosen(t); setPickerQuery(""); requestAnimationFrame(() => bodyRef.current?.focus()); }}
                  />
                ))}
                {filtered.others.length > 0 && (
                  <SectionHeader label="All" icon={Hash} />
                )}
                {filtered.others.map((t, i) => {
                  const flatIdx = filtered.recent.length + i;
                  return (
                    <TargetRow
                      key={`other-${t.id}`}
                      target={t}
                      active={flatIdx === activeIdx}
                      onChoose={() => { setChosen(t); setPickerQuery(""); requestAnimationFrame(() => bodyRef.current?.focus()); }}
                    />
                  );
                })}
              </div>
            )}

            {/* Body */}
            {chosen && (
              <div className="border-t border-border" style={{ padding: "10px 14px" }}>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message…"
                  rows={3}
                  className="bg-background border border-border text-foreground placeholder:text-muted-foreground"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    fontSize: 13.5, lineHeight: 1.5, resize: "vertical",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            )}

            {/* Footer */}
            <div
              className="border-t border-border bg-card/40"
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ fontSize: 11, color: "var(--axon-muted, #888)" }}>
                {error ? <span style={{ color: "hsl(0 72% 65%)" }}>⚠ {error}</span> : null}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={closeCompose}
                  className="text-muted-foreground hover:text-foreground border border-border bg-background"
                  style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!chosen || !body.trim() || sending}
                  className="bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Send className="h-3 w-3" />
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function TargetChip({ target }: { target: Target }) {
  const Icon = target.kind === "channel" ? Hash : AtSign;
  return (
    <span
      className="bg-muted text-foreground"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
      }}
    >
      <Icon className="h-3 w-3" />
      {target.name}
    </span>
  );
}

function TargetRow({
  target, active, onChoose,
}: {
  target: Target;
  active: boolean;
  onChoose: () => void;
}) {
  const Icon = target.kind === "channel" ? Hash : AtSign;
  return (
    <button
      type="button"
      onClick={onChoose}
      onMouseEnter={() => { /* hover handled via :hover for now */ }}
      className={active ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/40"}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 6, fontSize: 12.5,
        textAlign: "left", marginBottom: 2,
      }}
    >
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span>{target.name}</span>
      <span className="text-muted-foreground" style={{ fontSize: 10, marginLeft: "auto" }}>
        {target.kind === "channel" ? "channel" : "dm"}
      </span>
    </button>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon: typeof Hash }) {
  return (
    <div
      className="text-muted-foreground"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 10px 4px", fontSize: 9.5,
        textTransform: "uppercase", letterSpacing: "0.12em",
      }}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

/** True when `raw` (e.g. "#general", "@marcus", or just "general")
 *  refers to the given target by name or id. Case-insensitive. */
function matchesTarget(t: Target, raw: string): boolean {
  const norm = raw.replace(/^[#@]/, "").trim().toLowerCase();
  return (
    t.name.toLowerCase() === norm ||
    t.id.toLowerCase() === norm
  );
}

// Suppress unused-import warning when ChevronUp/ChevronDown aren't
// used yet (reserved for future "expand" / "collapse" affordance).
void ChevronUp; void ChevronDown;
