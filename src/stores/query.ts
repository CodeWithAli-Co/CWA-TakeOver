import supabase from "@/MyComponents/supabase";
import { useSuspenseQuery } from "@tanstack/react-query";

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
    .eq("supa_id", supaID.user?.id)
    .single(); // Fetch a single user
    // console.log("Supabase User Data:", data);

  if (error) {
    console.error("Error fetching active user:", error.message);
    return [];
  }

  const { data: AvatarUrl } = supabase.storage.from('avatars').getPublicUrl(data.avatar)

  // Return user data or default values
  return [
    {
      supa_id: data.supa_id,
      username: data.username,
      role: data.role,
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
  assignee: string[]
  deadline: string
}
const fetchTodos = async (user: string) => {
  
  console.log("Fetching todos for user:", user); // Debug log

  // const { data } = await supabase.from('cwa_todos').select('*').contains('assignee', [user]).order('priority', { ascending: false })



  // Get counts with error handling
  const { count: allTodoCount, error: allCountError } = await supabase
    .from('cwa_todos')
    .select('*');
    // .contains('assignee', [user]);
    
  const { count: todoCount, error: todoCountError } = await supabase
    .from('cwa_todos')
    .select('*');
    // .contains('assignee', [user])
    // .eq('status', 'to-do');
    
  const { count: inProgressTodoCount, error: inProgressCountError } = await supabase
    .from('cwa_todos')
    .select('*');
    // .contains('assignee', [user])
    // .eq('status', 'in-progress');
    
  const { count: doneTodoCount, error: doneCountError } = await supabase
    .from('cwa_todos')
    .select('*');
    // .contains('assignee', [user])
    // .eq('status', 'done');
  
  // Log any count errors
  if (allCountError || todoCountError || inProgressCountError || doneCountError) {
    console.warn('Some count queries had errors:', {
      allCountError, todoCountError, inProgressCountError, doneCountError
    });
  }

    // Now try your filtered query
const { data, error: todosError } = await supabase
.from('cwa_todos')
.select('*')
.contains('assignee', [user]);



   // Check if data is empty or undefined
   if ( todosError != null) {
    // Return a default TodosInterface with empty/zero values
    console.error('Error with Todos Query:', todosError.message);
    return [{
      todo_id: 0,
      created_at: '',
      title: 'No tasks found',
      description: todosError.message ,
      label: '',
      status: 'to-do',
      allCount: allTodoCount || 0,
      todoCount: todoCount || 0,
      inProgressCount: inProgressTodoCount || 0,
      doneCount: doneTodoCount || 0,
      priority: 'medium',
      assignee: [user],
      deadline: ''
    }];
  }
  

  // Check if data is empty
  if (!data || data.length === 0) {
    console.warn('No tasks found for user:', user);
    return [{
      todo_id: 0,
      created_at: '',
      title: 'No tasks found',
      description: 'Create a new task to get started',
      label: '',
      status: 'to-do',
      allCount: 0,
      todoCount: 0,
      inProgressCount: 0,
      doneCount: 0,
      priority: 'medium',
      assignee: [user],
      deadline: ''
    }];
  }


// Return all tasks, not just the first one
return data.map(task => ({
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
  assignee: task.assignee,
  deadline: task.deadline || ''
}));
}
export const Todos = (user: string) => {
  return useSuspenseQuery({
    queryKey: ['todos'],
    queryFn: () => fetchTodos(user)
  })
}