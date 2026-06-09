import { useQuery } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";
import {
  SEED_CHECKPOINTS,
  SEED_DEPENDENCIES,
  SEED_PROFILES,
  LANES,
} from "@/MyComponents/Roadmap/lib/seedData";
import type {
  Checkpoint,
  Dependency,
  Lane,
  RoadmapProfile,
} from "@/MyComponents/Roadmap/lib/types";

/**
 * Fetch helpers. If the Supabase tables haven't been created yet (or the
 * request fails), each hook silently falls back to the seed fixture so the
 * page always renders. That's intentional: the roadmap is expected to be
 * demo-ready even before the migration runs.
 */

const HAS_SUPABASE_ENV = !!(
  import.meta.env.VITE_DB_URL && import.meta.env.VITE_DB_KEY
);

// ------- profiles ---------------------------------------------------------

async function fetchRoadmapProfiles(): Promise<RoadmapProfile[]> {
  if (!HAS_SUPABASE_ENV) return SEED_PROFILES;
  try {
    const { data, error } = await companySupabase
.from("roadmap_profiles")
      .select("*");
    if (error || !data || data.length === 0) return SEED_PROFILES;
    return data.map((r: any) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      role: r.role,
      authorColor: r.author_color,
      avatarUrl: r.avatar_url ?? undefined,
      createdAt: r.created_at,
    }));
  } catch {
    return SEED_PROFILES;
  }
}

export function useRoadmapProfiles() {
  return useQuery({
    queryKey: ["roadmap", "profiles"],
    queryFn: fetchRoadmapProfiles,
    initialData: SEED_PROFILES,
  });
}

// ------- lanes ------------------------------------------------------------

async function fetchRoadmapLanes(): Promise<Lane[]> {
  if (!HAS_SUPABASE_ENV) return LANES;
  try {
    const { data, error } = await companySupabase
.from("roadmap_lanes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return LANES;
    return data.map((r: any) => ({
      id: r.id,
      title: r.title,
      accentHsl: r.accent_hsl,
      sortOrder: r.sort_order,
    }));
  } catch {
    return LANES;
  }
}

export function useRoadmapLanes() {
  return useQuery({
    queryKey: ["roadmap", "lanes"],
    queryFn: fetchRoadmapLanes,
    initialData: LANES,
  });
}

// ------- checkpoints ------------------------------------------------------

async function fetchRoadmapCheckpoints(): Promise<Checkpoint[]> {
  if (!HAS_SUPABASE_ENV) return SEED_CHECKPOINTS;
  try {
    const { data, error } = await companySupabase
.from("roadmap_checkpoints")
      .select("*");
    if (error || !data || data.length === 0) return SEED_CHECKPOINTS;
    return data.map((r: any) => ({
      id: r.id,
      laneId: r.lane_id,
      title: r.title,
      description: r.description ?? undefined,
      startDate: r.start_date,
      targetDate: r.target_date,
      status: r.status,
      ownerId: r.owner_id ?? undefined,
      authorId: r.author_id,
      approvalStatus: r.approval_status,
      metricLabel: r.metric_label ?? undefined,
      metricTarget: r.metric_target ?? undefined,
      metricCurrent: r.metric_current ?? undefined,
      rejectReason: r.reject_reason ?? undefined,
      createdAt: r.created_at,
      approvedAt: r.approved_at ?? undefined,
      completedAt: r.completed_at ?? undefined,
    }));
  } catch {
    return SEED_CHECKPOINTS;
  }
}

export function useRoadmapCheckpoints() {
  return useQuery({
    queryKey: ["roadmap", "checkpoints"],
    queryFn: fetchRoadmapCheckpoints,
    initialData: SEED_CHECKPOINTS,
  });
}

// ------- dependencies -----------------------------------------------------

async function fetchRoadmapDependencies(): Promise<Dependency[]> {
  if (!HAS_SUPABASE_ENV) return SEED_DEPENDENCIES;
  try {
    const { data, error } = await companySupabase
.from("roadmap_dependencies")
      .select("*");
    if (error || !data || data.length === 0) return SEED_DEPENDENCIES;
    return data.map((r: any) => ({
      id: r.id,
      fromId: r.from_id,
      toId: r.to_id,
    }));
  } catch {
    return SEED_DEPENDENCIES;
  }
}

export function useRoadmapDependencies() {
  return useQuery({
    queryKey: ["roadmap", "dependencies"],
    queryFn: fetchRoadmapDependencies,
    initialData: SEED_DEPENDENCIES,
  });
}
