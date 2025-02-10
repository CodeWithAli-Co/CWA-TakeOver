import { AddResendContact } from "@/MyComponents/subForms/addResendContact";
import { EditResendContact } from "@/MyComponents/subForms/editResendContact";
import { useAppStore } from "@/stores/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import '../assets/broadcast.css';

function Broadcast() {
  const { broadcastID, setBroadcastID, resetBroadcastID, setDialog, dialog } =
    useAppStore();
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

  // Delete Contact
  const DelContact = async(Email: string) => {
    await invoke('del_contact', { email: Email }).then((res) => console.log('Deleted Contact:', res))
  }

  const createMail = async () => {
    await invoke("create_broadcast").then((res) =>
      setBroadcastID(res as string)
    );
  };

  const sendMail = async () => {
    await invoke("send_broadcast", { broadcastId: broadcastID });
    resetBroadcastID();
  };
  return (
    <>
      <h3>Broadcast Page</h3>
      <section>
        <AddResendContact />
      </section>
      {/* Need to work on Fetching Contacts function API */}

      <button className="neonbtn" type="button" onClick={() => createMail()}>
        Create Mail
      </button>
      <button className="neonbtn" type="button" onClick={() => sendMail()}>
        Send Mail
      </button>
      <button className="neonbtn" type="button" onClick={() => showModal()}>
        Edit
      </button>
      <button className="neonbtn" type="button" onClick={() => DelContact('aalibrahimi0@gmail.com')}>Delete</button>
      {/* Might need to insert dynamic id number in forms so each btn has unique id 'submit${number}' so DOM doesnt complain */}
      <dialog ref={dialogRef} className="dialog">
        <button type="button" id="dialog-close4" onClick={() => closeModal()}>
          X
        </button>
        <EditResendContact />
      </dialog>
    </>
  );
}

export const Route = createLazyFileRoute("/broadcast")({
  component: Broadcast,
});
