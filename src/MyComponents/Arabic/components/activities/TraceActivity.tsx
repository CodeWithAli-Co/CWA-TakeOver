// ============================================================================
// Letter-form recognition. Pick the initial/medial/final shape that matches.
// Reuses MCQ-style UI but with larger Arabic glyphs.
// ============================================================================

import { useState } from "react";
import type { TraceActivity as TType } from "../../types";
import { ActivityCallbacks, ArabicDisplay, FeedbackBanner } from "./shared";

export function TraceActivity({
  activity,
  cb,
}: {
  activity: TType;
  cb: ActivityCallbacks;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");

  const choose = (i: number) => {
    if (state !== "idle") return;
    const correct = i === activity.correctIndex;
    setChosen(i);
    setState(correct ? "correct" : "wrong");
    cb.onResult(correct, String(i));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white/85 text-center">{activity.prompt}</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
        {activity.choices.map((c, i) => {
          const isChosen = chosen === i;
          const isCorrect = i === activity.correctIndex;
          let cls =
            "rounded-2xl border py-6 px-4 flex items-center justify-center min-h-[110px] transition-all ";
          if (state === "idle") {
            cls += "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer";
          } else if (isCorrect) {
            cls += "border-emerald-500/50 bg-emerald-500/15";
          } else if (isChosen) {
            cls += "border-amber-500/50 bg-amber-500/15";
          } else {
            cls += "border-white/10 bg-white/[0.02] opacity-40";
          }
          return (
            <button key={i} onClick={() => choose(i)} className={cls} disabled={state !== "idle"}>
              <ArabicDisplay text={c} size="lg" />
            </button>
          );
        })}
      </div>

      <FeedbackBanner state={state} onNext={cb.onNext} />
    </div>
  );
}
