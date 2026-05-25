/**
 * FileEditor.tsx — In-place file editor for the /code surface.
 *
 * Modes:
 *   · "view"  — read-only CodeBlock with the syntax-highlighted
 *               file contents.
 *   · "edit"  — editable buffer. Tries to use Monaco when the host
 *               app has `@monaco-editor/react` installed. Falls back
 *               to a font-monospaced <textarea> on top of an empty
 *               surface — fully functional, no syntax highlighting
 *               while typing.
 *
 *   To enable Monaco:
 *     pnpm add @monaco-editor/react monaco-editor
 *     # then refresh — the lazy import below picks it up.
 *
 * Save path: hits useSaveFile() in queries.ts which upserts on
 * (repo_id, branch_name, path) so editing the path renames the row
 * in-place (vs. creating a duplicate). New files get a freshly
 * generated id back from the upsert.
 *
 * This component is intentionally local — it does not push commits
 * to the `commits` table. That's a follow-up once we wire a real
 * "save → propose commit" flow.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil, Save, X, Loader2, FileCode, AlertCircle, Sparkles,
} from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import type { FileRow } from "./mockData";
import { useSaveFile } from "./queries";

// ── Monaco lazy loader ────────────────────────────────────────
// React.lazy + Suspense gives us a clean "loading…" state without
// blowing up the bundle. The .catch() returns a stub default export
// so the surrounding component renders gracefully when Monaco isn't
// installed — Vite's tree-shaker keeps the module wholly absent
// from the bundle in that case.
//
// We assert on `any` because @monaco-editor/react isn't in the
// project's typings unless the package is installed; the runtime
// shape is `{ default: Editor }` either way.

type MonacoModule = {
  default: React.ComponentType<{
    height: string | number;
    defaultLanguage?: string;
    language?: string;
    value?: string;
    onChange?: (v: string | undefined) => void;
    theme?: string;
    options?: Record<string, unknown>;
  }>;
};

// Monaco is an optional peer dependency. We stash the package name
// in a variable so Vite's static-analysis pass can't resolve it at
// build time (otherwise dev fails with "Failed to resolve import"
// when the package isn't installed). The /* @vite-ignore */ tag
// reinforces that. At runtime the import either succeeds (Monaco
// installed) or hits the .catch() (uninstalled → graceful fallback).
const MONACO_PKG = "@monaco-editor/react";

const MonacoEditor = lazy<MonacoModule["default"]>(() =>
  import(/* @vite-ignore */ MONACO_PKG)
    .then((m: MonacoModule) => ({ default: m.default }))
    .catch(() => ({ default: MonacoFallback })),
);

/** Rendered in place of Monaco when the package isn't installed.
 *  A plain textarea that still hits the same onChange contract. */
function MonacoFallback(props: {
  height: string | number;
  language?: string;
  value?: string;
  onChange?: (v: string | undefined) => void;
}) {
  // The wrapper must establish a height context — without `h-full`
  // the inner textarea sees an auto-sized parent and falls back to
  // its default 2-row height. We chain h-full from FileEditor's
  // flex body down through this wrapper to the textarea.
  return (
    <div className="relative h-full min-h-[400px] flex flex-col">
      <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-amber-300 pointer-events-none">
        <AlertCircle className="h-2.5 w-2.5" />
        plain editor — install @monaco-editor/react for richer UX
      </div>
      <textarea
        value={props.value ?? ""}
        onChange={(e) => props.onChange?.(e.target.value)}
        spellCheck={false}
        rows={24}
        className="flex-1 min-h-0 block w-full resize-none bg-background font-mono text-[12px] leading-[1.55] text-foreground p-3 pt-9 outline-none focus:ring-1 focus:ring-primary/40 rounded-md"
        style={{ fontFamily: 'ui-monospace, "JetBrains Mono", "Fira Code", Consolas, monospace' }}
      />
    </div>
  );
}

// ── Public component ──────────────────────────────────────────

interface Props {
  /** Existing file row when editing. `null` means "create a new
   *  file"; the editor opens with `newFileDefaults` populated. */
  file: FileRow | null;
  repoId: string;
  branchName: string;
  /** Defaults for the new-file case (path + starter contents). */
  newFileDefaults?: { path?: string; content?: string };
  /** Force the initial mode. New files default to "edit"; existing
   *  files default to "view". */
  initialMode?: "view" | "edit";
  /** Called after a successful save with the canonical row id. The
   *  parent can then re-select the row in its file tree. */
  onSaved?: (rowId: string, path: string) => void;
  onClose?: () => void;
}

