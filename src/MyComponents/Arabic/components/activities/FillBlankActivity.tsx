// ============================================================================
// Fill-in-the-blank — pick the word that fits the blank.
// ============================================================================

import React, { useState } from "react";
import type { FillBlankActivity as FBType } from "../../types";
import { ActivityCallbacks, FeedbackBanner } from "./shared";

export function FillBlankActivity({
  activity,
  cb,
}: {
  activity: FBType;
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

  // Visualize the prompt with a highlighted blank slot.
  const parts = activity.prompt.split("____");

  return (
    <div className="space-y-6">
      <div className="max-w-xl mx-auto rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center text-lg text-white/95 leading-relaxed">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <span>{p}</span>
            {i < parts.length - 1 && (
              <span
                className={
                  "inline-block mx-1 px-2 min-w-[72px] text-center rounded-md font-semibold " +
                  (state === "correct"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : state === "wrong"
                    ? "bg-amber-500/20 text-amber-100"
                    : "bg-sky-500/20 text-sky-100")
                }
              >
                {state === "idle" ? "___" : activity.blank}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
        {activity.choices.map((c, i) => {
          const isChosen = chosen === i;
          const isCorrect = i === activity.correctIndex;
          let cls = "rounded-xl border px-4 py-3 font-medium transition-all text-white ";
          if (state === "idle") {
            cls += "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer";
          } else if (isCorrect) {
            cls += "border-emerald-500/50 bg-emerald-500/15 text-emerald-50";
          } else if (isChosen) {
            cls += "border-amber-500/50 bg-amber-500/15 text-amber-50";
          } else {
            cls += "border-white/10 bg-white/[0.02] opacity-50";
          }
          return (
            <button key={i} onClick={() => choose(i)} className={cls} disabled={state !== "idle"}>
              {c}
            </button>
          );
        })}
      </div>

      <FeedbackBanner
        state={state}
        onNext={cb.onNext}
        explain={activity.explain}
      />
    </div>
  );
}
