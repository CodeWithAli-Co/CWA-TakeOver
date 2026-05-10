/**
 * FolderAttachmentCard — renders a folder bundle inside a chat message.
 *
 * The message body contains a `[folder:<base64>]` token that
 * `MessageBubble` decodes into a `FolderManifest`. This component takes
 * that manifest and renders:
 *   · A compact folder card with name + file count + total size
 *   · A "Browse files" button that opens an overlay listing every
 *     file with its relative path and a download link
 *
 * No "download zip" affordance — Tauri's chat WebView doesn't ship
 * JSZip and shipping a ~50KB zipper across the wire just for this is
 * overkill. The browse overlay lets the recipient grab whatever they
 * actually need.
 */

import { useState } from "react";
import { Folder, X, FileText, Download } from "lucide-react";
import type { FolderManifest, FolderManifestFile } from "./useFolderUpload";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fileExtChip(name: string): string {
  const ext = (name.split(".").pop() || "FILE").toUpperCase();
  return ext.slice(0, 4);
}

interface Props {
  manifest: FolderManifest;
}

export function FolderAttachmentCard({ manifest }: Props) {
  const [browseOpen, setBrowseOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setBrowseOpen(true)}
        className="mt-2 flex max-w-[320px] items-center gap-2.5 rounded-md border border-border bg-muted/25 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
        title={`Browse ${manifest.count} files in "${manifest.name}"`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Folder className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className="truncate text-[11.5px] font-medium text-foreground"
            title={manifest.name}
          >
            📁 {manifest.name}
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
            {manifest.count} {manifest.count === 1 ? "file" : "files"}
            {" · "}
            {humanSize(manifest.bytes)}
            {" · "}
            browse
          </div>
        </div>
      </button>

      {browseOpen && (
        <FolderBrowseOverlay
          manifest={manifest}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </>
  );
}

interface OverlayProps {
  manifest: FolderManifest;
  onClose: () => void;
}

function FolderBrowseOverlay({ manifest, onClose }: OverlayProps) {
  // Sort by relative path so subdirectories cluster together.
  const sorted: FolderManifestFile[] = [...manifest.files].sort((a, b) =>
    a.p.localeCompare(b.p),
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[min(720px,100%)] flex-col overflow-hidden rounded-xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Folder className="h-[15px] w-[15px]" />
            </div>
            <div className="min-w-0">
              <div
                className="truncate text-[12.5px] font-semibold text-foreground"
                title={manifest.name}
              >
                {manifest.name}
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                {manifest.count} files · {humanSize(manifest.bytes)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-[15px] w-[15px]" />
          </button>
        </div>

        {/* Scrollable file list */}
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {sorted.map((f) => {
              const fileName = f.p.split("/").pop() || f.p;
              const dirPath = f.p.includes("/")
                ? f.p.slice(0, f.p.lastIndexOf("/"))
                : "";
              return (
                <li key={f.u}>
                  <a
                    href={f.u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={fileName}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-[8.5px] font-mono uppercase tracking-widest text-muted-foreground">
                      {fileExtChip(fileName)}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div
                        className="truncate text-[12px] font-medium text-foreground"
                        title={fileName}
                      >
                        {fileName}
                      </div>
                      {dirPath && (
                        <div
                          className="truncate font-mono text-[10px] text-muted-foreground"
                          title={dirPath}
                        >
                          {dirPath}/
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {humanSize(f.s)}
                      </span>
                      <Download className="h-[13px] w-[13px] text-muted-foreground" />
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <FileText className="h-3 w-3" />
          Click any file to download
        </div>
      </div>
    </div>
  );
}
