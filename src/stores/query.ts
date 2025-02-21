import supabase from "@/MyComponents/supabase";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

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

  // Return user data or default values
  return [
    {
      supa_id: data.supa_id,
      username: data.username,
      role: data.role,
      avatar: data.avatar || "/codewithali_logo.png", // Default avatar
    },
  ];
};
export const ActiveUser = () => {
  return useQuery({
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
  return useQuery({
    queryKey: ["creds"],
    queryFn: fetchCreds,
    refetchInterval: 500,
  });
};


// Fetch All CWA Employees
const fetchEmployees = async () => {
  const { data } = await supabase.from("app_users").select("*");
  return data;
};
export const Employees = () => {
  return useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
    refetchInterval: 5000,
  });
};


// Fetch All CWA Interns
const fetchInterns = async () => {
  const { data } = await supabase.from("interns").select("*");
  return data;
};
export const Interns = () => {
  return useQuery({
    queryKey: ["interns"],
    queryFn: fetchInterns,
    refetchInterval: 5000,
  });
};


// Fetch CWA Chat Messages
const fetchMessages = async () => {
  const { data } = await supabase.from("cwa_chat").select("*").order('msg_id', { ascending: false }).limit(10);
  return data?.reverse();
};
export const Messages = () => {
  return useQuery({
    queryKey: ["generalchat"],
    queryFn: fetchMessages,
    refetchInterval: 500,
    refetchIntervalInBackground: true
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
  return useQuery({
    queryKey: ["dmgroups"],
    queryFn: () => fetchDMGroups(user),
    refetchInterval: 1000,
    refetchIntervalInBackground: true
  });
};


// Fetch DM Chat Messages
const fetchDMs = async (groupName: string ) => {
  switch(groupName) {
    case '':
      return [{message: 'Please Select a Group DM'}]
    default:
      const { data } = await supabase.from("cwa_dm_chat").select("*").eq('dm_group', groupName).order('msg_id', { ascending: false }).limit(10);
      return data?.reverse();    
  }
};
export const DMs = (groupName: string) => {
  return useSuspenseQuery({
    queryKey: ["dms"],
    queryFn: () => fetchDMs(groupName),
    refetchInterval: 500,
    refetchIntervalInBackground: true
  });
};