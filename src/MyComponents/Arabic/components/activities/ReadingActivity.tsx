// ============================================================================
// Reading activity — passage with translation reveal + MCQ comprehension.
// ============================================================================

import { useState } from "react";
import type { ReadingActivity as RType } from "../../types";
import { ActivityCallbacks, FeedbackBanner } from "./shared";

export function ReadingActivity({
  activity,
  cb,
}: {
  activity: RType;
  cb: ActivityCallbacks;
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");

  const choose = (i: number) => {
    if (state !== "idle") return;
    const ok = i === activity.correctIndex;
    setChosen(i);
    setState(ok ? "correct" : "wrong");
    cb.onResult(ok, String(i));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white/85 text-center">{activity.prompt}</h3>

      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
        <div className="text-right" dir="rtl" lang="ar">
          <div
            className="text-2xl md:text-3xl leading-loose text-white"
            style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' }}
          >
            {activity.passageAr}
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowTranslation((s) => !s)}
            className="text-sky-300 hover:text-sky-200 text-xs underline underline-offset-2"
          >
            {showTranslation ? "Hide translation" : "Show translation"}
          </button>
          {showTranslation && (
            <div className="mt-2 text-white/60 text-sm italic leading-relaxed">
              {activity.translation}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="text-white font-semibold mb-3">{activity.question}</div>
        <div className="grid gap-2">
          {activity.choices.map((c, i) => {
            const isChosen = chosen === i;
            const isCorrect = i === activity.correctIndex;
            let cls = "rounded-lg border px-4 py-3 text-left font-medium transition-all text-white ";
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
      </div>

      <FeedbackBanner state={state} onNext={cb.onNext} explain={activity.explain} />
    </div>
  );
}
