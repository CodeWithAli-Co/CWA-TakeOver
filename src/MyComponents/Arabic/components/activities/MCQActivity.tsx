// ============================================================================
// Multiple-choice question renderer.
// ============================================================================

import { useState } from "react";
import type { MCQActivity as MCQType } from "../../types";
import { ActivityCallbacks, ArabicDisplay, FeedbackBanner } from "./shared";

export function MCQActivity({
  activity,
  cb,
}: {
  activity: MCQType;
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
      {activity.arabicPrompt && (
        <div className="flex items-center justify-center">
          <ArabicDisplay text={activity.arabicPrompt} size="hero" />
        </div>
      )}

      <h3 className="text-xl font-semibold text-white text-center">
        {activity.question}
      </h3>

      <div className="grid gap-3 max-w-xl mx-auto">
        {activity.choices.map((c, i) => {
          const isChosen = chosen === i;
          const isCorrect = i === activity.correctIndex;
          let cls =
            "rounded-xl border px-4 py-3 text-left transition-all text-white/90 font-medium ";
          if (state === "idle") {
            cls += "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 cursor-pointer";
          } else if (isCorrect) {
            cls += "border-emerald-500/50 bg-emerald-500/15 text-emerald-50";
          } else if (isChosen) {
            cls += "border-amber-500/50 bg-amber-500/15 text-amber-50";
          } else {
            cls += "border-white/10 bg-white/[0.02] opacity-50";
          }
          return (
            <button key={i} onClick={() => choose(i)} className={cls} disabled={state !== "idle"}>
              <span className="inline-block w-6 h-6 rounded-md bg-white/10 text-xs font-bold leading-6 text-center mr-3">
                {String.fromCharCode(65 + i)}
              </span>
              {c}
            </button>
          );
        })}
      </div>

      <FeedbackBanner state={state} onNext={cb.onNext} explain={activity.explain} />
    </div>
  );
}
