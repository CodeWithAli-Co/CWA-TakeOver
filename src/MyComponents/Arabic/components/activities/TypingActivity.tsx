// ============================================================================
// Typing activity — user types transliteration (diacritics-agnostic).
// ============================================================================

import { useState } from "react";
import type { TypingActivity as TType } from "../../types";
import { ActivityCallbacks, FeedbackBanner, isAnswerCorrect } from "./shared";

export function TypingActivity({
  activity,
  cb,
}: {
  activity: TType;
  cb: ActivityCallbacks;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");

  const submit = () => {
    if (state !== "idle" || !value.trim()) return;
    const ok = isAnswerCorrect(value, activity.expected, activity.altAccepted);
    setState(ok ? "correct" : "wrong");
    cb.onResult(ok, value);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white/90 text-center">{activity.prompt}</h3>

      <div className="max-w-md mx-auto">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={state !== "idle"}
          placeholder="Type your answer…"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white text-lg outline-none focus:border-sky-400 focus:bg-white/[0.08] disabled:opacity-60"
        />
        {activity.hint && (
          <div className="text-white/40 text-xs italic text-center mt-2">Hint: {activity.hint}</div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={submit}
          disabled={state !== "idle" || !value.trim()}
          className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold disabled:opacity-50"
        >
          Check
        </button>
      </div>

      <FeedbackBanner
        state={state}
        onNext={cb.onNext}
        explain={state === "wrong" ? `The expected answer was: ${activity.expected}` : undefined}
      />
    </div>
  );
}
