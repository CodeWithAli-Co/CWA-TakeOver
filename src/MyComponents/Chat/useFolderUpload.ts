/**
 * useFolderUpload — upload an entire folder (with subdirectories) as a
 * single chat attachment. Used alongside `useImageUpload` for the
 * composer's "send folder" affordance.
 *
 * Two ingestion paths:
 *   · `gatherFromInput(files)` — for `<input type="file" webkitdirectory>`.
 *     Each file already carries `webkitRelativePath` set by the browser.
 *   · `gatherFromDataTransfer(items)` — for OS-file-explorer drag-drop.
 *     Uses `DataTransferItem.webkitGetAsEntry()` to detect folder entries
 *     and recursively walks them. Falls back to plain files for entries
 *     that aren't directories.
 *
 * Each folder uploads its files to the same `chat-images` Supabase bucket
 * we already use for images and other file attachments — keyed under a
 * per-folder prefix that includes the original relative path so the
 * structure can be reconstructed at view-time.
 *
 * The hook returns a manifest the composer base64-encodes into a single
 * `[folder:...]` token in the message body. `MessageBubble` parses that
 * token and renders a folder card with a browsable file list.
 *
 * Limits:
 *   · 50 files per folder (keeps the inline manifest under ~15KB)
 *   · 24 MB per individual file (matches `useImageUpload`)
 *   · 200 MB per folder total (sanity cap so a stray Downloads folder
 *     doesn't blow up the bucket on accident)
 */

import { useCallback, useState } from "react";
import supabase from "@/MyComponents/supabase";

const CHAT_BUCKET = "chat-images";
const MAX_FILES_PER_FOLDER = 50;
const MAX_BYTES_PER_FILE = 24 * 1024 * 1024;
const MAX_BYTES_PER_FOLDER = 200 * 1024 * 1024;

/** Single file inside a gathered folder bundle, pre-upload. */
export interface FolderEntry {
  /** Path relative to the dragged/picked folder root, e.g. "src/index.ts". */
  relativePath: string;
  file: File;
}

/** What the caller hands us before upload. */
export interface FolderBundle {
  /** Display name of the folder root. */
  name: string;
  entries: FolderEntry[];
}

/** Single uploaded file inside the manifest. */
export interface FolderManifestFile {
  /** Relative path (preserves subfolder structure). */
  p: string;
  /** Public URL of the uploaded file. */
  u: string;
  /** File size in bytes. */
  s: number;
}

/** Final manifest written to the chat message. */
export interface FolderManifest {
  /** Folder display name. */
  name: string;
  /** Total file count. */
  count: number;
  /** Total folder size in bytes. */
  bytes: number;
  /** Each uploaded file with its original relative path. */
  files: FolderManifestFile[];
}

/** Pending state surfaced to the composer for the in-progress folder. */
export interface PendingFolder {
  id: string;
  name: string;
  totalFiles: number;
  uploadedFiles: number;
  totalBytes: number;
  error?: string;
}

/**
 * Walk a `FileSystemDirectoryEntry` recursively, returning every File
 * inside it tagged with its relative path. Used for OS-file-explorer
 * folder drag-drop (the `DataTransferItem` path).
 */
function readDirectoryRecursive(
  dir: FileSystemDirectoryEntry,
  prefix = "",
): Promise<FolderEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = dir.createReader();
    const out: FolderEntry[] = [];

    // `readEntries` only returns a batch at a time; we keep calling
    // until it returns an empty array.
    const drain = () => {
      reader.readEntries(async (batch) => {
        if (batch.length === 0) {
          resolve(out);
          return;
        }
        try {
          for (const entry of batch) {
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isFile) {
              const file = await new Promise<File>((res, rej) => {
                (entry as FileSystemFileEntry).file(res, rej);
              });
              out.push({ relativePath: path, file });
            } else if (entry.isDirectory) {
              const nested = await readDirectoryRecursive(
                entry as FileSystemDirectoryEntry,
                path,
              );
              out.push(...nested);
            }
          }
          drain();
        } catch (err) {
          reject(err);
        }
      }, reject);
    };

    drain();
  });
}

