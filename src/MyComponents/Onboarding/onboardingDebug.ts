/**
 * onboardingDebug.ts — diagnostic helpers for the welcome-modal +
 * onboarding-banner gates. Used by WelcomeModal in dev to console.log
 * exactly which gate is blocking, and by the OnboardingDashboard's
 * admin tools to reset the localStorage welcome flag.
 */

import { takeOversupabase } from "@/MyComponents/supabase";

export interface WelcomeGateReport {
  supaId: string;
  hasInstance: boolean;
  instanceError?: string;
  createdAtMs: number | null;
  ageDays: number | null;
  recentEnough: boolean;
  localStorageBlocked: boolean;
  willShow: boolean;
  reasonNotShown?: string;
}

const RECENT_DAYS = 14;

/** Run every gate the WelcomeModal checks and return a structured
 *  report. Pure read; safe to call any time. */
export async function whyWelcomeGated(args: {
  supaId: string;
  createdAt: string | null | undefined;
}): Promise<WelcomeGateReport> {
  const { supaId, createdAt } = args;
  const out: WelcomeGateReport = {
    supaId,
    hasInstance: false,
    createdAtMs: null,
    ageDays: null,
    recentEnough: false,
    localStorageBlocked: false,
    willShow: false,
  };

  // localStorage gate
  try {
    const v = window.localStorage.getItem(`cwa-welcomed-${supaId}`);
    out.localStorageBlocked = v === "1";
  } catch { /* noop */ }

  // onboarding_instances probe
  try {
    const { data, error } = await takeOversupabase
.from("onboarding_instances")
      .select("id")
      .eq("employee_user_id", supaId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) out.instanceError = error.message;
    out.hasInstance = !!data;
  } catch (e) {
    out.instanceError = (e as Error).message;
  }

  // recency
  if (createdAt) {
    const ms = Date.parse(createdAt);
    if (!Number.isNaN(ms)) {
      out.createdAtMs = ms;
      out.ageDays = Math.floor((Date.now() - ms) / 86400000);
      out.recentEnough = out.ageDays <= RECENT_DAYS;
    }
  }

  // Final decision (mirrors WelcomeModal logic)
  if (out.localStorageBlocked) {
    out.reasonNotShown = "localStorage cwa-welcomed-* is set to '1' for this device.";
  } else if (out.hasInstance) {
    out.willShow = true;
  } else if (out.recentEnough) {
    out.willShow = true;
  } else if (out.createdAtMs === null) {
    out.reasonNotShown =
      "User row has no created_at value — primary fallback can't fire.";
  } else {
    out.reasonNotShown = `User has no active onboarding instance AND account is ${out.ageDays}d old (>${RECENT_DAYS}d window).`;
  }

  return out;
}

/** Clear the localStorage welcome flag for a given user on THIS device.
 *  Useful after dismissing the modal in dev to retest. */
export function resetWelcomeFor(supaId: string): boolean {
  try {
    window.localStorage.removeItem(`cwa-welcomed-${supaId}`);
    return true;
  } catch {
    return false;
  }
}

/** Clear EVERY cwa-welcomed-* key on this device. */
export function resetAllWelcomeFlags(): number {
  let count = 0;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("cwa-welcomed-")) {
        window.localStorage.removeItem(k);
        count++;
      }
    }
  } catch { /* noop */ }
  return count;
}
