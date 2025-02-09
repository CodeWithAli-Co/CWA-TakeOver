import { useAppStore } from '@/stores/store';
import './compAssets/dispInterns.css';
import { useEffect, useRef } from 'react';
import { Interns } from '@/stores/query';
import { Skeleton } from '@/components/ui/skeleton';
import supabase from './supabase';
import { AddIntern } from './subForms/addIntern';
import { EditIntern } from './subForms/editIntern';

function DisplayInterns() {
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
  const { data: interns, isPending, error } = Interns();

  // Need to fix visibily of Shadcn
  if (isPending)
    return <Skeleton className="w-[100px] h-[20px] rounded-full" />;
  if (error) return <p>Error Fetching Interns</p>;

  // Delete Intern
  const DelIntern = async (rowID: number) => {
    const { data: result, error } = await supabase
      .from("interns")
      .delete()
      .eq("id", rowID)
      .select();
    console.log(result);
    if (error) return console.log("Error: ", error.message);
  };

  return (
    <>
      {/* Add table to display Interns */}
      <h3>Interns</h3>

      <section>
        <AddIntern />
      </section>

      <section>
        {interns?.map((user: any) => (
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
                onClick={() => DelIntern(user.id)}
              >
                Delete
              </button>
              {/* Might need to insert dynamic id number in forms so each btn has unique id 'submit${number}' so DOM doesnt complain */}
              <dialog ref={dialogRef} className="dialog">
                <button
                  type="button"
                  id="dialog-close3"
                  onClick={() => closeModal()}
                >
                  X
                </button>
                <EditIntern rowID={user.id} />
              </dialog>
            </div>
        ))}
      </section>
    </>
  );
}

export default DisplayInterns