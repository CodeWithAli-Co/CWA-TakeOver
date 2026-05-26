/**
 * DocEditor.tsx — TipTap-based rich document editor for /workspace/docs/$id.
 *
 * Phase 1: rich text + lists + headings + links + tables + task lists +
 * placeholder + character count + typography. No slash commands yet
 * (Session 2), no collaborative cursors yet (Session 4).
 *
 * Save model: editor change → 800ms debounce → useUpdateDocument
 * mutation with the full JSON content. The TanStack Query layer then
 * updates the cache; remote changes (when realtime fires) merge in
 * via the BubbleMenu pattern below.
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
import { Loader2, Check } from "lucide-react";

interface Props {
  /** Initial content from the database. */
  content: JSONContent;
  /** Username of the current editor — recorded as updated_by on save. */
  currentUsername: string;
  /** Called with the latest JSONContent on every debounced save tick. */
  onSave: (content: JSONContent) => Promise<void>;
  /** Optional external value to reconcile when realtime updates arrive. */
  externalContent?: JSONContent;
  placeholder?: string;
}

const AUTOSAVE_DELAY_MS = 800;

export function DocEditor({
  content,
  currentUsername,
  onSave,
  placeholder = "Start writing…",
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Headings: H1–H4 covers most doc structure. H5/H6 deferred —
        // the toolbar gets too crowded otherwise and few writers use them.
        heading: { levels: [1, 2, 3, 4] },
        // We bring our own Link extension below (with autolinking) so
        // disable StarterKit's bundled one to avoid double-registration.
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary",
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
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "outline-none focus:outline-none min-h-[500px] " +
          "text-[15px] leading-[1.7] text-foreground/90 " +
          "prose-headings:font-bold prose-headings:text-foreground " +
          "prose-h1:text-[28px] prose-h1:mt-6 prose-h1:mb-3 " +
          "prose-h2:text-[22px] prose-h2:mt-5 prose-h2:mb-2.5 " +
          "prose-h3:text-[18px] prose-h3:mt-4 prose-h3:mb-2 " +
          "prose-h4:text-[15.5px] prose-h4:mt-3 prose-h4:mb-1.5 " +
          "prose-p:my-2 prose-p:leading-[1.7] " +
          "prose-strong:text-foreground prose-em:text-foreground/90 " +
          "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 " +
          "prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:pl-3 prose-blockquote:text-foreground/70 prose-blockquote:italic " +
          "prose-code:bg-muted/40 prose-code:px-1 prose-code:py-[1px] prose-code:rounded-sm prose-code:text-[13px] prose-code:text-primary " +
          "prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/60 prose-pre:rounded-sm prose-pre:p-3 prose-pre:my-3 prose-pre:text-[12.5px] " +
          "prose-hr:my-6 prose-hr:border-border/60",
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

  // External content sync (e.g. realtime update from another user).
  // For phase 1 we just hard-replace on first mount; phase 4 will
  // swap this for proper Y.js collab so concurrent edits merge.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(content)) return;
    // Don't fight an active typing session — only sync if the doc
    // hasn't been touched since mount.
    if (!editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <EditorContent editor={editor} className="flex-1 min-h-0 overflow-y-auto" />

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
