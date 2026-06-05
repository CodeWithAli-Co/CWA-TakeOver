import { takeOversupabase } from "@/MyComponents/supabase";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { message } from "@tauri-apps/plugin-dialog";
import { useCompanyFilter } from "./store";

/* ─── Helper: get current company label for DB storage ─── */
export function getActiveCompanyLabel(): "CodeWithAli" | "simplicity" {
  const raw = useCompanyFilter.getState().activeCompany;
  return raw === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// Fetch Active User with Avatar
//
// IMPORTANT: this function runs at app boot inside a useSuspenseQuery,
// which means it races against Supabase's async session hydration
// from disk. If we return [] when auth.getUser() hasn't resolved a
// session yet, React Query caches the empty result, NavUser falls
// back to "Unknown / Member", and nothing refetches until the user
// manually signs out and back in.
//
// Three defenses, in order:
//   1. If there's no auth user yet, THROW instead of returning [].
//      Suspense + retry will keep trying instead of caching the
//      empty result. Combined with retry: 3 + retryDelay in the
//      hook config below, this typically resolves on the second try
//      once Supabase finishes hydrating.
//   2. A short in-fetch poll: wait up to ~1.5s for auth to land
//      before giving up on the current attempt. Cuts down the
//      number of visible suspense retries.
//   3. An onAuthStateChange subscription (in subscribeActiveUserAuth
//      below) invalidates the cache whenever Supabase emits
//      SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED so any path
//      that wakes the session ends with a fresh user record.
const fetchActiveUser = async () => {
  // Two-layer auth probe:
  //   1. getSession() reads the persisted session straight out of
  //      localStorage — synchronous-ish, doesn't hit the network.
  //      Most reliable signal of "did our previous login survive
  //      the app close".
  //   2. getUser() falls back to a network verify if needed. We
  //      tolerate a slow network here by polling briefly.
  let supaUser: { id: string } | null = null;

  // Layer 1: persisted session from storage.
  const { data: sessionData } = await takeOversupabase.auth.getSession();
  if (sessionData?.session?.user) {
    supaUser = sessionData.session.user;
    // eslint-disable-next-line no-console
    console.debug(
      "[activeuser] session hit from getSession()",
      supaUser.id,
    );
  }

  // Layer 2: poll getUser() if storage didn't give us one.
  if (!supaUser) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await takeOversupabase.auth.getUser();
      if (error) {
        // eslint-disable-next-line no-console
        console.debug(
          "[activeuser] getUser error on attempt",
          attempt,
          error.message,
        );
        break;
      }
      if (data?.user) {
        supaUser = data.user;
        // eslint-disable-next-line no-console
        console.debug(
          "[activeuser] getUser hit on attempt",
          attempt,
        );
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!supaUser) {
    // No persisted session AND no network-verifiable user. The
    // user genuinely needs to re-authenticate. We return [] (not
    // throw) so the UI shows the "Unknown / Member" placeholder
    // briefly while the refetchInterval polls + the auth-state
    // listener waits for a real sign-in. Log loudly so we can
    // diagnose if this hits repeatedly.
    // eslint-disable-next-line no-console
    console.warn(
      "[activeuser] no Supabase session found — session likely expired or never persisted. " +
        "Logging out and back in will fix it. Polling will continue in case session hydrates late.",
    );
    return [];
  }

  // Query user details including avatar
  const { data, error } = await takeOversupabase    .from("app_users")
    .select("*") // Fetch everything
    .eq("supa_id", supaUser.id)
    .single(); // Fetch a single user

  if (error) {
    await message('Error Fetching Current Active User', {
      title: 'Error Fetching User',
      kind: 'error'
    })
    return [];
  }

  const { data: AvatarUrl } = takeOversupabase.storage.from('avatars').getPublicUrl(data.avatar)

  // Return user data or default values
  return [
    {
      supa_id: data.supa_id,
      username: data.username,
      role: data.role,
      role_rank: data.role_rank,
      avatarURL: AvatarUrl.publicUrl || 'default_avatar.png',
      avatarName: data.avatar || 'default_avatar.png',
      // created_at drives the first-sign-in welcome modal (14-day
      // recency window). Without it the modal's createdAt check
      // always yielded 0 and it silently refused to render.
      created_at: data.created_at,
    },
  ];
};
export const ActiveUser = () => {
  return useSuspenseQuery({
    queryKey: ["activeuser"],
    queryFn: fetchActiveUser,
    // Poll every 2s while we have no user — this catches the case
    // where Supabase's session hydration finishes AFTER our initial
    // fetch already returned []. The interval auto-stops the moment
    // we have a real user so we're not hammering the network.
    refetchInterval: (query) => {
      const data = query.state.data as unknown[] | undefined;
      if (!Array.isArray(data) || data.length === 0) return 2000;
      return false;
    },
    // Don't refetch on window focus once we have data — it would
    // briefly swap the cache back to loading via the suspense
    // boundary on every alt-tab.
    refetchOnWindowFocus: false,
    // Once we have the user, keep it warm for a minute.
    staleTime: 60 * 1000,
  });
};

/**
 * Wire up onAuthStateChange → invalidate(["activeuser"]).
 *
 * This is the belt-and-suspenders fix: even if the suspense retries
 * give up (e.g. user takes a long time entering the PIN), as soon
 * as Supabase emits SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED
 * we drop the cached empty result and refetch.
 *
 * Called once from the QueryClient bootstrap (or anywhere that has
 * access to the client). Returns an unsubscribe function for
 * cleanliness in tests / hot-reload — never relied on at runtime.
 */
let activeUserAuthBound = false;
export function subscribeActiveUserAuth(queryClient: {
  invalidateQueries: (filter: { queryKey: unknown[] }) => unknown;
}): () => void {
  if (activeUserAuthBound) return () => {};
  activeUserAuthBound = true;
  const { data: sub } = takeOversupabase.auth.onAuthStateChange(
    (event) => {
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        queryClient.invalidateQueries({ queryKey: ["activeuser"] });
      }
      if (event === "SIGNED_OUT") {
        queryClient.invalidateQueries({ queryKey: ["activeuser"] });
      }
    },
  );
  return () => {
    sub.subscription.unsubscribe();
    activeUserAuthBound = false;
  };
}


