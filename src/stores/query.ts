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
    console.log("Supabase User Data:", data);

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
      avatar: data.avatar || "/public/codewithali_logo.png", // Default avatar
    },
  ];
};

export const ActiveUser = () => {
  return useQuery({
    queryKey: ["activeuser"],
    queryFn: fetchActiveUser,
  });
};
