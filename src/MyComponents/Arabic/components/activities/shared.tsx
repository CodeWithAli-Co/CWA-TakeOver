// ============================================================================
// Shared UI bits for activity renderers.
// ============================================================================

import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { pickCorrect, pickWrong } from "../../encouragement";

export interface ActivityCallbacks {
  onResult: (correct: boolean, answeredText?: string) => void;
  onNext: () => void;
}

// The large feedback banner — shared by every scored activity.
export function FeedbackBanner({
  state,
  onNext,
  explain,
}: {
  state: "idle" | "correct" | "wrong";
  onNext: () => void;
  explain?: string;
}) {
  return (
    <AnimatePresence>
      {state !== "idle" && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={
            "mt-6 rounded-xl border p-4 flex items-start justify-between gap-4 " +
            (state === "correct"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100")
          }
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={
                "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 " +
                (state === "correct" ? "bg-emerald-500/20" : "bg-amber-500/20")
              }
            >
              {state === "correct" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">
                {state === "correct" ? pickCorrect() : pickWrong()}
              </div>
              {explain && (
                <div className="text-[13px] mt-1 opacity-85 leading-relaxed">{explain}</div>
              )}
            </div>
          </div>
          <button
            onClick={onNext}
            className={
              "shrink-0 px-4 py-2 rounded-lg font-semibold text-sm " +
              (state === "correct"
                ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                : "bg-amber-500 hover:bg-amber-400 text-black")
            }
          >
            Continue →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Normalize typed answers for loose matching.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "")     // strip harakat
    .replace(/[ʾʿāīūḥṣḍṭẓ']/g, (ch) =>
      ({ ʾ: "", ʿ: "", ā: "a", ī: "i", ū: "u", ḥ: "h", ṣ: "s", ḍ: "d", ṭ: "t", ẓ: "z", "'": "" }[ch] || ch),
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function isAnswerCorrect(
  input: string,
  expected: string,
  alts: string[] = [],
): boolean {
  const n = normalize(input);
  if (!n) return false;
  if (n === normalize(expected)) return true;
  return alts.some((a) => normalize(a) === n);
}

// Arabic typography helper — big centered display.
export function ArabicDisplay({
  text,
  size = "hero",
}: {
  text: string;
  size?: "hero" | "lg" | "md";
}) {
  const cls =
    size === "hero"
      ? "text-7xl md:text-8xl"
      : size === "lg"
      ? "text-4xl md:text-5xl"
      : "text-2xl md:text-3xl";
  return (
    <div
      dir="rtl"
      lang="ar"
      className={
        cls +
        " font-serif text-white text-center leading-[1.3] tracking-wide select-none"
      }
      style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' }}
    >
      {text}
    </div>
  );
}

// Non-scored "Info" activity — teaching slide.
export function InfoSlide({
  title,
  body,
  tip,
  onNext,
  showcase,
}: {
  title: string;
  body: string;
  tip?: string;
  onNext: () => void;
  showcase?: { ar: string; translit: string; en: string; note?: string }[];
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-2xl font-bold text-white">{title}</h3>
      <div className="text-white/75 whitespace-pre-line leading-relaxed text-[15px]">{body}</div>

      {showcase && showcase.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {showcase.map((w, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4"
            >
              <ArabicDisplay text={w.ar} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-white/95 font-semibold italic text-sm">{w.translit}</div>
                <div className="text-white/55 text-xs mt-0.5">{w.en}</div>
                {w.note && <div className="text-amber-200/70 text-[11px] mt-1">{w.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tip && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 text-sky-100 text-sm">
          <span className="font-semibold">Tip: </span>
          {tip}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
