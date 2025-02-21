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
    <div className="min-h-screen w-full bg-black/95 p-8 ">
      {/* Header Section */}
      <div className="max-w-4xl mx-auto ">
        <h3 className="text-3xl text-amber-50 mb-8 text-center">Broadcast Management</h3>
        
        {/* Main Content Container */}
        <div className="bg-gradient-to-b from-red-900 to-black rounded-lg border border-red-900/30">
          
          {/* Add Contact Section */}
          <div className="p-8">
            <h4 className="text-xl text-amber-50 mb-6">Add New Contact</h4>
            <div className="bg-black/80 rounded-lg p-6 border border-red-900/20">
              <form className="space-y-6">
                {/* Email Input */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-2">Email:</label>
                  <input
                    type="email"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg"
                  />
                </div>

                {/* First Name Input */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-2">First Name:</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950  focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg"
                  />
                </div>

                {/* Last Name Input */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-2">Last Name:</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg"
                  />
                </div>

                {/* Status Dropdown */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-2">Status:</label>
                  <select
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950  focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg"
                  >
                    <option value="false" className="bg-white-900">False</option>
                    <option value="true" className="bg-white-900">True</option>
                  </select>
                </div>

                {/* Add Button */}
                <button
                  type="submit"
                  className="w-full mt-6 p-2 bg-red-900 text-amber-50 rounded-lg 
                           hover:bg-red-800 transition-colors duration-300 
                           border border-red-700 neonbtn"
                >
                  Add Contact
                </button>
              </form>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-8 py-4 bg-black/40 grid grid-cols-4 gap-4">
            <button 
              onClick={createMail}
              className="p-2 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn"
            >
              Create Mail
            </button>
            
            <button 
              onClick={sendMail}
              className="p-2 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn"
            >
              Send Mail
            </button>
            
            <button 
              onClick={showModal}
              className="p-2 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn"
            >
              Edit Contact
            </button>
            
            <button 
              onClick={() => DelContact('aalibrahimi0@gmail.com')}
              className="p-2 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn"
            >
              Delete Contact
            </button>
          </div>

          {/* Contact List Section */}
          <div className="p-8">
            <h4 className="text-xl text-amber-50 mb-6">Contact List</h4>
            <div className="bg-black/80 rounded-lg p-6 border border-red-900/20 min-h-[200px]">
              {/* Add your contact list here */}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <dialog 
        ref={dialogRef} 
        className="bg-black/95 text-amber-50 rounded-lg p-8 backdrop:bg-black/50"
      >
        <div className="relative">
          <button 
            onClick={closeModal}
            className="absolute -top-6 -right-6 text-amber-50 hover:text-red-400 
                     transition-colors duration-300 text-xl"
          >
            ×
          </button>
          <EditResendContact />
        </div>
      </dialog>
    </div>
  );
}

export const Route = createLazyFileRoute("/broadcast")({
  component: Broadcast,
});