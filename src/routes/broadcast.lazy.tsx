import React from "react";
import { AddResendContact } from "@/MyComponents/subForms/addResendContact";
import { EditResendContact } from "@/MyComponents/subForms/editResendContact";
import { useAppStore } from "@/stores/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
// import '../assets/broadcast.css';
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/shadcnComponents/card";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { useState } from "react";
import {
  Mail,
  UserPlus,
  Users,
  Send,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
} from "lucide-react";

interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  status: boolean;
}

interface NewContact {
  email: string;
  firstName: string;
  lastName: string;
}
// console bug caatching for the contaacts
try {
  console.log("Fetching contacts...");
  const result = await invoke("list_contacts");
  console.log("Contacts fetched:", result);
  // setContacts(result as Contact[]);
} catch (error) {
  console.error("Error fetching contacts:", error);
}

interface FormEvent extends React.FormEvent<HTMLFormElement> {
  preventDefault: () => void;
}

// Mock data for demonstration

function BroadcastManagement() {
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

  // Adding these states handlers and function (without it the add contact doesn't get submitted proprly)
  const [newContact, setNewContact] = useState<NewContact>({
    email: "",
    firstName: "",
    lastName: "",
  });

  // Type the event handlers
  const handleAddContact = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    try {
      await invoke("add_contact", {
        email: newContact.email,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
      });

      setNewContact({
        email: "",
        firstName: "",
        lastName: "",
      });

      // Refresh contacts with proper typing
      const result = await invoke("list_contacts");
      setContacts(result as Array<Contact>); // Assuming Contact interface exists
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  // Time to add some contacts mapping hehe
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    async function getContacts() {
      try {
        const result = await invoke("list_contacts");
        setContacts(
          result as Array<{
            email: string;
            firstName: string;
            lastName: string;
            status: boolean;
          }>
        );
      } catch (error) {
        console.error("error fetching contacts", error);
      }
    }
    getContacts();
  }, []);

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
  const DelContact = async (Email: string) => {
    await invoke("del_contact", { email: Email }).then((res) =>
      console.log("Deleted Contact:", res)
    );
  };

  const createMail = async () => {
    await invoke("create_broadcast").then((res) =>
      setBroadcastID(res as string)
    );
  };

  const sendMail = async () => {
    await invoke("send_broadcast", { broadcastId: broadcastID });
    resetBroadcastID();
  };

  // were going to filter out contacts based on search

  // `searchLower` is just `searchTerm` converted to lowercase
  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.email.toLowerCase().includes(searchLower) || // Check if email contains search term
      contact.firstName.toLowerCase().includes(searchLower) || // Check first name
      contact.lastName.toLowerCase().includes(searchLower) // Check last name
    );
  });

  return (
    <div className="min-h-screen bg-black">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-50">
              Broadcast Management
            </h1>
            <p className="text-amber-50/70">
              Manage your contact list and broadcast messages.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={createMail}
              className="bg-red-900 hover:bg-red-800 text-amber-50"
            >
              <Mail className="h-4 w-4 mr-2" />
              Create Mail
            </Button>
            <Button
              onClick={sendMail}
              className="bg-red-900 hover:bg-red-800 text-amber-50"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Mail
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Contact Form */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-amber-50">Add New Contact</CardTitle>
              <CardDescription className="text-amber-50/70">
                Add a new contact to your broadcast list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-amber-50/70">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newContact.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContact((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="bg-black/40 border-red-900/30 text-amber-50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-amber-50/70">First Name</label>
                  <Input
                    type="text"
                    placeholder="First Name"
                    value={newContact.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContact((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    className="bg-black/40 border-red-900/30 text-amber-50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-amber-50/70">Last Name</label>
                  <Input
                    type="text"
                    placeholder="Last Name"
                    value={newContact.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewContact((prev) => ({
                        ...prev,
                        LastName: e.target.value,
                      }))
                    }
                    className="bg-black/40 border-red-900/30 text-amber-50"
                    required
                  />
                </div>
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full bg-red-900 hover:bg-red-800 text-amber-50"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Contact List */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-amber-50">Contact List</CardTitle>
                  <CardDescription className="text-amber-50/70">
                    Manage your existing contacts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[200px] bg-black/40 border-red-900/30 text-amber-50"
                  />
                  <Button
                    variant="outline"
                    className="border-red-900/30 text-amber-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {filteredContacts.map((contact, i) => (
                    <motion.div
                      key={contact.email}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-black/60 border border-red-900/30 hover:border-red-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-900/20">
                          <Users className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-amber-50">
                            {contact.firstName} {contact.lastName}
                          </h3>
                          <p className="text-xs text-amber-50/70">
                            {contact.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            contact.status
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }
                        >
                          {contact.status ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20"
                            onClick={showModal}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-50/70 hover:text-red-400 hover:bg-red-900/20"
                            onClick={() => DelContact(contact.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Broadcast Stats */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-amber-50">
                Broadcast Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm text-amber-50/70">Total Contacts</h3>
                    <Users className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">1,234</p>
                </div>
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm text-amber-50/70">Active Status</h3>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">89%</p>
                </div>
                <div className="p-4 rounded-lg bg-black/60 border border-red-900/30">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm text-amber-50/70">
                      Failed Deliveries
                    </h3>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-50 mt-2">2.3%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Contact Dialog */}
      <Dialog>
        <DialogContent className="bg-black/95 border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-amber-50">Edit Contact</DialogTitle>
          </DialogHeader>
          {/* Add your edit form content here */}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createLazyFileRoute("/broadcast")({
  component: BroadcastManagement,
});
