/**
 * MessageComposer.tsx — Bottom input area for sending messages.
 *
 * Features:
 *   - Reply quote pill (when replyingTo is set in chatStore)
 *   - Typing indicator broadcast via Supabase Realtime presence
 *   - Send on Enter, Shift+Enter for newline
 */

import { useState, useRef, useEffect } from "react";
import { Send, X, Paperclip, Smile } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";
}

export const MessageComposer: React.FC<Props> = ({
  group, currentUsername, userAvatar, table,
}) => {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { replyingTo, setReplyingTo, setTyping } = useChatStore();
  const typingChannelRef = useRef<any>(null);

  // Set up presence channel for typing indicators
  useEffect(() => {
    const channel = supabase.channel(`typing-${group}`, {
      config: { presence: { key: currentUsername } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typers: { username: string; expiresAt: number }[] = [];
        Object.entries(state).forEach(([key, presences]: [string, any]) => {
          const p = presences[0];
          if (p?.typing && p.expiresAt > Date.now()) {
            typers.push({ username: key, expiresAt: p.expiresAt });
          }
        });
        setTyping(group, typers);
      })
      .subscribe();

    typingChannelRef.current = channel;
    return () => {
      channel.unsubscribe();
    };
  }, [group, currentUsername, setTyping]);

  // Broadcast typing on input
  const handleChange = (val: string) => {
    setText(val);
    if (typingChannelRef.current) {
      typingChannelRef.current.track({
        typing: val.length > 0,
        expiresAt: Date.now() + 5000,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    // Minimal payload — works even without schema migrations
    const basePayload: any = {
      sent_by: currentUsername,
      message: text.trim(),
      userAvatar,
    };
    if (table === "cwa_dm_chat") basePayload.dm_group = group;

    // Extended payload — includes new columns (reactions, read_by, reply_to)
    const extendedPayload = {
      ...basePayload,
      reply_to: replyingTo?.msgId || null,
      reactions: {},
      read_by: [currentUsername],
    };

    // Try extended first; fall back to minimal if columns don't exist yet
    let { error } = await supabase.from(table).insert(extendedPayload);
    if (error) {
      console.warn("Extended insert failed, retrying without new columns:", error.message);
      const result = await supabase.from(table).insert(basePayload);
      error = result.error;
    }

    if (error) {
      console.error("Send message error:", error);
      return;
    }

    // Clear state immediately after successful send
    setText("");
    setReplyingTo(null);
    if (typingChannelRef.current) {
      typingChannelRef.current.track({ typing: false, expiresAt: 0 });
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="border-t border-white/[0.04] bg-[#0a0a0a]">
      {/* Reply quote pill */}
      {replyingTo && (
        <div className="px-5 pt-3 pb-2 flex items-start justify-between gap-3 border-b border-white/[0.04] bg-white/[0.015]">
          <div className="flex gap-2.5 min-w-0 flex-1">
            <div className="w-0.5 bg-red-500/50 rounded-full shrink-0 my-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-red-400/80 font-medium mb-0.5">
                Replying to <span className="text-red-300">{replyingTo.sentBy}</span>
              </p>
              <p className="text-[11px] text-white/50 truncate">{replyingTo.preview}</p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-5 py-3">
        <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.06] rounded-md focus-within:border-red-500/25 focus-within:bg-white/[0.04] transition-all">
          <button
            type="button"
            className="p-2.5 text-white/25 hover:text-white/60 transition-colors"
            title="Attach"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${group}`}
            rows={1}
            className="flex-1 bg-transparent py-2.5 text-[13.5px] text-white/85 placeholder:text-white/20 focus:outline-none resize-none max-h-32"
          />
          <button
            type="button"
            className="p-2.5 text-white/25 hover:text-white/60 transition-colors"
            title="Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-2 mr-1 my-1 rounded-sm bg-red-600 hover:bg-red-500 active:scale-95 text-white disabled:bg-white/[0.04] disabled:text-white/20 disabled:cursor-not-allowed transition-all"
            title="Send message (Enter)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-white/15 mt-1.5 px-1">
          Press <kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-white/40 text-[9px] border border-white/[0.06]">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-white/[0.04] rounded text-white/40 text-[9px] border border-white/[0.06]">Shift+Enter</kbd> for newline
        </p>
      </form>
    </div>
  );
};