/** Strip filesystem-illegal characters from a path component. */
function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9.\-_]/g, "-").slice(0, 80);
}

export function useFolderUpload(groupName: string, currentUsername: string) {
  const [pendingFolders, setPendingFolders] = useState<PendingFolder[]>([]);

  const removePendingFolder = useCallback((id: string) => {
    setPendingFolders((p) => p.filter((x) => x.id !== id));
  }, []);

  const clearPendingFolders = useCallback(() => {
    setPendingFolders([]);
  }, []);

  /**
   * Convert the `FileList` produced by `<input type="file" webkitdirectory>`
   * into a FolderBundle. The browser pre-populates `webkitRelativePath`
   * on each File which already includes the folder name as the first
   * segment.
   */
  const gatherFromInput = useCallback(
    (files: FileList | File[]): FolderBundle | null => {
      const arr = Array.from(files);
      if (arr.length === 0) return null;

      // Folder name = first segment of the first file's relative path.
      const sample = (arr[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      if (!sample) return null;
      const folderName = sample.split("/")[0] || "folder";

      const entries: FolderEntry[] = arr.map((file) => {
        const rel =
          (file as File & { webkitRelativePath?: string })
            .webkitRelativePath || file.name;
        // Strip the leading folder name so paths inside the manifest are
        // relative to the folder root (e.g. "src/index.ts" not
        // "my-project/src/index.ts").
        const stripped = rel.replace(new RegExp(`^${folderName}/`), "");
        return { relativePath: stripped, file };
      });

      return { name: folderName, entries };
    },
    [],
  );

  /**
   * Walk a `DataTransferItemList` from a drop event. Returns one
   * FolderBundle per dropped folder. Loose files in the same drop are
   * ignored — the composer's existing image/file path handles those.
   */
  const gatherFromDataTransfer = useCallback(
    async (items: DataTransferItemList): Promise<FolderBundle[]> => {
      const bundles: FolderBundle[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.kind !== "file") continue;
        const entry =
          typeof item.webkitGetAsEntry === "function"
            ? item.webkitGetAsEntry()
            : null;
        if (!entry || !entry.isDirectory) continue;

        promises.push(
          readDirectoryRecursive(entry as FileSystemDirectoryEntry).then(
            (entries) => {
              if (entries.length > 0) {
                bundles.push({ name: entry.name, entries });
              }
            },
          ),
        );
      }

      await Promise.all(promises);
      return bundles;
    },
    [],
  );

  /** Validate before kicking off the upload. Returns null on success
   *  or a human-readable rejection reason. */
  const validateBundle = (bundle: FolderBundle): string | null => {
    if (bundle.entries.length > MAX_FILES_PER_FOLDER) {
      return `Folder has ${bundle.entries.length} files — cap is ${MAX_FILES_PER_FOLDER}.`;
    }
    let total = 0;
    for (const e of bundle.entries) {
      if (e.file.size > MAX_BYTES_PER_FILE) {
        return `"${e.relativePath}" is over the ${MAX_BYTES_PER_FILE / 1024 / 1024}MB per-file cap.`;
      }
      total += e.file.size;
    }
    if (total > MAX_BYTES_PER_FOLDER) {
      return `Folder is ${(total / 1024 / 1024).toFixed(1)}MB — cap is ${MAX_BYTES_PER_FOLDER / 1024 / 1024}MB.`;
    }
    return null;
  };

  /**
   * Upload a folder bundle. Each file is pushed to Supabase storage
   * under a per-folder prefix; `relativePath` is preserved in the key.
   * Returns a `FolderManifest` ready to be base64-encoded and embedded
   * in the message body.
   */
  const uploadFolder = useCallback(
    async (bundle: FolderBundle): Promise<FolderManifest | null> => {
      const reason = validateBundle(bundle);
      if (reason) {
        const id = crypto.randomUUID();
        setPendingFolders((p) => [
          ...p,
          {
            id,
            name: bundle.name,
            totalFiles: bundle.entries.length,
            uploadedFiles: 0,
            totalBytes: 0,
            error: reason,
          },
        ]);
        return null;
      }

      const id = crypto.randomUUID();
      const totalBytes = bundle.entries.reduce(
        (acc, e) => acc + e.file.size,
        0,
      );

      setPendingFolders((p) => [
        ...p,
        {
          id,
          name: bundle.name,
          totalFiles: bundle.entries.length,
          uploadedFiles: 0,
          totalBytes,
        },
      ]);

      const safeGroup = safeSegment(groupName).toLowerCase();
      const safeUser = safeSegment(currentUsername).toLowerCase();
      const safeFolder = safeSegment(bundle.name).toLowerCase();
      const folderId = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
      const basePrefix = `${safeGroup}/${safeUser}-${folderId}-${safeFolder}`;

      const manifestFiles: FolderManifestFile[] = [];

      // Upload sequentially — keeps memory in check and matches the
      // existing useImageUpload behaviour. Updates the per-folder
      // pending counter as it goes so the composer can render progress.
      for (const entry of bundle.entries) {
        const safePath = entry.relativePath
          .split("/")
          .map(safeSegment)
          .join("/");
        const key = `${basePrefix}/${safePath}`;

        const { error } = await supabase.storage
          .from(CHAT_BUCKET)
          .upload(key, entry.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: entry.file.type || undefined,
          });

        if (error) {
          // Mark error on the pending folder; bail. Already-uploaded
          // files are left in the bucket — orphaned but harmless.
          setPendingFolders((p) =>
            p.map((x) =>
              x.id === id
                ? { ...x, error: `Upload failed: ${error.message}` }
                : x,
            ),
          );
          return null;
        }

        const { data } = supabase.storage
          .from(CHAT_BUCKET)
          .getPublicUrl(key);

        manifestFiles.push({
          p: entry.relativePath,
          u: data.publicUrl,
          s: entry.file.size,
        });

        setPendingFolders((p) =>
          p.map((x) =>
            x.id === id
              ? { ...x, uploadedFiles: manifestFiles.length }
              : x,
          ),
        );
      }

      // Drop the pending entry once we've succeeded — the composer
      // surfaces the finalized manifest inside the message preview.
      setPendingFolders((p) => p.filter((x) => x.id !== id));

      return {
        name: bundle.name,
        count: manifestFiles.length,
        bytes: totalBytes,
        files: manifestFiles,
      };
    },
    [groupName, currentUsername],
  );

  return {
    pendingFolders,
    removePendingFolder,
    clearPendingFolders,
    gatherFromInput,
    gatherFromDataTransfer,
    uploadFolder,
    MAX_FILES_PER_FOLDER,
    MAX_BYTES_PER_FOLDER,
  };
}

