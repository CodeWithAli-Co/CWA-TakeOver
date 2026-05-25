/**
 * TimesheetPage.tsx — Unified timesheet + schedule surface.
 *
 * One page, one data source (the `shifts` table). The user picks a view
 * mode (Me / Team / Person), a week, and sees everything that's planned,
 * in-progress, and completed for that scope.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Title + Tracker chip      Me / Team / Person   [+ New]  │ Top bar
 *   │ Week of Mon Aug 12        ← Today →                     │ Week nav
 *   ├─────────────────────────────────────────────────────────┤
 *   │ ClockBar (Me view only)                                 │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ 0h scheduled · 0h logged · 0 shifts · current streak    │ Stats bar
 *   ├─────────────────────────────────────────────────────────┤
 *   │                                                         │
 *   │                   WeekGrid (7×N)                        │
 *   │                                                         │
 *   └─────────────────────────────────────────────────────────┘
 *
 * This replaces both /timetracking and /schedule. The legacy routes
 * redirect here.
 */

import { useMemo, useState, Suspense } from "react";
import { Clock, Plus, Loader2, Users, User, ChevronDown, AlertCircle } from "lucide-react";
import {
  startOfWeekMonday,
  endOfWeekSunday,
  weekDays,
  shiftHours,
  type Shift,
} from "@/stores/shiftTypes";
import { useShiftsInRange } from "@/stores/shifts";
import { Employees, ActiveUser } from "@/stores/query";
import { Tracker, TrackerDot } from "@/components/editorial/Tracker";
import { Mono } from "@/components/editorial/Mono";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";

import { ViewToggle, type ViewMode } from "./ViewToggle";
import { WeekNavigator } from "./WeekNavigator";
import { ClockBar } from "./ClockBar";
import { WeekGrid } from "./WeekGrid";
import { ShiftEditor } from "./ShiftEditor";

interface Employee {
  supa_id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
}

