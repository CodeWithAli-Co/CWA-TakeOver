/**
 * s-overrides.lazy.tsx — Simplicity Manual Overrides
 * Allows admins to manually override user data, subscription states,
 * and other settings in the Simplicity platform.
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Settings2,
  Shield,
  AlertTriangle,
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/shadcnComponents/input";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";

export const Route = createLazyFileRoute("/s-overrides")({
  component: ManualOverrides,
});

// ── Types ──

interface OverrideEntry {
  id: string;
  target_user: string;
  override_type: "subscription" | "access" | "balance" | "status" | "role";
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
  applied_by: string;
  applied_at: string;
  status: "applied" | "reverted" | "pending";
}

// ── Mock data (replace with Supabase queries) ──

const mockOverrides: OverrideEntry[] = [
  {
    id: "1",
    target_user: "john@example.com",
    override_type: "subscription",
    field: "plan_tier",
    old_value: "free",
    new_value: "premium",
    reason: "Comp upgrade for beta tester",
    applied_by: "admin",
    applied_at: "2026-04-10T14:30:00Z",
    status: "applied",
  },
  {
    id: "2",
    target_user: "sara@example.com",
    override_type: "access",
    field: "feature_flags",
    old_value: "standard",
    new_value: "early_access",
    reason: "Partner program participant",
    applied_by: "admin",
    applied_at: "2026-04-08T10:15:00Z",
    status: "applied",
  },
  {
    id: "3",
    target_user: "mike@example.com",
    override_type: "balance",
    field: "credit_balance",
    old_value: "0",
    new_value: "50.00",
    reason: "Refund credit for service disruption",
    applied_by: "admin",
    applied_at: "2026-04-05T09:00:00Z",
    status: "reverted",
  },
];

// ── Helpers ──

const typeStyles: Record<string, { bg: string; text: string }> = {
  subscription: { bg: "bg-purple-500/[0.08]", text: "text-purple-400/80" },
  access: { bg: "bg-blue-500/[0.08]", text: "text-blue-400/80" },
  balance: { bg: "bg-emerald-500/[0.08]", text: "text-emerald-400/80" },
  status: { bg: "bg-amber-500/[0.08]", text: "text-amber-400/80" },
  role: { bg: "bg-rose-500/[0.08]", text: "text-rose-400/80" },
};

const statusIcon: Record<string, React.ReactNode> = {
  applied: <CheckCircle className="h-3 w-3 text-emerald-400/70" />,
  reverted: <RotateCcw className="h-3 w-3 text-amber-400/70" />,
  pending: <Clock className="h-3 w-3 text-blue-400/70" />,
};

function ManualOverrides() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = mockOverrides.filter((o) => {
    const matchesSearch =
      o.target_user.toLowerCase().includes(search.toLowerCase()) ||
      o.reason.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || o.override_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/10">
            <Settings2 className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-foreground/85 tracking-tight">
              Manual Overrides
            </h1>
            <p className="text-[11px] text-muted-foreground/50">
              View and manage manual data overrides for Simplicity users
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/[0.06] border border-amber-500/10 rounded-sm">
            <AlertTriangle className="h-3 w-3 text-amber-400/70" />
            <span className="text-[10px] text-amber-400/70 font-medium">
              Admin Only
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border border-border rounded-sm">
            <Shield className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">
              {filtered.length} overrides
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search user or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-[12px] bg-muted/30 border-border text-foreground/70 placeholder:text-muted-foreground/40 rounded-sm focus:border-primary/20"
          />
        </div>
        <div className="flex gap-1">
          {["all", "subscription", "access", "balance", "status", "role"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-sm border transition-colors ${
                typeFilter === t
                  ? "bg-primary/[0.1] border-primary/20 text-primary"
                  : "bg-muted/30 border-border text-muted-foreground/50 hover:text-muted-foreground/70"
              }`}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Override List */}
      <ScrollArea className="h-[calc(100vh-240px)]">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Settings2 className="h-8 w-8 text-muted-foreground/10 mb-3" />
              <p className="text-[12px] text-muted-foreground/40">
                No overrides found
              </p>
            </div>
          ) : (
            filtered.map((override, i) => (
              <motion.div
                key={override.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-4 bg-card border border-border rounded-sm hover:border-primary/10 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-medium text-foreground/75">
                        {override.target_user}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${typeStyles[override.override_type]?.bg} ${typeStyles[override.override_type]?.text} border-transparent`}
                      >
                        {override.override_type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {statusIcon[override.status]}
                        <span className="text-[10px] text-muted-foreground/50">
                          {override.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-muted-foreground/50">
                        {override.field}:
                      </span>
                      <span className="text-[11px] text-red-400/60 line-through">
                        {override.old_value}
                      </span>
                      <span className="text-[10px] text-muted-foreground/30">&rarr;</span>
                      <span className="text-[11px] text-emerald-400/70 font-medium">
                        {override.new_value}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
                      {override.reason}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground/40">
                      {new Date(override.applied_at).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground/30">
                      by {override.applied_by}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
