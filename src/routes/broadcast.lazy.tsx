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

  // Fetch all Contacts
  // useEffect(() => {
  //   async function getContacts() {
  //     await invoke('list_contacts').then((res) => console.log('Listed Contacts', res))
  //   }
  //   getContacts();
  // }, [])

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
    <div className="min-h-screen w-full bg-black/95 p-2 sm:p-4 md:p-8">
      {/* Header Section - Adjusted padding */}
      <div className="max-w-4xl mx-auto">
        <h3 className="text-2xl sm:text-3xl text-amber-50 mb-4 sm:mb-8 text-center">Broadcast Management</h3>
        
        {/* Main Content Container - Improved mobile spacing */}
        <div className="bg-gradient-to-b from-red-900 to-black rounded-lg border border-red-900/30">
          
          {/* Add Contact Section - Responsive padding */}
          <div className="p-4 sm:p-6 md:p-8">
            <h4 className="text-lg sm:text-xl text-amber-50 mb-4 sm:mb-6">Add New Contact</h4>
            <div className="bg-black/80 rounded-lg p-4 sm:p-6 border border-red-900/20">
              <form className="space-y-4 sm:space-y-6">
                {/* Email Input - Adjusted for mobile */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-1 sm:mb-2 text-sm sm:text-base">Email:</label>
                  <input
                    type="email"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg text-sm sm:text-base"
                  />
                </div>

                {/* First Name Input */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-1 sm:mb-2 text-sm sm:text-base">First Name:</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg text-sm sm:text-base"
                  />
                </div>

                {/* Last Name Input */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-1 sm:mb-2 text-sm sm:text-base">Last Name:</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg text-sm sm:text-base"
                  />
                </div>

                {/* Status Dropdown */}
                <div className="w-full">
                  <label className="text-amber-50 block mb-1 sm:mb-2 text-sm sm:text-base">Status:</label>
                  <select
                    className="w-full p-2 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-red-950 focus:rounded-lg transition-all duration-300
                             hover:bg-red-900 hover:rounded-lg text-sm sm:text-base"
                  >
                    <option value="false" className="bg-black">False</option>
                    <option value="true" className="bg-black">True</option>
                  </select>
                </div>

                {/* Add Button - Better mobile touch target */}
                <button
                  type="submit"
                  className="w-full mt-4 sm:mt-6 p-2.5 sm:p-3 bg-red-900 text-amber-50 rounded-lg 
                           hover:bg-red-800 transition-colors duration-300 
                           border border-red-700 neonbtn text-sm sm:text-base"
                >
                  Add Contact
                </button>
              </form>
            </div>
          </div>

          {/* Action Buttons - Responsive grid */}
          <div className="px-4 sm:px-8 py-3 sm:py-4 bg-black/40 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <button 
              onClick={createMail}
              className="p-2 sm:p-2.5 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn text-sm sm:text-base"
            >
              Create Mail
            </button>
            
            <button 
              onClick={sendMail}
              className="p-2 sm:p-2.5 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn text-sm sm:text-base"
            >
              Send Mail
            </button>
            
            <button 
              onClick={showModal}
              className="p-2 sm:p-2.5 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn text-sm sm:text-base"
            >
              Edit Contact
            </button>
            
            <button 
              onClick={() => DelContact('aalibrahimi0@gmail.com')}
              className="p-2 sm:p-2.5 bg-red-900 text-amber-50 rounded-lg hover:bg-red-800 
                       transition-colors duration-300 border border-red-700 neonbtn text-sm sm:text-base"
            >
              Delete Contact
            </button>
          </div>

          {/* Contact List Section */}
          <div className="p-4 sm:p-6 md:p-8">
            <h4 className="text-lg sm:text-xl text-amber-50 mb-4 sm:mb-6">Contact List</h4>
            <div className="bg-black/80 rounded-lg p-4 sm:p-6 border border-red-900/20 min-h-[200px]">
              {/* Add your contact list here */}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog - Improved mobile styling */}
      <dialog 
        ref={dialogRef} 
        className="bg-black/95 text-amber-50 rounded-lg p-4 sm:p-8 backdrop:bg-black/50 w-[95vw] sm:w-auto max-w-lg mx-auto"
      >
        <div className="relative">
          <button 
            onClick={closeModal}
            className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 text-amber-50 hover:text-red-400 
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