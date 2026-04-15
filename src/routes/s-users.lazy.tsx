/**
 * s-users.lazy.tsx — Simplicity User Management
 * Full admin table of Simplicity users with management capabilities.
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  Crown,
  Droplets,
  Shield,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";
import {
  useSimplicityUsers,
  SimplicityUser,
} from "@/MyComponents/Simplicity/api/simplicityQueries";

// ── User Detail Panel ────────────────────────────────────────────────
interface UserDetailPanelProps {
  user: SimplicityUser;
  isOpen: boolean;
  onClose: () => void;
}

function UserDetailPanel({ user, isOpen, onClose }: UserDetailPanelProps) {
  const handleToggleActive = async () => {
    console.log("Toggle active:", user.id);
    // TODO: Implement toggle active via API
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {user.first_name} {user.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-muted/50 rounded transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Plan & Status */}
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    Plan
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    {user.plan === "Tide" || user.plan === "premium" ? (
                      <Crown className="h-4 w-4 text-primary" />
                    ) : (
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {user.plan || "Ripple"}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    Status
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleToggleActive}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      {user.isActive ? (
                        <ToggleRight className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          user.isActive
                            ? "text-emerald-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    2FA Enabled
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    {user.two_fa_enabled ? (
                      <Shield className="h-4 w-4 text-primary" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground/50" />
                    )}
                    <span className="text-sm text-foreground">
                      {user.two_fa_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    Last Login
                  </span>
                  <p className="text-sm text-foreground mt-2">
                    {user.last_login_at
                      ? new Date(user.last_login_at * 1000).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>

                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    Savings Rate
                  </span>
                  <p className="text-sm font-medium text-foreground mt-2">
                    {user.savings_rate
                      ? `${(user.savings_rate * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>

                <div className="bg-muted/30 rounded-sm p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                    Joined
                  </span>
                  <p className="text-sm text-foreground mt-2">
                    {new Date(user.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-border">
                <button className="w-full py-2 px-3 bg-primary/10 hover:bg-primary/15 text-primary text-sm font-medium rounded-sm transition-colors">
                  Change Plan
                </button>
                <button className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-500/15 text-red-400 text-sm font-medium rounded-sm transition-colors">
                  Suspend Account
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main Users Table ─────────────────────────────────────────────────
function SimplicityUsersPage() {
  const { data: users = [], isLoading, isError } = useSimplicityUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "plan" | "joined">(
    "name"
  );
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedUser, setSelectedUser] = useState<SimplicityUser | null>(null);

  const filtered = users
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === "name") {
        aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
        bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sortField === "plan") {
        aVal = (a.plan || "ripple").toLowerCase();
        bVal = (b.plan || "ripple").toLowerCase();
      } else {
        aVal = new Date(a.joined_at).getTime();
        bVal = new Date(b.joined_at).getTime();
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const tideCount = users.filter(
    (u) => u.plan === "Tide" || u.plan === "premium"
  ).length;
  const rippleCount = users.filter(
    (u) => u.plan === "Ripple" || u.plan === "free" || !u.plan
  ).length;
  const activeCount = users.filter((u) => u.isActive).length;

  const toggleSort = (field: "name" | "plan" | "joined") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: "name" | "plan" | "joined" }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    );
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-background p-6 transition-colors duration-500 flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Error Loading Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Could not fetch user data from Simplicity
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Simplicity Users
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Manage {users.length} registered users
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-80 bg-card border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="mb-6">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="flex divide-x divide-border">
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Total Users
              </span>
              <p className="text-xl font-bold text-foreground tracking-tight mt-1">
                {users.length}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Active
              </span>
              <p className="text-xl font-bold text-emerald-400 tracking-tight mt-1">
                {activeCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  Tide (Paid)
                </span>
              </div>
              <p className="text-xl font-bold text-primary tracking-tight mt-1">
                {tideCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                  Ripple (Free)
                </span>
              </div>
              <p className="text-xl font-bold text-muted-foreground tracking-tight mt-1">
                {rippleCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr] gap-4 px-6 py-3.5 border-b border-border">
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
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
            Last Login
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium text-right">
            Savings Rate
          </span>
        </div>

        {/* Table body */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div>
            {filtered.map((user, i) => (
              <motion.button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="w-full grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr] gap-4 items-center px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors text-left"
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center shrink-0 font-medium text-[11px] text-primary">
                    {`${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground/80 truncate">
                    {user.first_name} {user.last_name}
                  </span>
                </div>

                {/* Email */}
                <span className="text-sm text-muted-foreground truncate">
                  {user.email || "—"}
                </span>

                {/* Plan */}
                <div className="flex items-center gap-2">
                  {user.plan === "Tide" || user.plan === "premium" ? (
                    <Crown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <Badge
                    variant="outline"
                    className="text-[10px] rounded-sm border-primary/20"
                  >
                    {user.plan || "Ripple"}
                  </Badge>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {user.isActive ? (
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Last Login */}
                <span className="text-sm text-muted-foreground">
                  {user.last_login_at
                    ? new Date(user.last_login_at * 1000).toLocaleDateString()
                    : "—"}
                </span>

                {/* Savings Rate */}
                <span className="text-sm font-medium text-primary text-right">
                  {user.savings_rate
                    ? `${(user.savings_rate * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/10">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} of {users.length} users
            </span>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <UserDetailPanel
        user={selectedUser!}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}

export const Route = createLazyFileRoute("/s-users")({
  component: SimplicityUsersPage,
});
