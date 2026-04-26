/**
 * OnboardingDashboard.tsx — two-pane view of all onboarding
 * instances:
 *
 *   · Left pane:  list of instances (search + filter by status)
 *   · Right pane: detail view with task checklist, owner badges,
 *                 progress bar, and owner-gated checkboxes
 *
 * For CEO / Admin roles this is the full fleet. For anyone else,
 * RLS in Supabase filters the list to their own instance(s) — so
 * the SAME component doubles as the employee-facing view. No
 * separate employee route needed.
 *
 * Owner gating: employer-owned items are only checkable by admins,
 * employee-owned items only by the employee themselves. The UI
 * shows ALL items to both parties so each knows what the other is
 * responsible for; just the checkboxes are gated.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, Search, Loader2, CheckCircle2, Circle, Building2,
  User, Clock, Filter, AlertTriangle, Sparkles, RotateCcw,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { ProvisionOnboarding } from "./ProvisionOnboarding";
import { TemplateManager } from "./TemplateManager";
import { resetAllWelcomeFlags } from "./onboardingDebug";

// ── Types ──────────────────────────────────────────────────────

type OnboardingStatus = "active" | "completed" | "paused" | "cancelled";
type ItemStatus = "pending" | "complete" | "skipped" | "blocked";
type ItemOwner = "employer" | "employee";

interface OnboardingInstance {
  id: string;
  offer_letter_id: string | null;
  employee_user_id: string | null;
  template_id: string | null;
  status: OnboardingStatus;
  started_at: string;
  completed_at: string | null;
  // Joined convenience fields (we fetch these via separate queries
  // and stitch client-side since the offer_letters / app_users
  // joins require extra RLS wiggle in some environments).
  _candidateName?: string;
  _positionTitle?: string;
  _employerLegalName?: string;
  _brand?: string;
}

interface OnboardingItem {
  id: string;
  instance_id: string;
  title: string;
  description: string | null;
  owner: ItemOwner;
  position: number;
  status: ItemStatus;
  completed_at: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
}

// ── Role helpers ───────────────────────────────────────────────

function useIsAdmin() {
  const { data: user } = ActiveUser();
  const role = user?.[0]?.role ?? "";
  return ["CEO", "COO", "CFO", "Admin"].includes(role as string);
}

function useCurrentSupaId(): string | null {
  const { data: user } = ActiveUser();
  return (user?.[0] as any)?.supa_id ?? null;
}

// ── Main component ─────────────────────────────────────────────

export function OnboardingDashboard() {
  const isAdmin = useIsAdmin();
  const mySupaId = useCurrentSupaId();

  const [instances, setInstances] = useState<OnboardingInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<OnboardingStatus | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProvision, setShowProvision] = useState(false);
  const [activeTab, setActiveTab] = useState<"instances" | "templates">("instances");

  // Fetch instances (RLS handles the employee vs admin filtering).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInstances(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from("onboarding_instances")
        .select("id, offer_letter_id, employee_user_id, template_id, status, started_at, completed_at")
        .order("started_at", { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setInstances([]);
        setLoadingInstances(false);
        return;
      }

      // Stitch in candidate info from offer_letters — best-effort.
      const withOffers: OnboardingInstance[] = [...(data ?? [])] as any;
      const offerIds = Array.from(
        new Set(withOffers.map((i) => i.offer_letter_id).filter(Boolean)),
      ) as string[];

      if (offerIds.length > 0) {
        const offers = await supabase
          .from("offer_letters")
          .select("id, candidate_name, position_title, employer_legal_name, brand")
          .in("id", offerIds);
        if (!offers.error && offers.data) {
          const byId = new Map(offers.data.map((o: any) => [o.id, o]));
          for (const inst of withOffers) {
            const o = inst.offer_letter_id ? byId.get(inst.offer_letter_id) : null;
            if (o) {
              inst._candidateName = (o as any).candidate_name;
              inst._positionTitle = (o as any).position_title;
              inst._employerLegalName = (o as any).employer_legal_name;
              inst._brand = (o as any).brand;
            }
          }
        }
      }

      // Auto-provisioned instances have offer_letter_id = null — fall
      // back to looking the hire up in app_users for a real name.
      const userIds = Array.from(
        new Set(
          withOffers
            .filter((i) => !i._candidateName && i.employee_user_id)
            .map((i) => i.employee_user_id!),
        ),
      );
      if (userIds.length > 0) {
        const users = await supabase
          .from("app_users")
          .select("supa_id, username, role")
          .in("supa_id", userIds);
        if (!users.error && users.data) {
          const userById = new Map(
            (users.data as Array<{ supa_id: string; username?: string; role?: string }>)
              .map((u) => [u.supa_id, u]),
          );
          for (const inst of withOffers) {
            if (!inst._candidateName && inst.employee_user_id) {
              const u = userById.get(inst.employee_user_id);
              if (u) {
                inst._candidateName = u.username ?? "Unknown hire";
                inst._positionTitle = u.role ?? "—";
              }
            }
          }
        }
      }

      setInstances(withOffers);
      setLoadingInstances(false);

      // Auto-select: prefer an employee's own instance if they're non-admin
      // and have exactly one; otherwise select the first active one for admins.
      if (!selectedId) {
        if (!isAdmin && withOffers.length === 1) {
          setSelectedId(withOffers[0]!.id);
        } else {
          const firstActive = withOffers.find((i) => i.status === "active");
          if (firstActive) setSelectedId(firstActive.id);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]); // selectedId intentionally excluded — only auto-select once

  // Listen for "onboarding:focus" events fired by the banner\'s
  // Continue button. When fired, switch the active tab to Instances
  // and select the requested instance so the right pane shows it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ instanceId?: string }>).detail;
      if (!detail?.instanceId) return;
      setActiveTab("instances");
      setSelectedId(detail.instanceId);
      // Scroll the right pane into view (helps when the banner is
      // pinned and the dashboard sits below the fold).
      requestAnimationFrame(() => {
        const main = document.querySelector(
          "[data-onboarding-detail]",
        ) as HTMLElement | null;
        main?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("onboarding:focus", handler);
    return () => window.removeEventListener("onboarding:focus", handler);
  }, []);

  // Filter + search.
  const filteredInstances = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return instances.filter((i) => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (!needle) return true;
      const hay = `${i._candidateName ?? ""} ${i._positionTitle ?? ""} ${i._employerLegalName ?? ""}`
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [instances, filterStatus, searchQuery]);

  const selected = instances.find((i) => i.id === selectedId) ?? null;

  // Inbox-style stats — counts that read across the top of the page.
  const activeCount = instances.filter((i) => i.status === "active").length;
  const completedCount = instances.filter((i) => i.status === "completed").length;
  const allHires = instances.length;

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col">
      {/* ── Header — icon tile + title stack on the left, stats + admin
            actions on the right (inbox-style). ──────────────────── */}
      <header className="flex items-start justify-between gap-6 border-b border-border/50 px-7 py-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-foreground tracking-tight">Onboarding</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed max-w-[640px]">
              {isAdmin
                ? "All active and completed onboarding flows. Auto-provisioned on first sign-in, or convert an accepted offer to spawn one."
                : "Your onboarding tasks. Check off items as you complete them."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Inline stats — only on Instances tab */}
          {activeTab === "instances" && (
            <div className="flex items-center gap-3 text-[11px]">
              <Stat icon={ClipboardCheck} value={allHires} label="hires" />
              <Stat icon={CheckCircle2} value={activeCount} label="active" tone={activeCount > 0 ? "good" : "muted"} />
              {completedCount > 0 && (
                <Stat icon={Circle} value={completedCount} label="done" tone="muted" />
              )}
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const cleared = resetAllWelcomeFlags();
                  alert(
                    cleared > 0
                      ? `Cleared ${cleared} welcome flag${cleared === 1 ? "" : "s"} on this device. Sign in as the test user to retest the welcome modal.`
                      : "No welcome flags were set on this device.",
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Clear all cwa-welcomed-* localStorage flags so the welcome modal fires again on next sign-in (this device only)"
              >
                <RotateCcw className="h-3 w-3" />
                Reset welcome
              </button>
              <button
                type="button"
                onClick={() => setShowProvision(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                title="Manually create an onboarding instance for any user without one"
              >
                <Sparkles className="h-3 w-3" />
                Provision onboarding
              </button>
            </div>
          )}
        </div>
      </header>

      {isAdmin && (
        <nav className="flex items-center gap-0 border-b border-border/40 px-7">
          <TabBtn
            active={activeTab === "instances"}
            onClick={() => setActiveTab("instances")}
            label="Instances"
          />
          <TabBtn
            active={activeTab === "templates"}
            onClick={() => setActiveTab("templates")}
            label="Templates"
          />
        </nav>
      )}

      {showProvision && (
        <ProvisionOnboarding onClose={() => setShowProvision(false)} />
      )}

      {loadError && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11.5px] text-amber-200">
              {loadError.toLowerCase().includes("does not exist")
                ? "Onboarding tables aren't set up. Run migrations/onboarding_init.sql on your Supabase project."
                : loadError}
            </p>
          </div>
        </div>
      )}

      {activeTab === "templates" && isAdmin ? (
        <TemplateManager />
      ) : (
      <div className="flex flex-1 min-h-[640px]">
        {/* Left pane — instance list */}
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-border/40 bg-card/30 min-h-[640px]">
          {/* Search + filter strip — taller, denser, inbox-style. */}
          <div className="border-b border-border/40 px-4 py-3.5 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="text"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-[12px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground/70 mr-0.5" />
              {(["active", "completed", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  data-active={filterStatus === s}
                  className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold capitalize transition-colors text-muted-foreground hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                >
                  {s}
                </button>
              ))}
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
                {filteredInstances.length} {filteredInstances.length === 1 ? "result" : "results"}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loadingInstances ? (
              <div className="flex items-center justify-center gap-2 p-4 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                  <ClipboardCheck className="h-6 w-6" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card" />
                </div>
                <h3 className="text-[13.5px] font-bold text-foreground">
                  {searchQuery ? "No matches" : "Inbox clear"}
                </h3>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                  {searchQuery
                    ? "Nothing matches your search. Try a different name or clear the filter."
                    : isAdmin
                      ? "No onboarding in progress. Convert an accepted offer or click Provision onboarding to start one."
                      : "You have no active onboarding tasks. Nice work."}
                </p>
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filteredInstances.map((i) => {
                  const active = i.id === selectedId;
                  const isMine = !!mySupaId && i.employee_user_id === mySupaId;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(i.id)}
                        data-active={active}
                        className="group w-full rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 text-left transition-all hover:bg-card hover:border-border data-[active=true]:border-primary/50 data-[active=true]:bg-primary/[0.06] data-[active=true]:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-foreground truncate">
                            {i._candidateName ?? "Unknown hire"}
                          </p>
                          <StatusPill status={i.status} />
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground truncate">
                          {i._positionTitle ?? "—"}
                          {i._employerLegalName && ` · ${i._employerLegalName}`}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {new Date(i.started_at).toLocaleDateString()}
                          {isMine && <span className="ml-1.5 text-primary font-semibold">· yours</span>}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right pane — detail */}
        <main data-onboarding-detail className="flex-1 min-h-[640px] overflow-y-auto">
          {selected ? (
            <InstanceDetail
              instance={selected}
              isAdmin={isAdmin}
              mySupaId={mySupaId}
              onChanged={() => {
                // Re-fetch the parent instance to reflect status changes
                // triggered by the completion-sync Postgres trigger.
                (async () => {
                  const { data } = await supabase
                    .from("onboarding_instances")
                    .select("id, status, completed_at")
                    .eq("id", selected.id)
                    .maybeSingle();
                  if (data) {
                    setInstances((arr) =>
                      arr.map((i) => (i.id === selected.id
                        ? { ...i, status: (data as any).status, completed_at: (data as any).completed_at }
                        : i)),
                    );
                  }
                })();
              }}
            />
          ) : (
            <EmptyMain
              hasResults={filteredInstances.length > 0}
              isAdmin={isAdmin}
              onProvision={() => setShowProvision(true)}
            />
          )}
        </main>
      </div>
      )}
    </div>
  );
}

