/**
 * EditorBubbleMenu.tsx — Floating toolbar that appears over a text
 * selection in the doc editor.
 *
 * Uses TipTap 2's BubbleMenu React component, which handles its own
 * position tracking against the current selection. We just declare the
 * button row inside.
 *
 * Buttons: bold, italic, underline, strike, inline code, link,
 * highlight, text-align (left/center/right), heading dropdown.
 *
 * Pattern note — every button uses `editor.chain().focus()...run()` so
 * the click never steals focus from the editor. `isActive(...)` drives
 * the pressed state.
 */

import { useRef } from "react";
import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Link as LinkIcon, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, ChevronDown,
} from "lucide-react";

interface Props {
  editor: Editor | null;
}

export function EditorBubbleMenu({ editor }: Props) {
  const headingRef = useRef<HTMLDetailsElement>(null);
  if (!editor) return null;

  const closeHeadingDropdown = () => {
    if (headingRef.current) headingRef.current.open = false;
  };

  const promptLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
      .run();
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 120,
        placement: "top",
        animation: "fade",
        offset: [0, 8],
      }}
      className="flex items-center gap-0.5 rounded-sm border border-border bg-popover shadow-xl px-1 py-1"
    >
      {/* Heading dropdown */}
      <details ref={headingRef} className="relative">
        <summary
          className="list-none cursor-pointer inline-flex items-center gap-1 px-2 h-7 rounded-sm text-[11.5px] font-semibold text-foreground/75 hover:bg-muted/40 hover:text-foreground transition-colors select-none"
          title="Block type"
        >
          {editor.isActive("heading", { level: 1 })
            ? "H1"
            : editor.isActive("heading", { level: 2 })
            ? "H2"
            : editor.isActive("heading", { level: 3 })
            ? "H3"
            : editor.isActive("heading", { level: 4 })
            ? "H4"
            : "Text"}
          <ChevronDown size={11} />
        </summary>
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-10 rounded-sm border border-border bg-popover shadow-xl py-1 w-[140px]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <HeadingOption
            label="Paragraph"
            active={
              !editor.isActive("heading") && editor.isActive("paragraph")
            }
            onClick={() => {
              editor.chain().focus().setParagraph().run();
              closeHeadingDropdown();
            }}
          />
          <HeadingOption
            icon={Heading1}
            label="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 1 }).run();
              closeHeadingDropdown();
            }}
          />
          <HeadingOption
            icon={Heading2}
            label="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 2 }).run();
              closeHeadingDropdown();
            }}
          />
          <HeadingOption
            icon={Heading3}
            label="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => {
              editor.chain().focus().toggleHeading({ level: 3 }).run();
              closeHeadingDropdown();
            }}
          />
        </div>
      </details>

      <Divider />

      <BubbleButton
        icon={Bold}
        label="Bold (⌘B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <BubbleButton
        icon={Italic}
        label="Italic (⌘I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <BubbleButton
        icon={UnderlineIcon}
        label="Underline (⌘U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <BubbleButton
        icon={Strikethrough}
        label="Strike-through"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <BubbleButton
        icon={Code}
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <BubbleButton
        icon={Highlighter}
        label="Highlight"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />

      <Divider />

      <BubbleButton
        icon={LinkIcon}
        label="Add link (⌘K)"
        active={editor.isActive("link")}
        onClick={promptLink}
      />

      <Divider />

      <BubbleButton
        icon={AlignLeft}
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <BubbleButton
        icon={AlignCenter}
        label="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <BubbleButton
        icon={AlignRight}
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
    </BubbleMenu>
  );
}

// ──────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────
function BubbleButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      className={
        "inline-flex items-center justify-center w-7 h-7 rounded-sm transition-colors " +
        (active
          ? "bg-primary/15 text-primary"
          : "text-foreground/65 hover:text-foreground hover:bg-muted/40")
      }
    >
      <Icon size={13} />
    </button>
  );
}

function HeadingOption({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        "w-full text-left px-3 py-1.5 text-[12px] font-semibold inline-flex items-center gap-2 transition-colors " +
        (active
          ? "bg-primary/[0.08] text-primary"
          : "text-foreground/75 hover:bg-muted/40 hover:text-foreground")
      }
    >
      {Icon ? <Icon size={12} /> : <span className="w-3" />}
      {label}
    </button>
  );
}

function Divider() {
  return <span className="self-stretch w-px bg-border/60 mx-0.5" />;
}
