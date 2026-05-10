/**
 * pickFolderTauri — Tauri-native folder selection.
 *
 * The web-standard `<input type="file" webkitdirectory>` is unreliable
 * inside Tauri's WebView2 on Windows: the picker opens, but every
 * resulting File ends up with an empty `webkitRelativePath`, which
 * means our `useFolderUpload.gatherFromInput` couldn't reconstruct the
 * folder structure and silently returned null. That was the root
 * cause of "I uploaded a folder but nothing happened."
 *
 * This module routes around the problem by using the native Tauri
 * dialog + filesystem plugins:
 *   1. `dialog.open({ directory: true })` opens the OS folder picker
 *   2. `fs.readDir` walks the chosen directory recursively
 *   3. `fs.readFile` pulls each file's bytes
 *   4. We wrap each blob in a real `File` so the existing
 *      `useFolderUpload.uploadFolder` pipeline can handle it unchanged
 *
 * The only thing we lose vs. the web path: we can't infer mime types
 * from the OS, so we fall back to extension-based detection (good
 * enough for the bucket — Supabase uses contentType for `Cache-Control`
 * and inline preview hinting, not for routing).
 */

import type { FolderBundle, FolderEntry } from "./useFolderUpload";

/** Runtime check — true when we're running inside Tauri's WebView. */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/** Map common file extensions to mime types. Sufficient for what we
 *  put in the chat-images bucket. */
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  jsx: "text/javascript",
  py: "text/x-python",
  rs: "text/rust",
  zip: "application/zip",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function mimeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/**
 * Open the OS folder picker, walk the chosen directory recursively,
 * and return a FolderBundle ready for `useFolderUpload.uploadFolder`.
 *
 * Returns:
 *   - FolderBundle on success
 *   - null if the user cancelled the picker
 *   - throws on unexpected filesystem errors so the caller can show
 *     an error pill
 */
export async function pickFolderTauri(): Promise<FolderBundle | null> {
  // Dynamic imports keep the bundle slim in non-Tauri contexts (web
  // dev preview) and let tree-shaking drop these when isTauriRuntime
  // returns false.
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readDir, readFile } = await import("@tauri-apps/plugin-fs");

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select a folder to send",
  });

  // User cancelled.
  if (!selected || typeof selected !== "string") return null;

  // Folder name = the last path segment. Handle both Windows
  // backslashes and POSIX forward slashes.
  const folderName =
    selected
      .split("\\").join("/")
      .replace(/\/$/, "")
      .split("/")
      .pop() || "folder";

  // Recursive walk. We collect each file's full path + relative path
  // first, then read bytes in a second pass so we don't hold the
  // filesystem iterator open during slow IO.
  interface FoundFile {
    fullPath: string;
    relativePath: string;
  }

  async function walk(
    dirPath: string,
    relPrefix: string,
  ): Promise<FoundFile[]> {
    const out: FoundFile[] = [];
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      const childFull = `${dirPath}/${entry.name}`.split("\\").join("/");
      const childRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        const nested = await walk(childFull, childRel);
        out.push(...nested);
      } else if (entry.isFile) {
        out.push({ fullPath: childFull, relativePath: childRel });
      }
      // symlinks ignored — too easy to chase a loop into oblivion
    }
    return out;
  }

  const found = await walk(selected, "");
  if (found.length === 0) {
    // Empty folder — caller will surface this as an error pill.
    return { name: folderName, entries: [] };
  }

  // Read every file's bytes and wrap in a File.
  const entries: FolderEntry[] = [];
  for (const f of found) {
    const bytes = await readFile(f.fullPath);
    const fileName = f.relativePath.split("/").pop() || "file";
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: mimeForName(fileName),
    });
    entries.push({ relativePath: f.relativePath, file });
  }

  return { name: folderName, entries };
}
