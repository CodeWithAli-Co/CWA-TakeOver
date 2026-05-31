/**
 * employee.lazy.tsx — Team management page (company-aware).
 *
 * CWA / All → Shows app_users from CWA's Supabase (editable, with promote/delete)
 * Simplicity → Shows users from Simplicity's Supabase (read-only admin view)
 */

import { useState, useEffect, useRef } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useAppStore, useSubMenuStore, useCompanyFilter } from "../stores/store";
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
  Crown,
  Droplets,
  Clock,
  Mail,
} from "lucide-react";
import { Employees } from "@/stores/query";
import { takeOversupabase } from "@/MyComponents/supabase";
import { EditEmployee } from "@/MyComponents/subForms/editEmploy";
import { PromoteUser } from "@/MyComponents/subForms/promoteUser";
import { message } from "@tauri-apps/plugin-dialog";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import {
  useSimplicityUsers,
  SimplicityUser,
} from "@/MyComponents/Simplicity/api/simplicityQueries";

// ── CWA role badge styling ──
const roleBadgeStyles: Record<string, string> = {
  CEO: "bg-primary/[0.08] text-primary border-primary/15",
  COO: "bg-blue-500/[0.08] text-blue-400 border-blue-500/15",
  Admin: "bg-amber-500/[0.08] text-amber-400 border-amber-500/15",
  "Project Manager": "bg-purple-500/[0.08] text-purple-400 border-purple-500/15",
  "Marketing Specialist": "bg-pink-500/[0.08] text-pink-400 border-pink-500/15",
  "Security Engineer": "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15",
  Member: "bg-muted text-muted-foreground border-border",
  Intern: "bg-muted/50 text-muted-foreground/70 border-border/50",
};

const getRoleBadgeStyle = (role: string) =>
  roleBadgeStyles[role] || "bg-muted text-muted-foreground border-border";

