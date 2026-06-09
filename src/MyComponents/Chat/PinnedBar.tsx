/**
 * PinnedBar.tsx — Collapsible pinned-messages strip under ChatHeader.
 *
 * Shows pinned messages for the current group. Click a pin → scrolls to
 * that message in the feed. Click the chevron → collapses the bar.
 * Admin-only unpin X button to the right of each pin.
 */

import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { companySupabase } from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";
import type { MessageInterface } from "@/stores/query";

interface Props {
  pinnedMessages: MessageInterface[];
  group: string;
  table: "cwa_chat" | "cwa_dm_chat";
  currentUsername: string;
  isAdmin: boolean;
  onJumpTo: (msgId: number) => void;
}

export function PinnedBar({
  pinnedMessages,
  group,
  table,
  isAdmin,
  onJumpTo,
}: Props) {
  const { pinCollapsed, togglePinCollapsed } = useChatStore();
  const collapsed = !!pinCollapsed[group];

  if (pinnedMessages.length === 0) return null;

  const unpin = async (msgId: number) => {
    const { error } = await companySupabase
.from(table)
      .update({ pinned_at: null, pinned_by: null })
      .eq("msg_id", msgId);
    if (error) console.error("[unpin] failed:", error.message);
  };

  return (
    <div
      className="shrink-0 border-b border-border bg-muted/30 min-w-0 max-w-full overflow-hidden"
      data-pinned-bar={group}
    >
      <button
        type="button"
        onClick={() => togglePinCollapsed(group)}
        className="flex h-8 w-full items-center gap-2 px-4 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pin className="size-3" />
        <span className="font-medium">
          {pinnedMessages.length} pinned{" "}
          {pinnedMessages.length === 1 ? "message" : "messages"}
        </span>
        <span className="ml-auto">
          {collapsed ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {pinnedMessages.map((m) => (
              <li
                key={m.msg_id}
                className="flex items-start gap-2 border-t border-border/50 px-4 py-2 hover:bg-muted/40 min-w-0 max-w-full overflow-hidden"
              >
                <Pin className="mt-0.5 size-3 shrink-0 text-primary/70" />
                <button
                  type="button"
                  onClick={() => onJumpTo(m.msg_id)}
                  /* Cap reading width so the truncate ellipsis lands at
                     a sane column edge instead of running across a
                     maximized window and clipping at the viewport. */
                  className="flex min-w-0 flex-1 flex-col text-left max-w-[860px]"
                >
                  <span className="truncate text-[11px] font-semibold text-foreground">
                    {m.sent_by}
                  </span>
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    {m.message || (m.image_urls?.length
                      ? `[${m.image_urls.length} image${m.image_urls.length > 1 ? "s" : ""}]`
                      : "")}
                  </span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => unpin(m.msg_id)}
                    aria-label="Unpin"
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
