// Time Tracking Type Definitions
// Comprehensive types for the time tracking and proof of work system

// ============================================
// Enums and Constants
// ============================================

export const TIME_CATEGORIES = [
  "Development",
  "Design",
  "Business",
  "Marketing",
  "Meetings",
  "Research",
  "Planning",
  "Documentation",
  "Testing",
  "Deployment",
  "Support",
  "Other",
] as const;

export type TimeCategory = (typeof TIME_CATEGORIES)[number];

export const COMPANIES = [
  { id: "simplicityFunds", name: "SimplicityFunds", color: "#ef4444" },
  { id: "codeWithAli", name: "CodeWithAli", color: "#3b82f6" },
] as const;

export type CompanyId = (typeof COMPANIES)[number]["id"];

// Category colors for UI consistency
export const CATEGORY_COLORS: Record<TimeCategory, { bg: string; text: string; border: string }> = {
  Development: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  Design: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  Business: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  Marketing: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  Meetings: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  Research: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  Planning: { bg: "bg-indigo-500/20", text: "text-indigo-400", border: "border-indigo-500/30" },
  Documentation: { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/30" },
  Testing: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  Deployment: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  Support: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  Other: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
};

// ============================================
// Database Types (matching Supabase schema)
// ============================================

export interface Company {
  id: string;
  name: string;
  color: string;
  logo_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  company_id: string;
  project_id?: string;
  date: string; // YYYY-MM-DD format
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  duration_minutes: number;
  description: string;
  category: TimeCategory;
  tags: string[];
  is_billable: boolean;
  is_verified: boolean;
  proof_attachments: string[];
  created_at: string;
  updated_at: string;
}

// Join type for time entry with related data
export interface TimeEntryWithRelations extends TimeEntry {
  company?: Company;
  project?: Project;
}

// ============================================
// Form Types
// ============================================

export interface TimeEntryFormData {
  company_id: string;
  project_id?: string;
  date: string;
  start_time: string; // HH:mm format for form input
  end_time: string; // HH:mm format for form input
  description: string;
  category: TimeCategory;
  tags: string[];
  is_billable: boolean;
}

export interface TimeEntryCreateData extends Omit<TimeEntry, "id" | "created_at" | "updated_at" | "is_verified" | "user_id"> {
  user_id?: string;
}

export interface TimeEntryUpdateData extends Partial<TimeEntryCreateData> {
  id: string;
}

// ============================================
// Filter and Query Types
// ============================================

export type ViewMode = "daily" | "weekly" | "monthly" | "yearly" | "project";

export interface TimeEntryFilters {
  company_id?: string;
  project_id?: string;
  category?: TimeCategory;
  is_billable?: boolean;
  date_from?: string;
  date_to?: string;
  search?: string;
  tags?: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// Statistics Types
// ============================================

export interface TimeStats {
  total_hours_today: number;
  total_hours_this_week: number;
  total_hours_this_month: number;
  total_hours_this_year: number;
  current_streak: number;
  longest_streak: number;
  billable_hours_this_month: number;
  non_billable_hours_this_month: number;
  most_productive_day: string;
  average_hours_per_day: number;
}

export interface DailyHours {
  date: string;
  total_minutes: number;
  billable_minutes: number;
  entries_count: number;
  by_company: Record<string, number>;
  by_category: Record<TimeCategory, number>;
}

export interface WeeklyStats {
  week_start: string;
  week_end: string;
  daily_hours: DailyHours[];
  total_hours: number;
  billable_hours: number;
  by_company: { company_id: string; company_name: string; hours: number; color: string }[];
  by_project: { project_id: string; project_name: string; hours: number }[];
  by_category: { category: TimeCategory; hours: number }[];
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  daily_hours: DailyHours[];
  total_hours: number;
  billable_hours: number;
  by_company: { company_id: string; company_name: string; hours: number; color: string }[];
  by_project: { project_id: string; project_name: string; hours: number }[];
  by_category: { category: TimeCategory; hours: number }[];
  goal_hours?: number;
  goal_progress?: number;
}

export interface YearlyStats {
  year: number;
  monthly_hours: { month: string; hours: number; billable_hours: number }[];
  total_hours: number;
  billable_hours: number;
  by_company: { company_id: string; company_name: string; hours: number; color: string }[];
  by_project: { project_id: string; project_name: string; hours: number }[];
  by_category: { category: TimeCategory; hours: number }[];
}

export interface ProjectStats {
  project_id: string;
  project_name: string;
  company_id: string;
  company_name: string;
  total_hours: number;
  billable_hours: number;
  entries_count: number;
  first_entry_date: string;
  last_entry_date: string;
  by_category: { category: TimeCategory; hours: number }[];
  timeline: { date: string; hours: number }[];
}

// ============================================
// Report Types
// ============================================

export interface ReportConfig {
  title: string;
  date_range: DateRange;
  company_id?: string;
  project_id?: string;
  include_descriptions: boolean;
  include_charts: boolean;
  include_detailed_entries: boolean;
  redact_sensitive: boolean;
  format: "pdf" | "csv";
}

export interface ProofOfWorkReport {
  id: string;
  generated_at: string;
  date_range: DateRange;
  company?: Company;
  project?: Project;
  total_hours: number;
  billable_hours: number;
  entries_count: number;
  entries: TimeEntryWithRelations[];
  stats: {
    by_category: { category: TimeCategory; hours: number; percentage: number }[];
    by_month: { month: string; hours: number }[];
    average_hours_per_day: number;
    total_days_worked: number;
  };
  public_link?: string;
  expires_at?: string;
}

// ============================================
// Timer Types (for live tracking)
// ============================================

export interface TimerState {
  is_running: boolean;
  start_time?: string;
  elapsed_seconds: number;
  company_id?: string;
  project_id?: string;
  description?: string;
  category?: TimeCategory;
}

// ============================================
// Template Types
// ============================================

export interface TimeEntryTemplate {
  id: string;
  user_id: string;
  name: string;
  company_id: string;
  project_id?: string;
  default_duration_minutes: number;
  description: string;
  category: TimeCategory;
  tags: string[];
  is_billable: boolean;
  created_at: string;
}

// ============================================
// Goal Types
// ============================================

export interface TimeGoal {
  id: string;
  user_id: string;
  type: "weekly" | "monthly";
  target_hours: number;
  company_id?: string;
  project_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface GoalProgress {
  goal: TimeGoal;
  current_hours: number;
  percentage: number;
  remaining_hours: number;
  on_track: boolean;
  projected_hours: number;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert minutes to hours and minutes display string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Convert hours to display string
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Calculate duration in minutes between two time strings (HH:mm format)
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHours, startMins] = startTime.split(":").map(Number);
  const [endHours, endMins] = endTime.split(":").map(Number);

  const startTotalMins = startHours * 60 + startMins;
  let endTotalMins = endHours * 60 + endMins;

  // Handle overnight entries
  if (endTotalMins < startTotalMins) {
    endTotalMins += 24 * 60;
  }

  return endTotalMins - startTotalMins;
}

/**
 * Format time string for display (HH:mm to 12-hour format)
 */
export function formatTime(time: string): string {
  const [hours, mins] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the current week (Sunday)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get company by ID
 */
export function getCompanyById(id: string): (typeof COMPANIES)[number] | undefined {
  return COMPANIES.find((c) => c.id === id);
}

/**
 * Get category color classes
 */
export function getCategoryColors(category: TimeCategory): { bg: string; text: string; border: string } {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

/**
 * Calculate streak (consecutive days with entries)
 */
export function calculateStreak(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };

  const sortedDates = [...new Set(dates)].sort().reverse();
  const today = formatDateISO(new Date());
  const yesterday = formatDateISO(new Date(Date.now() - 86400000));

  let current = 0;
  let longest = 0;
  let tempStreak = 0;

  // Check if streak is still active (logged today or yesterday)
  const streakActive = sortedDates[0] === today || sortedDates[0] === yesterday;

  for (let i = 0; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const prevDate = i > 0 ? new Date(sortedDates[i - 1]) : null;

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
