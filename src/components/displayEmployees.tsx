import "./compAssets/dispEmployees.css";
// import Database from "@tauri-apps/plugin-sql";

// getting errors connecting. Might need to use Tanstack Query to bring DB info to frontend properly
// const db = await Database.load(import.meta.env.VITE_DATABASE_URL);
// await db.execute('INSERT INTO ...');


function DisplayEmployees() {
  // async function SelectDB() {
  //   const result = await db.select("SELECT * FROM playing_with_neon");
  //   console.log(result);
  // }

  return (
    <>
      {/* Add table to display Employees */}
      <h3>Employees</h3>
      {/* <button type="button" onClick={() => SelectDB()}>Run DB</button> */}
    </>
  );
}

export default DisplayEmployees;
