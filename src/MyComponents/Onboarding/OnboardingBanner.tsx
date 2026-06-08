/**
 * OnboardingBanner.tsx — persistent progress strip with split status
 * (your tasks vs employer tasks), live realtime sync, and a one-time
 * "Welcome to the team" celebration when the last task flips.
 *
 * Lives in __root.tsx so it shows on every page until the active
 * instance is `complete` / `cancelled`. Self-hides when the user
 * finishes everything.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, ArrowRight, X, PartyPopper, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { companySupabase } from "@/routes/index.lazy";
import { ActiveUser } from "@/stores/query";
import { useTourStore } from "./tourStore";
import { DEFAULT_TOUR_STOPS } from "./tourSteps";

interface Instance {
  id: string;
  status: "active" | "completed" | "paused" | "cancelled";
}

interface ItemRow {
  id: string;
  status: "pending" | "complete" | "skipped" | "blocked";
  owner: "employer" | "employee";
}

interface SplitCounts {
  employee: { done: number; total: number };
  employer: { done: number; total: number };
}

export function OnboardingBanner() {
  const { data: activeUser } = ActiveUser();
  const me = activeUser?.[0];
  const mySupaId = me?.supa_id as string | undefined;
  const navigate = useNavigate();

  const [instance, setInstance] = useState<Instance | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [hidden, setHidden] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const wasAllDone = useRef(false);

  // ── Load instance + items ────────────────────────────────────
  const refetchItems = async (instanceId: string) => {
    const all = await companySupabase
.from("onboarding_items")
      .select("id, status, owner")
      .eq("instance_id", instanceId);
    if (!all.error && all.data) {
      setItems(all.data as ItemRow[]);
    }
  };

  useEffect(() => {
    if (!mySupaId) return;
    let cancelled = false;

    (async () => {
      const inst = await companySupabase
  .from("onboarding_instances")
        .select("id, status")
        .eq("employee_user_id", mySupaId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (inst.error) {
        setInstance(null);
        return;
      }
      const i = (inst.data as Instance | null) ?? null;
      setInstance(i);
      if (!i) return;

      await refetchItems(i.id);
    })();

    return () => { cancelled = true; };
  }, [mySupaId]);

  // ── Realtime — refetch on any change to this instance\'s items ─
  useEffect(() => {
    if (!instance?.id) return;
    const ch = companySupabase
      .channel(`onboarding-items-${instance.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "onboarding_items",
          filter: `instance_id=eq.${instance.id}`,
        },
        () => { refetchItems(instance.id); },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "onboarding_instances",
          filter: `id=eq.${instance.id}`,
        },
        (payload) => {
          const next = (payload.new as Instance | undefined) ?? null;
          if (next) setInstance(next);
        },
      )
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [instance?.id]);

  // ── Split counts ──────────────────────────────────────────────
  const split: SplitCounts = useMemo(() => {
    const out: SplitCounts = {
      employee: { done: 0, total: 0 },
      employer: { done: 0, total: 0 },
    };
    for (const it of items) {
      const slot = it.owner === "employer" ? out.employer : out.employee;
      slot.total += 1;
      if (it.status === "complete" || it.status === "skipped") slot.done += 1;
    }
    return out;
  }, [items]);

  const allDone =
    split.employee.total + split.employer.total > 0 &&
    split.employee.done + split.employer.done >=
      split.employee.total + split.employer.total;

  // ── Celebration trigger — fire once on transition to all-done ─
  useEffect(() => {
    if (allDone && !wasAllDone.current && instance?.id) {
      // Suppress if we\'ve already celebrated this instance on this device.
      const key = `cwa-onb-celebrated-${instance.id}`;
      try {
        if (window.localStorage.getItem(key) !== "1") {
          setShowCelebration(true);
          window.localStorage.setItem(key, "1");
          // No auto-dismiss anymore — the modal asks "Take the tour?"
          // and the user picks. Closing happens via the Maybe-later
          // button or the X.
        }
      } catch { /* noop */ }
    }
    wasAllDone.current = allDone;
  }, [allDone, instance?.id]);

  // ── Per-session dismiss for the persistent strip ──────────────
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

  // Banner hides if instance is closed / no items / dismissed.
  const showStrip =
    !!instance &&
    instance.status === "active" &&
    items.length > 0 &&
    !hidden;

  const dismissStrip = () => {
    if (dismissKey) {
      try { window.sessionStorage.setItem(dismissKey, "1"); } catch {}
    }
    setHidden(true);
  };

  const handleContinue = () => {
    // When all tasks are done, Continue kicks off the guided page tour
    // — that's the "what now?" answer the user needs after finishing
    // their list. Otherwise, jump them to /onboarding and pulse the
    // first pending task they own.
    if (allDone) {
      useTourStore.getState().start(DEFAULT_TOUR_STOPS);
      return;
    }
    const instanceId = instance?.id;
    navigate({ to: "/onboarding" }).catch(() => {});
    setTimeout(() => {
      if (instanceId) {
        window.dispatchEvent(
          new CustomEvent("onboarding:focus", {
            detail: { instanceId, focusFirstPending: true },
          }),
        );
      }
    }, 50);
  };

  return (
    <>
      {showStrip && (
        <SplitStrip
          allDone={allDone}
          split={split}
          onContinue={handleContinue}
          onDismiss={dismissStrip}
        />
      )}
      {showCelebration && (
        <CelebrationOverlay onClose={() => setShowCelebration(false)} />
      )}
    </>
  );
}