// Fetch All CWA Credentials — scoped by company
const fetchCreds = async (folder: string, company: string) => {
  let query = takeOversupabase.from("cwa_creds").select("*").eq('folder', folder);
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data } = await query;
  return data;
};
export const CWACreds = (folder: string) => {
  const { activeCompany } = useCompanyFilter();
  return useSuspenseQuery({
    queryKey: ["creds", folder, activeCompany],
    queryFn: () => fetchCreds(folder, activeCompany),
  });
};


// Fetch All CWA Employees
const fetchEmployees = async () => {
  const { data } = await takeOversupabase.from("app_users").select("*");
  return data;
};
export const Employees = () => {
  return useSuspenseQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
  });
};


// Fetch All CWA Interns
const fetchInterns = async () => {
  const { data } = await takeOversupabase.from("interns").select("*");
  return data;
};
export const Interns = () => {
  return useSuspenseQuery({
    queryKey: ["interns"],
    queryFn: fetchInterns,
  });
};


// Fetch DM Groups — scoped by company
const fetchDMGroups = async (user: string, company: string) => {
  let query = takeOversupabase.from("dm_groups").select("*").contains('subscribers', [user]);
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error: nameError } = await query;
  if (nameError) {
    console.log("NameError:", nameError)
  }
  return data;
};
export const DMGroups = (user: string) => {
  const { activeCompany } = useCompanyFilter();
  return useSuspenseQuery({
    queryKey: ["dmgroups", user, activeCompany],
    queryFn: () => fetchDMGroups(user, activeCompany),
  });
};


// Fetch Chat Messages
export interface MessageReactions {
  [emoji: string]: string[]; // emoji → list of usernames who reacted
}

export interface MessageInterface {
  msg_id: number
  sent_by: string
  created_at: string
  message: string
  userAvatar: string
  dm_group: string
  // Extended fields from 2025 schema migration (all optional for backward compat):
  reply_to?: number | null;     // msg_id of message being replied to
  reactions?: MessageReactions; // emoji → usernames who reacted
  read_by?: string[];           // list of usernames who have read this message
  // 2026 chat_enhancements migration (all optional for backward compat):
  thread_root_id?: number | null; // msg_id of the thread root (if this is a thread reply)
  image_urls?: string[];          // public URLs of attached images
  pinned_at?: string | null;      // ISO timestamp when pinned (null = unpinned)
  pinned_by?: string | null;      // username of the pinner
}

