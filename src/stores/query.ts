import supabase from "@/MyComponents/supabase";
import { useSuspenseQuery } from "@tanstack/react-query";
import { message } from "@tauri-apps/plugin-dialog";

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
    // console.log("Supabase User Data:", data);

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
      avatarName: data.avatar || 'default_avatar.png'
    },
  ];
};
export const ActiveUser = () => {
  return useSuspenseQuery({
    queryKey: ["activeuser"],
    queryFn: fetchActiveUser,
  });
};


// Fetch All CWA Credentials
const fetchCreds = async () => {
  const { data } = await supabase.from("cwa_creds").select("*");
  return data;
};
export const CWACreds = () => {
  return useSuspenseQuery({
    queryKey: ["creds"],
    queryFn: fetchCreds,
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


// Fetch DM Groups
const fetchDMGroups = async (user: string) => {
  const { data, error: nameError } = await supabase.from("dm_groups").select("*").contains('subscribers', [user])
  if (nameError) {
    console.log("NameError:", nameError)
  }
  return data;
};
export const DMGroups = (user: string) => {
  return useSuspenseQuery({
    queryKey: ["dmgroups"],
    queryFn: () => fetchDMGroups(user),
  });
};


// Fetch Chat Messages
export interface MessageInterface {
  msg_id: number
  sent_by: string
  created_at: string
  message: string
  userAvatar: string
  dm_group: string
}
const fetchMessages = async (groupName: string ) => {
  switch(groupName) {
    case '':
      return [{message: 'Please Select a Group DM'}]
    case 'General':
      const { data: general } = await supabase.from("cwa_chat").select("*").order('msg_id', { ascending: false }).limit(10);
      return general?.reverse();
    default:
      const { data: DM } = await supabase.from("cwa_dm_chat").select("*").eq('dm_group', groupName).order('msg_id', { ascending: false }).limit(10);
      return DM?.reverse();    
  }
};
export const Messages = (groupName: string) => {
  return useSuspenseQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages(groupName)
  });
};


// Fetch Todos
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
}
const fetchTodos = async (user: string) => {

  const { data, error: todosError } = await supabase.from('cwa_todos').select('*').contains('assignee', [user]).order('priorityOrder', { ascending: false })
  const { count: allTodoCount, error: allCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user])
  const { count: todoCount, error: todoCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'to-do')
  const { count: inProgressTodoCount, error: inProgressCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'in-progress')
  const { count: doneTodoCount, error: doneCountError } = await supabase.from('cwa_todos').select('todo_id', { count: 'exact', head: true }).contains('assignee', [user]).eq('status', 'done')
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
    deadline: task.deadline || ''
  }))
  // return returnData
}
export const Todos = (user: string) => {
  return useSuspenseQuery({
    queryKey: ['todos'],
    queryFn: () => fetchTodos(user)
  })
}


// Meetings Query
interface MeetingInterface {
  id: number;
  meeting_title: string;
  time?: string;
  date: string;
  attendees: number;
  meeting_type?: "online" | "in-person" | "hybrid";
  location?: string;
  hybrid_location?: { address: string, url: string };
}
const fetchMeetings = async () => {
  const { data, error } = await supabase.from('cwa_meetings').select('*')
  if (error) {
    console.log('Error fetching Meetings from DB', error.message)
  };

  return data as MeetingInterface[]
};
export const MeetingsQuery = () => {
  return useSuspenseQuery({
    queryKey: ["meetings"],
    queryFn: fetchMeetings
  });
};