/**
 * focus.ts — cross-tab navigation. Anything can request that a node / finding /
 * route / scenario / asset be focused; the shell switches to its tab and the
 * target tab opens it. Powers deep-links and the Cmd+K command palette.
 */
import { useSyncExternalStore } from "react";

export type FocusTab = "overview" | "map" | "security" | "data" | "scenarios";
export type FocusKind = "node" | "finding" | "route" | "asset" | "scenario";
export interface FocusReq { tab: FocusTab; kind: FocusKind; id: string; nonce: number }

const TAB_FOR: Record<FocusKind, FocusTab> = {
  node: "map", finding: "security", route: "data", asset: "data", scenario: "scenarios",
};

let current: FocusReq | null = null;
let n = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function requestFocus(kind: FocusKind, id: string) {
  current = { tab: TAB_FOR[kind], kind, id, nonce: ++n };
  emit();
}
export function clearFocus() { if (current) { current = null; emit(); } }

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function useFocus(): FocusReq | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
