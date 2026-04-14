// ============================================================================
// Matching pairs renderer — tap one Arabic, tap one English; correct pairs lock.
// Credits "correct" when all pairs are matched without any wrong pairings.
// ============================================================================

import { useState } from "react";
import type { MatchActivity as MatchType } from "../../types";
import { ActivityCallbacks, FeedbackBanner } from "./shared";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchActivity({
  activity,
  cb,
}: {
  activity: MatchType;
  cb: ActivityCallbacks;
}) {
  const pairs = activity.pairs;
  const [arOrder] = useState(() => shuffle(pairs.map((_, i) => i)));
  const [enOrder] = useState(() => shuffle(pairs.map((_, i) => i)));

  const [pickedAr, setPickedAr] = useState<number | null>(null);
  const [pickedEn, setPickedEn] = useState<number | null>(null);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<[number, number] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [state, setState] = useState<"idle" | "correct" | "wrong">("idle");

  const tryLock = (a: number, e: number) => {
    if (a === e) {
      const nextLocked = new Set(locked);
      nextLocked.add(a);
      setLocked(nextLocked);
      setPickedAr(null);
      setPickedEn(null);
      if (nextLocked.size === pairs.length) {
        const allRight = mistakes === 0;
        setState(allRight ? "correct" : "wrong");
        cb.onResult(allRight);
      }
    } else {
      setWrongFlash([a, e]);
      setMistakes((m) => m + 1);
      setTimeout(() => {
        setWrongFlash(null);
        setPickedAr(null);
        setPickedEn(null);
      }, 550);
    }
  };

  const pickAr = (i: number) => {
    if (state !== "idle" || locked.has(i)) return;
    setPickedAr(i);
    if (pickedEn !== null) tryLock(i, pickedEn);
  };
  const pickEn = (i: number) => {
    if (state !== "idle" || locked.has(i)) return;
    setPickedEn(i);
    if (pickedAr !== null) tryLock(pickedAr, i);
  };

  const arCls = (i: number) => {
    const base = "rounded-xl border px-3 py-3 text-center font-serif text-2xl transition-all ";
    if (locked.has(i)) return base + "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
    if (wrongFlash && (wrongFlash[0] === i)) return base + "border-amber-500/50 bg-amber-500/20 text-amber-100";
    if (pickedAr === i) return base + "border-sky-500/60 bg-sky-500/20 text-sky-50";
    return base + "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] cursor-pointer";
  };

  const enCls = (i: number) => {
    const base = "rounded-xl border px-3 py-3 text-center text-sm font-medium transition-all ";
    if (locked.has(i)) return base + "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
    if (wrongFlash && (wrongFlash[1] === i)) return base + "border-amber-500/50 bg-amber-500/20 text-amber-100";
    if (pickedEn === i) return base + "border-sky-500/60 bg-sky-500/20 text-sky-50";
    return base + "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] cursor-pointer";
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white/85 text-center">{activity.prompt}</h3>

      <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-white/40 text-center">Arabic</div>
          {arOrder.map((i) => (
            <button key={"ar" + i} onClick={() => pickAr(i)} className={arCls(i) + " w-full"} dir="rtl">
              {pairs[i].ar}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-white/40 text-center">English</div>
          {enOrder.map((i) => (
            <button key={"en" + i} onClick={() => pickEn(i)} className={enCls(i) + " w-full"}>
              {pairs[i].en}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-white/50">
        {locked.size} / {pairs.length} matched · {mistakes} mistakes
      </div>

      <FeedbackBanner
        state={state}
        onNext={cb.onNext}
        explain={
          state === "wrong"
            ? `You matched them all — but took ${mistakes} wrong tries. Come back and try for a clean run.`
            : undefined
        }
      />
    </div>
  );
}
