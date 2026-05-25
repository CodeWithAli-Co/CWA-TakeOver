/**
 * ShareSourceModal.tsx — Pre-share modal with quality picker, privacy
 * preamble, and a branded CTA. Replaces the unstyled handoff to the OS
 * source picker with a professional confirmation step.
 *
 * Flow:
 *   1. User clicks "Share screen" → this modal opens
 *   2. They pick quality + acknowledge the privacy note
 *   3. "Start Sharing" → calls onConfirm() which fires getDisplayMedia
 *      (the OS picker appears at that point — unavoidable, browser owns
 *      source selection for security reasons)
 *   4. Modal closes on success OR stays open with an error message
 *
 * The OS picker itself can't be replaced from a web context. That's the
 * W3C Screen Capture spec — "the UA must provide a mechanism for the
 * end user to choose which display surface to share." We wrap it with
 * context and polish instead.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Sparkles, Eye, Loader2, X, ShieldCheck } from "lucide-react";
import {
  useHuddleStore,
  QUALITY_PRESETS,
  type HuddleQuality,
} from "@/stores/huddleStore";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Starts the actual screen share. Typically huddle.startScreenShare. */
  onConfirm: () => Promise<void> | void;
  /** Channel / huddle name for context. */
  huddleName?: string;
  /** Peer count — helps the user decide how much they want to show. */
  peerCount?: number;
}

const QUALITY_ORDER: HuddleQuality[] = ["smooth", "balanced", "crisp", "ultra"];

export function ShareSourceModal({
  open,
  onClose,
  onConfirm,
  huddleName,
  peerCount = 0,
}: Props) {
  const quality = useHuddleStore((s) => s.quality);
  const setQuality = useHuddleStore((s) => s.setQuality);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      // NotAllowedError = user canceled the OS picker. That's fine,
      // don't show it as an error — just close silently.
      if (e instanceof Error && e.name === "NotAllowedError") {
        onClose();
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-md"
            onClick={starting ? undefined : onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-[9991] w-[min(540px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            {/* Top gradient accent */}
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(210 90% 55%), hsl(260 80% 60%), hsl(320 80% 60%))",
              }}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300 ring-1 ring-inset ring-white/10">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white">
                    Share your screen
                  </h2>
                  <p className="mt-0.5 text-[12px] text-white/55 leading-snug">
                    {huddleName ? (
                      <>
                        In <span className="font-medium text-white/75">{huddleName}</span>
                        {peerCount > 0 && (
                          <> · {peerCount} {peerCount === 1 ? "person" : "people"} watching</>
                        )}
                      </>
                    ) : (
                      "Pick a quality, then choose a window or screen."
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={starting ? undefined : onClose}
                disabled={starting}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/5 hover:text-white/80 disabled:opacity-40 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quality picker */}
            <div className="px-6 pb-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-white/50" />
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-white/55">
                  Quality
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUALITY_ORDER.map((key) => {
                  const preset = QUALITY_PRESETS[key];
                  const selected = quality === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setQuality(key)}
                      className={[
                        "group relative flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all",
                        selected
                          ? "border-blue-400/50 bg-blue-500/10 shadow-[0_0_0_1px_hsl(210_90%_55%/0.35),0_8px_24px_-8px_hsl(210_90%_55%/0.35)]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className={[
                            "text-[12px] font-medium",
                            selected ? "text-white" : "text-white/80",
                          ].join(" ")}
                        >
                          {preset.label}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-200 ring-1 ring-inset ring-blue-400/40">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] leading-snug text-white/50">
                        {preset.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Privacy note */}
            <div className="mx-6 mb-4 flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
              <p className="text-[11px] leading-relaxed text-white/55">
                Your OS will ask which window or screen to share in the next
                step. Nothing is captured until you confirm there. Close
                sensitive tabs first.
              </p>
            </div>

            {/* Error, if any */}
            {error && (
              <div className="mx-6 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
                {error}
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-black/30 px-6 py-3">
              <div className="flex items-center gap-1.5 text-[10.5px] text-white/40">
                <Eye className="h-3 w-3" />
                Preview shown to peers after confirm
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={starting}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_-2px_hsl(210_90%_55%/0.5)] ring-1 ring-inset ring-white/15 hover:from-blue-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Waiting for source…
                    </>
                  ) : (
                    <>
                      <Monitor className="h-3.5 w-3.5" />
                      Start Sharing
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
