/**
 * ThreadComposer.tsx — Minimal composer used inside ThreadPanel / inline.
 *
 * Smaller than MessageComposer: no typing-presence broadcast, no reply
 * quote pill. Sends messages with thread_root_id set so they show up in
 * the thread feed.
 */

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { getActiveCompanyLabel } from "@/stores/query";

interface Props {
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";
  rootMsgId: number;
}

export function ThreadComposer({
  group,
  currentUsername,
  userAvatar,
  table,
  rootMsgId,
}: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText("");

    const payload: Record<string, unknown> = {
      sent_by: currentUsername,
      message: msg,
      userAvatar,
      thread_root_id: rootMsgId,
    };

    if (table === "cwa_chat") {
      payload.company = getActiveCompanyLabel();
    } else {
      payload.dm_group = group;
    }

    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      console.error("[thread reply] insert failed:", error.message);
      setText(msg); // restore so user doesn't lose their draft
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card/80 p-3 backdrop-blur">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-2 py-1.5 focus-within:border-foreground/20">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Reply in thread…"
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Send reply"
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
