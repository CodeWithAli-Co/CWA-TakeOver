import supabase from "@/MyComponents/supabase";
import { useQuery } from "@tanstack/react-query";

// Fetch Active User
const fetchActiveUser = async () => {
  const { data: supaID } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("app_users")
    .select("supa_id, username, role")
    .eq("supa_id", supaID.user?.id);
  return data;
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
const fetchData = async () => {
  const { data } = await supabase.from("app_users").select("*");
  return data;
};
export const Employees = () => {
  return useQuery({
    queryKey: ["data"],
    queryFn: fetchData,
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
