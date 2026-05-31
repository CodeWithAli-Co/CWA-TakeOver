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
import { Send, X, Paperclip, Smile, Sparkles, Loader2, Image as ImgIcon, Reply, Mic, Square, Trash2, Clock, Gift, FolderUp, Folder } from "lucide-react";
import { takeOversupabase } from "@/MyComponents/supabase";
import { useChatStore } from "@/stores/chatStore";
import { getActiveCompanyLabel } from "@/stores/query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcnComponents/popover";
import { EmojiPicker } from "./EmojiPicker";
import { useImageUpload, type PendingUpload } from "./useImageUpload";
import {
  useFolderUpload,
  encodeFolderToken,
  type FolderManifest,
} from "./useFolderUpload";
import { isTauriRuntime, pickFolderTauri } from "./pickFolderTauri";
import { draftChatReply } from "@/Axon/engine/chatDraft";
import { MentionPicker, detectMentionQuery } from "./MentionPicker";
import { useVoiceRecorder, formatElapsed } from "./useVoiceRecorder";
import { PollDialog } from "./PollDialog";
import {
  SlashCommandPicker,
  filterSlashCommands,
  type SlashCommandDef,
} from "./SlashCommandPicker";
import { GifPicker } from "./GifPicker";
import { displayLabelForDM, isDMKey } from "./displayName";
import {
  addScheduled,
  listScheduledForGroup,
  removeScheduled,
  type ScheduledMessage,
} from "./scheduledStore";

// ── Module-level missing-column cache ─────────────────────────────
// Once an INSERT fails with "column X does not exist" on a given
// table, we remember it for the rest of the page session and stop
// pre-populating that column on subsequent sends. Without this, the
// progressive-fallback retry loop below burns 3-4 wasted POSTs on
// every single message — flooding the console with 400s the first
// time the user notices any chat activity. Same pattern as
// MessageList.tsx's read-receipt cache.
const composerMissingColumns = new Set<string>();
const isComposerMissing = (table: string, column: string) =>
  composerMissingColumns.has(`${table}:${column}`);