/* ── Marker helpers — used by both composer (encode) and bubble (decode)
   ─────────────────────────────────────────────────────────────────── */

/** Encode a manifest into the inline `[folder:...]` token used in the
 *  message body. base64 keeps the JSON safe from chat parsers. */
export function encodeFolderToken(manifest: FolderManifest): string {
  const json = JSON.stringify(manifest);
  // btoa requires latin-1 input; UTF-8 → percent → bytes is the
  // standard browser-safe pattern.
  const utf8 = unescape(encodeURIComponent(json));
  return `[folder:${btoa(utf8)}]`;
}

/** Inverse of `encodeFolderToken`. Returns null on parse failure. */
export function decodeFolderToken(token: string): FolderManifest | null {
  try {
    const m = token.match(/^\[folder:([A-Za-z0-9+/=]+)\]$/);
    if (!m) return null;
    const utf8 = atob(m[1]!);
    const json = decodeURIComponent(escape(utf8));
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.name !== "string" ||
      typeof parsed?.count !== "number" ||
      !Array.isArray(parsed?.files)
    ) {
      return null;
    }
    return parsed as FolderManifest;
  } catch {
    return null;
  }
}

/** Regex that matches every folder token in a body of text. Exported so
 *  MessageBubble can extract them out before running its existing
 *  per-URL extraction (which would otherwise mistake the folder's
 *  internal URLs for standalone file attachments). */
export const FOLDER_TOKEN_RE = /\[folder:[A-Za-z0-9+/=]+\]/g;
