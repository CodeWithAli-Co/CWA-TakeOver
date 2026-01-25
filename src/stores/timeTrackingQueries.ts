// Time Tracking Queries and Mutations
// Supabase data access layer for time tracking system

import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import type {
  TimeEntry,
  TimeEntryWithRelations,
  TimeEntryCreateData,
  TimeEntryUpdateData,
  TimeEntryFilters,
  Company,
  Project,
  TimeStats,
  DailyHours,
  WeeklyStats,
  TimeEntryTemplate,
  TimeGoal,
} from "./timeTrackingTypes";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format, subDays, eachDayOfInterval, parseISO } from "date-fns";

// ============================================
// Companies Queries
// ============================================

export function useCompanies() {
  return useSuspenseQuery({
    queryKey: ["time-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_companies")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Company[];
    },
  });
}

// ============================================
// Projects Queries
// ============================================

export function useProjects(companyId?: string) {
  return useSuspenseQuery({
    queryKey: ["time-projects", companyId],
    queryFn: async () => {
      let query = supabase
        .from("time_projects")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Project[];
    },
  });
}

// ============================================
// Helper: Fetch and combine entries with relations
// ============================================

async function fetchEntriesWithRelations(
  entries: TimeEntry[]
): Promise<TimeEntryWithRelations[]> {
  if (entries.length === 0) return [];

  // Fetch all companies
  const { data: companies, error: companyError } = await supabase
    .from("time_companies")
    .select("*");
  if (companyError) throw companyError;

  // Fetch all projects
  const { data: projects, error: projectError } = await supabase
    .from("time_projects")
    .select("*");
  if (projectError) throw projectError;

  // Create lookup maps
  const companyMap = new Map(companies?.map((c) => [c.id, c]) || []);
  const projectMap = new Map(projects?.map((p) => [p.id, p]) || []);

  // Combine entries with their relations
  return entries.map((entry) => ({
    ...entry,
    company: companyMap.get(entry.company_id) || null,
    project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
  })) as TimeEntryWithRelations[];
}

// ============================================
// Time Entries Queries
// ============================================

export function useTimeEntries(filters?: TimeEntryFilters) {
  return useSuspenseQuery({
    queryKey: ["time-entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select("*")
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (filters?.company_id) {
        query = query.eq("company_id", filters.company_id);
      }
      if (filters?.project_id) {
        query = query.eq("project_id", filters.project_id);
      }
      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.is_billable !== undefined) {
        query = query.eq("is_billable", filters.is_billable);
      }
      if (filters?.date_from) {
        query = query.gte("date", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("date", filters.date_to);
      }
      if (filters?.search) {
        query = query.ilike("description", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return fetchEntriesWithRelations(data as TimeEntry[]);
    },
  });
}

export function useTimeEntriesByDate(date: string) {
  return useSuspenseQuery({
    queryKey: ["time-entries-date", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("date", date)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return fetchEntriesWithRelations(data as TimeEntry[]);
    },
  });
}

export function useTimeEntriesByDateRange(startDate: string, endDate: string) {
  return useSuspenseQuery({
    queryKey: ["time-entries-range", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return fetchEntriesWithRelations(data as TimeEntry[]);
    },
  });
}

// ============================================
// Statistics Queries
// ============================================

export function useTimeStats() {
  return useSuspenseQuery({
    queryKey: ["time-stats"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const weekStart = format(getWeekStartDate(today), "yyyy-MM-dd");
      const weekEnd = format(getWeekEndDate(today), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
      const yearStart = format(startOfYear(today), "yyyy-MM-dd");
      const yearEnd = format(endOfYear(today), "yyyy-MM-dd");

      // Fetch all entries for the year (for streak calculation)
      const { data: yearEntries, error: yearError } = await supabase
        .from("time_entries")
        .select("date, duration_minutes, is_billable")
        .gte("date", yearStart)
        .lte("date", yearEnd);

      if (yearError) throw yearError;

      const entries = yearEntries || [];

      // Calculate totals
      const todayTotal = entries
        .filter((e) => e.date === todayStr)
        .reduce((sum, e) => sum + e.duration_minutes, 0);

      const weekTotal = entries
        .filter((e) => e.date >= weekStart && e.date <= weekEnd)
        .reduce((sum, e) => sum + e.duration_minutes, 0);

      const monthTotal = entries
        .filter((e) => e.date >= monthStart && e.date <= monthEnd)
        .reduce((sum, e) => sum + e.duration_minutes, 0);

      const monthBillable = entries
        .filter((e) => e.date >= monthStart && e.date <= monthEnd && e.is_billable)
        .reduce((sum, e) => sum + e.duration_minutes, 0);

      const yearTotal = entries.reduce((sum, e) => sum + e.duration_minutes, 0);

      // Calculate streak
      const dates = entries.map((e) => e.date);
      const { current, longest } = calculateStreakFromDates(dates);

      // Calculate most productive day
      const dayTotals: Record<string, number> = {};
      entries.forEach((e) => {
        const dayOfWeek = format(parseISO(e.date), "EEEE");
        dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + e.duration_minutes;
      });
      const mostProductiveDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      // Calculate average hours per day
      const uniqueDays = new Set(entries.map((e) => e.date)).size;
      const avgMinutesPerDay = uniqueDays > 0 ? yearTotal / uniqueDays : 0;

      const stats: TimeStats = {
        total_hours_today: todayTotal / 60,
        total_hours_this_week: weekTotal / 60,
        total_hours_this_month: monthTotal / 60,
        total_hours_this_year: yearTotal / 60,
        current_streak: current,
        longest_streak: longest,
        billable_hours_this_month: monthBillable / 60,
        non_billable_hours_this_month: (monthTotal - monthBillable) / 60,
        most_productive_day: mostProductiveDay,
        average_hours_per_day: avgMinutesPerDay / 60,
      };

      return stats;
    },
  });
}

export function useWeeklyStats(weekOffset: number = 0) {
  return useSuspenseQuery({
    queryKey: ["time-weekly-stats", weekOffset],
    queryFn: async () => {
      const today = new Date();
      const targetWeek = new Date(today);
      targetWeek.setDate(today.getDate() - weekOffset * 7);

      const weekStart = getWeekStartDate(targetWeek);
      const weekEnd = getWeekEndDate(targetWeek);
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      // Fetch entries without joins
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .order("date");

      if (error) throw error;

      // Fetch companies separately
      const { data: companies, error: companyError } = await supabase
        .from("time_companies")
        .select("*");
      if (companyError) throw companyError;

      const companyMap = new Map((companies || []).map((c) => [c.id, c]));

      // Generate all days in the week
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dailyHours: DailyHours[] = days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayEntries = (entries || []).filter((e) => e.date === dateStr);

        const byCompany: Record<string, number> = {};
        const byCategory: Record<string, number> = {};

        dayEntries.forEach((e) => {
          byCompany[e.company_id] = (byCompany[e.company_id] || 0) + e.duration_minutes;
          byCategory[e.category] = (byCategory[e.category] || 0) + e.duration_minutes;
        });

        return {
          date: dateStr,
          total_minutes: dayEntries.reduce((sum, e) => sum + e.duration_minutes, 0),
          billable_minutes: dayEntries.filter((e) => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0),
          entries_count: dayEntries.length,
          by_company: byCompany,
          by_category: byCategory as Record<string, number>,
        };
      });

      // Aggregate by company
      const companyTotals: Record<string, { name: string; hours: number; color: string }> = {};
      (entries || []).forEach((e) => {
        if (!companyTotals[e.company_id]) {
          const company = companyMap.get(e.company_id);
          companyTotals[e.company_id] = {
            name: company?.name || "Unknown",
            hours: 0,
            color: company?.color || "#888",
          };
        }
        companyTotals[e.company_id].hours += e.duration_minutes / 60;
      });

      // Aggregate by category
      const categoryTotals: Record<string, number> = {};
      (entries || []).forEach((e) => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.duration_minutes / 60;
      });

      const stats: WeeklyStats = {
        week_start: weekStartStr,
        week_end: weekEndStr,
        daily_hours: dailyHours,
        total_hours: (entries || []).reduce((sum, e) => sum + e.duration_minutes, 0) / 60,
        billable_hours: (entries || []).filter((e) => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0) / 60,
        by_company: Object.entries(companyTotals).map(([id, data]) => ({
          company_id: id,
          company_name: data.name,
          hours: data.hours,
          color: data.color,
        })),
        by_project: [],
        by_category: Object.entries(categoryTotals).map(([cat, hours]) => ({
          category: cat as any,
          hours,
        })),
      };

      return stats;
    },
  });
}

