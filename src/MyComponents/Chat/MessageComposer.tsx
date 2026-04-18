/**
 * MessageComposer.tsx — Bottom input area for sending messages.
 *
 * Features:
 *   - Reply quote pill (when replyingTo is set in chatStore)
 *   - Typing indicator broadcast via Supabase Realtime presence
 *   - Emoji picker (full picker — inline popover)
 *   - Image attachments: paperclip picker, drag-and-drop, paste from clipboard
 *   - /axon <prompt> slash command → Axon drafts a reply, fills textarea
 *   - Send on Enter, Shift+Enter for newline
 */

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Paperclip, Smile, Sparkles, Loader2, Image as ImgIcon, Reply, Mic, Square, Trash2, Clock } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";
import { getActiveCompanyLabel } from "@/stores/query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcnComponents/popover";
import { EmojiPicker } from "./EmojiPicker";
import { useImageUpload, type PendingUpload } from "./useImageUpload";
import { draftChatReply } from "@/Axon/engine/chatDraft";
import { MentionPicker, detectMentionQuery } from "./MentionPicker";
import { useVoiceRecorder, formatElapsed } from "./useVoiceRecorder";
import {
  addScheduled,
  listScheduledForGroup,
  removeScheduled,
  type ScheduledMessage,
} from "./scheduledStore";

interface Props {
  group: string;
  currentUsername: string;
  userAvatar: string;
  table: "cwa_chat" | "cwa_dm_chat";
  /** Last few messages in the channel — passed to /axon for context. */
  recentMessages?: { sender: string; text: string }[];
  /** Called after a successful insert so the parent can refetch
   *  immediately — belt-and-suspenders against slow realtime. */
  onAfterSend?: () => void;
  /** Members available for @mention autocomplete. */
  members?: string[];
}

const AXON_COMMAND = /^\/axon\s+/i;