/** Fetch all messages pinned in a group (General or DM). */
export const fetchPinnedMessages = async (
  groupName: string,
): Promise<MessageInterface[]> => {
  if (groupName === "General") {
    const { data } = await takeOversupabase
.from("cwa_chat")
      .select("*")
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false });
    return (data ?? []) as MessageInterface[];
  }
  const { data } = await takeOversupabase    .from("cwa_dm_chat")
    .select("*")
    .eq("dm_group", groupName)
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false });
  return (data ?? []) as MessageInterface[];
};

export const PinnedMessages = (groupName: string) =>
  useSuspenseQuery({
    queryKey: ["pinned-messages", groupName],
    queryFn: () => fetchPinnedMessages(groupName),
  });

/** Fetch all replies in a thread (messages whose thread_root_id matches). */
export const fetchThreadReplies = async (
  groupName: string,
  threadRootId: number,
): Promise<MessageInterface[]> => {
  const table = groupName === "General" ? "cwa_chat" : "cwa_dm_chat";
  let q = takeOversupabase
    .from(table)
    .select("*")
    .eq("thread_root_id", threadRootId)
    .order("msg_id", { ascending: true });
  if (groupName !== "General") q = q.eq("dm_group", groupName);
  const { data } = await q;
  return (data ?? []) as MessageInterface[];
};
const fetchMessages = async (groupName: string ) => {
  switch(groupName) {
    case '':
      return [{message: 'Please Select a Group DM'}]
    case 'General':
      const { data: general } = await takeOversupabase.from("cwa_chat").select("*").order('msg_id', { ascending: false }).limit(50);
      return general?.reverse();
    default:
      const { data: DM } = await takeOversupabase.from("cwa_dm_chat").select("*").eq('dm_group', groupName).order('msg_id', { ascending: false }).limit(50);
      return DM?.reverse();
  }
};
export const Messages = (groupName: string) => {
  // `useQuery` (not suspense) + `keepPreviousData` gives Slack-like UX:
  //   · First visit to a channel → data is undefined → MessageList shows
  //     its inline skeleton.
  //   · Subsequent group switches → previous channel's messages stay
  //     visible for the 100-200ms TanStack Query takes to settle, then
  //     swap in. No layout flicker.
  return useQuery({
    queryKey: ["messages", groupName],
    queryFn: () => fetchMessages(groupName),
    placeholderData: keepPreviousData,
  });
};


// Fetch Todos — scoped by company
export interface TodosInterface {
  todo_id: number
  created_at: string
  title: string
  description: string
  label: string
  status: string
  allCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
  priority: 'high' | 'medium' | 'low'
  priorityOrder: number
  assignee: string[]
  deadline: string
  company?: string
  /** Username of the operator who created / assigned this task.
   *  Populated by the UI + AXON actions on insert. May be null for
   *  legacy rows created before the tasks_assigned_by migration. */
  assigned_by?: string | null
}
const fetchTodos = async (user: string, company: string) => {
  const companyLabel = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";

  let baseQuery = takeOversupabase.from('cwa_todos').select('*').contains('assignee', [user]).order('priorityOrder', { ascending: false });
  let countBase = takeOversupabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]);

  // Apply company filter if not "all"
  if (company !== "all") {
    baseQuery = baseQuery.eq("company", companyLabel);
    countBase = countBase.eq("company", companyLabel);
  }

  const { data, error: todosError } = await baseQuery;
  const { count: allTodoCount, error: allCountError } = await countBase;
  const { count: todoCount, error: todoCountError } = await takeOversupabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'to-do').eq("company", companyLabel);
  const { count: inProgressTodoCount, error: inProgressCountError } = await takeOversupabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'in-progress').eq("company", companyLabel);
  const { count: doneTodoCount, error: doneCountError } = await takeOversupabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'done').eq("company", companyLabel);
  if (todosError || allCountError || todoCountError || inProgressCountError || doneCountError) {
    console.log('Error with Todos Query: ', todosError?.message || allCountError?.message || todoCountError?.message || inProgressCountError?.message || doneCountError?.message)
  }

  return data?.map((task: TodosInterface) => ({
    todo_id: task.todo_id,
    created_at: task.created_at,
    title: task.title,
    description: task.description || '',
    label: task.label || '',
    status: task.status,
    allCount: allTodoCount || data.length,
    todoCount: todoCount || 0,
    inProgressCount: inProgressTodoCount || 0,
    doneCount: doneTodoCount || 0,
    priority: task.priority,
    priorityOrder: task.priorityOrder,
    assignee: task.assignee,
    deadline: task.deadline || '',
    company: task.company || 'CodeWithAli',
    // Carry assigned_by through so TaskDetailModal can show who
    // created the task. `select('*')` returns it from the DB; the
    // mapper just needs to forward it. Without this, every task
    // landed in the UI with assigned_by stripped → "Unknown".
    assigned_by: (task as any).assigned_by ?? null,
  }))
}
export const Todos = (user: string) => {
  const { activeCompany } = useCompanyFilter();
  return useSuspenseQuery({
    queryKey: ['todos', user, activeCompany],
    queryFn: () => fetchTodos(user, activeCompany)
  })
}