// ═══════════════════════════════════════════════
// Simplicity Users View
// ═══════════════════════════════════════════════
function SimplicityUsersView() {
  const { data: users = [], isLoading } = useSimplicityUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "plan">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = users
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.plan?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aVal =
        sortField === "name"
          ? `${a.first_name} ${a.last_name}`.toLowerCase()
          : (a.plan || "free").toLowerCase();
      const bVal =
        sortField === "name"
          ? `${b.first_name} ${b.last_name}`.toLowerCase()
          : (b.plan || "free").toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

  const tideCount = users.filter(
    (u) => u.plan === "Tide" || u.plan === "premium"
  ).length;
  const rippleCount = users.filter(
    (u) => u.plan === "Ripple" || u.plan === "free" || !u.plan
  ).length;
  const activeCount = users.filter((u) => u.isActive).length;

  const toggleSort = (field: "name" | "plan") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: "name" | "plan" }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    );
  };

  return (
    <div className="min-h-screen w-full bg-background overflow-y-auto transition-colors duration-500">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-foreground tracking-tight">
                Simplicity Users
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {users.length} registered users on Simplicity Funds
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-[280px] bg-card border border-border rounded-sm text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="px-8 pb-5">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="flex divide-x divide-border">
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Total
              </span>
              <p className="text-xl font-bold text-foreground tracking-tight mt-0.5">
                {users.length}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Active
              </span>
              <p className="text-xl font-bold text-emerald-400 tracking-tight mt-0.5">
                {activeCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  Tide
                </span>
              </div>
              <p className="text-xl font-bold text-primary tracking-tight mt-0.5">
                {tideCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  Ripple
                </span>
              </div>
              <p className="text-xl font-bold text-muted-foreground tracking-tight mt-0.5">
                {rippleCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-10">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-border">
            <button
              onClick={() => toggleSort("name")}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
            >
              Name <SortIcon field="name" />
            </button>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Email
            </span>
            <button
              onClick={() => toggleSort("plan")}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
            >
              Plan <SortIcon field="plan" />
            </button>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Status
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium text-right">
              Joined
            </span>
          </div>

          {/* Table body */}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div>
              {filtered.map((user, i) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 items-center px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Name */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] text-primary font-medium">
                        {`${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium text-foreground/80 truncate">
                      {user.first_name} {user.last_name}
                    </span>
                  </div>

                  {/* Email */}
                  <span className="text-[13px] text-muted-foreground truncate">
                    {user.email || "—"}
                  </span>

                  {/* Plan */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] w-fit rounded-sm ${
                      user.plan === "Tide" || user.plan === "premium"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {user.plan || "Ripple"}
                  </Badge>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        user.isActive ? "bg-emerald-400" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Joined */}
                  <span className="text-[11px] text-muted-foreground text-right">
                    {user.joined_at
                      ? new Date(user.joined_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "—"}
                  </span>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[13px] text-muted-foreground/50">
                    No users found
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} of {users.length} users
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Live from Simplicity DB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CWA Employee View (original, now theme-aware)
// ═══════════════════════════════════════════════
function CWAEmployeeView() {
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
    const channel = takeOversupabase
      .channel("employees-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_users" },
        () => refetchEmployees()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [refetchEmployees]);

  const DelEmployee = async (rowID: number) => {
    const { error } = await takeOversupabase
      .from("app_users")
      .delete()
      .eq("id", rowID);
    if (error) {
      await message(error.message, {
        title: "Error Deleting User",
        kind: "error",
      });
    }
  };

  // Filter + sort
  const filtered =
    employees
      ?.filter(
        (e) =>
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
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: "username" | "role" }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    );
  };

  // Role breakdown for header stats
  const roleCounts =
    employees?.reduce(
      (acc, e) => {
        const role = e.role || "Member";
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ) || {};

  const topRoles: [string, number][] = Object.entries(roleCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5) as [string, number][];

  return (
    <div className="min-h-screen w-full bg-background overflow-y-auto transition-colors duration-500">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-foreground tracking-tight">
                Team
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {employees?.length || 0} members — CodeWithAli
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-[240px] bg-card border border-border rounded-sm text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Role breakdown strip */}
      <div className="px-8 pb-5">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="flex divide-x divide-border">
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Total
              </span>
              <p className="text-xl font-bold text-foreground tracking-tight mt-0.5">
                {employees?.length || 0}
              </p>
            </div>
            {topRoles.map(([role, count]) => (
              <div key={role} className="px-5 py-3.5 flex-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  {role}
                </span>
                <p className="text-xl font-bold text-foreground/80 tracking-tight mt-0.5">
                  {count}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promote form */}
      {showPromote === "show" && (
        <div className="px-8 pb-4">
          <PromoteUser userID={EmpID} />
        </div>
      )}

      {/* Table */}
      <div className="px-8 pb-10">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-6 py-3 border-b border-border">
            <button
              onClick={() => toggleSort("username")}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
            >
              Name <SortIcon field="username" />
            </button>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
              Email
            </span>
            <button
              onClick={() => toggleSort("role")}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
            >
              Role <SortIcon field="role" />
            </button>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium text-right">
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
                className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 items-center px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-sm bg-primary/10 border border-border flex items-center justify-center shrink-0">
                    <span className="text-[11px] text-primary font-medium">
                      {employee.username?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[13px] font-medium text-foreground/80 truncate">
                    {employee.username}
                  </span>
                </div>

                <span className="text-[13px] text-muted-foreground truncate">
                  {employee.email || "—"}
                </span>

                <Badge
                  variant="outline"
                  className={`${getRoleBadgeStyle(employee.role)} text-[10px] w-fit rounded-sm`}
                >
                  {employee.role}
                </Badge>

                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UserView userRole={[Role.COO, Role.CEO]}>
                    <button
                      onClick={() => {
                        setEmpID(employee.id);
                        setShowPromote("show");
                      }}
                      className="p-1.5 rounded-sm text-muted-foreground hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors"
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
                    className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <UserView userRole={[Role.COO, Role.CEO]}>
                    <button
                      onClick={() => DelEmployee(employee.id)}
                      className="p-1.5 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
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
                <Users className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground/50">
                  No members found
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} of {employees?.length || 0} members
            </span>
          </div>
        </div>

        {/* Hidden dialog for edit form */}
        <dialog
          ref={dialogRef}
          className="bg-transparent border-none outline-none backdrop:bg-background/60 backdrop:backdrop-blur-sm"
        >
          <EditEmployee rowID={EmpID} />
        </dialog>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Route Component — switches on company toggle
// ═══════════════════════════════════════════════
function Employee() {
  const { activeCompany } = useCompanyFilter();

  if (activeCompany === "simplicityFunds") {
    return <SimplicityUsersView />;
  }

  return <CWAEmployeeView />;
}

export const Route = createLazyFileRoute("/employee")({
  component: Employee,
});
