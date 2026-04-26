// ───────────────────────────────────────────────────────────────────
// Ensemble phase signal — module-level pub-sub for the active ensemble
// agent (architect | engineer | critic | null).
//
// The ensemble engine sets this as it transitions through phases. The
// AxonProvider subscribes and mirrors it into React state so the Orb
// (and any other UI surface) can read it via useAxon(). Same pattern
// as simulationFlag.ts — keeps the engine free of React imports while
// still letting the UI react in real time.
// ───────────────────────────────────────────────────────────────────

export type EnsemblePhase = "architect" | "engineer" | "critic" | null;

let _phase: EnsemblePhase = null;
const _listeners = new Set<(p: EnsemblePhase) => void>();

export function getEnsemblePhase(): EnsemblePhase {
  return _phase;
}

export function setEnsemblePhase(p: EnsemblePhase): void {
  if (_phase === p) return;
  _phase = p;
  for (const fn of _listeners) {
    try { fn(p); } catch { /* ignore listener errors */ }
  }
}

export function subscribeEnsemblePhase(fn: (p: EnsemblePhase) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
