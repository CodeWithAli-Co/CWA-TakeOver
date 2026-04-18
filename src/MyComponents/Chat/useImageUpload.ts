/**
 * useImageUpload — upload chat attachments to the `chat-images` Supabase
 * bucket and return public URLs for message rendering.
 *
 * Supports:
 *   · direct File[] input (from <input type="file">)
 *   · DataTransferItemList (drag/drop)
 *   · ClipboardEvent (paste)
 */

import { useCallback, useState } from "react";
import supabase from "@/MyComponents/supabase";

export interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  publicUrl?: string;
  error?: string;
}

const CHAT_BUCKET = "chat-images";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const VALID_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function useImageUpload(groupName: string, currentUsername: string) {
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const removePending = useCallback((id: string) => {
    setPending((p) => {
      const entry = p.find((x) => x.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPending((p) => {
      for (const x of p) if (x.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return [];
    });
  }, []);

  /** Upload a single file. Returns the public URL or null on failure. */
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!VALID_TYPES.includes(file.type)) {
        console.warn("[chat-image] rejected file type:", file.type);
        return null;
      }
      if (file.size > MAX_BYTES) {
        console.warn("[chat-image] rejected file size:", file.size);
        return null;
      }
      const ext = file.name.split(".").pop() || "bin";
      const safeGroup = groupName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const safeUser = currentUsername.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const key = `${safeGroup}/${safeUser}-${Date.now()}-${Math.floor(Math.random() * 1e4)}.${ext}`;

      const { error } = await supabase.storage
        .from(CHAT_BUCKET)
        .upload(key, file, { cacheControl: "3600", upsert: false });

      if (error) {
        console.error("[chat-image] upload failed:", error.message);
        return null;
      }
      const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(key);
      return data.publicUrl;
    },
    [groupName, currentUsername],
  );

  /** Queue files for upload and return public URLs once all finish. */
  const uploadMany = useCallback(
    async (files: File[]): Promise<string[]> => {
      const items: PendingUpload[] = files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        progress: 0,
      }));
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
