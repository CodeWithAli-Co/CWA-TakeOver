import "./compAssets/dispEmployees.css";
import supabase from "./supabase";
import { useQuery } from "@tanstack/react-query";
// import Database from "@tauri-apps/plugin-sql";

// getting errors connecting. Might need to use Tanstack Query to bring DB info to frontend properly
// const db = await Database.load(import.meta.env.VITE_DATABASE_URL);
// await db.execute('INSERT INTO ...');

const fetchData = async() => {
  const { data } = await supabase.from('todos').select("*")
  return data
}

function DisplayEmployees() {
  // async function SelectDB() {
  //   const result = await db.select("SELECT * FROM playing_with_neon");
  //   console.log(result);
  // }

  const { data: todos, isLoading, error, status } = useQuery({
    queryKey: ["data"],
    queryFn: fetchData,
    refetchInterval: 5000
  });

  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error Fetching Data</p>

  const temp = (x: any) =>{
    console.log(x)
  }
  return (
    <>
      {/* Add table to display Employees */}
      <h3>Employees</h3>
      <p>Status: {status}</p>
      <div>
      {todos!.map((todo) => (
        <ul key={todo.id} onClick={() => temp(todo)}>
          <li>{todo.task} | Status: {todo.is_complete}</li>
        </ul>
      ))}
    </div>
      {/* <button type="button" onClick={() => SelectDB()}>Run DB</button> */}
    </>
  );
}

export default DisplayEmployees;
