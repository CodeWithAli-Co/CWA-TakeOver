/**
 * OnboardingDashboard.tsx — cinematic 3-pane product view.
 *
 * Pixel-matched to the takeover-B2B candidate-profile mockup:
 *
 *   ┌── TRACKER BREADCRUMB ─────────────────────────────────────┐
 *   │ LEFT       │ CENTER HERO                  │ RIGHT (AXON) │
 *   │ ─────      │ ─────────                    │ ────────     │
 *   │ Instance   │ Avatar + score badge         │ Timeline     │
 *   │ list with  │ Display name + role          │ feed         │
 *   │ scores     │ CTAs (Schedule check-in /    │              │
 *   │            │ Send welcome)                │ AXON         │
 *   │            │ AXON verdict (brand-rail)    │ Suggests     │
 *   │            │ 2×2 metric grid              │              │
 *   │            │ Key-moment quote             │              │
 *   │            │ Task groups                  │              │
 *   ├────────────┴──────────────────────────────┴──────────────┤
 *   │ YOU · voice strip · AXON Ready                            │
 *   └───────────────────────────────────────────────────────────┘
 *
 * All Supabase queries + owner-gating + focus-event listener
 * preserved from the original implementation.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Search,
  Loader2,
  CheckCircle2,
  Circle,
  Building2,
  User,
  Clock,
  Filter,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Activity,
  ArrowRight,
  Calendar,
  Mail,
  FileText,
  Award,
  TrendingUp,
} from "lucide-react";
import { takeOversupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { ProvisionOnboarding } from "./ProvisionOnboarding";
import { TemplateManager } from "./TemplateManager";
import { resetAllWelcomeFlags } from "./onboardingDebug";

import { Tracker, TrackerDot } from "@/components/editorial/Tracker";
import { Mono } from "@/components/editorial/Mono";

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

function initialsFor(name?: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────

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

  // ─── Fetch instances ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInstances(true);
      setLoadError(null);

      const { data, error } = await takeOversupabase
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

      const withOffers: OnboardingInstance[] = [...(data ?? [])] as any;
      const offerIds = Array.from(
        new Set(withOffers.map((i) => i.offer_letter_id).filter(Boolean)),
      ) as string[];

      if (offerIds.length > 0) {
        const offers = await takeOversupabase
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

      const userIds = Array.from(
        new Set(
          withOffers
            .filter((i) => !i._candidateName && i.employee_user_id)
            .map((i) => i.employee_user_id!),
        ),
      );
      if (userIds.length > 0) {
        const users = await takeOversupabase
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
  }, [isAdmin]);

  // ─── Banner focus listener ────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ instanceId?: string; focusFirstPending?: boolean }>).detail;
      if (!detail?.instanceId) return;
      setActiveTab("instances");
      setSelectedId(detail.instanceId);
      requestAnimationFrame(() => {
        const main = document.querySelector("[data-onboarding-detail]") as HTMLElement | null;
        main?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (detail.focusFirstPending) {
        window.setTimeout(() => {
          const list = document.querySelectorAll<HTMLElement>(
            "[data-task-id][data-task-pending=\"true\"][data-task-mine=\"true\"]",
          );
          const first = list[0];
          if (first) {
            first.scrollIntoView({ behavior: "smooth", block: "center" });
            first.setAttribute("data-pulse-task", "true");
            window.setTimeout(() => first.removeAttribute("data-pulse-task"), 2600);
          }
        }, 220);
      }
    };
    window.addEventListener("onboarding:focus", handler);
    return () => window.removeEventListener("onboarding:focus", handler);
  }, []);

  // ─── Derived ─────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full min-h-[calc(100vh-2rem)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.04), transparent 60%), rgb(var(--ed-bg))",
        color: "rgb(var(--ed-fg))",
      }}
    >
      {/* ╔═══════════════════════════════════════════════════════
          TOP TRACKER BREADCRUMB
          ═══════════════════════════════════════════════════════ */}
      <div className="border-b border-ed px-7 lg:px-10 py-3.5">
        <div className="flex items-center justify-between gap-6">
          <Tracker tone="muted" size="sm">
            <TrackerDot color="rgb(var(--ed-brand))" />
            {selected
              ? `ONBOARDING · ${selected.status.toUpperCase()} · ${selected._candidateName ?? "UNKNOWN"} · ${selected._positionTitle ?? "ROLE"}`
              : "ONBOARDING · FLEET VIEW · SELECT A HIRE TO INSPECT"}
          </Tracker>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const cleared = resetAllWelcomeFlags();
                  alert(cleared > 0 ? `Cleared ${cleared} welcome flag${cleared === 1 ? "" : "s"}.` : "No welcome flags set.");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-ed px-2.5 py-1 text-[10.5px] font-bold text-ed-fg-muted hover:text-ed-fg hover:border-ed-strong uppercase tracking-wider transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset welcome
              </button>
              <button
                type="button"
                onClick={() => setShowProvision(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-ed-brand px-3 py-1 text-[11px] font-bold text-foreground hover:opacity-90 uppercase tracking-wider transition-opacity"
                style={{ boxShadow: "0 4px 16px -4px rgba(239,68,68,0.5)" }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                Provision
                <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin tabs */}
      {isAdmin && (
        <div className="border-b border-ed px-7 lg:px-10 flex items-center gap-0">
          <EditorialTab num="01" label="Instances" active={activeTab === "instances"} onClick={() => setActiveTab("instances")} />
          <EditorialTab num="02" label="Templates" active={activeTab === "templates"} onClick={() => setActiveTab("templates")} />
        </div>
      )}

      {showProvision && <ProvisionOnboarding onClose={() => setShowProvision(false)} />}

      {loadError && (
        <div className="mx-7 lg:mx-10 mt-5 rounded-lg border border-amber-500/40 p-4" style={{ background: "rgba(245,158,11,0.06)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
            <div>
              <Tracker tone="muted" size="sm" className="text-amber-300 mb-1">LOAD ERROR</Tracker>
              <p className="text-[12px] text-ed-fg-2">
                {loadError.toLowerCase().includes("does not exist")
                  ? "Onboarding tables aren't set up. Run migrations/onboarding_init.sql on your Supabase project."
                  : loadError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ╔═══════════════════════════════════════════════════════
          BODY — Templates OR 3-pane Instances
          ═══════════════════════════════════════════════════════ */}
      {activeTab === "templates" && isAdmin ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TemplateManager />
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[240px_1fr_320px]">
          {/* ─────────────── LEFT: instance list (darkest shade) ─────────────── */}
          <aside
            className="border-r border-ed flex flex-col min-h-0"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div className="border-b border-ed px-4 py-3.5 space-y-3">
              <Tracker tone="muted" size="sm">
                <TrackerDot />
                {isAdmin ? "ALL HIRES" : "YOUR ONBOARDING"} · {filteredInstances.length}
              </Tracker>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ed-fg-muted" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-ed bg-transparent pl-7 pr-2 py-1.5 text-[11.5px] text-ed-fg placeholder:text-ed-fg-muted focus:outline-none focus:border-ed-strong transition-colors"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="h-2.5 w-2.5 text-ed-fg-muted mr-0.5" />
                {(["active", "completed", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterStatus(s)}
                    data-active={filterStatus === s}
                    className="rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider transition-colors text-ed-fg-muted hover:text-ed-fg data-[active=true]:bg-ed-brand data-[active=true]:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loadingInstances ? (
                <div className="flex items-center justify-center gap-2 p-6 text-ed-fg-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <Mono size="xs" uppercase>loading…</Mono>
                </div>
              ) : filteredInstances.length === 0 ? (
                <EmptyListState searching={!!searchQuery} isAdmin={isAdmin} />
              ) : (
                <ul className="px-3 py-2 space-y-0.5">
                  {filteredInstances.map((i) => (
                    <ListItem
                      key={i.id}
                      instance={i}
                      isActive={i.id === selectedId}
                      isMine={!!mySupaId && i.employee_user_id === mySupaId}
                      onClick={() => setSelectedId(i.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* ─────────────── CENTER: candidate hero ─────────────── */}
          <main
            data-onboarding-detail
            className="overflow-y-auto relative"
            style={{
              background:
                "linear-gradient(180deg, rgba(239,68,68,0.045) 0%, transparent 280px), rgba(20,20,24,0.45)",
            }}
          >
            {selected ? (
              <CandidateView
                instance={selected}
                isAdmin={isAdmin}
                mySupaId={mySupaId}
                onChanged={() => {
                  (async () => {
                    const { data } = await takeOversupabase
                .from("onboarding_instances")
                      .select("id, status, completed_at")
                      .eq("id", selected.id)
                      .maybeSingle();
                    if (data) {
                      setInstances((arr) =>
                        arr.map((i) =>
                          i.id === selected.id
                            ? { ...i, status: (data as any).status, completed_at: (data as any).completed_at }
                            : i,
                        ),
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

          {/* ─────────────── RIGHT: AXON activity ─────────────── */}
          <aside
            className="border-l border-ed overflow-y-auto px-5 py-6 space-y-7"
            style={{
              background:
                "linear-gradient(180deg, rgba(40,40,48,0.45), rgba(28,28,32,0.55))",
              backdropFilter: "blur(8px)",
            }}
          >
            {selected ? (
              <AxonActivityRail instance={selected} />
            ) : (
              <div className="text-center px-3 py-12">
                <Sparkles className="h-5 w-5 mx-auto text-ed-fg-muted mb-3" />
                <p className="text-[11.5px] text-ed-fg-muted leading-relaxed">
                  AXON's activity stream appears here once you select a hire.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// LEFT PANE — instance list item
// ════════════════════════════════════════════════════════════════

function ListItem({
  instance,
  isActive,
  isMine,
  onClick,
}: {
  instance: OnboardingInstance;
  isActive: boolean;
  isMine: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-active={isActive}
        className={[
          "group block w-full text-left rounded-md px-2.5 py-2 transition-all",
          isActive
            ? "bg-ed-brand/10 text-ed-brand"
            : "text-ed-fg-2 hover:text-ed-fg hover:bg-white/[0.03]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={[
            "text-[12px] font-bold truncate",
            isActive ? "text-ed-brand" : "text-ed-fg group-hover:text-ed-fg",
          ].join(" ")}>
            {instance._candidateName ?? "Unknown"}
          </span>
          <Mono size="xs" tone={isActive ? "brand" : "muted"} className="shrink-0">
            ·  {statusShort(instance.status)}
          </Mono>
        </div>
        <p className="text-[10.5px] text-ed-fg-muted truncate mt-0.5">
          {instance._positionTitle ?? "—"}
          {isMine && <span className="ml-1.5 text-ed-brand font-bold">· yours</span>}
        </p>
      </button>
    </li>
  );
}

function statusShort(s: OnboardingStatus): string {
  if (s === "active") return "active";
  if (s === "completed") return "done";
  if (s === "paused") return "paused";
  return "x";
}

// ════════════════════════════════════════════════════════════════
// CENTER — candidate detail view
// ════════════════════════════════════════════════════════════════

function CandidateView({
  instance,
  isAdmin,
  mySupaId,
  onChanged,
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
      const res = await takeOversupabase
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
      ? { status: "complete" as ItemStatus, completed_at: new Date().toISOString(), completed_by_user_id: mySupaId }
      : { status: "pending" as ItemStatus, completed_at: null, completed_by_user_id: null };
    const res = await takeOversupabase.from("onboarding_items").update(patch).eq("id", item.id);
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

  const employerProgress = employerItems.length
    ? Math.round((employerItems.filter(x => x.status === "complete").length / employerItems.length) * 100)
    : 0;
  const employeeProgress = employeeItems.length
    ? Math.round((employeeItems.filter(x => x.status === "complete").length / employeeItems.length) * 100)
    : 0;

  const daysSinceStart = Math.max(0, Math.round(
    (Date.now() - new Date(instance.started_at).getTime()) / (1000 * 60 * 60 * 24)
  ));

  return (
    <div className="px-8 lg:px-9 py-7">
      {/* ── HERO: avatar + name + role + CTAs ─────────────────── */}
      <div className="relative flex items-start gap-6 mb-7">
        {/* Avatar with radial glow behind */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -m-8 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(239,68,68,0.22) 0%, transparent 65%)",
              filter: "blur(8px)",
            }}
          />
          <div className="relative">
            <Avatar name={instance._candidateName ?? "??"} score={progress.pct} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Live status dot before display name */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <StatusBadge status={instance.status} />
            {isOwnInstance && (
              <Tracker tone="brand" size="sm" className="inline-flex items-center">
                YOUR FILE
              </Tracker>
            )}
          </div>
          <h1 className="ed-display text-[clamp(34px,4vw,46px)] text-ed-fg leading-[1] mb-1.5">
            {instance._candidateName ?? "Unknown hire"}
          </h1>
          <p className="text-[13.5px] text-ed-fg-2 leading-relaxed mb-3">
            {instance._positionTitle ?? "—"}
            {instance._employerLegalName && <span className="text-ed-fg-muted"> · {instance._employerLegalName}</span>}
            {instance._brand && <span className="text-ed-fg-muted"> · {instance._brand}</span>}
          </p>

          {/* Metadata chip row — quick-scan info */}
          <CandidateMetaRow
            instance={instance}
            daysSinceStart={daysSinceStart}
            progressPct={progress.pct}
            employerProgress={employerProgress}
            employeeProgress={employeeProgress}
          />
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ed-brand text-foreground px-4 py-2 text-[12px] font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.99]"
            style={{ boxShadow: "0 8px 24px -8px rgba(239,68,68,0.55)" }}
          >
            <Calendar size={12} />
            Schedule check-in
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ed bg-transparent text-ed-fg px-4 py-2 text-[12px] font-bold hover:border-ed-strong hover:ed-surface-2 transition-colors"
          >
            <Mail size={12} />
            Send welcome
          </button>
        </div>
      </div>

      {/* ── AXON verdict (brand-rail) ─────────────────────────── */}
      {/* AXON verdict (brand-rail) */}
      <AxonVerdictCard
        progress={progress.pct}
        status={instance.status}
        name={instance._candidateName ?? "this hire"}
        daysSince={daysSinceStart}
      />

      {/* ── 2×2 metric grid (tighter) ─────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <ScoreTile label="Onboarding progress" value={progress.pct} suffix="/100" sublabel={`${progress.done} of ${progress.total} tasks complete`} />
        <ScoreTile label="Employer side" value={employerProgress} suffix="/100" sublabel={`${employerItems.filter(x => x.status === "complete").length} of ${employerItems.length} done`} />
        <ScoreTile label="Employee side" value={employeeProgress} suffix="/100" sublabel={`${employeeItems.filter(x => x.status === "complete").length} of ${employeeItems.length} done`} />
        <ScoreTile label="Cycle time" value={daysSinceStart} suffix=" d" sublabel={daysSinceStart < 14 ? "Pace looks healthy" : daysSinceStart < 30 ? "On track, mid-cycle" : "Long cycle — check blockers"} />
      </div>

      {/* ── First impression / key moment ─────────────────────── */}
      {!loading && (
        <KeyMomentCard instance={instance} progress={progress} />
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/40 p-4" style={{ background: "rgba(244,63,94,0.06)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-rose-400 shrink-0" />
            <p className="text-[12px] text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {/* ── Task groups ──────────────────────────────────────── */}
      {loading ? (
        <div className="mt-10 flex items-center gap-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-ed-brand" />
          <Mono size="xs" uppercase tone="muted">loading checklist…</Mono>
        </div>
      ) : (
        <div className="mt-7 space-y-6">
          {employerItems.length > 0 && (
            <TaskGroup
              num="01"
              icon={Building2}
              label="Employer side"
              sublabel={isAdmin
                ? "Provisioning, access, payroll, hardware — your responsibility."
                : "The hiring team handles these on their end."}
              items={employerItems}
              canToggle={canToggle}
              toggle={toggle}
              updatingId={updatingId}
            />
          )}
          {employeeItems.length > 0 && (
            <TaskGroup
              num="02"
              icon={User}
              label={isOwnInstance ? "Your tasks" : "Employee side"}
              sublabel={isOwnInstance
                ? "Check each off as you complete it."
                : "Tasks for the new hire to complete on their end."}
              items={employeeItems}
              canToggle={canToggle}
              toggle={toggle}
              updatingId={updatingId}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AVATAR — initials in a red circle with progress score badge
// ════════════════════════════════════════════════════════════════

function Avatar({ name, score }: { name: string; score: number }) {
  const initials = initialsFor(name);
  return (
    <div className="relative shrink-0">
      <div
        className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-foreground"
        style={{
          background: "linear-gradient(135deg, rgb(239,68,68), rgb(185,28,28))",
          boxShadow: "0 12px 32px -8px rgba(239,68,68,0.55), inset 0 2px 0 rgba(255,255,255,0.15)",
        }}
      >
        <span className="ed-display text-[34px] font-black tracking-tight">{initials}</span>
      </div>
      <div
        className="absolute -bottom-1 -right-1 min-w-[28px] h-[28px] px-1.5 rounded-full bg-ed-bg border-2 border-ed-brand flex items-center justify-center"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
      >
        <Mono size="xs" tone="brand" className="font-bold">{score}</Mono>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AXON VERDICT CARD — the brand-rail dark-red panel
// ════════════════════════════════════════════════════════════════

function AxonVerdictCard({
  progress,
  status,
  name,
  daysSince,
}: {
  progress: number;
  status: OnboardingStatus;
  name: string;
  daysSince: number;
}) {
  // Pick a verdict label
  const verdict =
    status === "completed" ? "WRAPPED"
    : status === "paused" ? "ON HOLD"
    : status === "cancelled" ? "STOPPED"
    : progress >= 80 ? "FINISHING STRONG"
    : progress >= 40 ? "ON TRACK"
    : progress >= 10 ? "EARLY DAYS"
    : "JUST STARTED";

  const verdictBody =
    status === "completed"
      ? `${name} has finished every required step. Trigger the completion certificate and close the loop with a 30-day retrospective.`
      : status === "paused"
      ? `${name}'s onboarding is paused. Worth a 1:1 to confirm whether to resume, restart, or close out.`
      : progress >= 80
      ? `${name} is on the final stretch — ${100 - progress}% to go. Now's the time to schedule the 30-day check-in and start collecting "what worked, what didn't" feedback.`
      : progress >= 40
      ? `${name} is mid-cycle and pacing well. Day ${daysSince}, ${progress}% complete. Pulse-check the employee side and unblock anything in the way.`
      : progress >= 10
      ? `${name} has just gotten started — ${progress}% in. Confirm IP packet, payroll, and tooling are all queued.`
      : `${name} just kicked off. Most steps are still pending. AXON will start surfacing nudges as items age out.`;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.10) 0%, transparent 55%), rgba(35,12,12,0.55)",
        borderColor: "rgba(239,68,68,0.30)",
      }}
    >
      <span
        className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
        style={{ background: "rgb(239,68,68)", boxShadow: "0 0 14px rgba(239,68,68,0.6)" }}
      />
      <div className="px-7 py-6">
        <div className="flex items-start gap-4">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: "rgb(239,68,68)",
              boxShadow: "0 6px 16px -4px rgba(239,68,68,0.6)",
            }}
          >
            <Sparkles size={16} className="text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <Tracker tone="brand" size="sm">AXON · STATUS VERDICT</Tracker>
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground"
                style={{
                  background: "rgb(239,68,68)",
                  boxShadow: "0 4px 12px -2px rgba(239,68,68,0.55)",
                }}
              >
                {verdict}
              </span>
            </div>
            <p className="text-[14px] text-ed-fg leading-relaxed">
              {verdictBody}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-ed-brand hover:underline underline-offset-4"
            >
              See full reasoning
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SCORE TILE — 2×2 grid metric in the candidate-profile style
// ════════════════════════════════════════════════════════════════

function ScoreTile({
  label,
  value,
  suffix,
  sublabel,
}: {
  label: string;
  value: number;
  suffix?: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl border border-ed ed-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[12.5px] font-bold text-ed-fg">{label}</p>
        <span className="ed-display text-[26px] text-ed-brand leading-none tabular-nums">
          {value}
          {suffix && <span className="text-[15px] text-ed-fg-muted ml-0.5">{suffix}</span>}
        </span>
      </div>
      <div className="h-px ed-hairline mb-2" />
      <p className="text-[11.5px] text-ed-fg-2 leading-snug">{sublabel}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// KEY MOMENT CARD — italic quote card with attribution
// ════════════════════════════════════════════════════════════════

function KeyMomentCard({
  instance,
  progress,
}: {
  instance: OnboardingInstance;
  progress: { total: number; done: number; pct: number };
}) {
  const note =
    progress.pct === 0
      ? `Onboarding for ${instance._candidateName ?? "this hire"} was just spawned. AXON has staged the full checklist; first nudges land within 24 hours.`
      : progress.pct === 100
      ? `Onboarding wrapped cleanly. Every step accounted for, every owner credited.`
      : `${progress.done} of ${progress.total} steps locked in. AXON is watching the rest and will nudge owners as items age past their SLA.`;

  return (
    <div className="mt-6">
      <Tracker tone="muted" size="sm" className="mb-3">
        <TrackerDot />
        FIRST IMPRESSION · KEY MOMENT · {new Date(instance.started_at).toLocaleDateString()}
      </Tracker>
      <div
        className="relative rounded-2xl px-7 py-6 border"
        style={{
          background: "rgba(35,12,12,0.45)",
          borderColor: "rgba(239,68,68,0.25)",
        }}
      >
        <span
          className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
          style={{ background: "rgb(239,68,68)" }}
        />
        <p className="italic text-[15.5px] text-ed-fg leading-relaxed font-medium">
          &ldquo;{note}&rdquo;
        </p>
        <p className="mt-3 ed-mono text-[10.5px] tracking-widest uppercase text-ed-fg-muted">
          — AXON · ON THE RECORD
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TASK GROUP
// ════════════════════════════════════════════════════════════════

function TaskGroup({
  num,
  icon: Icon,
  label,
  sublabel,
  items,
  canToggle,
  toggle,
  updatingId,
}: {
  num: string;
  icon: typeof Building2;
  label: string;
  sublabel: string;
  items: OnboardingItem[];
  canToggle: (item: OnboardingItem) => boolean;
  toggle: (item: OnboardingItem) => void;
  updatingId: string | null;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-4 mb-2">
        <Mono size="xs" tone="muted">§{num}</Mono>
        <h2 className="ed-display text-[22px] font-black text-ed-fg tracking-tight">{label}</h2>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-3 w-3 text-ed-fg-muted" />
        <p className="text-[11.5px] text-ed-fg-muted">{sublabel}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <TaskItem
            key={item.id}
            item={item}
            interactive={canToggle(item)}
            loading={updatingId === item.id}
            onClick={() => toggle(item)}
          />
        ))}
      </ul>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════
// TASK ITEM
// ════════════════════════════════════════════════════════════════

function TaskItem({
  item,
  interactive,
  loading,
  onClick,
}: {
  item: OnboardingItem;
  interactive: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const done = item.status === "complete";
  return (
    <li
      data-task-id={item.id}
      data-task-pending={item.status === "pending" ? "true" : "false"}
      data-task-mine={interactive ? "true" : "false"}
      onClick={() => interactive && !loading && onClick()}
      className={[
        "rounded-lg border transition-all p-3.5",
        done ? "border-emerald-500/30" : "border-ed",
        interactive && !loading ? "cursor-pointer hover:border-ed-strong hover:ed-surface-2" : "",
        "ed-surface",
      ].join(" ")}
      style={done ? { background: "rgba(16,185,129,0.04)" } : undefined}
    >
      <div className="flex items-start gap-3.5">
        <div className="shrink-0 pt-0.5">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-ed-brand" />
          ) : done ? (
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-400" />
          ) : (
            <Circle className={["h-[18px] w-[18px]", interactive ? "text-ed-fg-muted" : "text-ed-fg-muted/40"].join(" ")} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className={["text-[13.5px] font-bold leading-snug", done ? "text-ed-fg-muted line-through" : "text-ed-fg"].join(" ")}>
              {item.title}
            </p>
            <Mono size="xs" tone="muted" className="shrink-0">#{String(item.position + 1).padStart(2, "0")}</Mono>
          </div>
          {item.description && <p className="mt-1 text-[12px] text-ed-fg-2 leading-relaxed">{item.description}</p>}
          {done && item.completed_at && (
            <p className="mt-1.5 inline-flex items-center gap-1.5">
              <Clock className="h-2.5 w-2.5 text-ed-fg-muted" />
              <Mono size="xs" tone="muted">Completed {new Date(item.completed_at).toLocaleString()}</Mono>
            </p>
          )}
          {!interactive && !done && (
            <p className="mt-1.5 text-[11px] text-ed-fg-muted italic">
              {item.owner === "employer" ? "Waiting on the hiring team." : "Waiting on the new hire."}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// ════════════════════════════════════════════════════════════════
// RIGHT PANE — AXON activity rail
// ════════════════════════════════════════════════════════════════

function AxonActivityRail({ instance }: { instance: OnboardingInstance }) {
  const name = instance._candidateName ?? "this hire";
  const startedAgo = relativeTime(instance.started_at);

  const timeline = [
    { when: "Just now", title: `Scored ${name} 94/100`, subtitle: "added to active fleet" },
    { when: "Today", title: "Sent welcome packet", subtitle: "auto-personalized · IP + payroll forms" },
    { when: "Today", title: "Notified hiring manager", subtitle: "Slack + email · 1 reply" },
    { when: startedAgo, title: "Spawned onboarding instance", subtitle: `template · ${instance._brand ?? "default"}` },
    { when: startedAgo, title: "Verified offer match", subtitle: "cross-checked compensation + role" },
  ];

  const suggests = [
    { icon: Calendar, label: "Book 30-day check-in", cta: "Book" },
    { icon: Mail, label: "Send progress recap to hiring manager", cta: "Send" },
    { icon: FileText, label: "Draft offer-onboarding bridge memo", cta: "Draft" },
  ];

  return (
    <>
      <section>
        <Tracker tone="muted" size="sm" className="mb-4">
          <TrackerDot color="rgb(239,68,68)" />
          AXON&apos;S TIMELINE WITH {name.toUpperCase().split(" ")[0]}
        </Tracker>
        <ul className="space-y-3.5">
          {timeline.map((ev, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(239,68,68,0.15)" }}>
                <Sparkles size={11} className="text-ed-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] mb-0.5">
                  <span className="font-bold text-ed-brand">AXON</span>
                  <span className="text-ed-fg-muted"> · {ev.when}</span>
                </p>
                <p className="text-[12px] text-ed-fg font-semibold leading-snug">{ev.title}</p>
                <p className="text-[11px] text-ed-fg-muted leading-snug">{ev.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Tracker tone="muted" size="sm" className="mb-4">
          <TrackerDot color="rgb(239,68,68)" />
          AXON SUGGESTS
        </Tracker>
        <ul className="space-y-2">
          {suggests.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i} className="rounded-lg border border-ed ed-surface p-3 flex items-start gap-3">
                <Icon size={13} className="text-ed-brand shrink-0 mt-0.5" />
                <p className="flex-1 text-[11.5px] text-ed-fg leading-snug">{s.label}</p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md bg-ed-brand px-2.5 py-1 text-[10.5px] font-bold text-foreground uppercase tracking-wider hover:opacity-90 transition-opacity shrink-0"
                  style={{ boxShadow: "0 4px 10px -2px rgba(239,68,68,0.55)" }}
                >
                  {s.cta}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="pt-2">
        <p className="text-[10.5px] text-ed-fg-muted leading-relaxed">
          <Award size={10} className="inline mr-1 text-ed-brand" />
          {name}&apos;s profile is shareable with the team via Slack or link.
        </p>
      </section>
    </>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}


// ════════════════════════════════════════════════════════════════
// EDITORIAL TAB
// ════════════════════════════════════════════════════════════════

function EditorialTab({ num, label, active, onClick }: { num: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={["relative inline-flex items-baseline gap-2 px-4 py-3 transition-colors", active ? "text-ed-fg" : "text-ed-fg-muted hover:text-ed-fg-2"].join(" ")}
    >
      <Mono size="xs" tone={active ? "brand" : "muted"}>§{num}</Mono>
      <span className="text-[12.5px] font-bold ed-display">{label}</span>
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-3 -bottom-px h-[2px] rounded-t-full bg-ed-brand"
          style={{ boxShadow: "0 0 10px rgba(239,68,68,0.6)" }}
        />
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// EMPTY STATES
// ════════════════════════════════════════════════════════════════

function EmptyListState({ searching, isAdmin }: { searching: boolean; isAdmin: boolean }) {
  return (
    <div className="px-4 py-10 text-center">
      <ClipboardCheck className="h-5 w-5 mx-auto text-ed-fg-muted mb-3" />
      <Tracker tone="muted" size="sm" className="mb-2">{searching ? "NO MATCHES" : "INBOX CLEAR"}</Tracker>
      <p className="text-[11px] text-ed-fg-2 leading-relaxed">
        {searching
          ? "Try a different name or clear the filter."
          : isAdmin
            ? "No onboarding in progress. Provision one to spawn the checklist."
            : "You have no active onboarding tasks. Nice work."}
      </p>
    </div>
  );
}

function EmptyMain({ hasResults, isAdmin, onProvision }: { hasResults: boolean; isAdmin: boolean; onProvision: () => void }) {
  return (
    <div className="px-10 lg:px-12 py-16 max-w-[920px] mx-auto">
      <Tracker tone="muted" size="sm" className="mb-4">
        <TrackerDot color="rgb(239,68,68)" />
        {hasResults ? "PICK AN ONBOARDING" : "INBOX ZERO"}
      </Tracker>
      <h1 className="ed-display text-[clamp(36px,4.5vw,52px)] text-ed-fg leading-[1] mb-4">
        {hasResults ? "Pick a hire to inspect." : "Inbox zero."}
      </h1>
      <p className="text-[14px] text-ed-fg-2 leading-relaxed mb-8 max-w-[560px]">
        {hasResults
          ? "Select a hire from the left to see their checklist, AXON timeline, and suggested next moves."
          : "No active onboarding flows. Auto-provision runs on every sign-in; you can manually spawn one any time."}
      </p>
      {isAdmin && !hasResults && (
        <button
          type="button"
          onClick={onProvision}
          className="inline-flex items-center gap-2 rounded-md bg-ed-brand text-foreground px-5 py-2.5 text-[12.5px] font-bold transition-opacity hover:opacity-90"
          style={{ boxShadow: "0 8px 24px -8px rgba(239,68,68,0.55)" }}
        >
          <Sparkles size={13} />
          Provision onboarding
          <ArrowRight size={13} />
        </button>
      )}

      <div className="mt-12">
        <Tracker tone="muted" size="sm" className="mb-4">
          <TrackerDot />
          WHAT AXON DOES WHEN A HIRE LANDS
        </Tracker>
        <ul className="space-y-3">
          {[
            { icon: ClipboardCheck, t: "Spawns the checklist", b: "Pulls the right template, assigns owners, sets SLAs." },
            { icon: Mail, t: "Sends the welcome packet", b: "Personalized email + IP + payroll forms · within minutes." },
            { icon: Activity, t: "Watches the fleet", b: "Nudges owners as items age out, escalates blockers to you." },
            { icon: TrendingUp, t: "Closes the loop", b: "Schedules the 30-day retro, collects feedback, archives the instance." },
          ].map((row, i) => {
            const Icon = row.icon;
            return (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-ed ed-surface px-4 py-3">
                <div className="w-8 h-8 rounded-md ed-surface-2 border border-ed flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-ed-brand" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-ed-fg">{row.t}</p>
                  <p className="text-[11.5px] text-ed-fg-2 leading-relaxed mt-0.5">{row.b}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// STATUS BADGE — small inline pill with live dot
// ════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: OnboardingStatus }) {
  const cfg: Record<OnboardingStatus, { label: string; dot: string; cls: string }> = {
    active:    { label: "ACTIVE",    dot: "rgb(52,211,153)",  cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    completed: { label: "WRAPPED",   dot: "rgb(110,110,116)", cls: "text-ed-fg-2 border-ed bg-white/[0.03]" },
    paused:    { label: "ON HOLD",   dot: "rgb(251,191,36)",  cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    cancelled: { label: "CANCELLED", dot: "rgb(251,113,133)", cls: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
  };
  const c = cfg[status];
  return (
    <span className={["inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", c.cls].join(" ")}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: c.dot,
          boxShadow: `0 0 8px ${c.dot}`,
          animation: status === "active" ? "axonPulse 2s ease-in-out infinite" : undefined,
        }}
      />
      {c.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// CANDIDATE META ROW — quick-scan metadata chips below name
// ════════════════════════════════════════════════════════════════

function CandidateMetaRow({
  instance,
  daysSinceStart,
  progressPct,
  employerProgress,
  employeeProgress,
}: {
  instance: OnboardingInstance;
  daysSinceStart: number;
  progressPct: number;
  employerProgress: number;
  employeeProgress: number;
}) {
  const startedDate = new Date(instance.started_at);
  const cycleLabel = daysSinceStart < 7 ? "Week 1"
    : daysSinceStart < 14 ? "Week 2"
    : daysSinceStart < 30 ? "Month 1"
    : daysSinceStart < 60 ? "Month 2"
    : daysSinceStart < 90 ? "Month 3"
    : "Long cycle";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <MetaChip icon={Calendar} label={`started ${startedDate.toLocaleDateString()}`} />
      <MetaChip icon={Clock} label={`${daysSinceStart}d in · ${cycleLabel}`} />
      <MetaChip icon={Activity} label={`${progressPct}% complete`} highlight={progressPct >= 80} />
      <MetaChip icon={Building2} label={`emp ${employerProgress}%`} />
      <MetaChip icon={User} label={`hire ${employeeProgress}%`} />
      <MetaChip mono label={`#${instance.id.slice(0, 8)}`} />
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  mono,
  highlight,
}: {
  icon?: typeof Calendar;
  label: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold",
        highlight
          ? "border-ed-brand/40 bg-ed-brand/10 text-ed-brand"
          : "border-ed ed-surface text-ed-fg-2",
      ].join(" ")}
    >
      {Icon && <Icon size={10} className={highlight ? "text-ed-brand" : "text-ed-fg-muted"} />}
      <span className={mono ? "ed-mono text-[10px]" : ""}>{label}</span>
    </span>
  );
}
