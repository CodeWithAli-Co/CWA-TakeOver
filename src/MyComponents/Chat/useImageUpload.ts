/**
 * useImageUpload — upload chat attachments (images OR any other file) to
 * the `chat-images` Supabase bucket. Returns public URLs that the bubble
 * uses to render image galleries OR file-card attachments (extension-based).
 *
 * Supports:
 *   · direct File[] input (from <input type="file">)
 *   · DataTransferItemList (drag/drop)
 *   · ClipboardEvent (paste)
 */

import { useCallback, useState } from "react";
import { companySupabase } from "@/MyComponents/supabase";

export interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  publicUrl?: string;
  error?: string;
  isImage: boolean;
}

const CHAT_BUCKET = "chat-images";
const MAX_BYTES = 24 * 1024 * 1024; // 24MB — accommodates docs + short clips
const IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
]);

export function useImageUpload(groupName: string, currentUsername: string) {
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const removePending = useCallback((id: string) => {
    setPending((p) => {
      const entry = p.find((x) => x.id === id);
      if (entry?.previewUrl) {
        try { URL.revokeObjectURL(entry.previewUrl); } catch { /* noop */ }
      }
      return p.filter((x) => x.id !== id);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPending((p) => {
      for (const x of p) {
        if (x.previewUrl) {
          try { URL.revokeObjectURL(x.previewUrl); } catch { /* noop */ }
        }
      }
      return [];
    });
  }, []);

  /** Upload a single file. Returns the public URL or null on failure. */
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      if (file.size > MAX_BYTES) {
        console.warn(
          `[chat-upload] rejected file over ${MAX_BYTES / 1024 / 1024}MB:`,
          file.name, file.size,
        );
        return null;
      }
      const safeGroup = groupName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const safeUser = currentUsername.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      // Include the original filename in the path so MessageBubble can
      // extract it for display on non-image attachments.
      const safeName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "-")
        .slice(0, 80);
      const key = `${safeGroup}/${safeUser}-${Date.now()}-${Math.floor(Math.random() * 1e4)}-${safeName}`;

      const { error } = await companySupabase.storage
        .from(CHAT_BUCKET)
        .upload(key, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (error) {
        console.error("[chat-upload] upload failed:", error.message);
        return null;
      }
      const { data } = companySupabase.storage.from(CHAT_BUCKET).getPublicUrl(key);
      return data.publicUrl;
    },
    [groupName, currentUsername],
  );

  /** Queue files for upload and return public URLs once all finish. */
  const uploadMany = useCallback(
    async (files: File[]): Promise<string[]> => {
      const items: PendingUpload[] = files.map((f) => {
        const isImage = IMAGE_TYPES.has(f.type);
        return {
          id: crypto.randomUUID(),
          file: f,
          // Object URL is only meaningful for visual previews; non-images
          // render as a file card so we skip it.
          previewUrl: isImage ? URL.createObjectURL(f) : "",
          progress: 0,
          isImage,
        };
      });
      setPending((p) => [...p, ...items]);

      const urls: string[] = [];
      for (const item of items) {
        const url = await upload(item.file);
        if (url) urls.push(url);
        setPending((p) =>
          p.map((x) =>
            x.id === item.id
              ? { ...x, publicUrl: url ?? undefined, progress: 100 }
              : x,
          ),
        );
      }
      return urls;
    },
    [upload],
  );

  /** Pull File objects from a ClipboardEvent (handles pasted screenshots). */
  const filesFromClipboard = useCallback((e: ClipboardEvent): File[] => {
    const out: File[] = [];
    const items = e.clipboardData?.items;
    if (!items) return out;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
    return out;
  }, []);

  return {
    pending,
    removePending,
    clearPending,
    uploadMany,
    filesFromClipboard,
  };
}