// ────────────────────────────────────────────────────────────────
// AllTodos - same shape as Todos but unfiltered by assignee.
// Used by CEO/COO/CFO when they flip the scope toggle to "Everyone".
// ────────────────────────────────────────────────────────────────
const fetchAllTodos = async (company: string) => {
  const companyLabel = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";

  let baseQuery = takeOversupabase.from('cwa_todos').select('*').order('priorityOrder', { ascending: false });
  let countBase = takeOversupabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true });

  if (company !== "all") {
    baseQuery = baseQuery.eq("company", companyLabel);
    countBase = countBase.eq("company", companyLabel);
  }

  const { data } = await baseQuery;
  const { count: allCount } = await countBase;

  // Compute status counts client-side from the result since we already
  // have every row in memory. Avoids 3 extra round-trips per refresh.
  const list = (data ?? []) as TodosInterface[];
  const todoCount = list.filter((t) => t.status === "to-do").length;
  const inProgressCount = list.filter((t) => t.status === "in-progress").length;
  const doneCount = list.filter((t) => t.status === "done").length;

  return list.map((task: TodosInterface) => ({
    todo_id: task.todo_id,
    created_at: task.created_at,
    title: task.title,
    description: task.description || '',
    label: task.label || '',
    status: task.status,
    allCount: allCount || list.length,
    todoCount,
    inProgressCount,
    doneCount,
    priority: task.priority,
    priorityOrder: task.priorityOrder,
    assignee: task.assignee,
    deadline: task.deadline || '',
    company: task.company || 'CodeWithAli',
    // Carry assigned_by through — same fix as fetchTodos above. The
    // C-level "Everyone" scope queries this fetcher; without this
    // line the modal showed "Unknown" for every task even when the
    // DB had a valid assigner.
    assigned_by: (task as any).assigned_by ?? null,
  }));
};

export const AllTodos = () => {
  const { activeCompany } = useCompanyFilter();
  return useSuspenseQuery({
    queryKey: ['allTodos', activeCompany],
    queryFn: () => fetchAllTodos(activeCompany)
  });
};


// Meetings Query — scoped by company
//
// Exported so MeetingCard / drawers / join mutation can all share
// one shape. (Was a local interface; kept the same name.)
export interface MeetingInterface {
  id: number;
  meeting_title: string;
  // Free-form notes / agenda. Nullable — see
  // migrations/meeting_description_and_joins.sql.
  description?: string | null;
  // Opt-in flag. When false (default) the Join button never
  // renders on the card. The creator flips this on/off.
  allow_join?: boolean;
  // Self-added teammates, as user_supa_id strings. Distinct
  // from `attendee_ids` which the creator picks up-front.
  joiners?: string[];
  // Roster the creator picked when adding the meeting. Used to
  // decide whether someone is already "in" before showing Join.
  attendee_ids?: string[];
  // Whoever created the meeting — hides Join button from them.
  created_by?: string | null;
  time?: string;
  date: string;
  attendees: number;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string;
  hybrid_location?: { address: string, url: string };
  company?: string;
}
const fetchMeetings = async (company: string) => {
  let query = takeOversupabase.from('cwa_meetings').select('*');
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error } = await query;
  if (error) {
    console.log('Error fetching Meetings from DB', error.message)
  };

  return data as MeetingInterface[]
};
export const MeetingsQuery = () => {
  const { activeCompany } = useCompanyFilter();
  return useSuspenseQuery({
    queryKey: ["meetings", activeCompany],
    queryFn: () => fetchMeetings(activeCompany)
  });
};

