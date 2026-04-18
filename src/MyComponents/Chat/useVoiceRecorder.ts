/**
 * useVoiceRecorder — MediaRecorder wrapper for voice-message capture.
 *
 * Returns:
 *   · recording, elapsed (live ms)
 *   · start(): request mic + begin recording
 *   · stop():  finalise recording → resolves with a File ready to upload
 *   · cancel(): discard current recording without producing a File
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecorder {
  recording: boolean;
  elapsed: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<File | null>;
  cancel: () => void;
}

export function useVoiceRecorder(): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    recRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recRef.current = rec;
      rec.start();
      startedAtRef.current = Date.now();
      setRecording(true);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<File | null> => {
    const rec = recRef.current;
    if (!rec) return null;
    return new Promise((resolve) => {
      rec.onstop = () => {
        const cancelled = cancelledRef.current;
        const chunks = chunksRef.current.slice();
        cleanup();
        if (cancelled || chunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File(
          [blob],
          `voice-${Date.now()}.webm`,
          { type: "audio/webm", lastModified: Date.now() },
        );
        resolve(file);
      };
      rec.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* noop */ }
    }
    cleanup();
  }, [cleanup]);

  return { recording, elapsed, error, start, stop, cancel };
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
