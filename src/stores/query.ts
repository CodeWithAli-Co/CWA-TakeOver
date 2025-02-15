import supabase from "@/MyComponents/supabase";
import { useQuery } from "@tanstack/react-query";

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
    refetchInterval: 5000,
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
const fetchInterns= async () => {
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