// ── Split-status banner strip ─────────────────────────────────

function SplitStrip({
  allDone, split, onContinue, onDismiss,
}: {
  allDone: boolean;
  split: SplitCounts;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const empPct = pct(split.employee.done, split.employee.total);
  const erPct = pct(split.employer.done, split.employer.total);
  const totalDone = split.employee.done + split.employer.done;
  const totalAll = split.employee.total + split.employer.total;

  return (
    <div className="sticky top-0 z-40 border-b border-primary/30 bg-primary/[0.08] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2">
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-primary" />

        <div className="min-w-0 flex-1 flex items-center gap-3">
          <span className="text-[12px] font-semibold text-foreground whitespace-nowrap">
            Onboarding
          </span>
          <span className="text-[11px] text-foreground/80 whitespace-nowrap">
            {totalDone} of {totalAll} done
          </span>

          {/* Two segmented progress bars side by side */}
          <div className="hidden md:flex items-center gap-3 flex-1 min-w-0 max-w-[420px]">
            <SegmentedBar
              label="Yours"
              done={split.employee.done}
              total={split.employee.total}
              pctValue={empPct}
              tone="primary"
            />
            <SegmentedBar
              label="Employer"
              done={split.employer.done}
              total={split.employer.total}
              pctValue={erPct}
              tone="muted"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {allDone ? "Review" : "Continue"}
          <ArrowRight className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={onDismiss}
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

function SegmentedBar({
  label, done, total, pctValue, tone,
}: {
  label: string;
  done: number;
  total: number;
  pctValue: number;
  tone: "primary" | "muted";
}) {
  if (total === 0) return null;
  const fillCls =
    tone === "primary"
      ? "bg-primary"
      : "bg-muted-foreground/60";
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">
        {label}
      </span>
      <div className="h-1 flex-1 min-w-[40px] rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`h-full ${fillCls} transition-all duration-500`}
          style={{ width: `${pctValue}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}

function pct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

// ── Celebration overlay — one-time confetti moment ─────────────

function CelebrationOverlay({ onClose }: { onClose: () => void }) {
  const startTour = () => {
    useTourStore.getState().start(DEFAULT_TOUR_STOPS);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-background/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[460px] rounded-xl border border-primary/30 bg-card shadow-2xl pointer-events-auto"
        style={{ animation: "cwa-onb-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-6 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary mb-3">
            <PartyPopper className="h-7 w-7" />
          </div>
          <h2 className="text-[20px] font-bold text-foreground tracking-tight">
            Onboarding complete.
          </h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Welcome to the team. Want a quick tour of the app to see
            where everything lives?
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border/60 bg-transparent px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={startTour}
              className="rounded-md bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Take the 2-minute tour
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cwa-onb-pop {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cwa-onb-pulse-task {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--axon-accent-rgb, 248 113 113), 0); }
          25% { box-shadow: 0 0 0 6px rgba(var(--axon-accent-rgb, 248 113 113), 0.35); }
          50% { box-shadow: 0 0 0 12px rgba(var(--axon-accent-rgb, 248 113 113), 0); }
        }
        [data-pulse-task="true"] {
          animation: cwa-onb-pulse-task 1.2s ease-out 2;
        }
      `}</style>
    </div>
  );
}