const markComposerMissing = (table: string, column: string) => {
  composerMissingColumns.add(`${table}:${column}`);
};

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
  // Drafts are persisted per-channel so you can switch groups without
  // losing a half-typed message. Wiped on send.
  const [text, setText] = useState<string>(() => readDraft(group));
  const [showEmoji, setShowEmoji] = useState(false);
  const [axonBusy, setAxonBusy] = useState(false);
  const [axonError, setAxonError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollInitialQ, setPollInitialQ] = useState("");
  const [showGifs, setShowGifs] = useState(false);
  // Slash-command picker state — shown whenever the composer starts with '/'
  const [slashIdx, setSlashIdx] = useState(0);
  const slashVisible = /^\/\S*$/.test(text.trimStart());
  const slashMatches = slashVisible ? filterSlashCommands(text.trimStart()) : [];

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
  const folderInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<any>(null);

  const { replyingTo, setReplyingTo, setTyping } = useChatStore();
  const {
    pending, removePending, clearPending, uploadMany, filesFromClipboard,
  } = useImageUpload(group, currentUsername);
  const folderUpload = useFolderUpload(group, currentUsername);
  // Folders we've finished uploading and are queued to embed in the
  // next message. Cleared after send. Separate from `pending` so the
  // existing image flow stays untouched.
  const [readyFolders, setReadyFolders] = useState<FolderManifest[]>([]);
  // Visible error specifically for the folder picker so silent
  // failures (empty folder, cancelled dialog, webkitdirectory not
  // populating relative paths) stop disappearing into the void.
  const [folderPickerError, setFolderPickerError] = useState<string | null>(
    null,
  );
  const voice = useVoiceRecorder();

  const handleMicToggle = async () => {
    if (voice.recording) {
      const file = await voice.stop();
      if (file) await uploadMany([file]);
    } else {
      await voice.start();
    }
  };

  // Draft persistence: save on text change (debounced), load on group switch.
  useEffect(() => {
    setText(readDraft(group));
  }, [group]);
  useEffect(() => {
    const id = window.setTimeout(() => writeDraft(group, text), 250);
    return () => window.clearTimeout(id);
  }, [text, group]);

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
    const channel = takeOversupabase.channel(`typing-${group}`, {
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

  // ── side-effect slash commands ──────────────────────────────────────
  const handleSideEffectCommand = (
    kind: "status" | "dnd" | "away" | "clear" | "remind" | "poll",
    raw: string,
  ) => {
    switch (kind) {
      case "poll": {
        const rest = raw.replace(/^\/poll\s*/i, "").trim();
        setPollInitialQ(rest);
        setPollOpen(true);
        return;
      }
      case "status": {
        const rest = raw.replace(/^\/status\s*/i, "").trim();
        try {
          const store = useChatStore.getState();
          if (rest) store.setCustomStatus(rest, null);
          else store.clearCustomStatus();
        } catch { /* noop */ }
        setAxonError(rest ? `Status: ${rest}` : "Status cleared");
        return;
      }
      case "dnd": {
        try {
          const store = useChatStore.getState() as any;
          const cur = !!store.dnd;
          store.setDnd?.(!cur);
          setAxonError(!cur ? "Do Not Disturb on" : "Do Not Disturb off");
        } catch { /* noop */ }
        return;
      }
      case "away": {
        try { (useChatStore.getState() as any).setPresenceStatus?.(currentUsername, "away"); } catch { /* noop */ }
        setAxonError("Marked as away");
        return;
      }
      case "clear": {
        try { useChatStore.getState().markRead(group); } catch { /* noop */ }
        setAxonError("Channel marked as read");
        return;
      }
      case "remind": {
        // /remind me in 10m <message>
        //         at 3pm      <message>
        const m = raw.match(/^\/remind\s+(?:me\s+)?(in\s+([^\s]+)|at\s+([^\s]+))\s+(.+)$/i);
        if (!m) {
          setAxonError("Usage: /remind me in 10m <msg>  OR  /remind me at 3pm <msg>");
          return;
        }
        const relSpec = m[2];
        const absSpec = m[3];
        const body = m[4];
        const dueAt = parseRemindSpec(relSpec, absSpec);
        if (!dueAt) {
          setAxonError("Couldn't parse time. Try '15m', '2h', '3pm', '17:30'.");
          return;
        }
        const payload = {
          sent_by: currentUsername,
          message: `⏰ Reminder: ${body}`,
          userAvatar,
        } as Record<string, unknown>;
        if (table === "cwa_dm_chat") (payload as any).dm_group = group;
        addScheduled({
          dueAt: dueAt.toISOString(),
          table,
          group,
          payload,
          createdBy: currentUsername,
          preview: `⏰ ${body.slice(0, 50)}`,
        });
        setAxonError(`Reminder set for ${dueAt.toLocaleString()}`);
        return;
      }
    }
  };

  // ── slash command picker ────────────────────────────────────────────
  const pickSlashCommand = (def: SlashCommandDef) => {
    // Zero-arg commands execute immediately.
    const zeroArg = new Set(["/away", "/dnd", "/clear", "/shortcuts"]);
    if (zeroArg.has(def.command)) {
      if (def.command === "/shortcuts") {
        // Fire the same `?` shortcut the ShortcutsOverlay listens for.
        const ev = new KeyboardEvent("keydown", { key: "?", bubbles: true });
        window.dispatchEvent(ev);
        setText("");
        return;
      }
      const kind =
        def.command === "/away"
          ? "away"
          : def.command === "/dnd"
          ? "dnd"
          : "clear";
      handleSideEffectCommand(kind as "away" | "dnd" | "clear", def.command);
      setText("");
      return;
    }
    // Commands that take arguments — expand the trigger and position the
    // caret after the trailing space so the user can immediately type.
    setText(def.command + " ");
    setSlashIdx(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = def.command.length + 1;
      el.setSelectionRange(pos, pos);
    });
  };

  // Reset the slash picker highlight whenever the command query changes.
  useEffect(() => {
    if (slashVisible) setSlashIdx(0);
  }, [slashVisible, text]);

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

  /** Handler for the folder-picker input (`webkitdirectory`). The browser
   *  hands us a flat FileList where each File should carry a populated
   *  `webkitRelativePath`. In some embedded WebViews (notably Tauri's
   *  WebView2 on Windows) it doesn't, in which case we fall back to a
   *  flat folder of just the picked file names. */
  const onPickFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (!files || files.length === 0) {
      setFolderPickerError("No files in that folder.");
      return;
    }
    let bundle = folderUpload.gatherFromInput(files);
    if (!bundle) {
      // webkitRelativePath was empty — fall back to a flat bundle so
      // the user gets *something* sent rather than a silent no-op.
      console.warn(
        "[folder-picker] webkitRelativePath was empty; falling back to flat bundle.",
      );
      const arr = Array.from(files);
      bundle = {
        name: "Selected Files",
        entries: arr.map((file) => ({ relativePath: file.name, file })),
      };
    }
    setFolderPickerError(null);
    const manifest = await folderUpload.uploadFolder(bundle);
    if (manifest) setReadyFolders((p) => [...p, manifest]);
  };

  /** Tauri-native folder picker — opens the OS folder dialog and
   *  recursively reads the chosen directory. Used when running inside
   *  the desktop app where `webkitdirectory` isn't reliable. */
  const handleFolderButtonClick = async () => {
    setFolderPickerError(null);
    if (isTauriRuntime()) {
      try {
        const bundle = await pickFolderTauri();
        if (!bundle) return; // user cancelled
        if (bundle.entries.length === 0) {
          setFolderPickerError(`"${bundle.name}" is empty.`);
          return;
        }
        const manifest = await folderUpload.uploadFolder(bundle);
        if (manifest) setReadyFolders((p) => [...p, manifest]);
      } catch (err) {
        console.error("[folder-picker:tauri]", err);
        setFolderPickerError(
          err instanceof Error ? err.message : "Folder picker failed.",
        );
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);

    // Detect folder drops first — `webkitGetAsEntry` exposes whether
    // each item is a directory. We pull folders off into the folder
    // upload pipeline and only pass remaining loose files through to
    // the existing image/file upload.
    const items = e.dataTransfer.items;
    const folderBundles = items
      ? await folderUpload.gatherFromDataTransfer(items)
      : [];

    if (folderBundles.length > 0) {
      // Kick all folder uploads off in parallel — each tracks its own
      // pending state internally.
      const uploadPromises = folderBundles.map((b) =>
        folderUpload.uploadFolder(b).then((m) => {
          if (m) setReadyFolders((p) => [...p, m]);
        }),
      );
      // Don't await — we want loose files to start uploading too.
      Promise.all(uploadPromises);
    }

    // Loose files: only those whose entry is NOT a directory. If
    // `webkitGetAsEntry` is unavailable, fall back to treating
    // everything as a file.
    const looseFiles: File[] = [];
    if (items && typeof items[0]?.webkitGetAsEntry === "function") {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        if (it.kind !== "file") continue;
        const entry = it.webkitGetAsEntry();
        if (entry && entry.isFile) {
          const f = it.getAsFile();
          if (f) looseFiles.push(f);
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        looseFiles.push(e.dataTransfer.files[i]!);
      }
    }
    if (looseFiles.length > 0) uploadMany(looseFiles);
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

    // Side-effect-only slash commands (no message posted).
    const sideEffect = isSideEffectCommand(text);
    if (sideEffect) {
      handleSideEffectCommand(sideEffect, text);
      setText("");
      return;
    }

    // Expand slash commands before anything else reads `text`.
    const expanded = expandSlashCommands(text, currentUsername);
    const textContent = expanded.trim();
    const hasText = !!textContent;
    const hasPending = pending.some((p) => !p.publicUrl);
    if (hasPending) return; // wait for image/file uploads
    // Folders track their own pending state inside `useFolderUpload`;
    // any folder that hasn't finished uploading is still in
    // `pendingFolders` and hasn't been added to `readyFolders` yet.
    if (folderUpload.pendingFolders.some((f) => !f.error)) return;
    const imageUrls = pending
      .map((p) => p.publicUrl)
      .filter((u): u is string => !!u);

    if (
      !hasText &&
      imageUrls.length === 0 &&
      readyFolders.length === 0
    ) {
      return;
    }

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
    // Each ready folder becomes one base64 token in the body.
    // MessageBubble decodes them into the FolderAttachmentCard.
    for (const manifest of readyFolders) {
      parts.push(encodeFolderToken(manifest));
    }
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

    // Pre-strip any columns we've ALREADY discovered are missing on
    // this table during this page session. Without this, every single
    // message send burns 3-4 wasted POSTs while the loop re-discovers
    // the same gaps. The cache is module-level (see top of file) so
    // it's shared across re-renders + composer remounts.
    let payload: Record<string, unknown> = { ...aggressivePayload };
    for (const col of dropOrder) {
      if (isComposerMissing(table, col) && col in payload) {
        delete payload[col];
      }
    }
    let error: { message: string } | null = null;
    for (let attempt = 0; attempt <= dropOrder.length; attempt++) {
      const res = await takeOversupabase.from(table).insert(payload);
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
        // Cache for the rest of the session so we don't keep
        // discovering this on every message send.
        markComposerMissing(table, offending);
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
            markComposerMissing(table, col);
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
    writeDraft(group, "");
    setReplyingTo(null);
    clearPending();
    setReadyFolders([]);
    folderUpload.clearPendingFolders();
    if (typingChannelRef.current) {
      typingChannelRef.current.track({ typing: false, expiresAt: 0 });
    }
    inputRef.current?.focus();

    // Belt-and-suspenders: trigger an immediate refetch so the UI shows the
    // new message even if Supabase realtime is slow / dropped.
    onAfterSend?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash-command picker takes priority over other pickers when visible.
    if (slashVisible && slashMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => Math.min(slashMatches.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        // Only hijack Enter if the user is still typing the bare command
        // (no arguments yet). Otherwise let Enter submit the message.
        const onlyCommand = /^\/\S*$/.test(text.trimStart());
        if (onlyCommand) {
          e.preventDefault();
          const pick = slashMatches[slashIdx];
          if (pick) pickSlashCommand(pick);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Clear the leading slash so picker closes.
        setText("");
        return;
      }
    }

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

      {/* Folder picker error — surfaces silent failures (cancelled
          dialog, empty folder, webkitdirectory not populating
          relative paths). Auto-dismissable. */}
      {folderPickerError && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-1.5 text-[11px] text-destructive">
          <Folder className="h-3 w-3" />
          <span className="flex-1">{folderPickerError}</span>
          <button
            type="button"
            onClick={() => setFolderPickerError(null)}
            className="rounded-sm p-0.5 hover:bg-destructive/15"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Folder strip — in-flight folder uploads + finalized folders
          waiting to be sent. Each row collapses the folder to one chip
          so a 50-file dump doesn't fill the composer. */}
      {(folderUpload.pendingFolders.length > 0 ||
        readyFolders.length > 0) && (
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-2">
          {folderUpload.pendingFolders.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11.5px]"
            >
              <Folder className="h-[14px] w-[14px] shrink-0 text-primary" />
              <div className="min-w-0 leading-tight">
                <div
                  className="truncate font-medium text-foreground max-w-[200px]"
                  title={f.name}
                >
                  {f.name}
                </div>
                <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  {f.error
                    ? "error"
                    : `${f.uploadedFiles}/${f.totalFiles} files`}
                </div>
              </div>
              {f.error ? (
                <button
                  type="button"
                  onClick={() => folderUpload.removePendingFolder(f.id)}
                  className="rounded-sm p-0.5 text-destructive hover:bg-destructive/15"
                  title={f.error}
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
          {readyFolders.map((m, i) => (
            <div
              key={`ready-${i}`}
              className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11.5px]"
            >
              <Folder className="h-[14px] w-[14px] shrink-0 text-primary" />
              <div className="min-w-0 leading-tight">
                <div
                  className="truncate font-medium text-foreground max-w-[200px]"
                  title={m.name}
                >
                  {m.name}
                </div>
                <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  {m.count} files · ready
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setReadyFolders((p) =>
                    p.filter((_, idx) => idx !== i),
                  )
                }
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Remove folder"
                title="Remove from this message"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
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
            Drop files or a folder to attach
          </div>
        )}

        <div className={`flex items-center gap-1 bg-muted/40 border rounded-xl pl-1 pr-1 focus-within:bg-muted/50 transition-all ${
          isAxonMode
            ? "border-primary/50 focus-within:border-primary/70"
            : "border-border/70 focus-within:border-primary/35"
        }`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            onClick={handleFolderButtonClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
            title={`Send folder (max ${folderUpload.MAX_FILES_PER_FOLDER} files)`}
          >
            <FolderUp className="h-[17px] w-[17px]" />
          </button>
          {/* Mic / voice message */}
          {voice.recording ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={voice.cancel}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                title="Cancel recording"
              >
                <Trash2 className="h-[15px] w-[15px]" />
              </button>
              <button
                type="button"
                onClick={handleMicToggle}
                className="flex h-7 items-center gap-1.5 rounded-full bg-destructive/15 border border-destructive/40 px-2.5 text-[11px] font-medium text-destructive"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-primary transition-colors"
              title="Record voice message"
            >
              <Mic className="h-[17px] w-[17px]" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />
          {/* Folder picker — `webkitdirectory` makes the OS dialog
              switch to "Select Folder" mode and pre-populates
              `webkitRelativePath` on every File. Cast required because
              React's input typings don't include the vendor attr. */}
          {/* React's input typings don't include the non-standard
              `webkitdirectory` / `directory` attrs even though every
              Chromium-based engine (including Tauri's WebView2)
              supports them. We reach past JSX to set them. */}
          <input
            ref={(el) => {
              folderInputRef.current = el;
              if (el) {
                el.setAttribute("webkitdirectory", "");
                el.setAttribute("directory", "");
              }
            }}
            type="file"
            multiple
            onChange={onPickFolder}
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
                  : `Message ${
                      isDMKey(group)
                        ? displayLabelForDM(group, currentUsername)
                        : `#${group}`
                    } — @ to mention · /axon for AI`
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

            {/* Slash command picker — slides up when the composer starts with '/' */}
            <AnimatePresence>
              {slashVisible && slashMatches.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-2">
                  <SlashCommandPicker
                    query={text.trimStart()}
                    activeIndex={slashIdx}
                    onSetIndex={setSlashIdx}
                    onPick={pickSlashCommand}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* GIF picker anchor */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGifs((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
              title="GIFs"
              aria-expanded={showGifs}
            >
              <Gift className="h-[17px] w-[17px]" />
            </button>
            <AnimatePresence>
              {showGifs && (
                <div className="absolute bottom-full right-0 z-30 mb-2">
                  <GifPicker
                    onPick={(url) => {
                      // Append the GIF URL to the message — MessageBubble
                      // extracts and inlines it, hiding the raw link.
                      setText((t) => (t.trim() ? `${t}\n${url}` : url));
                      setShowGifs(false);
                      inputRef.current?.focus();
                    }}
                    onClose={() => setShowGifs(false)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Emoji picker anchor */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
              title="Emoji"
              aria-expanded={showEmoji}
            >
              <Smile className="h-[17px] w-[17px]" />
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
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors"
                title="Schedule send"
              >
                <Clock className="h-[17px] w-[17px]" />
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 disabled:bg-muted/50 disabled:text-muted-foreground/60 disabled:cursor-not-allowed transition-all"
            title={isAxonMode ? "Draft with Axon" : "Send (Enter)"}
          >
            {axonBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isAxonMode ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5 translate-x-[1px]" />
            )}
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/75 mt-1.5 px-1">
          Press <kbd className="px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">Enter</kbd> to send ·
          <kbd className="mx-1 px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">Shift+Enter</kbd> newline ·
          <kbd className="mx-1 px-1 py-0.5 bg-muted/50 rounded text-muted-foreground/70 text-[9px] border border-border">/axon</kbd> draft with AI ·
          paste or drop images
        </p>
      </form>

      {/* Poll composer (opened via /poll or the Plus button in the toolbar) */}
      <PollDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        initialQuestion={pollInitialQ}
        onSubmit={async (pollBody) => {
          // Post as a regular message. PollMessage will detect the
          // {poll:...} marker and render the interactive poll.
          const basePayload: Record<string, unknown> = {
            sent_by: currentUsername,
            message: pollBody,
            userAvatar,
          };
          if (table === "cwa_dm_chat") basePayload.dm_group = group;
          const aggressive: Record<string, unknown> = {
            ...basePayload,
            reactions: {},
            read_by: [currentUsername],
            company: getActiveCompanyLabel(),
          };
          let { error } = await takeOversupabase.from(table).insert(aggressive);
          if (error) {
            // Progressive fallback — drop columns that don't exist.
            await takeOversupabase.from(table).insert(basePayload);
          }
          onAfterSend?.();
          setPollInitialQ("");
        }}
      />
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
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
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
//
//   /me <text>         italic action: "_<username> <text>_"
//   /shrug [text]      appends ¯\_(ツ)_/¯
//   /tableflip [text]  appends (╯°□°）╯︵ ┻━┻
//   /unflip [text]     appends ┬─┬ ノ( ゜-゜ノ)
//   /code <text>       fenced code block
//   /here [text]       "@here <text>" — notifies online members
//   /channel [text]    "@channel <text>" — notifies ALL channel members
//   /status <text>     sets presence label ("In a meeting" etc.)
//   /dnd               toggles Do Not Disturb (handled at callsite)
//   /away              sets presence to away
//   /remind me <in|at> <...> <msg>   scheduled self-message (handled at callsite)
//   /giphy <query>     inline giphy link (static for now — no API)
//   /clear             local-only — hides the channel's current unread
//   /poll [question]   opens the poll dialog (handled at callsite)
//
// Anything this function doesn't recognize is passed through unchanged.
function expandSlashCommands(text: string, username: string): string {
  if (/^\/me\s+/i.test(text)) {
    return `_${username} ${text.replace(/^\/me\s+/i, "").trim()}_`;
  }
  if (/^\/shrug\b/i.test(text)) {
    const m = text.match(/^\/shrug\s*(.*)$/i);
    const rest = (m?.[1] ?? "").trim();
    return rest ? `${rest} \u00af\\_(\u30c4)_/\u00af` : "\u00af\\_(\u30c4)_/\u00af";
  }
  if (/^\/tableflip\b/i.test(text)) {
    const rest = text.replace(/^\/tableflip\s*/i, "").trim();
    const flip = "(\u256f\u00b0\u25a1\u00b0\uff09\u256f\ufe35 \u253b\u2501\u253b";
    return rest ? `${rest} ${flip}` : flip;
  }
  if (/^\/unflip\b/i.test(text)) {
    const rest = text.replace(/^\/unflip\s*/i, "").trim();
    const unflip = "\u252c\u2500\u252c\u30ce( \u309c-\u309c\u30ce)";
    return rest ? `${rest} ${unflip}` : unflip;
  }
  if (/^\/code\s+/i.test(text)) {
    const body = text.replace(/^\/code\s+/i, "");
    return "```\n" + body + "\n```";
  }
  if (/^\/here\b/i.test(text)) {
    const rest = text.replace(/^\/here\s*/i, "").trim();
    return rest ? `@here ${rest}` : "@here";
  }
  if (/^\/channel\b/i.test(text)) {
    const rest = text.replace(/^\/channel\s*/i, "").trim();
    return rest ? `@channel ${rest}` : "@channel";
  }
  if (/^\/giphy\s+/i.test(text)) {
    const q = text.replace(/^\/giphy\s+/i, "").trim();
    // Direct Giphy search link — avoids needing an API key for v1.
    return `_(giphy: ${q}) — https://giphy.com/search/${encodeURIComponent(q)}_`;
  }
  return text;
}

/** Read/write per-channel drafts from localStorage. Keyed by group name. */
const DRAFT_PREFIX = "cwa-chat-draft:";
function readDraft(group: string): string {
  if (typeof window === "undefined" || !group) return "";
  try { return window.localStorage.getItem(DRAFT_PREFIX + group) ?? ""; }
  catch { return ""; }
}
function writeDraft(group: string, value: string) {
  if (typeof window === "undefined" || !group) return;
  try {
    if (value) window.localStorage.setItem(DRAFT_PREFIX + group, value);
    else window.localStorage.removeItem(DRAFT_PREFIX + group);
  } catch { /* quota or private mode */ }
}

/** Parse /remind spec into a Date. Supports:
 *   relSpec: 10m / 2h / 3d / 90s
 *   absSpec: 3pm / 17:30 / 9am / 21:00
 */
function parseRemindSpec(rel: string | undefined, abs: string | undefined): Date | null {
  const now = new Date();
  if (rel) {
    const m = rel.match(/^(\d+)(s|m|h|d)$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const d = new Date(now);
    if (unit === "s") d.setSeconds(d.getSeconds() + n);
    else if (unit === "m") d.setMinutes(d.getMinutes() + n);
    else if (unit === "h") d.setHours(d.getHours() + n);
    else if (unit === "d") d.setDate(d.getDate() + n);
    return d;
  }
  if (abs) {
    const m12 = abs.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
    if (m12) {
      let h = parseInt(m12[1], 10);
      const min = m12[2] ? parseInt(m12[2], 10) : 0;
      const pm = m12[3].toLowerCase() === "pm";
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
      const d = new Date(now);
      d.setHours(h, min, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return d;
    }
    const m24 = abs.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      const d = new Date(now);
      d.setHours(parseInt(m24[1], 10), parseInt(m24[2], 10), 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return d;
    }
  }
  return null;
}

/** True if the text is a side-effect-only slash command that shouldn't post
 *  a message. Callsite handles the side effect and swallows the send. */
function isSideEffectCommand(text: string): "status" | "dnd" | "away" | "clear" | "remind" | "poll" | null {
  if (/^\/status\b/i.test(text)) return "status";
  if (/^\/dnd\b/i.test(text)) return "dnd";
  if (/^\/away\b/i.test(text)) return "away";
  if (/^\/clear\b/i.test(text)) return "clear";
  if (/^\/remind\b/i.test(text)) return "remind";
  if (/^\/poll\b/i.test(text)) return "poll";
  return null;
}
