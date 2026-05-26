/**
 * CommentMark.ts — TipTap mark that anchors a comment thread to a
 * specific text range in the doc.
 *
 * Why a mark (not a range stored in the DB):
 *   Marks ride along with their text as the doc evolves. If you
 *   wrap text in a comment mark and someone else later types in the
 *   middle of that text, ProseMirror splits/extends the mark
 *   automatically — the anchor stays correct without us writing any
 *   reconciliation logic. The DB just stores the comment metadata
 *   keyed by `commentId`.
 *
 * Style: subtle yellow underline + tinted highlight. Hover state +
 * an `aria-pressed` style for the currently-focused comment thread
 * are wired via the `data-active` attribute the editor sets when
 * the user clicks on the mark (see CommentsSidebar for that flow).
 *
 * Click handling lives on the rendered span via a data attribute —
 * the parent component listens for clicks on `[data-comment-id]`
 * inside the editor and opens the matching thread.
 */

import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      /**
       * Wrap the current selection in a comment mark with the given id.
       * Used after a comment is persisted to the DB so the editor can
       * link the new comment_id to the text the user originally chose.
       */
      setCommentMark: (commentId: string) => ReturnType;
      /** Remove any comment mark in the current selection (or by id). */
      unsetCommentMark: (commentId?: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "commentMark",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "workspace-comment-mark",
      },
    };
  },

  // Multiple overlapping comments on the same text are allowed by
  // letting marks coexist (excludes is intentionally not set).
  exclusive: false,
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-comment-id"),
        renderHTML: (attrs) => {
          if (!attrs.commentId) return {};
          return { "data-comment-id": attrs.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentMark:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetCommentMark:
        (commentId?: string) =>
        ({ tr, dispatch, state }) => {
          if (!commentId) {
            if (dispatch) tr.removeMark(0, state.doc.content.size, this.type);
            return true;
          }
          // Targeted removal: walk the doc, drop marks with matching id
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type !== this.type) return;
              if ((mark.attrs as any).commentId !== commentId) return;
              if (dispatch) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
              }
            });
          });
          return true;
        },
    };
  },
});

export default CommentMark;
