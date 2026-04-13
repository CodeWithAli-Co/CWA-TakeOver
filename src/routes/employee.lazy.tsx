import { useState, useEffect, useRef } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useAppStore, useSubMenuStore } from "../stores/store";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Edit2,
  Trash2,
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  Shield,
} from "lucide-react";
import { Employees } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { EditEmployee } from "@/MyComponents/subForms/editEmploy";
import { PromoteUser } from "@/MyComponents/subForms/promoteUser";
import { message } from "@tauri-apps/plugin-dialog";
import UserView, { Role } from "@/MyComponents/Reusables/userView";

// Role badge styling
const roleBadgeStyles: Record<string, string> = {
  CEO: "bg-red-500/[0.08] text-red-400 border-red-500/15",
  COO: "bg-blue-500/[0.08] text-blue-400 border-blue-500/15",
  Admin: "bg-amber-500/[0.08] text-amber-400 border-amber-500/15",
  "Project Manager": "bg-purple-500/[0.08] text-purple-400 border-purple-500/15",
  "Marketing Specialist": "bg-pink-500/[0.08] text-pink-400 border-pink-500/15",
  "Security Engineer": "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15",
  Member: "bg-white/[0.04] text-white/40 border-white/[0.06]",
  Intern: "bg-white/[0.03] text-white/30 border-white/[0.04]",
};

const getRoleBadgeStyle = (role: string) =>
  roleBadgeStyles[role] || "bg-white/[0.04] text-white/40 border-white/[0.06]";

function Employee() {
  const { setDialog, dialog } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"username" | "role">("username");
  const [sortAsc, setSortAsc] = useState(true);

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

  const { data: employees, refetch: refetchEmployees } = Employees();
  const [EmpID, setEmpID] = useState(0);
  const { showPromote, setShowPromote } = useSubMenuStore();

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("employees-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_users" },
        () => refetchEmployees()
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [refetchEmployees]);

  const DelEmployee = async (rowID: number) => {
    const { error } = await supabase
      .from("app_users")
      .delete()
      .eq("id", rowID);
    if (error) {
      await message(error.message, { title: "Error Deleting User", kind: "error" });
    }
  };

  // Filter + sort
  const filtered = employees
    ?.filter((e) =>
      e.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = (a[sortField] || "").toLowerCase();
      const bVal = (b[sortField] || "").toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }) || [];

  const toggleSort = (field: "username" | "role") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: "username" | "role" }) => {
    if (sortField !== field) return null;
    return sortAsc
      ? <ChevronUp className="h-3 w-3 text-white/30" />
      : <ChevronDown className="h-3 w-3 text-white/30" />;
  };

  // Role breakdown for header stats
  const roleCounts = employees?.reduce((acc, e) => {
    const role = e.role || "Member";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Top roles to show in the header strip
  const topRoles: [string, number][] = Object.entries(roleCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5) as [string, number][];

  return (
    <div className="min-h-screen w-full bg-black overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-white/[0.03] border border-white/[0.04]">
              <Users className="h-5 w-5 text-red-500/70" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">Team</h1>
              <p className="text-[12px] text-white/20 mt-0.5">
                {employees?.length || 0} members across all companies
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-[240px] bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Role breakdown strip */}
      <div className="px-8 pb-5">
        <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
          <div className="flex divide-x divide-white/[0.04]">
            {/* Total */}
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Total</span>
              <p className="text-xl font-bold text-white tracking-tight mt-0.5">{employees?.length || 0}</p>
            </div>
            {/* Top roles */}
            {topRoles.map(([role, count]) => (
              <div key={role} className="px-5 py-3.5 flex-1">
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">{role}</span>
                <p className="text-xl font-bold text-white/80 tracking-tight mt-0.5">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promote form (inline, above table) */}
      {showPromote === "show" && (
        <div className="px-8 pb-4">
          <PromoteUser userID={EmpID} />
        </div>
      )}

      {/* Table */}
      <div className="px-8 pb-10">
        <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-6 py-3 border-b border-white/[0.04]">
            <button
              onClick={() => toggleSort("username")}
              className="flex items-center gap-1.5 text-[10px] text-white/20 uppercase tracking-[0.15em] font-medium hover:text-white/40 transition-colors text-left"
            >
              Name <SortIcon field="username" />
            </button>
            <span className="text-[10px] text-white/20 uppercase tracking-[0.15em] font-medium">
              Email
            </span>
            <button
              onClick={() => toggleSort("role")}
              className="flex items-center gap-1.5 text-[10px] text-white/20 uppercase tracking-[0.15em] font-medium hover:text-white/40 transition-colors text-left"
            >
              Role <SortIcon field="role" />
            </button>
            <span className="text-[10px] text-white/20 uppercase tracking-[0.15em] font-medium text-right">
              Actions
            </span>
          </div>

          {/* Table body */}
          <div>
            {filtered.map((employee, i) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 items-center px-6 py-3.5 border-b border-white/[0.025] last:border-b-0 hover:bg-white/[0.015] transition-colors group"
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-sm bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <span className="text-[11px] text-white/30 font-medium">
                      {employee.username?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[13px] font-medium text-white/75 truncate">
                    {employee.username}
                  </span>
                </div>

                {/* Email */}
                <span className="text-[13px] text-white/30 truncate">
                  {employee.email || "—"}
                </span>

                {/* Role */}
                <Badge
                  variant="outline"
                  className={`${getRoleBadgeStyle(employee.role)} text-[10px] w-fit rounded-sm`}
                >
                  {employee.role}
                </Badge>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UserView userRole={[Role.COO, Role.CEO]}>
                    <button
                      onClick={() => {
                        setEmpID(employee.id);
                        setShowPromote("show");
                      }}
                      className="p-1.5 rounded-sm text-white/15 hover:text-amber-400/70 hover:bg-amber-500/[0.06] transition-colors"
                      title="Promote / Demote"
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                  </UserView>

                  <button
                    onClick={() => {
                      showModal();
                      setEmpID(employee.id);
                    }}
                    className="p-1.5 rounded-sm text-white/15 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <UserView userRole={[Role.COO, Role.CEO]}>
                    <button
                      onClick={() => DelEmployee(employee.id)}
                      className="p-1.5 rounded-sm text-white/15 hover:text-red-400/70 hover:bg-red-500/[0.06] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </UserView>
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <Users className="h-6 w-6 text-white/[0.05] mx-auto mb-2" />
                <p className="text-[13px] text-white/15">No members found</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[11px] text-white/15">
              {filtered.length} of {employees?.length || 0} members
            </span>
          </div>
        </div>

        {/* Hidden dialog for edit form */}
        <dialog ref={dialogRef} className="bg-transparent border-none outline-none backdrop:bg-black/60 backdrop:backdrop-blur-sm">
          <EditEmployee rowID={EmpID} />
        </dialog>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/employee")({
  component: Employee,
});
