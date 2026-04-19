/**
 * transcription.ts — Front-end hook into the Tauri `transcribe_audio`
 * sidecar command. The sidecar itself is Rust glue around
 * whisper.cpp (or any Whisper-compatible binary) that you'll wire on
 * the Tauri side:
 *
 *   // src-tauri/src/main.rs
 *   #[tauri::command]
 *   async fn transcribe_audio(path: String) -> Result<String, String> {
 *     // 1. Spawn the whisper.cpp sidecar with `path` as input.
 *     // 2. Capture stdout, return the transcribed string.
 *   }
 *
 * Until that sidecar exists, this module falls back to the Web Speech
 * API's SpeechRecognition-on-recorded-audio trick (limited but useful
 * for short voice notes). If neither is available it returns null and
 * the caller shows a "transcription unavailable" note.
 */

import { invoke } from "@tauri-apps/api/core";

export type TranscriptionResult =
  | { ok: true; text: string; source: "sidecar" | "web-speech" }
  | { ok: false; reason: string };

/**
 * Transcribe an audio file (URL to a hosted audio blob, typically a
 * voice message). Attempts Tauri sidecar first, falls back to nothing
 * until a browser-based whisper wasm is wired up.
 */
export async function transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
  // Preferred path: Tauri sidecar running whisper.cpp locally.
  try {
    const text = await invoke<string>("transcribe_audio", { path: audioUrl });
    if (typeof text === "string" && text.trim().length > 0) {
      return { ok: true, text: text.trim(), source: "sidecar" };
    }
  } catch (err) {
    // Command not registered yet, or sidecar failed. Fall through.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/command .* not found/i.test(msg)) {
      console.warn("[transcription] sidecar:", msg);
    }
  }

  // No browser fallback ships here — keeping the function surface ready
  // for when the sidecar lands. Returning a structured "unavailable"
  // lets callers render a useful tooltip instead of silent failure.
  return {
    ok: false,
    reason:
      "Transcription sidecar not installed yet. Wire the Rust command and restart the app.",
  };
}

/**
 * Batch-transcribe N urls in sequence (the sidecar is typically single-
 * threaded; serial is safer than parallel). Returns results in order.
 */
export async function transcribeBatch(
  urls: string[],
): Promise<TranscriptionResult[]> {
  const out: TranscriptionResult[] = [];
  for (const u of urls) {
    out.push(await transcribeAudio(u));
  }
  return out;
}