// ────────────────────────────────────────────────────────────────
// axon_checkins — private daily reflections between employee + Axon.
// Owner-only RLS at the DB layer; clients don't need to filter by
// user_id explicitly because the policy returns only the auth.uid()
// owner's rows. Uses plain useQuery (not Suspense) so a missing
// table degrades to empty rather than throwing into the boundary.
// ────────────────────────────────────────────────────────────────
export interface AxonCheckinRow {
  id: string;
  user_id: string;
  prompt: string;
  entry: string | null;
  entry_voice_audio_url: string | null;
  axon_acknowledgement: string | null;
  time_of_day: "morning" | "midday" | "afternoon" | "evening";
  skipped: boolean;
  created_at: string;
  updated_at: string;
}

export const useMyAxonCheckins = (limit: number = 10) => {
  return useQuery({
    queryKey: ["axon_checkins", "mine", limit],
    queryFn: async (): Promise<AxonCheckinRow[]> => {
      const { data, error } = await takeOversupabase
  .from("axon_checkins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        // Table missing or RLS rejected — degrade to empty.
        console.warn("[axon_checkins] query error:", error.message);
        return [];
      }
      return (data ?? []) as AxonCheckinRow[];
    },
    // Reflections are personal + low-velocity. Cache for a minute
    // so re-mounts don't re-fetch on every navigation.
    staleTime: 60_000,
  });
};

// ────────────────────────────────────────────────────────────────
// growth_tracks — Axon-proposed, manager-approved career arc.
// Each user has at most one manager_approved=true row at a time
// (partial unique index enforces this in the DB).
// ────────────────────────────────────────────────────────────────
export interface GrowthMilestoneStep {
  id: string;
  label: string;
  completed: boolean;
  due_date: string | null;
}
export interface GrowthTrackRow {
  id: string;
  user_id: string;
  /** Renamed from current_role to dodge the Postgres reserved keyword.
   *  Semantically still the employee's current role/title in their arc. */
  role_title: string;
  next_milestone: string;
  milestone_steps: GrowthMilestoneStep[];
  axon_note: string | null;
  pacing_status: "on_track" | "attention_needed" | "ahead";
  manager_approved: boolean;
  created_at: string;
  updated_at: string;
}

export const useMyGrowthTrack = () => {
  return useQuery({
    queryKey: ["growth_tracks", "mine", "current"],
    queryFn: async (): Promise<GrowthTrackRow | null> => {
      const { data, error } = await takeOversupabase
  .from("growth_tracks")
        .select("*")
        .eq("manager_approved", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[growth_tracks] query error:", error.message);
        return null;
      }
      return (data as GrowthTrackRow | null) ?? null;
    },
    staleTime: 60_000,
  });
};

/**
 * All approved tracks the current user is permitted to read.
 * Non-managers get just their own row (RLS scopes by user_id);
 * managers (CEO/COO/CFO) get everyone's tracks because the
 * manager-select policy grants them broad read access.
 *
 * Returns rows with the owner's username + role joined in so the
 * /growth page can render employee names without a separate join.
 */
export interface GrowthTrackWithOwner extends GrowthTrackRow {
  owner_username: string | null;
  owner_role: string | null;
}

