// ============================================================================
// Flashcard renderer — self-paced. Counts as "correct" on completion.
// ============================================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FlashcardActivity as FCType } from "../../types";
import { ActivityCallbacks, ArabicDisplay } from "./shared";

export function FlashcardActivity({
  activity,
  cb,
}: {
  activity: FCType;
  cb: ActivityCallbacks;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set([0]));

  const card = activity.cards[idx];
  const isLast = idx === activity.cards.length - 1;

  const next = () => {
    if (idx < activity.cards.length - 1) {
      setIdx(idx + 1);
      setFlipped(false);
      setSeen((s) => new Set([...s, idx + 1]));
    }
  };
  const prev = () => {
    if (idx > 0) {
      setIdx(idx - 1);
      setFlipped(false);
    }
  };

  const finish = () => {
    cb.onResult(true);
    cb.onNext();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white/80 text-center">{activity.prompt}</h3>

      <div className="flex items-center justify-between text-xs text-white/50 max-w-md mx-auto">
        <span>Card {idx + 1} / {activity.cards.length}</span>
        <span>{seen.size} / {activity.cards.length} seen</span>
      </div>

      <div className="max-w-md mx-auto">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-6 py-10 min-h-[260px] flex flex-col items-center justify-center relative overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {!flipped ? (
              <motion.div
                key="front"
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-4"
              >
                <ArabicDisplay text={card.ar} size="hero" />
                <div className="text-white/40 text-xs italic mt-2">tap to flip</div>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-2 px-6 text-center"
              >
                <div className="text-white text-3xl font-semibold italic">{card.translit}</div>
                <div className="text-sky-200 text-lg">{card.en}</div>
                {card.note && (
                  <div className="text-amber-200/70 text-xs mt-2 max-w-xs">{card.note}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="h-10 px-4 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        {!isLast ? (
          <button
            onClick={next}
            className="h-10 px-5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold flex items-center gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={finish}
            className="h-10 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            I've got these →
          </button>
        )}
      </div>
    </div>
  );
}
