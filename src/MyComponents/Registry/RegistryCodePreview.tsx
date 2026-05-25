/**
 * RegistryCodePreview — file tree on the left, syntax-highlighted
 * source on the right. Tarball is fetched + extracted in-browser
 * on first mount (lazy via useTarball), then cached for the session.
 */

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileCode, Folder, FolderOpen, File as FileIcon, Loader2, AlertCircle, Copy, CheckCircle2 } from "lucide-react";
import { useTarball } from "./lib/useTarball";
import {
  buildFileTree,
  findMainComponent,
  languageFromPath,
  type FileNode,
  type TarEntry,
} from "./lib/extractTarball";
import { registryTarballUrl } from "./queries";

interface Props {
  storagePath: string | null;
  itemName: string;
  version: string | null;
}

export function RegistryCodePreview({ storagePath, itemName, version }: Props) {
  const url = storagePath ? registryTarballUrl(storagePath) : null;
  const { data: entries, isLoading, error } = useTarball(url);

  const tree = useMemo(
    () => (entries && entries.length > 0 ? buildFileTree(entries) : null),
    [entries],
  );

  // Default-select the main component when entries load.
  const defaultPick = useMemo(
    () => (entries ? findMainComponent(entries) ?? entries.find((e) => e.isText) ?? entries[0] : null),
    [entries],
  );
  const [selected, setSelected] = useState<TarEntry | null>(null);
  const active = selected ?? defaultPick;

  if (!url) {
    return (
      <div className="flex h-[320px] items-center justify-center text-[12px] text-muted-foreground">
        No published version to inspect.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        Fetching + unpacking {itemName}{version ? `@${version}` : ""}…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <p className="text-[12px] text-red-300">{(error as Error).message}</p>
      </div>
    );
  }

  if (!entries || entries.length === 0 || !tree) {
    return (
      <div className="flex h-[320px] items-center justify-center text-[12px] text-muted-foreground">
        Tarball is empty.
      </div>
    );
  }

  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-border/60 overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* File tree */}
        <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-border/60 bg-muted/20 py-2 text-[12px]">
          <TreeView
            node={tree}
            depth={0}
            selected={active?.path ?? null}
            onPick={setSelected}
          />
        </aside>

        {/* Code pane */}
        <div className="flex flex-1 flex-col min-w-0">
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-3 py-1.5 text-[11px]">
                <span className="truncate font-mono text-foreground/80">{active.path}</span>
                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  <span>{formatSize(active.size)}</span>
                  {active.isText && <CopyButton text={active.text ?? ""} />}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {active.isText ? (
                  <SyntaxHighlighter
                    language={languageFromPath(active.path)}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      background: "transparent",
                      fontSize: 11.5,
                      minHeight: "100%",
                    }}
                    showLineNumbers
                    lineNumberStyle={{ color: "hsl(var(--muted-foreground) / 0.5)", fontSize: 10 }}
                  >
                    {active.text ?? ""}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                    Binary file ({formatSize(active.size)}) — preview not supported.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
              Select a file to preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tree view ──────────────────────────────────────────────────────
function TreeView({
  node,
  depth,
  selected,
  onPick,
}: {
  node: FileNode;
  depth: number;
  selected: string | null;
  onPick: (e: TarEntry) => void;
}) {
  // Root node has no own rendering — just render its children.
  if (node.name === "") {
    return (
      <>
        {node.children?.map((c) => (
          <TreeView key={c.path} node={c} depth={depth} selected={selected} onPick={onPick} />
        ))}
      </>
    );
  }

  if (node.type === "file") {
    const isActive = selected === node.path;
    return (
      <button
        type="button"
        onClick={() => node.entry && onPick(node.entry)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={[
          "flex w-full items-center gap-1.5 py-1 pr-2 text-left transition-colors",
          isActive
            ? "bg-blue-500/15 text-primary-foreground"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        ].join(" ")}
      >
        <FileGlyph path={node.name} />
        <span className="truncate font-mono text-[11.5px]">{node.name}</span>
      </button>
    );
  }

  // Directory — always-expanded (simple and predictable).
  return (
    <div>
      <div
        style={{ paddingLeft: 8 + depth * 12 }}
        className="flex items-center gap-1.5 py-1 text-[11.5px] font-medium text-foreground/75"
      >
        <FolderOpen className="h-3 w-3 text-amber-400/60" />
        <span className="truncate">{node.name}</span>
      </div>
      {node.children?.map((c) => (
        <TreeView key={c.path} node={c} depth={depth + 1} selected={selected} onPick={onPick} />
      ))}
    </div>
  );
}

function FileGlyph({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["tsx", "jsx", "ts", "js"].includes(ext)) {
    return <FileCode className="h-3 w-3 text-blue-400/70" />;
  }
  return <FileIcon className="h-3 w-3 text-muted-foreground" />;
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* noop */ }
      }}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-muted transition-colors"
      title="Copy file contents"
    >
      {copied ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
