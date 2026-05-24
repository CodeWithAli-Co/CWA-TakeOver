import supabase from "@/MyComponents/supabase";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { message } from "@tauri-apps/plugin-dialog";
import { useCompanyFilter } from "./store";

/* ─── Helper: get current company label for DB storage ─── */
export function getActiveCompanyLabel(): "CodeWithAli" | "simplicity" {
  const raw = useCompanyFilter.getState().activeCompany;
  return raw === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// Fetch Active User with Avatar
const fetchActiveUser = async () => {
  const { data: supaID, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Error fetching user:", authError.message);
    return [];
  }

  // Query user details including avatar
  const { data, error } = await supabase
    .from("app_users")
    .select("*") // Fetch everything
    .eq("supa_id", supaID.user.id)
    .single(); // Fetch a single user

  if (error) {
    await message('Error Fetching Current Active User', {
      title: 'Error Fetching User',
      kind: 'error'
    })
    return [];
  }

  const { data: AvatarUrl } = supabase.storage.from('avatars').getPublicUrl(data.avatar)

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
  });
};


// Fetch All CWA Credentials — scoped by company
const fetchCreds = async (folder: string, company: string) => {
  let query = supabase.from("cwa_creds").select("*").eq('folder', folder);
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
  const { data } = await supabase.from("app_users").select("*");
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
  const { data } = await supabase.from("interns").select("*");
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
  let query = supabase.from("dm_groups").select("*").contains('subscribers', [user]);
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
    const { data } = await supabase
      .from("cwa_chat")
      .select("*")
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false });
    return (data ?? []) as MessageInterface[];
  }
  const { data } = await supabase
    .from("cwa_dm_chat")
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
  let q = supabase
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
      const { data: general } = await supabase.from("cwa_chat").select("*").order('msg_id', { ascending: false }).limit(50);
      return general?.reverse();
    default:
      const { data: DM } = await supabase.from("cwa_dm_chat").select("*").eq('dm_group', groupName).order('msg_id', { ascending: false }).limit(50);
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

  let baseQuery = supabase.from('cwa_todos').select('*').contains('assignee', [user]).order('priorityOrder', { ascending: false });
  let countBase = supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]);

  // Apply company filter if not "all"
  if (company !== "all") {
    baseQuery = baseQuery.eq("company", companyLabel);
    countBase = countBase.eq("company", companyLabel);
  }

  const { data, error: todosError } = await baseQuery;
  const { count: allTodoCount, error: allCountError } = await countBase;
  const { count: todoCount, error: todoCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'to-do').eq("company", companyLabel);
  const { count: inProgressTodoCount, error: inProgressCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'in-progress').eq("company", companyLabel);
  const { count: doneTodoCount, error: doneCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'done').eq("company", companyLabel);
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

  let baseQuery = supabase.from('cwa_todos').select('*').order('priorityOrder', { ascending: false });
  let countBase = supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true });

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
interface MeetingInterface {
  id: number;
  meeting_title: string;
  time?: string;
  date: string;
  attendees: number;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string;
  hybrid_location?: { address: string, url: string };
  company?: string;
}
const fetchMeetings = async (company: string) => {
  let query = supabase.from('cwa_meetings').select('*');
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
