import "./compAssets/dispEmployees.css";
import supabase from "./supabase";
import { useQuery } from "@tanstack/react-query";

const fetchData = async () => {
  const { data } = await supabase.from("app_users").select("*");
  return data;
};

function DisplayEmployees() {
  const {
    data: users,
    isLoading,
    error,
    status,
  } = useQuery({
    queryKey: ["data"],
    queryFn: fetchData,
    refetchInterval: 5000,
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error Fetching Data</p>;

  const temp = (x: any) => {
    console.log(x);
  };
  return (
    <>
      {/* Add table to display Employees */}
      <h3>Employees</h3>
      <p>Status: {status}</p>
      
      <section>
        <p>Add new user</p>
      </section>

      <section>
        {users!.map((user) => (
          <ul key={user.id} onClick={() => temp(user)}>
            <li>
              {user.username} | Role: {user.role}
            </li>
          </ul>
        ))}
      </section>
    </>
  );
}

export default DisplayEmployees;
