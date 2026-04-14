/**
 * defaultCreds.tsx — Account Management page (Void theme).
 *
 * Displays `cwa_creds` rows as a searchable card grid. Passwords are
 * encrypted in Supabase; revealing a card triggers a Tauri `decrypt`
 * command to display it.
 *
 * Features:
 *   - Search by platform name, username, email
 *   - Status filter pills: All / Active / Inactive
 *   - Card reveal/hide for password
 *   - Copy-to-clipboard for username + password
 *   - CEO/COO see a "CCC" folder link + delete button
 *   - Realtime sync (proper useEffect cleanup — no leak on rerender)
 */

import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Eye, EyeOff, Folder, Trash2, Search, Copy, Check,
  Users, Lock,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { AddData } from "@/MyComponents/subForms/addForm";
import { EditData } from "@/MyComponents/subForms/editForm";
import {
  getPlatformIcon,
  platformStyles,
} from "@/MyComponents/Reusables/PlatformIcons";
import ToggleSwitch from "@/MyComponents/Reusables/switchUI";
import { CWACreds } from "@/stores/query";
import { Link } from "@tanstack/react-router";
import UserView from "../Reusables/userView";

interface Credential {
  id: number;
  platform_name: string;
  acc_username: string;
  acc_email: string;
  acc_enc_password: string;
  acc_addinfo?: string;
  active: boolean;
  folder?: string;
}

