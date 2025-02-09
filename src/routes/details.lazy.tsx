import { createLazyFileRoute } from "@tanstack/react-router";
import { CWACreds } from "../stores/query";
import { invoke } from "@tauri-apps/api/core";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import "../assets/details.css";
import supabase from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";
import { AddData } from "@/MyComponents/subForms/addForm";
import { EditData } from "@/MyComponents/subForms/editForm";

function Details() {
  const { setDialog, dialog, setDisplayer, displayer, resetDisplayer } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const showModal = (dialogDisplay: string) => {
    document.startViewTransition(() => {
      dialogRef.current?.showModal();
    });
    setDisplayer(dialogDisplay);
    setDialog("shown");
  };

  const closeModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.close();
    });
    resetDisplayer();
    setDialog("closed");
  };

  // Close dialog when form is submitted (bc form sets dialog state to 'closed')
  useEffect(() => {
    if (dialog === "closed") {
      document.startViewTransition(() => {
        dialogRef.current?.close();
      });
      resetDisplayer();
    }
  }, [dialog]);

  // Reveal Password
  const getPassword = async (credID: number) => {
    const { data } = await supabase
      .from("cwa_creds")
      .select("id, acc_enc_password")
      .eq("id", credID);
    const decPassword = invoke("decrypt", {
      keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
      encryptedData: data![0].acc_enc_password,
    });
    decPassword.then((res) => console.log(res));
  };

  // Delete Data
  const DelData = async (rowID: number) => {
    const { data: result, error } = await supabase
      .from("cwa_creds")
      .delete()
      .eq("id", rowID)
      .select();
    console.log(result);
    if (error) return console.log("Error: ", error.message);
  };

  // Display Table
  const { data: cwaCreds, isPending, error } = CWACreds();
  // Need to fix visibily of Shadcn
  if (isPending)
    return <Skeleton className="w-[100px] h-[20px] rounded-full" />;
  if (error) return console.log(error.message);
  return (
    <>
      <h3>Details Page</h3>
      {cwaCreds?.map((cred: any) => (
        <div id="details-grid" key={cred.id}>
          <div>
            <p>Platform: {cred.platform_name}</p>
            <p>Username: {cred.acc_username}</p>
            <p>Email: {cred.acc_email}</p>
            <div>
              Password:{" "}
              <p className="password" style={{ display: "inline-block" }}>
                {cred.acc_enc_password}
              </p>
            </div>
            <p>Additional Info: {cred.acc_addinfo}</p>
            <p>Status: {JSON.stringify(cred.active)}</p>
            <button
              className="neonbtn"
              type="button"
              onClick={() => getPassword(cred.id)}
            >
              Reveal Pass
            </button>
            <button
              className="neonbtn"
              type="button"
              onClick={() => showModal("editDialog")}
            >
              Edit
            </button>
            <button
              className="neonbtn"
              type="button"
              onClick={() => DelData(cred.id)}
            >
              Delete
            </button>
          </div>

          {/* Might need to insert dynamic id number in forms so each btn has unique id 'submit${number}' so DOM doesnt complain */}
          <dialog ref={dialogRef} className="dialog">
            <button
              type="button"
              id="dialog-close"
              onClick={() => closeModal()}
            >
              X
            </button>
            {displayer === "editDialog" ? (
              <EditData rowID={cred.id} />
            ) : displayer === "addDialog" ? (
              <AddData />
            ) : (
              "Error Loading Dialog..."
            )}
          </dialog>
        </div>
      ))}
      <button type="button" onClick={() => showModal("addDialog")}>
        Add Data
      </button>
    </>
  );
}

export const Route = createLazyFileRoute("/details")({
  component: Details,
});
