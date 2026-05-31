/**
 * GraduationPlan.queries.ts — React Query hooks + mutations against
 * the graduation_plan_* tables. Used exclusively by the Graduation
 * Plan dashboard.
 *
 * One source of truth: queryKey ['graduationPlan'] on the data
 * fetch. Every mutation below invalidates that key, so a single
 * realtime channel (subscribed to in the component) can also just
 * call invalidate to refetch — no manual cache splicing.
 */

import { takeOversupabase } from "@/MyComponents/supabase";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

// ─── Types (mirrors Postgres schema) ───────────────────────────────
export type CourseStatus =
  | "planned"
  | "in_progress"
  | "passed"
  | "failed"
  | "dropped";

export type Season = "spring" | "summer" | "fall" | "winter";

export interface Meta {
  id: number;
  student_name: string;
  university: string;
  program: string;
  target_grad_term: string;
  required_units: number;
  prior_completed_units: number;
  sjsu_gpa: number | null;
  overall_gpa: number | null;
  updated_at: string;
}

export interface Term {
  id: string;
  label: string;
  season: Season;
  year: number;
  tag: string | null;
  mandatory: boolean;
  is_target: boolean;
  position: number;
}

export interface Course {
  id: number;
  term_id: string;
  code: string;
  name: string;
  units: number;
  category: string;
  status: CourseStatus;
  critical: boolean;
  position: number;
  notes: string | null;
}

export interface PlanData {
  meta: Meta;
  terms: Term[];
  courses: Course[];
}

// ─── Single combined fetcher ───────────────────────────────────────
// Three small tables, one query key — keeps cache invalidation
// trivial and avoids the "loaded meta but courses still pending"
// flicker on first render.
async function fetchPlan(): Promise<PlanData> {
  const [metaRes, termsRes, coursesRes] = await Promise.all([
    supabase
      .from("graduation_plan_meta")
      .select("*")
      .eq("id", 1)
      .single(),
    supabase
      .from("graduation_plan_terms")
      .select("*")
      .order("position", { ascending: true }),
    supabase
      .from("graduation_plan_courses")
      .select("*")
      .order("position", { ascending: true }),
  ]);

  if (metaRes.error) throw metaRes.error;
  if (termsRes.error) throw termsRes.error;
  if (coursesRes.error) throw coursesRes.error;

  return {
    meta: metaRes.data as Meta,
    terms: (termsRes.data ?? []) as Term[],
    courses: (coursesRes.data ?? []) as Course[],
  };
}

export const PLAN_QUERY_KEY = ["graduationPlan"] as const;

export function useGraduationPlan() {
  return useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: fetchPlan,
    staleTime: 30_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PLAN_QUERY_KEY });
}

/** Update a single course's status (planned → passed, etc.). Drives
 *  the header completion math. */
export function useUpdateCourseStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id: number; status: CourseStatus }) => {
      const { error } = await takeOversupabase
  .from("graduation_plan_courses")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Move a course to a different term (drag-drop) with optional
 *  position reordering inside the new term. */
export function useMoveCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id: number;
      term_id: string;
      position?: number;
    }) => {
      const update: { term_id: string; position?: number } = {
        term_id: input.term_id,
      };
      if (input.position !== undefined) update.position = input.position;
      const { error } = await takeOversupabase
  .from("graduation_plan_courses")
        .update(update)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Insert a new course at the bottom of a term. */
export function useAddCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      term_id: string;
      code: string;
      name: string;
      units: number;
      category: string;
      critical?: boolean;
    }) => {
      // Bottom-of-term position = (max position in term) + 1
      const { data: existing } = await takeOversupabase
  .from("graduation_plan_courses")
        .select("position")
        .eq("term_id", input.term_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = (existing?.[0]?.position ?? 0) + 1;

      const { error } = await takeOversupabase
  .from("graduation_plan_courses")
        .insert({
          term_id: input.term_id,
          code: input.code,
          name: input.name,
          units: input.units,
          category: input.category,
          critical: input.critical ?? false,
          position: nextPos,
          status: "planned",
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Edit one or more course fields. */
export function useEditCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id: number;
      patch: Partial<
        Pick<Course, "code" | "name" | "units" | "category" | "critical" | "notes">
      >;
    }) => {
      const { error } = await takeOversupabase
  .from("graduation_plan_courses")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Delete a course. */
export function useDeleteCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await takeOversupabase
  .from("graduation_plan_courses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Update meta — GPAs, target grad term, etc. */
export function useUpdateMeta() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          Meta,
          | "sjsu_gpa"
          | "overall_gpa"
          | "target_grad_term"
          | "required_units"
          | "prior_completed_units"
          | "student_name"
          | "program"
          | "university"
        >
      >,
    ) => {
      const { error } = await takeOversupabase
  .from("graduation_plan_meta")
        .update(patch)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Decide the "current" term based on today's date. SJSU windows
 *  are approximate but match typical academic calendar boundaries:
 *
 *    spring : Jan 20 – May 25
 *    summer : May 26 – Aug 19
 *    fall   : Aug 20 – Dec 24
 *    (between Dec 25 and Jan 19: no current term — winter break)
 *
 *  Returns the matching term's id, or null if we're between terms.
 */
export function detectCurrentTermId(terms: Term[], now = new Date()): string | null {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const year = now.getFullYear();

  let season: Season | null = null;
  if ((month === 1 && day >= 20) || (month >= 2 && month <= 4) || (month === 5 && day <= 25)) {
    season = "spring";
  } else if (
    (month === 5 && day >= 26) ||
    month === 6 ||
    month === 7 ||
    (month === 8 && day <= 19)
  ) {
    season = "summer";
  } else if (
    (month === 8 && day >= 20) ||
    month === 9 ||
    month === 10 ||
    month === 11 ||
    (month === 12 && day <= 24)
  ) {
    season = "fall";
  }

  if (!season) return null;
  const match = terms.find((t) => t.season === season && t.year === year);
  return match?.id ?? null;
}

/** Aggregate completed / in-progress / remaining units for the
 *  unit-progress bar, factoring in the user's prior completed units
 *  (transfer credits etc. that aren't in the per-course list). */
export function computeUnitTotals(data: PlanData) {
  const required = data.meta.required_units;
  const prior = data.meta.prior_completed_units;

  const passedUnitsInPlan = data.courses
    .filter((c) => c.status === "passed")
    .reduce((s, c) => s + c.units, 0);

  const inProgressUnits = data.courses
    .filter((c) => c.status === "in_progress")
    .reduce((s, c) => s + c.units, 0);

  const completed = prior + passedUnitsInPlan;
  const remaining = Math.max(0, required - completed - inProgressUnits);

  return { required, completed, inProgress: inProgressUnits, remaining };
}
