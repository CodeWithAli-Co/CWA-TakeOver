/**
 * GlobalSearch.tsx — Cmd+K search across every channel + DM.
 *
 * Hit Cmd/Ctrl+K anywhere in the app to open. Queries both cwa_chat and
 * cwa_dm_chat in parallel via ilike on the message body. Clicking a result
 * navigates to the owning channel and scrolls to the message.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, MessageSquare, Search, Loader2, ArrowRight } from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";
import { ActiveUser } from "@/stores/query";
import { displayLabelForDM, isDMKey } from "./displayName";

interface Hit {
  msg_id: number;
  group: string;   // "General" or dm_group name
  kind: "general" | "dm";
  sent_by: string;
  message: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setGroupName } = useAppStore();
  // Current user is needed so the helper can pick the OTHER party in a
  // 1:1 DM and render "Me" for self-DMs.
  const { data: me } = ActiveUser();
  const currentUsername = me?.[0]?.username || "";

  // Reset on close + autofocus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const needle = q.trim();
    if (needle.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Prefer the ranked full-text RPC when the migration has been
        // applied. Falls back to the legacy parallel ilike queries
        // gracefully if the RPC returns an error.
        let merged: Hit[] = [];
        const rpc = await companySupabase.rpc("chat_search", { needle, lim: 40 });
        if (!rpc.error && Array.isArray(rpc.data)) {
          merged = (rpc.data as any[]).map((r) => ({
            msg_id: r.msg_id,
            group: r.table_name === "cwa_chat" ? "General" : r.dm_group,
            kind: (r.table_name === "cwa_chat" ? "general" : "dm") as const,
            sent_by: r.sent_by,
            message: r.message ?? "",
            created_at: r.created_at,
          }));
        } else {
          // Legacy path — keeps search working before the migration runs.
          const [{ data: generalData }, { data: dmData }] = await Promise.all([
            supabase
              .from("cwa_chat")
              .select("msg_id, sent_by, message, created_at")
              .ilike("message", `%${needle}%`)
              .order("msg_id", { ascending: false })
              .limit(20),
            supabase
              .from("cwa_dm_chat")
              .select("msg_id, sent_by, message, dm_group, created_at")
              .ilike("message", `%${needle}%`)
              .order("msg_id", { ascending: false })
              .limit(20),
          ]);
          merged = [
            ...(generalData ?? []).map((r: any) => ({
              msg_id: r.msg_id,
              group: "General",
              kind: "general" as const,
              sent_by: r.sent_by,
              message: r.message ?? "",
              created_at: r.created_at,
            })),
            ...(dmData ?? []).map((r: any) => ({
              msg_id: r.msg_id,
              group: r.dm_group,
              kind: "dm" as const,
              sent_by: r.sent_by,
              message: r.message ?? "",
              created_at: r.created_at,
            })),
          ]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 30);
        }
        setHits(merged);
        setActive(0);
      } catch (err) {
        console.error("[search] failed:", err);
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [q, open]);

  const jumpTo = useCallback(
    (hit: Hit) => {
      setGroupName(hit.group);
      onOpenChange(false);
      // Give the chat view a frame to mount, then scroll the target msg.
      setTimeout(() => {
        const el = document.getElementById(`msg-${hit.msg_id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary/60", "rounded-md");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-primary/60", "rounded-md");
          }, 2000);
        }
      }, 400);
    },
    [setGroupName, onOpenChange],
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) jumpTo(hit);
    }
  };

  // Grouped hits render (by channel)
  const grouped = useMemo(() => {
    const m = new Map<string, Hit[]>();
    for (const h of hits) {
      if (!m.has(h.group)) m.set(h.group, []);
      m.get(h.group)!.push(h);
    }
    return Array.from(m.entries());
  }, [hits]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/60 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="flex w-full max-w-[580px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.65)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Search messages"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search messages across every channel…"
                className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  esc
                </kbd>
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {q.trim().length < 2 && (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  Type at least 2 characters to search every channel + DM.
                </div>
              )}

              {q.trim().length >= 2 && !loading && hits.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  No messages match “{q.trim()}”.
                </div>
              )}

              {grouped.map(([group, groupHits]) => {
                // Display label routes through the central helper — keeps
                // "dm::Ali::Mason" out of the search-results header.
                const groupLabel = isDMKey(group)
                  ? displayLabelForDM(group, currentUsername)
                  : group;
                return (
                <div key={group} className="py-1">
                  <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {group === "General" ? (
                      <Hash className="h-3 w-3 text-primary" />
                    ) : (
                      <MessageSquare className="h-3 w-3 text-primary" />
                    )}
                    {groupLabel}
                    <span className="opacity-60">· {groupHits.length}</span>
                  </div>
                  {groupHits.map((hit) => {
                    const globalIdx = hits.indexOf(hit);
                    const isActive = globalIdx === active;
                    return (
                      <button
                        key={`${hit.kind}-${hit.msg_id}`}
                        type="button"
                        onClick={() => jumpTo(hit)}
                        onMouseEnter={() => setActive(globalIdx)}
                        className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                          isActive ? "bg-muted" : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-semibold text-foreground">
                              {hit.sent_by}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(hit.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[12.5px] text-foreground/80">
                            {highlight(hit.message, q.trim())}
                          </div>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>
                <kbd className="rounded border border-border bg-muted/40 px-1 py-0.5 text-[9px]">↑↓</kbd>{" "}
                navigate ·{" "}
                <kbd className="rounded border border-border bg-muted/40 px-1 py-0.5 text-[9px]">⏎</kbd>{" "}
                jump
              </span>
              <span>{hits.length} results</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Highlight matching substrings. Returns a React fragment. */
function highlight(text: string, needle: string): React.ReactNode {
  if (!needle) return text;
  const re = new RegExp(
    `(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "ig",
  );
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark
        key={i}
        className="rounded-sm bg-primary/30 px-0.5 text-primary-foreground"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