// ── Instance detail pane ───────────────────────────────────────

function InstanceDetail({
  instance, isAdmin, mySupaId, onChanged,
}: {
  instance: OnboardingInstance;
  isAdmin: boolean;
  mySupaId: string | null;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isOwnInstance = !!mySupaId && instance.employee_user_id === mySupaId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await supabase
        .from("onboarding_items")
        .select("id, instance_id, title, description, owner, position, status, completed_at, completed_by_user_id, notes")
        .eq("instance_id", instance.id)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        setItems([]);
      } else {
        setItems((res.data ?? []) as OnboardingItem[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instance.id]);

  const canToggle = (item: OnboardingItem): boolean => {
    if (item.status !== "pending" && item.status !== "complete") return false;
    if (item.owner === "employer") return isAdmin;
    if (item.owner === "employee") return isOwnInstance;
    return false;
  };

  const toggle = async (item: OnboardingItem) => {
    if (!canToggle(item)) return;
    setUpdatingId(item.id);
    const nextStatus = item.status === "complete" ? "pending" : "complete";
    const patch = nextStatus === "complete"
      ? {
          status: "complete" as ItemStatus,
          completed_at: new Date().toISOString(),
          completed_by_user_id: mySupaId,
        }
      : {
          status: "pending" as ItemStatus,
          completed_at: null,
          completed_by_user_id: null,
        };
    const res = await supabase
      .from("onboarding_items")
      .update(patch)
      .eq("id", item.id);
    if (res.error) {
      setError(`Update failed: ${res.error.message}`);
      setUpdatingId(null);
      return;
    }
    setItems((arr) => arr.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
    setUpdatingId(null);
    onChanged();
  };

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter((x) => x.status === "complete" || x.status === "skipped").length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  const employerItems = items.filter((x) => x.owner === "employer");
  const employeeItems = items.filter((x) => x.owner === "employee");

  return (
    <div className="p-6 space-y-5">
      {/* Header card */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Onboarding
            </p>
            <h2 className="text-[17px] font-bold text-foreground">
              {instance._candidateName ?? "Unknown hire"}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {instance._positionTitle ?? "—"}
              {instance._employerLegalName && ` · ${instance._employerLegalName}`}
            </p>
            <p className="mt-1 text-[10.5px] text-muted-foreground/80">
              Started {new Date(instance.started_at).toLocaleString()}
              {instance.completed_at && ` · Completed ${new Date(instance.completed_at).toLocaleString()}`}
            </p>
          </div>
          <StatusPill status={instance.status} large />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-semibold text-foreground">Progress</span>
            <span className="text-muted-foreground">
              {progress.done}/{progress.total} · {progress.pct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </p>
      )}

      {/* Task groups */}
      {loading ? (
        <div className="flex items-center gap-2 p-3 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tasks…
        </div>
      ) : (
        <div className="space-y-5">
          <TaskGroup
            icon={Building2}
            label="Employer tasks"
            sublabel={
              isAdmin
                ? "You check these off as you provision access, hardware, payroll, etc."
                : "The hiring team handles these on their end."
            }
            items={employerItems}
            canToggle={canToggle}
            toggle={toggle}
            updatingId={updatingId}
          />
          <TaskGroup
            icon={User}
            label="Your tasks"
            sublabel={
              isOwnInstance
                ? "You check these off as you complete them."
                : "Tasks for the new hire to complete."
            }
            items={employeeItems}
            canToggle={canToggle}
            toggle={toggle}
            updatingId={updatingId}
          />
        </div>
      )}
    </div>
  );
}

// ── Task group ─────────────────────────────────────────────────

function TaskGroup({
  icon: Icon, label, sublabel, items, canToggle, toggle, updatingId,
}: {
  icon: typeof Building2;
  label: string;
  sublabel: string;
  items: OnboardingItem[];
  canToggle: (item: OnboardingItem) => boolean;
  toggle: (item: OnboardingItem) => void;
  updatingId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </h3>
        <span className="text-[10.5px] text-muted-foreground/70">· {sublabel}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const done = item.status === "complete";
          const interactive = canToggle(item);
          const loading = updatingId === item.id;
          return (
            <li
              key={item.id}
              className={[
                "rounded-md border p-3 transition-colors",
                done
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/60 bg-background/40",
                interactive && !loading ? "cursor-pointer hover:border-primary/40" : "",
              ].join(" ")}
              onClick={() => interactive && !loading && toggle(item)}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className={`h-4 w-4 ${interactive ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      "text-[13px] font-semibold leading-tight",
                      done ? "text-foreground/80 line-through" : "text-foreground",
                    ].join(" ")}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
                      {item.description}
                    </p>
                  )}
                  {done && item.completed_at && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(item.completed_at).toLocaleString()}
                    </p>
                  )}
                  {!interactive && !done && (
                    <p className="mt-1 text-[10px] text-muted-foreground/60 italic">
                      {item.owner === "employer"
                        ? "Waiting on the hiring team."
                        : "Waiting on the new hire."}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Status pill ────────────────────────────────────────────────

function StatusPill({
  status, large,
}: {
  status: OnboardingStatus;
  large?: boolean;
}) {
  const config: Record<OnboardingStatus, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "border-primary/40 bg-primary/10 text-primary" },
    completed: { label: "Complete",  cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
    paused:    { label: "Paused",    cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    cancelled: { label: "Cancelled", cls: "border-zinc-600/40 bg-zinc-700/10 text-zinc-400" },
  };
  const c = config[status];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold whitespace-nowrap",
        large ? "text-[11px]" : "text-[10px]",
        c.cls,
      ].join(" ")}
    >
      {c.label}
    </span>
  );
}


// ── Right-pane empty state — full-bleed, ghost-preview style ─────

function EmptyMain({
  hasResults, isAdmin, onProvision,
}: {
  hasResults: boolean;
  isAdmin: boolean;
  onProvision: () => void;
}) {
  const ghostTasks = [
    { label: "Sign NDA + IP assignment", owner: "employee" },
    { label: "Provision laptop / equipment", owner: "employer" },
    { label: "Add to payroll system", owner: "employer" },
    { label: "Read company handbook", owner: "employee" },
    { label: "Set up tooling access (email, chat, repos)", owner: "employee" },
    { label: "Schedule first 1:1 with hiring manager", owner: "employer" },
    { label: "Send team introductions", owner: "employee" },
  ] as const;

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      {/* Hero strip — title + CTA, full width */}
      <div className="border-b border-border/40 px-8 py-7 bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="flex items-start justify-between gap-6 max-w-[1100px] mx-auto">
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shrink-0">
              <ClipboardCheck className="h-7 w-7" />
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-[3px] ring-background" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold text-foreground tracking-tight">
                {hasResults ? "Pick an onboarding" : "Inbox zero"}
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed max-w-[640px]">
                {hasResults
                  ? "Select a hire from the left to see their checklist, owner badges, and progress. Owner-gated checkboxes make sure each task lands with the right person."
                  : "No active onboarding flows right now. Auto-provision runs on every sign-in, and you can manually spawn one for any user via the button above."}
              </p>
            </div>
          </div>
          {isAdmin && !hasResults && (
            <button
              type="button"
              onClick={onProvision}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Provision onboarding
            </button>
          )}
        </div>
      </div>

      {/* Ghost preview — what a populated checklist would look like */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-7">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
              Preview · what a checklist looks like
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <ul className="space-y-1.5 opacity-50 pointer-events-none select-none">
            {ghostTasks.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-md border border-border/60 bg-background shrink-0"
                />
                <span className="text-[10px] tabular-nums text-muted-foreground/60 font-mono w-6 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 min-w-0 text-[12.5px] font-medium text-foreground/80 truncate">
                  {t.label}
                </span>
                <span
                  className={[
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold border",
                    t.owner === "employee"
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border",
                  ].join(" ")}
                >
                  {t.owner}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
            {hasResults
              ? "Click a hire on the left to load their real checklist."
              : "When a hire signs in, their personalized checklist replaces this preview."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Inbox-style header helpers ──────────────────────────

function Stat({
  icon: Icon, value, label, tone,
}: {
  icon: typeof ClipboardCheck;
  value: number;
  label: string;
  tone?: "good" | "muted";
}) {
  const dotCls =
    tone === "good"
      ? "bg-emerald-400"
      : tone === "muted"
        ? "bg-muted-foreground/40"
        : "bg-primary";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-2.5 py-1.5 text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span className="tabular-nums font-semibold text-foreground">{value}</span>
      <span className="text-[10.5px] uppercase tracking-wider">{label}</span>
      <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${dotCls}`} />
    </span>
  );
}

function TabBtn({
  active, onClick, label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className="relative px-4 py-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground data-[active=true]:text-foreground transition-colors"
    >
      {label}
      <span
        aria-hidden
        className="absolute inset-x-3 bottom-0 h-[2px] rounded-t-full bg-primary opacity-0 data-[a=true]:opacity-100"
        data-a={active}
      />
    </button>
  );
}
