/**
 * OnboardingBanner.tsx — persistent progress strip shown at the top
 * of the app when the current user has an active onboarding.
 *
 * Fetches the current user's own onboarding_instance (RLS narrows
 * to just theirs) plus item progress. Hides automatically when the
 * instance is `completed`, `cancelled`, or not present.
 *
 * Can be dismissed for the current session via localStorage
 * (per-user + per-instance key). Re-appears on next sign-in or
 * after instance status changes. Simple; not trying to be a
 * full notification system.
 *
 * Mounted globally from __root.tsx so new hires see it across
 * every route until they finish their tasks.
 */

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ArrowRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";

interface Instance {
  id: string;
  status: "active" | "completed" | "paused" | "cancelled";
}

interface Counts {
  total: number;
  done: number;
}

export function OnboardingBanner() {
  const { data: activeUser } = ActiveUser();
  const me = activeUser?.[0];
  const mySupaId = me?.supa_id as string | undefined;
  const navigate = useNavigate();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [hidden, setHidden] = useState(false);

  // Load user's active instance + item counts.
  useEffect(() => {
    if (!mySupaId) return;
    let cancelled = false;

    (async () => {
      // First: find the active instance for THIS user.
      const inst = await supabase
        .from("onboarding_instances")
        .select("id, status")
        .eq("employee_user_id", mySupaId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      // Table-missing error → show nothing, don't crash.
      if (inst.error) {
        setInstance(null);
        return;
      }
      const i = (inst.data as Instance | null) ?? null;
      setInstance(i);
      if (!i) return;

      // Then: count completed vs total items.
      const all = await supabase
        .from("onboarding_items")
        .select("status", { count: "exact" })
        .eq("instance_id", i.id);
      if (cancelled || all.error) return;
      const rows = (all.data ?? []) as Array<{ status: string }>;
      const total = rows.length;
      const done = rows.filter(
        (r) => r.status === "complete" || r.status === "skipped",
      ).length;
      setCounts({ total, done });
    })();

    return () => { cancelled = true; };
  }, [mySupaId]);

  // Per-user, per-instance session dismissal. Persists only for
  // this session — localStorage keeps it dismissed across route
  // changes but NOT across fresh sign-ins.
  const dismissKey = useMemo(
    () => (instance ? `cwa-onb-banner-dismissed-${instance.id}` : null),
    [instance],
  );
  useEffect(() => {
    if (!dismissKey) return;
    try {
      setHidden(window.sessionStorage.getItem(dismissKey) === "1");
    } catch { /* noop */ }
  }, [dismissKey]);

  if (!instance || !counts || hidden) return null;
  if (instance.status !== "active") return null;
  if (counts.total === 0) return null;

  const pct = Math.round((counts.done / counts.total) * 100);
  const allDone = counts.done >= counts.total;

  const dismiss = () => {
    if (dismissKey) {
      try { window.sessionStorage.setItem(dismissKey, "1"); } catch {}
    }
    setHidden(true);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-primary/30 bg-primary/[0.08] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2">
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-primary" />

        <div className="min-w-0 flex-1 flex items-center gap-3">
          <span className="text-[12px] font-semibold text-foreground whitespace-nowrap">
            Onboarding
          </span>
          <span className="text-[11.5px] text-foreground/80 whitespace-nowrap">
            {counts.done} of {counts.total} done
          </span>
          {/* Progress bar */}
          <div className="hidden md:block flex-1 min-w-[80px] max-w-[260px] h-1 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="hidden md:inline text-[10.5px] tabular-nums text-muted-foreground whitespace-nowrap">
            {pct}%
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            const instanceId = instance?.id;
            // Navigate first; on /onboarding already? still fine — the
            // event listener below will auto-select the instance even
            // when the URL doesn\'t actually change.
            navigate({ to: "/onboarding" }).catch(() => {});
            // Tiny delay so the dashboard is mounted before we
            // dispatch — covers the cold-load case.
            setTimeout(() => {
              if (instanceId) {
                window.dispatchEvent(
                  new CustomEvent("onboarding:focus", { detail: { instanceId } }),
                );
              }
            }, 50);
          }}
          className="inline-flex items-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {allDone ? "Review" : "Continue"}
          <ArrowRight className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Hide onboarding banner"
          title="Hide for this session"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