export const useAllVisibleGrowthTracks = () => {
  return useQuery({
    queryKey: ["growth_tracks", "all-visible"],
    queryFn: async (): Promise<GrowthTrackWithOwner[]> => {
      // Pull the tracks first.
      const { data: tracks, error } = await takeOversupabase
  .from("growth_tracks")
        .select("*")
        .eq("manager_approved", true)
        .order("updated_at", { ascending: false });
      if (error) {
        console.warn(
          "[growth_tracks/all-visible] query error:",
          error.message,
        );
        return [];
      }
      const rows = (tracks ?? []) as GrowthTrackRow[];
      if (rows.length === 0) return [];

      // Resolve owner usernames in a single follow-up query —
      // cheap, avoids needing a view or a foreign-table join.
      const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: owners } = await takeOversupabase
  .from("app_users")
        .select("supa_id, username, role")
        .in("supa_id", ownerIds);
      const ownerMap = new Map<string, { username: string; role: string | null }>();
      for (const o of (owners ?? []) as any[]) {
        ownerMap.set(o.supa_id, { username: o.username, role: o.role ?? null });
      }
      return rows.map((r) => ({
        ...r,
        owner_username: ownerMap.get(r.user_id)?.username ?? null,
        owner_role: ownerMap.get(r.user_id)?.role ?? null,
      }));
    },
    staleTime: 30_000,
  });
};

/**
 * Fetch a specific user's current approved growth track. Used by
 * the manager create/edit modal to pre-fill an "edit existing"
 * flow when the picked employee already has a track.
 */
export const useGrowthTrackForUser = (userId: string | null) => {
  return useQuery({
    queryKey: ["growth_tracks", "for-user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<GrowthTrackRow | null> => {
      if (!userId) return null;
      const { data, error } = await takeOversupabase
  .from("growth_tracks")
        .select("*")
        .eq("user_id", userId)
        .eq("manager_approved", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[growth_tracks/for-user] query error:", error.message);
        return null;
      }
      return (data as GrowthTrackRow | null) ?? null;
    },
    staleTime: 30_000,
  });
};

/**
 * Mutation: toggle a milestone step's `completed` flag. Calls the
 * server-side RPC `toggle_growth_step_completion` which validates
 * the caller is either the track owner or a manager, then patches
 * the JSONB in place. Owner-only update on the row itself stays
 * disallowed by RLS — the RPC is the single supported path.
 *
 * On mutate we apply an optimistic update to the affected caches
 * so the checkmark flips immediately. On error we roll back and
 * surface the message; on settled we invalidate to reconcile.
 */
export const useToggleGrowthStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      trackId: string;
      stepId: string;
      completed: boolean;
    }) => {
      const { data, error } = await takeOversupabase.rpc(
        "toggle_growth_step_completion",
        {
          p_track_id: vars.trackId,
          p_step_id: vars.stepId,
          p_completed: vars.completed,
        },
      );
      if (error) throw new Error(error.message);
      return data as GrowthTrackRow;
    },

    // Optimistic update: patch the affected caches before the
    // server replies so the UI flips instantly.
    onMutate: async (vars) => {
      const patchSteps = (steps: GrowthMilestoneStep[] | undefined) =>
        (steps ?? []).map((s) =>
          s.id === vars.stepId ? { ...s, completed: vars.completed } : s,
        );

      // Snapshot every growth_tracks cache so we can roll back.
      await queryClient.cancelQueries({ queryKey: ["growth_tracks"] });
      const snapshots = queryClient.getQueriesData<any>({
        queryKey: ["growth_tracks"],
      });

      for (const [key, value] of snapshots) {
        if (!value) continue;
        if (Array.isArray(value)) {
          queryClient.setQueryData(
            key,
            value.map((t: any) =>
              t?.id === vars.trackId
                ? { ...t, milestone_steps: patchSteps(t.milestone_steps) }
                : t,
            ),
          );
        } else if (value?.id === vars.trackId) {
          queryClient.setQueryData(key, {
            ...value,
            milestone_steps: patchSteps(value.milestone_steps),
          });
        }
      }
      return { snapshots };
    },

    onError: (_err, _vars, ctx) => {
      // Roll back to the snapshot taken before the mutation.
      if (!ctx?.snapshots) return;
      for (const [key, value] of ctx.snapshots) {
        queryClient.setQueryData(key, value);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["growth_tracks"] });
    },
  });
};