export function FileEditor({
  file, repoId, branchName, newFileDefaults,
  initialMode, onSaved, onClose,
}: Props) {
  const isNew = !file;
  const [mode, setMode] = useState<"view" | "edit">(
    initialMode ?? (isNew ? "edit" : "view"),
  );

  // Buffer state. Keep the path editable on the New File path
  // (in case the user wants to rename before first save) but lock
  // it once the row exists — renaming an existing file is a follow-
  // up that needs a soft "move" UX.
  const [path, setPath] = useState<string>(
    file?.path ?? newFileDefaults?.path ?? "new-file.ts",
  );
  const [content, setContent] = useState<string>(
    file?.content ?? newFileDefaults?.content ?? "",
  );
  const [language, setLanguage] = useState<string>(
    file?.language ?? "typescript",
  );

  // Reset state when the parent swaps in a different file.
  const lastFileId = useRef<string | null>(file?.id ?? null);
  useEffect(() => {
    if (file?.id !== lastFileId.current) {
      lastFileId.current = file?.id ?? null;
      setMode(initialMode ?? (file ? "view" : "edit"));
      setPath(file?.path ?? newFileDefaults?.path ?? "new-file.ts");
      setContent(file?.content ?? newFileDefaults?.content ?? "");
      setLanguage(file?.language ?? "typescript");
    }
    // initialMode + newFileDefaults are deliberately omitted from
    // the dep array — only the file id swap should reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  const dirty = useMemo(() => {
    if (isNew) return content.length > 0;
    return (
      content !== (file?.content ?? "") ||
      path !== (file?.path ?? "")
    );
  }, [isNew, content, path, file]);

  const save = useSaveFile();

  const onSave = async () => {
    try {
      const rowId = await save.mutateAsync({
        repoId, branchName, path, content,
        language,
        fileId: file?.id ?? null,
      });
      onSaved?.(rowId, path);
      setMode("view");
    } catch (err) {
      // Surface the error inline — the toast surface isn't wired up
      // for /code yet. The save mutation's error state below renders
      // the message; this catch keeps the promise from bubbling.
      console.error("[FileEditor] save failed:", err);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/40 px-5 py-2.5 flex items-center gap-2">
        <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
        {mode === "edit" && isNew ? (
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="src/path/to/file.ts"
            className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-0.5 font-mono text-[11.5px] text-foreground outline-none focus:border-primary/40"
          />
        ) : (
          <span className="font-mono text-[11.5px] text-foreground/90 truncate">{path}</span>
        )}

        <span className="ml-auto inline-flex items-center gap-2">
          {save.isPending && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              saving…
            </span>
          )}
          {save.isError && (
            <span
              className="inline-flex items-center gap-1 font-mono text-[10px] text-red-300"
              title={(save.error as Error)?.message ?? "Save failed"}
            >
              <AlertCircle className="h-3 w-3" />
              save failed
            </span>
          )}
          {mode === "view" ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10.5px] font-semibold text-foreground/85 hover:bg-muted/60"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (isNew) {
                    onClose?.();
                  } else {
                    setContent(file?.content ?? "");
                    setPath(file?.path ?? "");
                    setMode("view");
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || save.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10.5px] font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
            </>
          )}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden p-2 flex flex-col">
        {mode === "view" ? (
          content
            ? (
              <div className="flex-1 min-h-0 overflow-auto">
                <CodeBlock code={content} language={language} />
              </div>
            )
            : (
              <p className="p-5 font-mono text-[12px] text-muted-foreground">
                // (empty file — switch to Edit to add content)
              </p>
            )
        ) : (
          <Suspense fallback={
            <div className="flex items-center gap-2 p-5 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading editor…
            </div>
          }>
            <MonacoEditor
              height="100%"
              defaultLanguage={normaliseEditorLanguage(language)}
              language={normaliseEditorLanguage(language)}
              value={content}
              onChange={(v) => setContent(v ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                tabSize: 2,
              }}
            />
          </Suspense>
        )}
      </div>

      {/* Footer hint */}
      {mode === "edit" && (
        <div className="shrink-0 border-t border-border bg-card/30 px-5 py-1.5 flex items-center gap-2 font-mono text-[9.5px] text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5 text-primary" />
          Editing in place — saves write directly to the repo's HEAD on {branchName}. Commit + PR flow lands in a follow-up.
        </div>
      )}
    </div>
  );
}

/** Monaco uses slightly different language ids than the
 *  react-syntax-highlighter mapping. Translate the small set we
 *  actually surface. */
function normaliseEditorLanguage(input?: string | null): string {
  if (!input) return "plaintext";
  const v = input.toLowerCase();
  const map: Record<string, string> = {
    text: "plaintext",
    tsx: "typescript",
    jsx: "javascript",
    md: "markdown",
    mdx: "markdown",
    sh: "shell",
    yml: "yaml",
  };
  return map[v] ?? v;
}
