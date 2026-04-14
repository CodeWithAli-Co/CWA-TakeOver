/**
 * ClientSidebar.tsx — Left pane of the unified invoicer page.
 *
 * Lists all clients with search filter, lets user pick one to view their
 * invoices in the middle pane, and provides inline "Add Client" form
 * (no slide-in Sheet — feels cleaner).
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Users, X, Mail, User } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { Clients as fetchClients } from "@/stores/invoiceQuery";
import { useClientStore } from "@/stores/invoiceStore";
import supabase from "@/MyComponents/supabase";
import Capitalize from "@/MyComponents/Reusables/capitalize";

export const ClientSidebar = () => {
  const { setName, setEmail, name: selectedName } = useClientStore();
  const { data: clients, refetch } = fetchClients();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = clients?.filter((c: any) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const form = useForm({
    defaultValues: { clientName: "", clientEmail: "" },
    onSubmit: async ({ value }) => {
      await supabase.from("clients").insert({
        name: value.clientName,
        email: value.clientEmail,
      });
      form.reset();
      setShowAdd(false);
      refetch();
    },
  });

  const handleSelect = (client: any) => {
    setName(client.name);
    setEmail(client.email);
  };

  return (
    <div className="bg-card border border-border rounded-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-primary/[0.08]">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">
              Clients
            </span>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={`p-1.5 rounded-sm transition-colors ${
              showAdd
                ? "bg-primary/10 text-primary"
                : "bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/[0.06]"
            }`}
            title={showAdd ? "Cancel" : "Add Client"}
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/60 placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
        </div>
      </div>

      {/* Inline Add Client Form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-border overflow-hidden"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="p-3 space-y-2"
          >
            <form.Field
              name="clientName"
              children={(field) => (
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-primary/40" />
                  <input
                    type="text"
                    required
                    placeholder="Client name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Capitalize(e.target.value))}
                    className="w-full pl-7 pr-2 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/70 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/20"
                  />
                </div>
              )}
            />
            <form.Field
              name="clientEmail"
              children={(field) => (
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-primary/40" />
                  <input
                    type="email"
                    required
                    placeholder="client@email.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/70 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/20"
                  />
                </div>
              )}
            />
            <button
              type="submit"
              className="w-full py-1.5 bg-primary hover:bg-primary/80 text-foreground text-[11px] font-medium rounded-sm transition-colors"
            >
              Add Client
            </button>
          </form>
        </motion.div>
      )}

      {/* Client List */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[12px] text-muted-foreground/40">
              {clients?.length === 0 ? "No clients yet" : "No matches"}
            </p>
          </div>
        ) : (
          filtered.map((client: any) => {
            const isSelected = selectedName === client.name;
            return (
              <motion.button
                key={client.id}
                onClick={() => handleSelect(client)}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left px-3 py-2.5 rounded-sm mb-1 transition-all duration-200 group ${
                  isSelected
                    ? "bg-primary/[0.08] border border-primary/15"
                    : "bg-transparent border border-transparent hover:bg-muted/30 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`h-7 w-7 rounded-sm flex items-center justify-center text-[10px] font-medium ${
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/50 text-muted-foreground/70"
                  }`}>
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium truncate ${
                      isSelected ? "text-foreground" : "text-foreground/60 group-hover:text-foreground/80"
                    }`}>
                      {client.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">
                      {client.email}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/40">
          {filtered.length} of {clients?.length || 0} clients
        </p>
      </div>
    </div>
  );
};
