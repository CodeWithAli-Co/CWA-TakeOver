import { createLazyFileRoute } from "@tanstack/react-router";
import { CWACreds } from "../stores/query";
import { invoke } from "@tauri-apps/api/core";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import "../assets/details.css";
import supabase from "@/MyComponents/supabase";
import { EditData } from "@/MyComponents/editForm";
import { useAppStore } from "@/stores/store";

function Details() {
  const { setDialog, dialog } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const showModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.showModal();
    });
    setDialog("shown");
  };

  const closeModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.close();
    });
    setDialog("closed");
  };

  useEffect(() => {
    if (dialog === "closed") {
      document.startViewTransition(() => {
        dialogRef.current?.close();
      });
    }
  }, [dialog]);

  // Insert data
  // Encrypting password before inserting
  const AddData = async (
    platform_name: string,
    username: string,
    email: string,
    password: string,
    AddInfo: string,
    Status: boolean
  ) => {
    const encPassword = invoke("encrypt", {
      keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
      plaintext: password,
    });
    encPassword.then(async (res) => {
      const { error } = await supabase.from("cwa_creds").insert({
        platform_name: platform_name,
        acc_username: username,
        acc_email: email,
        acc_enc_password: res,
        acc_addinfo: AddInfo,
        active: Status,
      });
      if (error) return console.log(error.message);
    });
  };

  const getPassword = async (credID: string) => {
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
  const DelData = async (rowID: any) => {
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
              onClick={() => getPassword(String(cred.id))}
            >
              Reveal Pass
            </button>
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
              onClick={() => DelData(cred.id)}
            >
              Delete
            </button>
          </div>
          <dialog ref={dialogRef} className="dialog">
            <button
              type="button"
              id="dialog-close"
              onClick={() => closeModal()}
            >
              X
            </button>
            <EditData rowID={cred.id} />
          </dialog>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          AddData("Boom", "rawr", "rawr@gm.com", "lolgagger", "pls work", true)
        }
      >
        Add Data
      </button>
    </>
  );
}

export const Route = createLazyFileRoute("/details")({
  component: Details,
});