// ── Single credential card ──
const CredentialCard: React.FC<{
  cred: Credential;
  onDelete: (id: number) => void;
}> = ({ cred, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [decryptedPass, setDecryptedPass] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const style = platformStyles[cred.platform_name.toLowerCase()] || platformStyles.default;

  const revealPassword = async () => {
    try {
      const { data } = await supabase
        .from("cwa_creds")
        .select("acc_enc_password")
        .eq("id", cred.id)
        .single();
      if (!data) return;
      const pass = await invoke("decrypt", {
        keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
        encryptedData: data.acc_enc_password,
      });
      setDecryptedPass(pass as string);
    } catch (err) {
      console.error("Decrypt error:", err);
    }
  };

  const toggleReveal = async () => {
    if (!expanded) {
      setExpanded(true);
      await revealPassword();
    } else {
      setExpanded(false);
      setDecryptedPass(null);
    }
  };

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`bg-[#0a0a0a] border border-white/[0.04] hover:border-red-500/10 rounded-sm overflow-hidden transition-all duration-300 ${
        expanded ? "ring-1 ring-red-500/10" : ""
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`h-10 w-10 rounded-sm overflow-hidden flex items-center justify-center text-white bg-gradient-to-br ${style.gradient} shrink-0`}
            style={{ boxShadow: `0 0 12px ${style.shadowColor}` }}
          >
            {getPlatformIcon(cred.platform_name)}
          </div>
          <div className="min-w-0">
            <h3 className="capitalize text-[14px] font-semibold text-white/90 truncate">
              {cred.platform_name}
            </h3>
            <p className="text-[11px] text-white/30 truncate">
              {cred.acc_username || cred.acc_email || "—"}
            </p>
          </div>
        </div>
        <ToggleSwitch
          checked={cred.active}
          onChange={() => {}}
        />
      </div>

      {/* Body */}
      <div className="px-4 pb-3 space-y-2">
        {/* Username row */}
        {cred.acc_username && (
          <div className="flex items-center justify-between gap-2 text-[12px] group/row">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-white/20 uppercase tracking-wider w-16 shrink-0">User</span>
              <span className="text-white/70 truncate select-text">{cred.acc_username}</span>
            </div>
            <button
              onClick={() => copy(cred.acc_username, "user")}
              className="opacity-0 group-hover/row:opacity-100 p-1 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-all"
              title="Copy username"
            >
              {copiedField === "user"
                ? <Check className="h-3 w-3 text-emerald-400" />
                : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Expanded fields */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {cred.acc_email && (
                <div className="flex items-center justify-between gap-2 text-[12px] group/row">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-white/20 uppercase tracking-wider w-16 shrink-0">Email</span>
                    <span className="text-white/70 truncate select-text">{cred.acc_email}</span>
                  </div>
                  <button
                    onClick={() => copy(cred.acc_email, "email")}
                    className="opacity-0 group-hover/row:opacity-100 p-1 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-all"
                    title="Copy email"
                  >
                    {copiedField === "email"
                      ? <Check className="h-3 w-3 text-emerald-400" />
                      : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}

              {decryptedPass && (
                <div className="flex items-center justify-between gap-2 text-[12px] group/row">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-white/20 uppercase tracking-wider w-16 shrink-0">Pass</span>
                    <span className="text-red-400 font-mono truncate select-text">{decryptedPass}</span>
                  </div>
                  <button
                    onClick={() => copy(decryptedPass, "pass")}
                    className="opacity-0 group-hover/row:opacity-100 p-1 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-all"
                    title="Copy password"
                  >
                    {copiedField === "pass"
                      ? <Check className="h-3 w-3 text-emerald-400" />
                      : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}

              {cred.acc_addinfo && (
                <div className="flex items-start gap-2 text-[12px]">
                  <span className="text-[10px] text-white/20 uppercase tracking-wider w-16 shrink-0 pt-0.5">Info</span>
                  <span className="text-white/50 leading-snug">{cred.acc_addinfo}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions footer */}
      <div className="px-3 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <button
          onClick={toggleReveal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.02] hover:bg-red-500/[0.06] border border-white/[0.04] hover:border-red-500/15 text-white/40 hover:text-red-400 text-[11px] transition-colors"
        >
          {expanded
            ? <><EyeOff className="h-3 w-3" /> Hide</>
            : <><Eye className="h-3 w-3" /> Reveal</>}
        </button>

        <div className="flex items-center gap-1">
          <EditData rowID={cred.id} />
          <UserView userRole={["CEO", "COO"]}>
            <button
              onClick={() => {
                if (confirm(`Delete ${cred.platform_name}?`)) onDelete(cred.id);
              }}
              className="p-1.5 rounded-sm text-white/20 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </UserView>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main component ──
export const CompanyCreds = ({
  folder = "default",
}: {
  folder?: string;
  className?: string;
}) => {
  const { data: cwaCreds, isPending, error, refetch } = CWACreds(folder);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Proper realtime subscription — wrapped in useEffect with cleanup.
  // (Fixes the old bug where a new channel was subscribed on every render.)
  useEffect(() => {
    const channel = supabase
      .channel("creds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_creds" },
        () => refetch()
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [refetch]);

  const delCred = async (id: number) => {
    const { error } = await supabase.from("cwa_creds").delete().eq("id", id);
    if (error) console.error("Delete error:", error.message);
  };

  // Filter by folder + search + status
  const filtered = useMemo(() => {
    const list = (cwaCreds as Credential[] | null | undefined) || [];
    return list.filter((cred) => {
      const matchesFolder =
        folder === "default"
          ? true // in default view, show all creds (backward compat)
          : cred.folder === folder;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        cred.platform_name.toLowerCase().includes(q) ||
        cred.acc_username?.toLowerCase().includes(q) ||
        cred.acc_email?.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && cred.active) ||
        (statusFilter === "inactive" && !cred.active);
      return matchesFolder && matchesSearch && matchesStatus;
    });
  }, [cwaCreds, folder, searchQuery, statusFilter]);

  const activeCount = (cwaCreds as Credential[] | undefined)?.filter((c) => c.active).length || 0;
  const inactiveCount = ((cwaCreds as Credential[] | undefined)?.length || 0) - activeCount;

  if (isPending) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-[13px] text-red-400/70">Error loading credentials</p>
      </div>
    );
  }

  const total = cwaCreds?.length || 0;

  return (
    <div className="min-h-screen bg-black overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-red-500/[0.08] border border-red-500/15">
              <Lock className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">Account Management</h1>
              <p className="text-[12px] text-white/20 mt-0.5">
                {total} credential{total !== 1 ? "s" : ""} stored securely
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <UserView userRole={["CEO", "COO"]}>
              <Link
                to="/detailFolders"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] hover:bg-red-500/[0.06] border border-white/[0.04] hover:border-red-500/15 text-white/40 hover:text-red-400 text-[11px] font-medium rounded-sm transition-colors"
              >
                <Folder className="h-3 w-3" />
                CCC Folder
                <ChevronRight className="h-3 w-3" />
              </Link>
            </UserView>
            <AddData />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="px-8 pt-5">
        <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
          <div className="flex">
            <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="h-3 w-3 text-red-500/60" />
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Total Accounts</span>
              </div>
              <p className="text-xl font-bold text-white tracking-tight">{total}</p>
            </div>
            <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Active</span>
              </div>
              <p className="text-xl font-bold text-emerald-400 tracking-tight">{activeCount}</p>
            </div>
            <div className="flex-1 px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-white/20" />
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Inactive</span>
              </div>
              <p className="text-xl font-bold text-white/50 tracking-tight">{inactiveCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-8 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm p-0.5">
            {(["all", "active", "inactive"] as const).map((s) => {
              const counts = { all: total, active: activeCount, inactive: inactiveCount };
              const labels = { all: "All", active: "Active", inactive: "Inactive" };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all ${
                    statusFilter === s
                      ? "bg-red-500/[0.1] text-red-400"
                      : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {labels[s]} ({counts[s]})
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
            <input
              type="text"
              placeholder="Search platform, user, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
            />
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-8 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm py-16 text-center">
            <Lock className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-[14px] text-white/30 font-medium mb-1">
              {total === 0 ? "No accounts yet" : "No accounts match"}
            </p>
            <p className="text-[12px] text-white/15">
              {total === 0 ? "Click 'Add' to save your first credential" : "Try a different search or filter"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filtered.map((cred) => (
                <CredentialCard key={cred.id} cred={cred} onDelete={delCred} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