// ============================================
// Mutations
// ============================================

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: TimeEntryCreateData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          ...entry,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-stats"] });
      queryClient.invalidateQueries({ queryKey: ["time-weekly-stats"] });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TimeEntryUpdateData) => {
      const { data, error } = await supabase
        .from("time_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-stats"] });
      queryClient.invalidateQueries({ queryKey: ["time-weekly-stats"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["time-stats"] });
      queryClient.invalidateQueries({ queryKey: ["time-weekly-stats"] });
    },
  });
}

// ============================================
// Templates
// ============================================

export function useTimeTemplates() {
  return useSuspenseQuery({
    queryKey: ["time-templates"],
    queryFn: async () => {
      const { data: templates, error } = await supabase
        .from("time_entry_templates")
        .select("*")
        .order("name");

      if (error) throw error;

      // Fetch companies and projects separately
      const { data: companies } = await supabase.from("time_companies").select("*");
      const { data: projects } = await supabase.from("time_projects").select("*");

      const companyMap = new Map((companies || []).map((c) => [c.id, c]));
      const projectMap = new Map((projects || []).map((p) => [p.id, p]));

      return (templates || []).map((t) => ({
        ...t,
        company: companyMap.get(t.company_id) || null,
        project: t.project_id ? projectMap.get(t.project_id) || null : null,
      })) as (TimeEntryTemplate & { company: Company; project: Project | null })[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<TimeEntryTemplate, "id" | "user_id" | "created_at">) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entry_templates")
        .insert({
          ...template,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-templates"] });
    },
  });
}

// ============================================
// Goals
// ============================================

export function useTimeGoals() {
  return useSuspenseQuery({
    queryKey: ["time-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_goals")
        .select("*")
        .eq("is_active", true)
        .order("type");

      if (error) throw error;
      return data as TimeGoal[];
    },
  });
}

// ============================================
// Helper Functions
// ============================================

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEndDate(date: Date): Date {
  const start = getWeekStartDate(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function calculateStreakFromDates(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };

  const uniqueDates = [...new Set(dates)].sort().reverse();
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  let current = 0;
  let longest = 0;
  let tempStreak = 0;

  const streakActive = uniqueDates[0] === today || uniqueDates[0] === yesterday;

  for (let i = 0; i < uniqueDates.length; i++) {
    const currentDate = parseISO(uniqueDates[i]);
    const prevDate = i > 0 ? parseISO(uniqueDates[i - 1]) : null;

    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((prevDate.getTime() - currentDate.getTime()) / 86400000);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longest = Math.max(longest, tempStreak);
        tempStreak = 1;
      }
    }
  }

  longest = Math.max(longest, tempStreak);
  current = streakActive ? tempStreak : 0;

  return { current, longest };
}
