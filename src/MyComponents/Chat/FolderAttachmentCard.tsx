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
import {
  Folder,
  X,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { FolderManifest, FolderManifestFile } from "./useFolderUpload";
import { isTauriRuntime } from "./pickFolderTauri";

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

/** Status of an in-progress bulk save. */
type SaveStatus =
  | { kind: "idle" }
  | { kind: "downloading"; done: number; total: number; current: string }
  | { kind: "done"; destination: string }
  | { kind: "error"; message: string };

function FolderBrowseOverlay({ manifest, onClose }: OverlayProps) {
  const [save, setSave] = useState<SaveStatus>({ kind: "idle" });

  // Sort by relative path so subdirectories cluster together.
  const sorted: FolderManifestFile[] = [...manifest.files].sort((a, b) =>
    a.p.localeCompare(b.p),
  );

  /**
   * Save every file to disk preserving the original folder structure.
   *
   *   · Tauri (the desktop app): opens the OS folder picker, then
   *     writes each file under `${chosen}/${manifest.name}/...`. No
   *     zip step — the recipient ends up with the actual folder.
   *   · Browser fallback: triggers a sequential anchor download per
   *     file. Browsers prompt the user to allow multiple downloads
   *     after the first ~5 — that's a known browser limit, not
   *     something we can override. For a real bulk-download UX we'd
   *     need a zip lib (JSZip ~50KB); the Tauri path makes that
   *     unnecessary for the desktop app.
   */
  const handleSaveAll = async () => {
    if (save.kind === "downloading") return;

    if (isTauriRuntime()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { writeFile, mkdir, exists } = await import(
          "@tauri-apps/plugin-fs"
        );

        const chosenRoot = await open({
          directory: true,
          multiple: false,
          title: `Save "${manifest.name}" to…`,
        });
        if (!chosenRoot || typeof chosenRoot !== "string") return;

        // Place the folder under the chosen root, named after the
        // original. Normalise separators since Tauri returns native
        // paths.
        const normRoot = chosenRoot.split("\\").join("/").replace(/\/$/, "");
        const folderRoot = `${normRoot}/${manifest.name}`;

        // Make the root once. Per-file mkdir below handles subdirs.
        if (!(await exists(folderRoot))) {
          await mkdir(folderRoot, { recursive: true });
        }

        let done = 0;
        for (const file of manifest.files) {
          setSave({
            kind: "downloading",
            done,
            total: manifest.count,
            current: file.p,
          });

          // Fetch the file body. Failures bail with a useful error.
          const res = await fetch(file.u);
          if (!res.ok) {
            throw new Error(
              `Failed to download "${file.p}" (HTTP ${res.status}).`,
            );
          }
          const buf = new Uint8Array(await res.arrayBuffer());

          // Reconstruct any subdirectories the relative path needs.
          const fullPath = `${folderRoot}/${file.p}`;
          const dirPart = fullPath.slice(0, fullPath.lastIndexOf("/"));
          if (dirPart && !(await exists(dirPart))) {
            await mkdir(dirPart, { recursive: true });
          }
          await writeFile(fullPath, buf);

          done += 1;
        }

        setSave({ kind: "done", destination: folderRoot });
      } catch (err) {
        console.error("[folder-save:tauri]", err);
        setSave({
          kind: "error",
          message: err instanceof Error ? err.message : "Save failed.",
        });
      }
      return;
    }

    // ── Browser fallback — sequential anchor downloads.
    // Most browsers allow 1–5 in quick succession before prompting
    // the user to allow more. We pace at 250ms apart to give the
    // browser a chance to register each.
    setSave({ kind: "downloading", done: 0, total: manifest.count, current: "" });
    let done = 0;
    for (const file of manifest.files) {
      try {
        const a = document.createElement("a");
        a.href = file.u;
        a.download = file.p.split("/").pop() || "file";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        done += 1;
        setSave({
          kind: "downloading",
          done,
          total: manifest.count,
          current: file.p,
        });
        // brief pause so the browser can keep up
        await new Promise((r) => setTimeout(r, 250));
      } catch {
        // keep going on individual failures — best-effort
      }
    }
    setSave({ kind: "done", destination: "your default downloads folder" });
  };

  const downloadProgress =
    save.kind === "downloading"
      ? Math.round((save.done / Math.max(1, save.total)) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={save.kind === "downloading"}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 hover:border-primary/60 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title={
                isTauriRuntime()
                  ? "Save the entire folder to disk"
                  : "Trigger a download for every file"
              }
            >
              {save.kind === "downloading" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {save.kind === "downloading"
                ? `${save.done}/${save.total}`
                : "Save all"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>

        {/* Bulk-save status banner — visible during and after a Save All. */}
        {save.kind === "downloading" && (
          <div className="border-b border-border bg-primary/[0.04] px-4 py-2">
            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mb-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="flex-1 truncate font-mono" title={save.current}>
                {save.current || "preparing…"}
              </span>
              <span className="font-mono">{downloadProgress}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
        {save.kind === "done" && (
          <div className="flex items-center gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate" title={save.destination}>
              Saved to {save.destination}
            </span>
            <button
              type="button"
              onClick={() => setSave({ kind: "idle" })}
              className="rounded-sm p-0.5 hover:bg-emerald-500/15"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {save.kind === "error" && (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-[11px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate" title={save.message}>
              {save.message}
            </span>
            <button
              type="button"
              onClick={() => setSave({ kind: "idle" })}
              className="rounded-sm p-0.5 hover:bg-destructive/15"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

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

        {/* Footer hint — adapts copy to runtime so the user knows
            what "Save all" actually does. */}
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <FileText className="h-3 w-3" />
          {isTauriRuntime()
            ? "Save all writes the folder to disk · Click a file to open it"
            : "Save all triggers a download per file · Click a file to open it"}
        </div>
      </div>
    </div>
  );
}