// ────────────────────────────────────────────────────────────────
// team_activity — ambient feed of wins / status changes / kudos.
// Whole-company scope for v1 (no company filter); RLS allows any
// authenticated user to read.
// ────────────────────────────────────────────────────────────────
export interface TeamActivityRow {
  id: string;
  actor_id: string;
  target_id: string | null;
  activity_type: "win" | "status_change" | "kudos";
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const useTeamActivity = (limit: number = 20) => {
  return useQuery({
    queryKey: ["team_activity", limit],
    queryFn: async (): Promise<TeamActivityRow[]> => {
      const { data, error } = await takeOversupabase
  .from("team_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        console.warn("[team_activity] query error:", error.message);
        return [];
      }
      return (data ?? []) as TeamActivityRow[];
    },
    staleTime: 30_000,
  });
};

// ────────────────────────────────────────────────────────────────
// useStrategicFocus — current quarter's strategic priority for the
// active company. Returns the most recently updated row; the
// dashboard card surfaces it on days when the CEO has no meetings,
// turning a "Free today" empty state into a strategic prompt.
//
// Schema: migrations/strategic_focus.sql (cwa_strategic_focus).
// ────────────────────────────────────────────────────────────────
export interface StrategicFocusRow {
  id: string;
  company: string;
  headline: string;
  latest_note: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export const useStrategicFocus = (company: string | null | undefined) => {
  return useQuery({
    queryKey: ["strategic_focus", company],
    queryFn: async (): Promise<StrategicFocusRow | null> => {
      if (!company) return null;
      const { data, error } = await takeOversupabase
  .from("cwa_strategic_focus")
        .select("*")
        .eq("company", company)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        // Don't blow up the dashboard if the table doesn't exist
        // yet (operator hasn't run the migration). Just return null
        // so the card shows its "Set up a focus" empty state.
        if (
          /relation .* does not exist|cwa_strategic_focus/i.test(
            error.message ?? "",
          )
        ) {
          return null;
        }
        console.warn("[strategic_focus] query error:", error.message);
        return null;
      }
      return (data as StrategicFocusRow | null) ?? null;
    },
    enabled: !!company,
    staleTime: 60_000,
  });
};

// ────────────────────────────────────────────────────────────────
// useKudosReceived — recognition feed for the current user.
//
// Filters team_activity to rows where activity_type === "kudos" AND
// target_id === the active employee's supa_id. Used by the employee
// top-strip card to show the most recent kudos + a count of how many
// they've received in the trailing 7 days.
// ────────────────────────────────────────────────────────────────
export const useKudosReceived = (targetSupaId: string | null | undefined, limit: number = 10) => {
  return useQuery({
    queryKey: ["kudos_received", targetSupaId, limit],
    queryFn: async (): Promise<TeamActivityRow[]> => {
      if (!targetSupaId) return [];
      const { data, error } = await takeOversupabase
  .from("team_activity")
        .select("*")
        .eq("activity_type", "kudos")
        .eq("target_id", targetSupaId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        console.warn("[kudos_received] query error:", error.message);
        return [];
      }
      return (data ?? []) as TeamActivityRow[];
    },
    enabled: !!targetSupaId,
    staleTime: 30_000,
  });
};

// ────────────────────────────────────────────────────────────────
// app_users (lightweight) — just supa_id + username + role for
// dropdowns in the Send-kudos and Create-growth-track modals.
// Excludes the current user from kudos targeting (no self-kudos).
// ────────────────────────────────────────────────────────────────
export interface EmployeeRow {
  supa_id: string;
  username: string;
  role: string | null;
}

export const useAllEmployees = (excludeCurrentUser: boolean = false) => {
  return useQuery({
    queryKey: ["app_users", "all", excludeCurrentUser],
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data: auth } = await takeOversupabase.auth.getUser();
      const myId = auth?.user?.id;
      const { data, error } = await takeOversupabase
  .from("app_users")
        .select("supa_id, username, role")
        .order("username", { ascending: true });
      if (error) {
        console.warn("[app_users] query error:", error.message);
        return [];
      }
      const rows = (data ?? []) as EmployeeRow[];
      return excludeCurrentUser && myId
        ? rows.filter((r) => r.supa_id !== myId)
        : rows;
    },
    staleTime: 5 * 60_000, // employees list changes rarely
  });
};
