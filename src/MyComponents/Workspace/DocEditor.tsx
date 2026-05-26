/**
 * DocEditor.tsx — TipTap-based rich document editor for /workspace/docs/$id.
 *
 * Phase 2 capabilities:
 *   · StarterKit baseline (paragraphs, headings, bold/italic, lists,
 *     code, blockquote, horizontal rule, undo/redo)
 *   · Tables (with header row)
 *   · Task lists with nested support
 *   · Links + auto-linking
 *   · Images with paste/drop upload to Supabase storage
 *   · Underline, highlight, text-align
 *   · Slash command palette ("/" → block menu)
 *   · Bubble menu (selection toolbar)
 *   · Character + word count footer
 *
 * Save model: debounced 800ms after the last change. Editor change →
 * `onSave(JSONContent)` → caller persists to Supabase.
 *
 * Realtime reconcile: external `content` prop updates trigger a
 * setContent() call ONLY when the editor isn't currently focused, so
 * the local user's typing isn't interrupted.
 */

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Loader2, Check } from "lucide-react";
import { SlashCommand } from "./SlashCommand";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { uploadWorkspaceImage, extractImageFiles } from "./imageUpload";

interface Props {
  /** Initial content from the database. */
  content: JSONContent;
  /** Username of the current editor — recorded as updated_by on save. */
  currentUsername: string;
  /** Called with the latest JSONContent on every debounced save tick. */
  onSave: (content: JSONContent) => Promise<void>;
  placeholder?: string;
}

const AUTOSAVE_DELAY_MS = 800;

/**
 * ProseMirror plugin that intercepts paste/drop events containing
 * image files, uploads them to Supabase storage, then dispatches
 * setImage commands to insert them into the document.
 *
 * Implemented as a ProseMirror plugin (rather than a TipTap event
 * handler) so we get fine-grained control over preventDefault and
 * access to the EditorView for inserting at the drop position.
 */
const imagePasteDropKey = new PluginKey("workspaceImagePasteDrop");

function imagePasteDropPlugin(getOnInsert: () => (url: string, alt: string) => void) {
  return new Plugin({
    key: imagePasteDropKey,
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
        if (moved) return false; // intra-document move — let PM handle it
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

export function DocEditor({
  content,
  onSave,
  placeholder = "Type \"/\" for commands, or start writing…",
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy ref so the plugin's closure can reach the editor instance —
  // breaks the chicken/egg between useEditor and the plugin definition.
  const insertImageRef = useRef<(url: string, alt: string) => void>(
    () => { /* assigned after useEditor returns */ },
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class:
            "text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary",
        },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-sm my-3 max-w-full" },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "workspace-table" },
      }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand,
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "outline-none focus:outline-none min-h-[500px] " +
          "text-[15px] leading-[1.7] text-foreground/90",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await onSave(json);
          setSavedAt(Date.now());
        } catch (e) {
          console.error("[DocEditor] save failed:", e);
        } finally {
          setSaving(false);
        }
      }, AUTOSAVE_DELAY_MS);
    },
  });

  // Wire the imagePasteDropPlugin into the editor view after it's
  // initialized. Registering a plugin post-hoc requires the
  // registerPlugin EditorView API.
  useEffect(() => {
    if (!editor) return;
    insertImageRef.current = (url, alt) => {
      editor.chain().focus().setImage({ src: url, alt }).run();
    };
    const plugin = imagePasteDropPlugin(() => insertImageRef.current);
    editor.registerPlugin(plugin);
    return () => {
      editor.unregisterPlugin(imagePasteDropKey);
    };
  }, [editor]);

  // Sync external content (e.g. realtime update from another user)
  // when the local editor isn't focused — avoids fighting active typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(content)) return;
    if (!editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EditorBubbleMenu editor={editor} />
      <EditorContent
        editor={editor}
        className="flex-1 min-h-0 overflow-y-auto workspace-prose"
      />

      <footer className="flex items-center justify-between px-2 pt-3 mt-4 border-t border-border/60 text-[10.5px] uppercase tracking-[0.12em] text-foreground/40 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {saving ? (
            <>
              <Loader2 size={11} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : savedAt ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span>Saved</span>
            </>
          ) : (
            <span>&nbsp;</span>
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
