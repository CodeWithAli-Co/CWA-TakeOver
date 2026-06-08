/**
 * NewSchedule.tsx - Schedule calendar, redesigned.
 *
 * Two-pane layout (editorial language):
 *
 *   +--- EDITORIAL HEADER (tracker breadcrumb + month nav + new event) ---+
 *   | EMPLOYEE SIDEBAR (real Supabase) | CALENDAR SURFACE (month grid)    |
 *   |  - status dots                   |  - weekday tracker row           |
 *   |  - filter by click               |  - day cells with mono dates     |
 *   |  - shift count per person        |  - today: brand-rail glow        |
 *   |                                  |  - event chips with initials     |
 *   +----------------------------------+----------------------------------+
 *
 * Real employees come from Employees() Supabase hook (app_users table).
 * Events are still client-side (TODO: wire to events table next pass).
 */

import React, { useState, useEffect, useMemo, Suspense } from "react";
import {
  Calendar,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/shadcnComponents/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Employees, ActiveUser } from "@/stores/query";
import { companySupabase } from "@/routes/index.lazy";
import { useCompanyFilter } from "@/stores/store";
import { Tracker, TrackerDot } from "@/components/editorial/Tracker";
import { Mono } from "@/components/editorial/Mono";

// Types -------------------------------------------------------------

interface Employee {
  supa_id: string;
  id?: number;
  username: string;
  role: string;
  avatar_url?: string | null;
  status?: "active" | "break" | "offline";
}

type EventType = "shift" | "meeting" | "break" | "off";

interface ScheduleEvent {
  id: string;
  employeeSupaId: string;
  employeeName: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  type: EventType;
  notes?: string;
}

// Helpers -----------------------------------------------------------