export const MessageComposer: React.FC<Props> = ({
  group, currentUsername, userAvatar, table, recentMessages, onAfterSend,
  members = [],
}) => {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [axonBusy, setAxonBusy] = useState(false);
  const [axonError, setAxonError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  // Mention autocomplete state
  const [mentionInfo, setMentionInfo] = useState<{
    query: string;
    startIndex: number;
  } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const filteredMembers = mentionInfo
    ? members
        .filter((m) => m.toLowerCase().includes(mentionInfo.query.toLowerCase()))
        .filter((m) => m !== currentUsername)
        .slice(0, 8)
    : [];

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<any>(null);

  const { replyingTo, setReplyingTo, setTyping } = useChatStore();
  const {
    pending, removePending, clearPending, uploadMany, filesFromClipboard,
  } = useImageUpload(group, currentUsername);
  const voice = useVoiceRecorder();

  const handleMicToggle = async () => {
    if (voice.recording) {
      const file = await voice.stop();
      if (file) await uploadMany([file]);
    } else {
      await voice.start();
    }
  };

  // Scheduled messages — list + tick in response to changes
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  useEffect(() => {
    const refresh = () => setScheduled(listScheduledForGroup(group));
    refresh();
    window.addEventListener("cwa-scheduled-changed", refresh);
    const id = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("cwa-scheduled-changed", refresh);
      clearInterval(id);
    };
  }, [group]);

  const scheduleSend = async (dueAt: Date) => {
    const expanded = expandSlashCommands(text, currentUsername);
    const textContent = expanded.trim();
    const imageUrls = pending
      .map((p) => p.publicUrl)
      .filter((u): u is string => !!u);
    if (!textContent && imageUrls.length === 0) return;

    const parts: string[] = [];
    if (replyingTo) {
      parts.push(`{reply:${replyingTo.msgId}|${replyingTo.sentBy}}`);
    }
    if (textContent) parts.push(textContent);
    parts.push(...imageUrls);
    const finalMessage = parts.join("\n");

    const payload: Record<string, unknown> = {
      sent_by: currentUsername,
      message: finalMessage,
      userAvatar,
      reply_to: replyingTo?.msgId || null,
      reactions: {},
      read_by: [currentUsername],
      company: getActiveCompanyLabel(),
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    };
    if (table === "cwa_dm_chat") payload.dm_group = group;

    addScheduled({
      dueAt: dueAt.toISOString(),
      table,
      group,
      payload,
      createdBy: currentUsername,
      preview: textContent.slice(0, 60) || `[${imageUrls.length} attachment]`,
    });
    setText("");
    setReplyingTo(null);
    clearPending();
  };

  // ── typing presence ───────────────────────────────────────────────────
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
    return () => { channel.unsubscribe(); };
  }, [group, currentUsername, setTyping]);

  const handleChange = (val: string) => {
    setText(val);
    setAxonError(null);
    if (typingChannelRef.current) {
      typingChannelRef.current.track({
        typing: val.length > 0,
        expiresAt: Date.now() + 5000,
      });
    }
    // Update mention-detect state based on the current caret position.
    const caret = inputRef.current?.selectionStart ?? val.length;
    const info = detectMentionQuery(val, caret);
    setMentionInfo(info);
    setMentionIdx(0);
  };

  const insertMention = (username: string) => {
    if (!mentionInfo) return;
    const before = text.slice(0, mentionInfo.startIndex);
    const caret = inputRef.current?.selectionStart ?? text.length;
    const after = text.slice(caret);
    const inserted = `@${username} `;
    const next = before + inserted + after;
    setText(next);
    setMentionInfo(null);
    // Restore focus + set caret just after the inserted mention.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // ── /axon detection ─────────────────────────────────────────────────
  const runAxon = async (prompt: string) => {
    setAxonBusy(true);
    setAxonError(null);
    const res = await draftChatReply(prompt, {
      groupName: group,
      operator: currentUsername,
      recentMessages,
    });
    setAxonBusy(false);
    if (res.error) {
      setAxonError(res.error);
      return;
    }
    setText(res.text);
    inputRef.current?.focus();
  };

  // ── image handling ────────────────────────────────────────────────────
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = filesFromClipboard(e.nativeEvent as unknown as ClipboardEvent);
    if (files.length > 0) {
      e.preventDefault();
      uploadMany(files);
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadMany(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const files: File[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      files.push(e.dataTransfer.files[i]!);
    }
    if (files.length > 0) uploadMany(files);
  };

  // ── send ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // /axon: if the command is in the text, strip it and ask Axon to draft.
    if (AXON_COMMAND.test(text)) {
      const prompt = text.replace(AXON_COMMAND, "").trim();
      if (!prompt) {
        setAxonError("Usage: /axon <what you want to say>");
        return;
      }
      await runAxon(prompt);
      return; // user reviews the draft and sends manually
    }

    // Expand slash commands before anything else reads `text`.
    const expanded = expandSlashCommands(text, currentUsername);
    const textContent = expanded.trim();
    const hasText = !!textContent;
    const hasPending = pending.some((p) => !p.publicUrl);
    if (hasPending) return; // wait for uploads
    const imageUrls = pending
      .map((p) => p.publicUrl)
      .filter((u): u is string => !!u);

    if (!hasText && imageUrls.length === 0) return;

    // Always embed attachments inside the message body so they survive any
    // DB column the user's schema happens to be missing:
    //   · Image URLs append as plain text (MessageBubble extracts them back).
    //   · If this is a reply, prepend an invisible marker that MessageBubble
    //     parses back into a reply quote — works even when the DB has no
    //     `reply_to` column.
    const parts: string[] = [];
    if (replyingTo) {
      parts.push(`{reply:${replyingTo.msgId}|${replyingTo.sentBy}}`);
    }
    if (textContent) parts.push(textContent);
    parts.push(...imageUrls);
    const finalMessage = parts.join("\n");

    const basePayload: Record<string, unknown> = {
      sent_by: currentUsername,
      message: finalMessage,
      userAvatar,
    };
    if (table === "cwa_dm_chat") basePayload.dm_group = group;

    // Start with every column we'd like to populate. The fallback loop below
    // drops fields whose columns don't exist in the DB, so inserts survive
    // schemas missing optional columns (image_urls, reactions, read_by, etc.).
    const aggressivePayload: Record<string, unknown> = {
      ...basePayload,
      reply_to: replyingTo?.msgId || null,
      reactions: {},
      read_by: [currentUsername],
      company: getActiveCompanyLabel(),
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    };

    // Progressive fallback: on "column X does not exist" errors, drop X
    // and retry. Order here is by importance: image_urls first (least
    // critical), reply_to last (most critical for reply-quote rendering).
    const dropOrder = [
      "image_urls",
      "company",
      "reactions",
      "read_by",
      "reply_to",
    ];
    let payload: Record<string, unknown> = { ...aggressivePayload };
    let error: { message: string } | null = null;
    for (let attempt = 0; attempt <= dropOrder.length; attempt++) {
      const res = await supabase.from(table).insert(payload);
      error = res.error ? { message: res.error.message } : null;
      if (!error) break;

      // Try to identify the offending column from the error message
      const msg = error.message || "";
      const match =
        msg.match(/column\s+["']?(\w+)["']?\s+.*(?:does not exist|not found)/i) ||
        msg.match(/Could not find the ['"]?(\w+)['"]? column/i);
      const offending = match?.[1];

      let dropped = false;
      if (offending && offending in payload) {
        console.warn(`[send] column "${offending}" missing, retrying without it`);
        const next = { ...payload };
        delete next[offending];
        payload = next;
        dropped = true;
      } else {
        // Didn't recognise the column from error text — drop from our preset
        // list in order.
        for (const col of dropOrder) {
          if (col in payload) {
            console.warn(`[send] retrying without "${col}" (error was: ${msg})`);
            const next = { ...payload };
            delete next[col];
            payload = next;
            dropped = true;
            break;
          }
        }
      }
      if (!dropped) break;
    }

    if (error) {
      console.error("[send] all insert variants failed:", error);
      return;
    }

    setText("");
    setReplyingTo(null);
    clearPending();
    if (typingChannelRef.current) {
      typingChannelRef.current.track({ typing: false, expiresAt: 0 });
    }
    inputRef.current?.focus();

    // Belt-and-suspenders: trigger an immediate refetch so the UI shows the
    // new message even if Supabase realtime is slow / dropped.
    onAfterSend?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Mention autocomplete: Arrow / Enter / Escape take precedence while the
    // popover is open.
    if (mentionInfo && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => Math.min(filteredMembers.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = filteredMembers[mentionIdx];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionInfo(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isAxonMode = AXON_COMMAND.test(text);

  return (
    <div
      className="border-t border-border bg-card"
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={onDrop}
    >
      {/* Reply quote pill — bold so user can't miss that they're in reply mode */}
      {replyingTo && (
        <div className="flex items-start justify-between gap-3 border-b border-primary/25 bg-primary/[0.08] px-5 py-2.5">
          <div className="flex gap-2.5 min-w-0 flex-1">
            <div className="w-1 rounded-full bg-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                <Reply className="h-3 w-3" />
                Replying to {replyingTo.sentBy}
              </p>
              <p className="text-[11.5px] text-foreground/85 truncate italic">
                {replyingTo.preview}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Scheduled-messages chip */}
      {scheduled.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/[0.05] px-5 py-1.5 text-[11px]">
          <Clock className="h-3 w-3 text-primary" />
          <span className="text-primary">
            {scheduled.length} scheduled in this channel
          </span>
          <button
            type="button"
            onClick={() => scheduled.forEach((s) => removeScheduled(s.id))}
            className="ml-auto text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Pending image thumbnails */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-2">
          {pending.map((p) => (
            <PendingThumb key={p.id} item={p} onRemove={() => removePending(p.id)} />
          ))}
        </div>
      )}

      {/* Axon error banner */}
      {axonError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-1.5 text-[11px] text-destructive">
          {axonError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative px-5 py-3">
        {draggingOver && (
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-md border-2 border-dashed border-primary/40 bg-primary/5 text-[11.5px] font-medium text-primary">
            <ImgIcon className="mr-2 h-4 w-4" />
            Drop images to attach
          </div>
        )}

        <div className={`flex items-end gap-2 bg-muted/40 border rounded-md focus-within:bg-muted/50 transition-all ${
          isAxonMode
            ? "border-primary/50 focus-within:border-primary/70"
            : "border-border focus-within:border-red-500/25"
        }`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-muted-foreground/50 hover:text-foreground/60 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          {/* Mic / voice message */}
          {voice.recording ? (
            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={voice.cancel}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                title="Cancel recording"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleMicToggle}
                className="flex items-center gap-1.5 rounded-full bg-destructive/15 border border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive"
                title="Stop recording"
              >
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-destructive" />
                {formatElapsed(voice.elapsed)}
                <Square className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMicToggle}
              className="p-2.5 text-muted-foreground/50 hover:text-primary transition-colors"
              title="Record voice message"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />

          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              onSelect={() => {
                const caret = inputRef.current?.selectionStart ?? text.length;
                const info = detectMentionQuery(text, caret);
                setMentionInfo(info);
              }}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              placeholder={
                isAxonMode
                  ? "Axon is listening… press Enter to draft"
                  : `Message #${group} — @ to mention · /axon for AI`
              }
              rows={1}
              className="w-full bg-transparent py-2.5 text-[13.5px] text-foreground/85 placeholder:text-muted-foreground/60 focus:outline-none resize-none max-h-32"
            />
            <AnimatePresence>
              {mentionInfo && filteredMembers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-0 z-30 mb-2"
                >
                  <MentionPicker
                    members={filteredMembers}
                    query={mentionInfo.query}
                    activeIndex={mentionIdx}
                    onPick={insertMention}
                    onSetIndex={setMentionIdx}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Emoji picker anchor */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="p-2.5 text-muted-foreground/50 hover:text-foreground/60 transition-colors"
              title="Emoji"
              aria-expanded={showEmoji}
            >
              <Smile className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {showEmoji && (
                <div className="absolute bottom-full right-0 z-30 mb-2">
                  <EmojiPicker
                    onPick={(e) => {
                      setText((t) => t + e);
                      setShowEmoji(false);
                      inputRef.current?.focus();
                    }}
                    onClose={() => setShowEmoji(false)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Send-later popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-2.5 text-muted-foreground/50 hover:text-foreground/60 transition-colors"
                title="Schedule send"
              >
                <Clock className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 p-1.5"
            >
              <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Send later
              </div>
              {[
                { label: "In 10 minutes", ms: 10 * 60_000 },
                { label: "In 1 hour", ms: 60 * 60_000 },
                { label: "In 4 hours", ms: 4 * 60 * 60_000 },
                { label: "Tomorrow at 9 AM", at: nextMorningAt9() },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    const due = "at" in opt && opt.at != null
                      ? opt.at
                      : new Date(Date.now() + ((opt as { ms: number }).ms ?? 0));
                    scheduleSend(due);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-foreground/85 hover:bg-muted"
                >
                  <span>{opt.label}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    {"at" in opt && opt.at != null
                      ? opt.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button
            type="submit"
            disabled={axonBusy || pending.some((p) => !p.publicUrl) || (!text.trim() && pending.length === 0)}
            className="p-2 mr-1 my-1 rounded-sm bg-primary hover:bg-primary/80 active:scale-95 text-foreground disabled:bg-muted/50 disabled:text-muted-foreground/60 disabled:cursor-not-allowed transition-all"
            title={isAxonMode ? "Draft with Axon" : "Send (Enter)"}
          >
            {axonBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isAxonMode ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
          Press <kbd className="px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">Enter</kbd> to send ·
          <kbd className="mx-1 px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">Shift+Enter</kbd> newline ·
          <kbd className="mx-1 px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">/axon</kbd> draft with AI ·
          paste or drop images
        </p>
      </form>
    </div>
  );
};

// ── pending thumbnail / file card ---------------------------------------

function PendingThumb({
  item, onRemove,
}: {
  item: PendingUpload;
  onRemove: () => void;
}) {
  const uploading = !item.publicUrl;
  const kb = item.file.size >= 1024 * 1024
    ? `${(item.file.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(item.file.size / 1024))} KB`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative"
    >
      {item.isImage ? (
        <div className="h-16 w-16 overflow-hidden rounded-md border border-border">
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-16 w-48 items-center gap-2 rounded-md border border-border bg-muted/30 px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {(item.file.name.split(".").pop() || "FILE").slice(0, 4).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[11.5px] font-medium text-foreground" title={item.file.name}>
              {item.file.name}
            </div>
            <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
              {kb}
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
        aria-label="Remove"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </motion.div>
  );
}

/** Tomorrow at 09:00 in the user's local timezone. */
function nextMorningAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ── Slash command expansion ---------------------------------------------
// /me <text>       → italic action: "_<username> <text>_"
// /shrug [text]    → "<text> ¯\_(ツ)_/¯"
// /code <text>     → fenced code block
// /here [text]     → "@here <text>" (notifies all online members via
//                    __root's realtime handler that detects @here)
function expandSlashCommands(text: string, username: string): string {
  if (/^\/me\s+/i.test(text)) {
    return `_${username} ${text.replace(/^\/me\s+/i, "").trim()}_`;
  }
  if (/^\/shrug\b/i.test(text)) {
    const m = text.match(/^\/shrug\s*(.*)$/i);
    const rest = (m?.[1] ?? "").trim();
    return rest ? `${rest} \u00af\\_(\u30c4)_/\u00af` : "\u00af\\_(\u30c4)_/\u00af";
  }
  if (/^\/code\s+/i.test(text)) {
    const body = text.replace(/^\/code\s+/i, "");
    return "```\n" + body + "\n```";
  }
  if (/^\/here\b/i.test(text)) {
    const rest = text.replace(/^\/here\s*/i, "").trim();
    return rest ? `@here ${rest}` : "@here";
  }
  return text;
}
