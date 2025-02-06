import { createLazyFileRoute } from "@tanstack/react-router";
import "../assets/employee.css";
import { useAppStore } from "../stores/main";
import DisplayEmployees from "../components/displayEmployees";
import DisplayInterns from "../components/displayInterns";

function Employee() {
  const { displayer, setDisplayer } = useAppStore();

  return (
    <>
    {/* Eversince added this, app became slow to load up */}
      <nav id="employee-navbar">
        <button type="button" className={`emnavbar-btn ${displayer === 'Employees' && 'activeDisp'}`} onClick={() => setDisplayer('Employees')}>Employees</button>
        <button type="button" className={`emnavbar-btn ${displayer === 'Interns' && 'activeDisp'}`} onClick={() => setDisplayer('Interns')}>Interns</button>
      </nav>

      <div id="employee-body">
        {displayer === 'Employees' && <DisplayEmployees />}
        {displayer === 'Interns' && <DisplayInterns />}
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/employee")({
  component: Employee,
});