const WEEK_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function initialsFor(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function accentForSupaId(id: string): string {
  const palette = [
    "rgb(239,68,68)",
    "rgb(245,158,11)",
    "rgb(16,185,129)",
    "rgb(14,165,233)",
    "rgb(168,85,247)",
    "rgb(236,72,153)",
    "rgb(34,211,238)",
    "rgb(251,191,36)",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}


// Map a Supabase row from schedule_events to the in-memory ScheduleEvent shape
function rowToEvent(row: any): ScheduleEvent {
  return {
    id: String(row.id),
    employeeSupaId: row.employee_supa_id ?? "",
    employeeName: row.employee_name ?? "",
    title: row.title ?? "",
    startTime: row.start_time ?? "09:00",
    endTime: row.end_time ?? "17:00",
    date: row.date ?? new Date().toISOString().split("T")[0]!,
    type: (row.type ?? "shift") as EventType,
    notes: row.notes ?? "",
  };
}

const EVENT_TYPE_META: Record<EventType, { label: string; accent: string }> = {
  shift:   { label: "SHIFT",   accent: "rgb(239,68,68)" },
  meeting: { label: "MEETING", accent: "rgb(14,165,233)" },
  break:   { label: "BREAK",   accent: "rgb(251,191,36)" },
  off:     { label: "OFF",     accent: "rgb(110,110,116)" },
};

// Content wrapper (Suspense-guarded fetch) --------------------------

function EmployeeScheduleContent() {
  const { data: rawEmployees } = Employees();
  const employees: Employee[] = useMemo(() => {
    if (!rawEmployees) return [];
    return (rawEmployees as any[]).map((u) => ({
      supa_id: String(u.supa_id ?? u.id ?? ""),
      id: u.id,
      username: u.username ?? "Unnamed",
      role: u.role ?? "Member",
      avatar_url: u.avatar_url ?? null,
      status: "active" as const,
    })).filter((e) => e.supa_id);
  }, [rawEmployees]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { data: meUser } = ActiveUser();
  const mySupaId = (meUser?.[0] as any)?.supa_id ?? null;
  const { activeCompany } = useCompanyFilter();
  const companyLabel = activeCompany === "simplicityFunds" ? "simplicity" : "CodeWithAli";

  // Hydrate events from Supabase on mount + when company changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = companySupabase.from("schedule_events").select("*");
      if (activeCompany !== "all") q = q.eq("company", companyLabel);
      const { data, error } = await q.order("date", { ascending: true });
      if (cancelled) return;
      if (error) {
        // PostgREST returns code 42P01 ("undefined_table") for missing tables.
        // Compose a message that our banner can recognize cleanly.
        const code = (error as any).code;
        const msg = code === "42P01"
          ? `Table does not exist (code 42P01): ${error.message}`
          : error.message;
        setLoadError(msg);
        setEvents([]);
        return;
      }
      setLoadError(null);
      setEvents((data ?? []).map(rowToEvent));
    })();
    return () => { cancelled = true; };
  }, [activeCompany, companyLabel]);

  // Realtime subscription - keeps every open client in sync
  useEffect(() => {
    const channel = companySupabase
      .channel("schedule_events_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_events" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = rowToEvent(payload.new as any);
            setEvents((arr) => (arr.some((e) => e.id === row.id) ? arr : [...arr, row]));
          } else if (payload.eventType === "UPDATE") {
            const row = rowToEvent(payload.new as any);
            setEvents((arr) => arr.map((e) => (e.id === row.id ? row : e)));
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.id;
            if (oldId) setEvents((arr) => arr.filter((e) => e.id !== oldId));
          }
        },
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const cells: DayCell[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const iso = date.toISOString().split("T")[0]!;
      const cellEvents = events.filter((e) => {
        if (e.date !== iso) return false;
        if (selectedEmployee && e.employeeSupaId !== selectedEmployee) return false;
        if (searchQuery) {
          const hay = `${e.employeeName} ${e.title}`.toLowerCase();
          if (!hay.includes(searchQuery.toLowerCase())) return false;
        }
        return true;
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

      cells.push({
        date,
        iso,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        isPast: date.getTime() < today.getTime(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        events: cellEvents,
      });
    }
    return cells;
  }, [currentDate, events, selectedEmployee, searchQuery]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    const needle = searchQuery.toLowerCase();
    return employees.filter(
      (e) => e.username.toLowerCase().includes(needle) || e.role.toLowerCase().includes(needle),
    );
  }, [employees, searchQuery]);

  const eventsByEmployee = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const map = new Map<string, number>();
    events.forEach((e) => {
      const d = new Date(e.date);
      if (d >= monthStart && d <= monthEnd) {
        map.set(e.employeeSupaId, (map.get(e.employeeSupaId) ?? 0) + 1);
      }
    });
    return map;
  }, [events, currentDate]);

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const monthShort = currentDate.toLocaleString("default", { month: "short" });
  const totalEventsThisMonth = days.filter((d) => d.isCurrentMonth).reduce((n, d) => n + d.events.length, 0);

  const goPrev   = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const goNext   = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const goToday  = () => setCurrentDate(new Date());
  const openAdd  = (d?: Date) => { setSelectedDate(d ?? null); setEditingEvent(null); setIsAddEventOpen(true); };
  const openEdit = (e: ScheduleEvent) => { setEditingEvent(e); setIsAddEventOpen(true); };
  const remove = async (id: string) => {
    // Optimistic
    setEvents((arr) => arr.filter((e) => e.id !== id));
    const { error } = await companySupabase.from("schedule_events").delete().eq("id", id);
    if (error) {
      setLoadError(`Delete failed: ${error.message}`);
    }
  };

  const selectedEmployeeObj = selectedEmployee ? employees.find((e) => e.supa_id === selectedEmployee) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {loadError && (
        <div className="mx-6 mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-200">
          <strong className="font-bold mr-1">Schedule offline:</strong>
          {(() => {
            const m = loadError.toLowerCase();
            const isMissingTable =
              m.includes("does not exist") ||
              m.includes("relation") ||
              m.includes("could not find the table") ||
              m.includes("schema cache") ||
              m.includes("404");
            return isMissingTable
              ? "The schedule_events table isn't set up yet. Run migrations/schedule_events.sql in your Supabase SQL editor to enable saving."
              : loadError;
          })()}
        </div>
      )}
      <header className="border-b border-border px-6 lg:px-8 py-5 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <Tracker tone="muted" size="sm" className="mb-2">
          <TrackerDot color="rgb(239,68,68)" />
          SCHEDULE - {employees.length} {employees.length === 1 ? "EMPLOYEE" : "EMPLOYEES"} - {totalEventsThisMonth} EVENT{totalEventsThisMonth === 1 ? "" : "S"} THIS MONTH
        </Tracker>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex items-baseline gap-4 flex-wrap">
            <h1
              className="font-black text-foreground leading-none"
              style={{
                fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif',
                fontSize: "clamp(26px, 2.6vw, 34px)",
                letterSpacing: "-0.02em",
              }}
            >
              {monthName}
            </h1>
            {selectedEmployeeObj && (
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentForSupaId(selectedEmployeeObj.supa_id) }} />
                Filtering: {selectedEmployeeObj.username}
                <button onClick={() => setSelectedEmployee(null)} className="ml-1 text-muted-foreground hover:text-foreground">x</button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-card">
              <button type="button" onClick={goPrev} aria-label="Previous month"
                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-l-md transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={goToday}
                className="px-3 h-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border-x border-border">
                Today
              </button>
              <button type="button" onClick={goNext} aria-label="Next month"
                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-r-md transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button type="button" onClick={() => openAdd()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 h-8 text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              style={{ boxShadow: "0 4px 12px -2px rgba(239,68,68,0.45)" }}>
              <Plus className="w-3 h-3" />
              New event
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-0">
        <EmployeeSidebar
          employees={filteredEmployees}
          selectedSupaId={selectedEmployee}
          onSelect={(id) => setSelectedEmployee(selectedEmployee === id ? null : id)}
          search={searchQuery}
          onSearch={setSearchQuery}
          eventsByEmployee={eventsByEmployee}
          monthShort={monthShort}
        />

        <main className="overflow-auto">
          <CalendarSurface days={days} onAdd={openAdd} onEdit={openEdit} onRemove={remove} />
        </main>
      </div>

      <EventModal
        isOpen={isAddEventOpen}
        onClose={() => {
          setIsAddEventOpen(false);
          setEditingEvent(null);
          setSelectedDate(null);
        }}
        event={editingEvent}
        employees={employees}
        selectedDate={selectedDate}
        onSave={async (newEvent) => {
          const payload = {
            employee_supa_id: newEvent.employeeSupaId,
            employee_name: newEvent.employeeName,
            title: newEvent.title,
            start_time: newEvent.startTime,
            end_time: newEvent.endTime,
            date: newEvent.date,
            type: newEvent.type,
            notes: newEvent.notes ?? null,
            company: companyLabel,
            created_by_supa_id: mySupaId,
          };

          if (editingEvent) {
            // Update existing row
            const { data, error } = await companySupabase
        .from("schedule_events")
              .update(payload)
              .eq("id", editingEvent.id)
              .select()
              .maybeSingle();
            if (error) {
              setLoadError(`Save failed: ${error.message}`);
              return;
            }
            if (data) {
              const row = rowToEvent(data);
              setEvents((arr) => arr.map((e) => (e.id === editingEvent.id ? row : e)));
            }
          } else {
            // Insert new row
            const { data, error } = await companySupabase
        .from("schedule_events")
              .insert(payload)
              .select()
              .maybeSingle();
            if (error) {
              setLoadError(`Save failed: ${error.message}`);
              return;
            }
            if (data) {
              const row = rowToEvent(data);
              setEvents((arr) => (arr.some((e) => e.id === row.id) ? arr : [...arr, row]));
            }
          }

          setIsAddEventOpen(false);
          setEditingEvent(null);
          setSelectedDate(null);
        }}
      />
    </div>
  );
}

