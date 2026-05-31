/**
 * imageUpload.ts — Helpers for uploading doc images to Supabase storage.
 *
 * `uploadWorkspaceImage` takes a File (or Blob), names it with a uuid
 * + the original extension, drops it in the `workspace-images` bucket,
 * and returns the public URL ready to paste into a TipTap image node.
 *
 * Used by the SlashCommand image option, the editor's paste/drop
 * handler, and (later) the toolbar's image button.
 */

import { takeOversupabase } from "@/MyComponents/supabase";

const BUCKET = "workspace-images";

const VALID_MIME = /^image\/(png|jpe?g|gif|webp|svg\+xml|avif)$/i;

export interface UploadedImage {
  publicUrl: string;
  storagePath: string;
}

/** Returns a UUID v4-ish string without bringing in a dep. */
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function extFromMime(type: string, fallback: string): string {
  switch (type) {
    case "image/png": return "png";
    case "image/jpeg": case "image/jpg": return "jpg";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    case "image/avif": return "avif";
    default: return fallback;
  }
}

/**
 * Upload a File to the workspace-images bucket. Throws on validation
 * or storage failure so callers can surface a toast.
 */
export async function uploadWorkspaceImage(file: File | Blob): Promise<UploadedImage> {
  const type = (file as File).type || "image/png";
  if (!VALID_MIME.test(type)) {
    throw new Error(`Unsupported image type: ${type}`);
  }

  const original = (file as File).name ?? "image";
  const fallbackExt = original.includes(".") ? original.split(".").pop()! : "png";
  const ext = extFromMime(type, fallbackExt);
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${uid()}.${ext}`;

  const { error } = await takeOversupabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      contentType: type,
      upsert: false,
    });
  if (error) throw error;

  const { data } = takeOversupabase.storage.from(BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error("Upload succeeded but public URL is missing.");
  }
  return { publicUrl: data.publicUrl, storagePath };
}

/**
 * Extract image File objects from a DataTransfer (used by paste + drop
 * handlers). Returns an empty array when no images present.
 */
export function extractImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  // items API gives us pasted clipboard images that don't appear in `files`.
  for (let i = 0; i < dt.items.length; i++) {
    const it = dt.items[i]!;
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  // Fallback for drag-and-drop where items isn't populated.
  if (out.length === 0 && dt.files) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i]!;
      if (f.type.startsWith("image/")) out.push(f);
    }
  }
  return out;
}
