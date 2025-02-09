import { Employees } from "../stores/query";
import { Skeleton } from "@/components/ui/skeleton";
import "./compAssets/dispEmployees.css";

function DisplayEmployees() {
  // use isPending instead of isLoading for when state is fetching data
  // Can also use react's Suspense
  const { data: employees, isPending, error } = Employees();

  // Need to fix visibily of Shadcn
  if (isPending) return <Skeleton className="w-[100px] h-[20px] rounded-full" />;
  if (error) return <p>Error Fetching Data</p>;

  const temp = (x: any) => {
    console.log(x);
  };
  return (
    <>
      {/* Add table to display Employees */}
      <h3>Employees</h3>
      
      <section>
        <p>Add new user</p>
      </section>

      <section>
        {employees!.map((user) => (
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
