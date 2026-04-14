// ============================================================================
// Dialogue activity — two-speaker conversation + comprehension question.
// ============================================================================

import { useState } from "react";
import type { DialogueActivity as DType } from "../../types";
import { ActivityCallbacks, FeedbackBanner } from "./shared";

export function DialogueActivity({
  activity,
  cb,
}: {
  activity: DType;
  cb: ActivityCallbacks;
}) {
  const [showTrans, setShowTrans] = useState(true);
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

      <div className="max-w-2xl mx-auto space-y-2">
        {activity.lines.map((ln, i) => {
          const isA = ln.speaker === "A";
          return (
            <div key={i} className={"flex " + (isA ? "justify-start" : "justify-end")}>
              <div
                className={
                  "max-w-[85%] rounded-2xl px-4 py-3 border " +
                  (isA
                    ? "bg-white/[0.04] border-white/10 rounded-bl-sm"
                    : "bg-sky-500/10 border-sky-500/30 rounded-br-sm")
                }
              >
                <div
                  dir="rtl"
                  className="text-white text-lg leading-loose font-serif"
                  style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' }}
                >
                  {ln.ar}
                </div>
                <div className="text-white/55 text-xs italic mt-1">{ln.translit}</div>
                {showTrans && (
                  <div className="text-sky-200/80 text-[13px] mt-1">{ln.en}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={() => setShowTrans((s) => !s)}
          className="text-sky-300 hover:text-sky-200 text-xs underline"
        >
          {showTrans ? "Hide English" : "Show English"}
        </button>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="text-white font-semibold mb-3">{activity.question}</div>
        <div className="grid gap-2">
          {activity.choices.map((c, i) => {
            const isChosen = chosen === i;
            const isCorrect = i === activity.correctIndex;
            let cls = "rounded-lg border px-4 py-3 font-medium text-left transition-all text-white ";
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
