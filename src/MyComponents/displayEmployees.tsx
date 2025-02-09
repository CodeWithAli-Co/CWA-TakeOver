import { Employees } from "../stores/query";
import { Skeleton } from "@/components/ui/skeleton";
import "./compAssets/dispEmployees.css";
import { AddEmployee } from "./subForms/addEmploy";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/store";
import { EditEmployee } from "./subForms/editEmploy";
import supabase from "./supabase";

function DisplayEmployees() {
  const { setDialog, dialog } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Show dialog
  const showModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.showModal();
    });
    setDialog("shown");
  };

  // Close dialog
  const closeModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.close();
    });
    setDialog("closed");
  };

  // Close dialog when form is submitted (bc form sets dialog state to 'closed')
  useEffect(() => {
    if (dialog === "closed") {
      document.startViewTransition(() => {
        dialogRef.current?.close();
      });
    }
  }, [dialog]);

  // Display Data
  // use isPending instead of isLoading for when state is fetching data
  // Can also use react's Suspense
  const { data: employees, isPending, error } = Employees();

  // Need to fix visibily of Shadcn
  if (isPending)
    return <Skeleton className="w-[100px] h-[20px] rounded-full" />;
  if (error) return <p>Error Fetching Data</p>;

  // Delete Employee
  const DelEmployee = async (rowID: number) => {
    const { data: result, error } = await supabase
      .from("app_users")
      .delete()
      .eq("id", rowID)
      .select();
    console.log(result);
    if (error) return console.log("Error: ", error.message);
  };

  return (
    <>
      {/* Add table to display Employees */}
      <h3>Employees</h3>

      <section>
        <AddEmployee />
      </section>

      <section>
        {employees?.map((user: any) => (
            <div key={user.id}>
              <p>
                {user.username} | Role: {user.role}
              </p>
              <button
                className="neonbtn"
                type="button"
                onClick={() => showModal()}
              >
                Edit
              </button>
              <button
                className="neonbtn"
                type="button"
                onClick={() => DelEmployee(user.id)}
              >
                Delete
              </button>
              {/* Might need to insert dynamic id number in forms so each btn has unique id 'submit${number}' so DOM doesnt complain */}
              <dialog ref={dialogRef} className="dialog">
                <button
                  type="button"
                  id="dialog-close2"
                  onClick={() => closeModal()}
                >
                  X
                </button>
                <EditEmployee rowID={user.id} />
              </dialog>
            </div>
        ))}
      </section>
    </>
  );
}

export default DisplayEmployees;
