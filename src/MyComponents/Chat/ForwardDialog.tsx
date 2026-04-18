/**
 * ForwardDialog.tsx — Channel picker for forwarding a message.
 *
 * Shows General + every DM the user is in. Picking a destination inserts
 * the original message body (with a forwarded-from header marker) into
 * the target table.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Forward, Hash, MessageSquare, X } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { getActiveCompanyLabel } from "@/stores/query";
import type { MessageInterface } from "@/stores/query";

interface Group {
  id: string | number;
  name: string;
  type?: string;
  subscribers?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Source message being forwarded. */
  source: MessageInterface | null;
  /** Where the source lives (so we can label the "from" channel). */
  sourceGroup: string;
  /** Channels available as forwarding destinations. */
  groups: Group[];
  currentUsername: string;
  userAvatar: string;
}

export function ForwardDialog({
  open, onOpenChange, source, sourceGroup, groups, currentUsername, userAvatar,
}: Props) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const filtered = useMemo(
    () => groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search],
  );

  const forwardTo = async (destGroup: Group) => {
    if (!source) return;
    setSending(destGroup.name);
    try {
      const isGeneral = destGroup.name === "General";
      const table: "cwa_chat" | "cwa_dm_chat" = isGeneral ? "cwa_chat" : "cwa_dm_chat";
      // Strip any existing fwd marker so chains don't pile up; keep
      // image / reply markers intact (they belong to the original).
      const cleanBody = (source.message || "").replace(/^\{fwd:[^}]+\}\s*\n?/, "");
      const fwdMarker = `{fwd:${source.sent_by}|${sourceGroup}}\n`;
      const finalMessage = fwdMarker + cleanBody;

      const payload: Record<string, unknown> = {
        sent_by: currentUsername,
        message: finalMessage,
        userAvatar,
        reactions: {},
        read_by: [currentUsername],
        company: getActiveCompanyLabel(),
        image_urls: source.image_urls ?? null,
      };
      if (table === "cwa_dm_chat") payload.dm_group = destGroup.name;

      const { error } = await supabase.from(table).insert(payload);
      if (error) {
        console.error("[forward] failed:", error.message);
      }
    } finally {
      setSending(null);
      onOpenChange(false);
    }
  };

  return (
    <AnimatePresence>
      {open && source && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[16vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Forward message"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Forward className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Forward message</h3>
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

            {/* Source preview */}
            <div className="border-b border-border bg-muted/20 px-4 py-2.5 text-[11.5px]">
              <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                From {source.sent_by} · #{sourceGroup}
              </div>
              <div className="mt-0.5 line-clamp-2 italic text-foreground/80">
                {(source.message || "").replace(/^\{[a-z]+:[^}]+\}\s*\n?/, "") || "[attachment]"}
              </div>
            </div>

            {/* Search */}
            <div className="border-b border-border px-4 py-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a channel or DM…"
                className="w-full bg-transparent text-[12.5px] placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>

            <ul className="max-h-[40vh] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                  No matches.
                </li>
              ) : (
                filtered.map((g) => (
                  <li key={String(g.id)}>
                    <button
                      type="button"
                      onClick={() => forwardTo(g)}
                      disabled={sending != null}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] hover:bg-muted/60 disabled:opacity-60"
                    >
                      {g.name === "General" ? (
                        <Hash className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="flex-1 truncate text-foreground">
                        {g.name}
                      </span>
                      {sending === g.name && (
                        <span className="text-[10px] text-muted-foreground">sending…</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
