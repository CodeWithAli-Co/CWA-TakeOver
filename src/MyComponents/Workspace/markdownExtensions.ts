/**
 * markdownExtensions.ts — Custom TipTap extensions that bring the
 * doc editor up to "Discord + Obsidian + .md file" parity without
 * pulling in new npm packages.
 *
 * Exports:
 *   · Spoiler     — Mark. Discord-style `||text||`. Click to reveal.
 *   · Subscript   — Mark. Renders as <sub>. Markdown shortcut `~x~`.
 *   · Superscript — Mark. Renders as <sup>. Markdown shortcut `^x^`.
 *   · Callout     — Block node. Obsidian-style `> [!info] body`,
 *                   supports types: info, note, warning, success,
 *                   danger, axon. Renders as a tinted callout block
 *                   with an icon hint. Inline children allowed.
 *
 * All four expose markdown-style input rules so typing the
 * traditional syntax converts in place, just like StarterKit's
 * bold/italic/strike do today.
 */

import { Mark, Node, mergeAttributes } from "@tiptap/core";
import { markInputRule, markPasteRule } from "@tiptap/core";

// ── Spoiler mark ────────────────────────────────────────────────
// Renders text inside `||…||` as a blurred span that reveals on
// click. Re-clicking re-hides. Stores hidden state on the rendered
// element via a data attribute that the CSS reads.
export const Spoiler = Mark.create({
  name: "spoiler",
  inclusive: false,
  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-spoiler": "true",
        class: "ws-spoiler",
      }),
      0,
    ];
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(\|\|(?<text>[^|]+)\|\|)$/,
        type: this.type,
      }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /(?:^|\s)(\|\|(?<text>[^|]+)\|\|)/g,
        type: this.type,
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-x": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

// ── Subscript mark ──────────────────────────────────────────────
export const Subscript = Mark.create({
  name: "subscript",
  parseHTML() {
    return [{ tag: "sub" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sub", mergeAttributes(HTMLAttributes), 0];
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(~(?<text>[^~]+)~)$/,
        type: this.type,
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-,": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

// ── Superscript mark ────────────────────────────────────────────
export const Superscript = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML() {
    return [{ tag: "sup" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes), 0];
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(\^(?<text>[^\^]+)\^)$/,
        type: this.type,
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-.": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

// ── Callout node ────────────────────────────────────────────────
// Block-level container with a `type` attribute. Holds inline
// content so you can write inside it naturally. Six recognized
// types — each gets a different tint + icon via CSS.
//
// Markdown shortcut: type `> [!info] ` (or any recognized type) at
// the start of a paragraph to convert into a callout. The CSS
// handles the actual visual treatment so this file stays small.

export type CalloutType =
  | "info"
  | "note"
  | "warning"
  | "success"
  | "danger"
  | "axon";

const CALLOUT_TYPES: CalloutType[] = [
  "info",
  "note",
  "warning",
  "success",
  "danger",
  "axon",
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
      toggleCallout: (type?: CalloutType) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info" as CalloutType,
        parseHTML: (el) => {
          const v = el.getAttribute("data-callout-type") as CalloutType | null;
          return v && CALLOUT_TYPES.includes(v) ? v : "info";
        },
        renderHTML: (attrs) => ({
          "data-callout-type": attrs.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "true",
        class: "ws-callout",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type }),
      toggleCallout:
        (type: CalloutType = "info") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { type }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addInputRules() {
    // Match `> [!info] ` at start of a line. Captures the type.
    return [
      {
        find: /^>\s\[!(info|note|warning|success|danger|axon)\]\s$/,
        handler: ({ state, range, match }) => {
          const type = (match[1] as CalloutType) || "info";
          const { tr } = state;
          tr.delete(range.from, range.to);
          tr.setBlockType(range.from, range.from, state.schema.nodes.paragraph);
          // Wrap the now-empty paragraph in a callout of the matched type.
          // Use setNodeMarkup on the parent block via wrapIn-equivalent.
          const $pos = tr.doc.resolve(range.from);
          const block = $pos.parent;
          if (block && block.type.name === "paragraph") {
            tr.setBlockType(
              range.from,
              range.from + block.nodeSize - 2,
              state.schema.nodes.paragraph,
            );
          }
          // Defer the wrap to the next tick so the deletion settles first.
          queueMicrotask(() => {
            this.editor.chain().focus().setCallout(type).run();
          });
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => this.editor.commands.toggleCallout("info"),
    };
  },
});
