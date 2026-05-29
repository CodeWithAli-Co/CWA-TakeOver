/**
 * DocEditor.tsx — TipTap-based collaborative rich text editor.
 *
 * Phase 4 changes from phase 1-2:
 *   · Editor content is owned by the Y.Doc passed in — we don't pass
 *     `content` to useEditor anymore. Bootstrap happens upstream in
 *     DocDetailPage which seeds the Y.Doc from saved state before
 *     mounting us.
 *   · History extension is OFF (Collaboration owns undo/redo) — the
 *     base extension list is configured with `withHistory: false`.
 *   · CollaborationCursor renders remote teammates' carets + name labels.
 *   · `onUpdate` still fires for save scheduling, but the persisted
 *     content is computed by the parent from the Y.Doc (so we never
 *     serialize via the editor here).
 *
 * Slash command + bubble menu + image paste/drop unchanged from phase 2.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useEditor, EditorContent } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Loader2, Check, Wifi } from "lucide-react";
import * as Y from "yjs";

import { getBaseDocExtensions } from "./docSchema";
import { SlashCommand } from "./SlashCommand";
import { PageLinkSuggestion } from "./PageLinkSuggestion";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { uploadWorkspaceImage, extractImageFiles } from "./imageUpload";
import type { SupabaseYProvider } from "@/lib/yjs/SupabaseYProvider";
import type { RemoteUser } from "@/lib/yjs/awareness";

interface Props {
  ydoc: Y.Doc;
  provider: SupabaseYProvider | null;
  user: RemoteUser;
  /** Y.js XML fragment name to bind to. Defaults to 'default' for
   *  single-tab / legacy documents. Multi-tab docs pass `tab:<id>`
   *  so each tab gets its own fragment within the same Y.Doc. */
  field?: string;
  /** Notifies the parent that the doc just changed (debounced save). */
  onLocalChange: () => void;
  /** Called when the user picks "Comment" in the bubble menu. */
  onAddComment?: (
    selectedText: string,
    applyMark: (commentId: string) => void,
  ) => void;
  /** Called when the user clicks an existing comment mark — opens that
   *  thread in the sidebar. */
  onFocusComment?: (commentId: string) => void;
}

const SYNC_INDICATOR_MS = 1500;