function TimesheetContent() {
  // -- Active user (the "Me" target) --
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const myId: string | null = me?.supa_id ?? null;
  const myName: string = me?.username ?? "Me";

  // -- All employees (for Team + Person picker) --
  const { data: rawEmployees } = Employees();
  const employees: Employee[] = useMemo(() => {
    if (!rawEmployees) return [];
    return (rawEmployees as any[])
      .map((u) => ({
        supa_id: String(u.supa_id ?? u.id ?? ""),
        username: u.username ?? "Unnamed",
        role: u.role ?? "Member",
        avatar_url: u.avatar_url ?? null,
      }))
      .filter((e) => e.supa_id);
  }, [rawEmployees]);

  // -- View state --
  const [view, setView] = useState<ViewMode>("me");
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [personId, setPersonId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [prefillSlot, setPrefillSlot] = useState<{ start: Date; userSupaId?: string } | null>(null);

  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeekSunday(weekAnchor), [weekAnchor]);
  const days = useMemo(() => weekDays(weekAnchor), [weekAnchor]);

  // -- Scope: which user(s) to query --
  const scopedUserId: string | null =
    view === "me"
      ? myId
      : view === "person"
        ? personId
        : null; // "team" → fetch all

  const { data: shifts = [], isLoading, error } = useShiftsInRange(
    weekStart,
    weekEnd,
    { userSupaId: scopedUserId },
  );

  // -- Stats roll-up for this week --
  const stats = useMemo(() => {
    const total = shifts.length;
    const scheduledHours = shifts.reduce((sum, s) => sum + shiftHours(s), 0);
    const loggedHours = shifts
      .filter((s) => s.status === "completed" || s.status === "in_progress")
      .reduce((sum, s) => sum + shiftHours(s), 0);
    const inProgress = shifts.filter((s) => s.status === "in_progress").length;
    return { total, scheduledHours, loggedHours, inProgress };
  }, [shifts]);

  const personName: string =
    view === "person"
      ? employees.find((e) => e.supa_id === personId)?.username ?? "Pick a teammate"
      : "";

  const openNewShift = () => {
    setEditingShift(null);
    setPrefillSlot(null);
    setEditorOpen(true);
  };

  const openEditShift = (s: Shift) => {
    setEditingShift(s);
    setPrefillSlot(null);
    setEditorOpen(true);
  };

  const openNewAtSlot = (start: Date, userSupaId?: string) => {
    setEditingShift(null);
    setPrefillSlot({ start, userSupaId });
    setEditorOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ─────────────── TOP BAR ─────────────── */}
      <header className="border-b border-border px-6 lg:px-8 py-5 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <Tracker tone="muted" size="sm" className="mb-2">
          <TrackerDot color="rgb(239,68,68)" />
          TIMESHEET — {stats.total} SHIFT{stats.total === 1 ? "" : "S"} THIS WEEK
          {stats.inProgress > 0 && (
            <>
              {" — "}
              <span className="text-emerald-400">{stats.inProgress} ON THE CLOCK</span>
            </>
          )}
        </Tracker>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex items-baseline gap-4 flex-wrap">
            <h1
              className="font-black text-foreground leading-none"
              style={{
                fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
                fontSize: "clamp(26px, 2.6vw, 34px)",
                letterSpacing: "-0.02em",
              }}
            >
              Timesheet
            </h1>
            {view === "person" && personName && (
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <User className="w-3 h-3" />
                {personName}
              </span>
            )}
            {view === "team" && (
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Users className="w-3 h-3" />
                {employees.length} {employees.length === 1 ? "employee" : "employees"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle
              value={view}
              onChange={(v) => {
                setView(v);
                if (v !== "person") setPersonId(null);
              }}
            />

            {view === "person" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 h-8 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                  >
                    {personName}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border max-h-[320px] overflow-auto">
                  {employees.length === 0 ? (
                    <DropdownMenuItem disabled>No employees</DropdownMenuItem>
                  ) : (
                    employees.map((e) => (
                      <DropdownMenuItem
                        key={e.supa_id}
                        onClick={() => setPersonId(e.supa_id)}
                        className="text-foreground/85 focus:bg-secondary focus:text-foreground gap-2"
                      >
                        <span className="font-semibold">{e.username}</span>
                        <span className="text-[10.5px] text-muted-foreground">{e.role}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              type="button"
              onClick={openNewShift}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 h-8 text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              style={{ boxShadow: "0 4px 12px -2px rgba(239,68,68,0.45)" }}
            >
              <Plus className="w-3 h-3" />
              New shift
            </button>
          </div>
        </div>

        <WeekNavigator
          weekStart={weekStart}
          weekEnd={weekEnd}
          onPrev={() => {
            const d = new Date(weekAnchor);
            d.setDate(d.getDate() - 7);
            setWeekAnchor(d);
          }}
          onNext={() => {
            const d = new Date(weekAnchor);
            d.setDate(d.getDate() + 7);
            setWeekAnchor(d);
          }}
          onToday={() => setWeekAnchor(new Date())}
        />
      </header>

      {/* ─────────────── ERROR BANNER ─────────────── */}
      {error && (
        <div className="mx-6 mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong className="font-bold mr-1">Timesheet offline:</strong>
            {String((error as Error).message).toLowerCase().includes("does not exist") ||
            String((error as Error).message).includes("42P01")
              ? "The shifts table isn't set up yet. Run migrations/shifts_unified_baseline.sql in your Supabase SQL editor."
              : (error as Error).message}
          </div>
        </div>
      )}

      {/* ─────────────── CLOCK BAR (Me only) ─────────────── */}
      {view === "me" && myId && (
        <div className="px-6 lg:px-8 pt-4">
          <ClockBar userSupaId={myId} username={myName} />
        </div>
      )}

      {/* ─────────────── STATS BAR ─────────────── */}
      <div className="px-6 lg:px-8 pt-4 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatChip
            label="Scheduled"
            value={`${stats.scheduledHours.toFixed(1)}h`}
            tone="default"
          />
          <StatChip
            label="Logged"
            value={`${stats.loggedHours.toFixed(1)}h`}
            tone="brand"
          />
          <StatChip
            label="Shifts"
            value={String(stats.total)}
            tone="default"
          />
          <StatChip
            label="On the clock"
            value={String(stats.inProgress)}
            tone={stats.inProgress > 0 ? "emerald" : "default"}
          />
        </div>
      </div>

      {/* ─────────────── WEEK GRID ─────────────── */}
      <main className="flex-1 min-h-0 px-6 lg:px-8 pb-6">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <Mono size="sm" uppercase>loading shifts...</Mono>
          </div>
        ) : view === "person" && !personId ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <User className="w-6 h-6 opacity-50" />
            <p className="text-[12.5px]">Pick a teammate from the dropdown above to see their schedule.</p>
          </div>
        ) : (
          <WeekGrid
            days={days}
            shifts={shifts}
            mode={view}
            employees={view === "team" ? employees : null}
            currentUserId={myId}
            onShiftClick={openEditShift}
            onEmptyCellClick={openNewAtSlot}
          />
        )}
      </main>

      {/* ─────────────── EDITOR DIALOG ─────────────── */}
      <ShiftEditor
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingShift(null);
          setPrefillSlot(null);
        }}
        editing={editingShift}
        prefill={prefillSlot}
        employees={employees}
        currentUserId={myId}
        currentUserName={myName}
      />
    </div>
  );
}

// ───────── Tiny inline components ─────────

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "brand" | "emerald";
}) {
  const colors = {
    default: "border-border bg-card",
    brand:   "border-primary/30 bg-primary/5",
    emerald: "border-emerald-500/40 bg-emerald-500/5",
  }[tone];
  const valColors = {
    default: "text-foreground",
    brand:   "text-primary",
    emerald: "text-emerald-400",
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 ${colors}`}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className={`text-[18px] font-black leading-none ${valColors}`}>{value}</p>
    </div>
  );
}

// ───────── Public export (Suspense-wrapped) ─────────

export default function TimesheetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <Mono size="sm" uppercase>loading timesheet...</Mono>
        </div>
      }
    >
      <TimesheetContent />
    </Suspense>
  );
}