// Employee sidebar ---------------------------------------------------

function EmployeeSidebar({
  employees, selectedSupaId, onSelect, search, onSearch, eventsByEmployee, monthShort,
}: {
  employees: Employee[];
  selectedSupaId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (s: string) => void;
  eventsByEmployee: Map<string, number>;
  monthShort: string;
}) {
  return (
    <aside className="border-r border-border flex flex-col min-h-0" style={{ background: "rgba(0,0,0,0.25)" }}>
      <div className="px-4 pt-5 pb-3 border-b border-border space-y-3">
        <Tracker tone="muted" size="sm">
          <TrackerDot />
          TEAM - {employees.length}
        </Tracker>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search name or role..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-7 h-8 text-[12px] bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-border-strong"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {employees.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Users className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
            <p className="text-[11px] text-muted-foreground">
              {search ? "No matches." : "No employees yet."}
            </p>
          </div>
        ) : (
          employees.map((e) => {
            const isActive = selectedSupaId === e.supa_id;
            const count = eventsByEmployee.get(e.supa_id) ?? 0;
            const accent = accentForSupaId(e.supa_id);
            return (
              <button
                key={e.supa_id}
                type="button"
                onClick={() => onSelect(e.supa_id)}
                data-active={isActive}
                className={[
                  "group w-full flex items-center gap-3 px-2.5 py-2 rounded-md transition-all text-left",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/85 hover:bg-card hover:text-foreground",
                ].join(" ")}
              >
                <div
                  className="relative w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    boxShadow: isActive ? `0 0 0 1px ${accent}` : `inset 0 1px 0 rgba(255,255,255,0.15)`,
                  }}
                >
                  {initialsFor(e.username)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate leading-tight">{e.username}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{e.role}</p>
                </div>

                {count > 0 && (
                  <Mono size="xs" tone={isActive ? "brand" : "muted"} className="shrink-0">
                    {count}
                  </Mono>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[10px] text-muted-foreground/80 leading-snug">
          <Filter className="inline w-2.5 h-2.5 mr-1 -mt-0.5" />
          Click a teammate to filter the calendar to their {monthShort} events.
        </p>
      </div>
    </aside>
  );
}

// Calendar surface --------------------------------------------------

interface DayCell {
  date: Date;
  iso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  events: ScheduleEvent[];
}

function CalendarSurface({
  days, onAdd, onEdit, onRemove,
}: {
  days: DayCell[];
  onAdd: (d: Date) => void;
  onEdit: (e: ScheduleEvent) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      <div className="rounded-xl border border-border bg-card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="px-3 py-2.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
          {days.map((d, i) => (
            <DayCellView key={i} day={d} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Day cell ----------------------------------------------------------

function DayCellView({
  day, onAdd, onEdit, onRemove,
}: {
  day: DayCell;
  onAdd: (d: Date) => void;
  onEdit: (e: ScheduleEvent) => void;
  onRemove: (id: string) => void;
}) {
  const visible = day.events.slice(0, 3);
  const overflow = day.events.length - visible.length;

  return (
    <div
      onClick={() => onAdd(day.date)}
      className={[
        "group relative min-h-[110px] border-r border-b border-border last:border-r-0 px-2 pt-2 pb-1.5 cursor-pointer transition-colors",
        day.isCurrentMonth ? "" : "bg-card/40",
        day.isToday ? "" : "hover:bg-secondary/30",
        day.isWeekend && day.isCurrentMonth ? "bg-card/50" : "",
      ].join(" ")}
      style={
        day.isToday
          ? {
              background: "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.08) 0%, transparent 60%), hsl(var(--card))",
              boxShadow: "inset 3px 0 0 rgb(239,68,68)",
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between mb-1.5">
        <Mono
          size={day.isToday ? "md" : "sm"}
          tone={day.isToday ? "brand" : !day.isCurrentMonth ? "muted" : day.isPast ? "muted" : "fg"}
          className={day.isToday ? "font-black" : "font-bold"}
        >
          {String(day.dayNumber).padStart(2, "0")}
        </Mono>
        {day.isCurrentMonth && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(day.date); }}
            aria-label="Add event"
            className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {visible.map((e) => (
          <EventChip key={e.id} event={e} onEdit={() => onEdit(e)} onRemove={() => onRemove(e.id)} />
        ))}
        {overflow > 0 && (
          <Mono size="xs" tone="muted" className="block pl-1 pt-0.5">
            +{overflow} more
          </Mono>
        )}
      </div>
    </div>
  );
}

// Event chip --------------------------------------------------------

function EventChip({
  event, onEdit, onRemove,
}: {
  event: ScheduleEvent;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const meta = EVENT_TYPE_META[event.type];
  const accent = meta.accent;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      className="group/event rounded px-1.5 py-1 cursor-pointer transition-all flex items-center gap-1.5 text-[10.5px]"
      style={{
        background: `${accent}14`,
        borderLeft: `2px solid ${accent}`,
      }}
    >
      <span
        className="w-3.5 h-3.5 rounded shrink-0 inline-flex items-center justify-center text-[8px] font-black text-white"
        style={{ background: accent }}
      >
        {initialsFor(event.employeeName)[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate leading-tight" style={{ fontSize: "10.5px" }}>
          {event.employeeName}
        </p>
        <p className="text-muted-foreground truncate leading-tight" style={{ fontSize: "9.5px" }}>
          {event.startTime}-{event.endTime}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="opacity-0 group-hover/event:opacity-100 h-4 w-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-opacity"
            aria-label="Event actions"
          >
            <MoreHorizontal className="w-2.5 h-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border">
          <DropdownMenuItem onClick={onEdit} className="text-foreground/85 focus:bg-secondary focus:text-foreground">
            <Edit className="w-3 h-3 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-primary focus:bg-primary/10 focus:text-primary"
          >
            <Trash2 className="w-3 h-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Event modal -------------------------------------------------------

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ScheduleEvent | null;
  employees: Employee[];
  selectedDate: Date | null;
  onSave: (event: ScheduleEvent) => void;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen, onClose, event, employees, selectedDate, onSave,
}) => {
  const firstEmployee = employees[0]?.supa_id ?? "";
  const [formData, setFormData] = useState({
    employeeSupaId: event?.employeeSupaId || firstEmployee,
    title: event?.title || "",
    date: event?.date ||
      (selectedDate ? selectedDate.toISOString().split("T")[0]! : new Date().toISOString().split("T")[0]!),
    startTime: event?.startTime || "09:00",
    endTime: event?.endTime || "17:00",
    type: (event?.type as EventType) || "shift",
    notes: event?.notes || "",
  });

  useEffect(() => {
    if (event) {
      setFormData({
        employeeSupaId: event.employeeSupaId,
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        type: event.type,
        notes: event.notes || "",
      });
    } else if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        date: selectedDate.toISOString().split("T")[0]!,
        employeeSupaId: prev.employeeSupaId || firstEmployee,
      }));
    }
  }, [event, selectedDate, firstEmployee]);

  const handleSubmit = () => {
    const selectedEmp = employees.find((e) => e.supa_id === formData.employeeSupaId);
    const newEvent: ScheduleEvent = {
      id: event?.id || `event-${Date.now()}`,
      employeeSupaId: formData.employeeSupaId,
      employeeName: selectedEmp?.username || "",
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: formData.date,
      type: formData.type,
      notes: formData.notes,
    };
    onSave(newEvent);
  };

  const typeMeta = EVENT_TYPE_META[formData.type];
  const selectedEmpObj = employees.find((e) => e.supa_id === formData.employeeSupaId);
  const empAccent = selectedEmpObj ? accentForSupaId(selectedEmpObj.supa_id) : "rgb(110,110,116)";
  const niceDate = formData.date
    ? new Date(formData.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-xl border-border-strong overflow-hidden p-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.06), transparent 60%), hsl(var(--card))",
        }}
      >
        {/* Brand-rail top edge */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${typeMeta.accent}, transparent)`,
            boxShadow: `0 0 12px ${typeMeta.accent}`,
          }}
        />

        <div className="px-7 pt-7 pb-3">
          <DialogHeader className="space-y-3">
            <Tracker tone="muted" size="sm">
              <TrackerDot color={typeMeta.accent} />
              {event ? "EDIT EVENT" : "NEW EVENT"} - {typeMeta.label}{niceDate ? ` - ${niceDate}` : ""}
            </Tracker>
            <DialogTitle
              className="font-black text-foreground leading-none"
              style={{
                fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif',
                fontSize: "clamp(22px, 2.2vw, 28px)",
                letterSpacing: "-0.02em",
              }}
            >
              {event ? "Edit event." : "New event."}
            </DialogTitle>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Pick the person, the time, and the type. AXON nudges the right
              owner when the event is within 24 hours.
            </p>
          </DialogHeader>
        </div>

        <div className="px-7 pb-6 space-y-5">
          {/* WHO -- avatar preview + native select underneath */}
          <div>
            <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
              Who
            </Label>
            <div className="relative">
              <div
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${empAccent}, ${empAccent}cc)`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {selectedEmpObj ? initialsFor(selectedEmpObj.username) : "?"}
              </div>
              <select
                value={formData.employeeSupaId}
                onChange={(e) => setFormData({ ...formData, employeeSupaId: e.target.value })}
                className="w-full pl-12 pr-3 py-2.5 bg-secondary/40 border border-border-strong text-foreground rounded-md text-[14px] font-semibold focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
              >
                {employees.length === 0 && <option value="">(no employees)</option>}
                {employees.map((emp) => (
                  <option key={emp.supa_id} value={emp.supa_id}>{emp.username} - {emp.role}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* TYPE -- color-coded pill row, not a native select */}
          <div>
            <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
              Type
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(EVENT_TYPE_META) as EventType[]).map((t) => {
                const m = EVENT_TYPE_META[t];
                const isActive = formData.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    data-active={isActive}
                    className={[
                      "relative rounded-md border px-2 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-all",
                      isActive
                        ? "text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
                    ].join(" ")}
                    style={
                      isActive
                        ? {
                            background: `${m.accent}18`,
                            borderColor: `${m.accent}66`,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${m.accent}33, 0 6px 16px -8px ${m.accent}66`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                      style={{
                        background: m.accent,
                        boxShadow: isActive ? `0 0 6px ${m.accent}` : undefined,
                      }}
                    />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TITLE */}
          <div>
            <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
              Title
            </Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Morning shift"
              className="bg-secondary/40 border-border-strong text-foreground placeholder:text-muted-foreground/60 h-10 text-[14px] font-medium focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* DATE + START + END */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
                Date
              </Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
                Start
              </Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
                End
              </Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="bg-secondary/40 border-border-strong text-foreground h-10 text-[13px] font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* NOTES */}
          <div>
            <Label className="text-muted-foreground text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 block">
              Notes <span className="text-muted-foreground/60 font-medium normal-case ml-1">(optional)</span>
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anything to flag for this event..."
              className="bg-secondary/40 border-border-strong text-foreground placeholder:text-muted-foreground/60 min-h-[80px] text-[13px] focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-7 py-4 bg-secondary/20 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-border-strong px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.employeeSupaId}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: "0 4px 12px -2px rgba(239,68,68,0.5)" }}
          >
            {event ? "Update event" : "Create event"}
            <ChevronRight className="w-3 h-3" strokeWidth={3} />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Public export (Suspense-wrapped) ---------------------------------

const EmployeeSchedule: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <Mono size="sm" uppercase>loading schedule...</Mono>
        </div>
      }
    >
      <EmployeeScheduleContent />
    </Suspense>
  );
};

export default EmployeeSchedule;
export { Calendar };