function imagePasteDropPlugin(getOnInsert: () => (url: string, alt: string) => void) {
  const key = new PluginKey("workspaceImagePasteDrop");
  return new Plugin({
    key,
    props: {
      handlePaste(_view, event) {
        const files = extractImageFiles(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach(async (file) => {
          try {
            const { publicUrl } = await uploadWorkspaceImage(file);
            getOnInsert()(publicUrl, file.name || "Image");
          } catch (e) {
            console.error("[DocEditor] paste upload failed:", e);
          }
        });
        return true;
      },
      handleDrop(_view, event, _slice, moved) {
        if (moved) return false;
        const dt = (event as DragEvent).dataTransfer;
        const files = extractImageFiles(dt);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach(async (file) => {
          try {
            const { publicUrl } = await uploadWorkspaceImage(file);
            getOnInsert()(publicUrl, file.name || "Image");
          } catch (e) {
            console.error("[DocEditor] drop upload failed:", e);
          }
        });
        return true;
      },
    },
  });
}

const imagePasteDropKey = new PluginKey("workspaceImagePasteDropOuter");

export function DocEditor({
  ydoc, provider, user, field = "default",
  onLocalChange, onAddComment, onFocusComment,
}: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [synced, setSynced] = useState<boolean>(provider?.synced ?? false);

  // Track sync state — flip to true once the provider announces it.
  useEffect(() => {
    if (!provider) return;
    if (provider.synced) {
      setSynced(true);
      return;
    }
    const unsub = provider.onSynced(() => setSynced(true));
    return () => unsub();
  }, [provider]);

  // Lazy ref so the paste/drop plugin can reach the (eventually-created)
  // editor instance.
  const insertImageRef = useRef<(url: string, alt: string) => void>(
    () => { /* assigned after useEditor returns */ },
  );

  const editor = useEditor(
    {
      extensions: [
        ...getBaseDocExtensions({ withHistory: false }),
        // `field` binds the editor to a specific named XML fragment
        // inside the Y.Doc. Multi-tab docs pass 'tab:<id>' so each
        // tab has its own fragment; single-tab/legacy docs default
        // to 'default' so old content keeps rendering.
        Collaboration.configure({ document: ydoc, field }),
        ...(provider
          ? [CollaborationCursor.configure({ provider, user })]
          : []),
        SlashCommand,
        // [[Page Name]] inline references — autocompletes against
        // workspace_documents + workspace_spreadsheets, inserts a
        // PageLink atom. See PageLink.ts + PageLinkSuggestion.tsx.
        PageLinkSuggestion,
      ],
      editorProps: {
        attributes: {
          class:
            "outline-none focus:outline-none min-h-[500px] " +
            "text-[15px] leading-[1.7] text-foreground/90",
        },
      },
      onUpdate: () => {
        onLocalChange();
        setSaving(true);
        // Flip back after a short delay; the parent's debounce decides
        // when the actual persistence write happens but this gives the
        // user immediate "I see you typing" feedback in the footer.
        window.clearTimeout((onUpdateTimerRef.current as any) ?? 0);
        onUpdateTimerRef.current = window.setTimeout(() => {
          setSaving(false);
          setRecentlySaved(true);
          window.setTimeout(() => setRecentlySaved(false), SYNC_INDICATOR_MS);
        }, 900);
      },
    },
    // Recreate the editor if we get a different Y.Doc, provider, or
    // field. Field change happens on tab switch — fresh editor binds
    // to the new fragment cleanly without any save/restore dance.
    [ydoc, provider, field],
  );

  const onUpdateTimerRef = useRef<number | null>(null);

  // Install image paste/drop plugin post-mount.
  useEffect(() => {
    if (!editor) return;
    insertImageRef.current = (url, alt) => {
      editor.chain().focus().setImage({ src: url, alt }).run();
    };
    const plugin = imagePasteDropPlugin(() => insertImageRef.current);
    editor.registerPlugin(plugin);
    return () => {
      try {
        editor.unregisterPlugin(imagePasteDropKey);
      } catch { /* noop */ }
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EditorBubbleMenu editor={editor} onAddComment={onAddComment} />
      <EditorContent
        editor={editor}
        className="flex-1 min-h-0 overflow-y-auto workspace-prose"
        onClick={(e) => {
          const target = e.target as HTMLElement | null;

          // ── PageLink click → soft navigation ─────────────
          // The PageLink node renders as <a data-page-link>. We
          // intercept the click and route through tanstack-router
          // so the SPA doesn't do a hard page load.
          const link = target?.closest?.(
            "a[data-page-link]",
          ) as HTMLAnchorElement | null;
          if (link) {
            e.preventDefault();
            const id = link.getAttribute("data-id");
            const kind = link.getAttribute("data-kind");
            if (id) {
              navigate({
                to:
                  kind === "spreadsheet"
                    ? "/workspace/sheets/$id"
                    : "/workspace/docs/$id",
                params: { id },
              } as any);
            }
            return;
          }

          // ── Spoiler click → toggle revealed state ────────
          const spoiler = target?.closest?.(
            "span[data-spoiler]",
          ) as HTMLElement | null;
          if (spoiler) {
            e.preventDefault();
            spoiler.classList.toggle("ws-spoiler--revealed");
            return;
          }

          // ── Comment click → open the sidebar to it ───────
          if (!onFocusComment) return;
          const span = target?.closest?.(
            "[data-comment-id]",
          ) as HTMLElement | null;
          const commentId = span?.getAttribute("data-comment-id");
          if (commentId) onFocusComment(commentId);
        }}
      />

      <footer className="flex items-center justify-between px-2 pt-3 mt-4 border-t border-border/60 text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {saving ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : recentlySaved ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>
          {provider && (
            <div className="flex items-center gap-1">
              <Wifi
                size={10}
                className={synced ? "text-emerald-400" : "text-foreground/35"}
              />
              <span>{synced ? "Live" : "Connecting…"}</span>
            </div>
          )}
        </div>
        <div className="font-mono tabular-nums text-foreground/35">
          {editor.storage.characterCount.words()} words ·{" "}
          {editor.storage.characterCount.characters()} chars
        </div>
      </footer>
    </div>
  );
}
