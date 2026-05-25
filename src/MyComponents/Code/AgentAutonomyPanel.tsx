/**
 * AgentAutonomyPanel.tsx — Per-repo agent permissions matrix +
 * branch protection rules. Renders inside the Settings tab of the
 * repo view.
 *
 * Two sections:
 *   1. Permission matrix — rows = agents, cols = capabilities.
 *      Each cell is a toggle. Optional branch-pattern selector
 *      per row (so you can have different rules on main vs. *).
 *   2. Branch protection rules — list of (pattern, required
 *      approvals, must-be-human, etc.) cards. New-rule button.
 *
 * Reads from MOCK_PERMISSIONS / MOCK_BRANCH_PROTECTION; future
 * Supabase wiring is a select on agent_permissions WHERE repo_id.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Bot, GitBranch, Shield, Plus, Trash2,
  Check, X, Info, Users,
} from "lucide-react";
import {
  MOCK_AGENTS,
  type AiAgent,
  type AgentPermission, type BranchProtection, type Repo,
} from "./mockData";
import { useAgents, usePermissions, useBranchProtection } from "./queries";

interface Capability {
  key: keyof Pick<
    AgentPermission,
    "canCommitDirect" | "canOpenPr" | "canReviewPr" | "canMergePr" | "canMergeOwnPr" | "canForcePush"
  >;
  label: string;
  short: string;
  /** When true → flipping ON is dangerous, render a red tint. */
  dangerous?: boolean;
  description: string;
}

const CAPS: Capability[] = [
  { key: "canCommitDirect", label: "Commit direct", short: "Direct",
    description: "Push commits without opening a PR. Skips review.",
    dangerous: true },
  { key: "canOpenPr", label: "Open PRs", short: "Open",
    description: "Create new pull requests against the target branch." },
  { key: "canReviewPr", label: "Review PRs", short: "Review",
    description: "Approve or request changes on PRs from others." },
  { key: "canMergePr", label: "Merge PRs", short: "Merge",
    description: "Click the merge button on PRs the agent didn't author." },
  { key: "canMergeOwnPr", label: "Merge own PRs", short: "Self-merge",
    description: "Merge a PR the same agent opened. Effectively bypasses review.",
    dangerous: true },
  { key: "canForcePush", label: "Force push", short: "Force",
    description: "Allowed to rewrite branch history. History-destructive.",
    dangerous: true },
];

export function AgentAutonomyPanel({ repo }: { repo: Repo }) {
  // Live reads with graceful mock-data fallback. Local working
  // copies mirror the fetched data so toggle UX stays instant —
  // when mutation wiring lands we'll flush these back via a
  // useMutation + queryClient.invalidateQueries().
  const { data: agents = MOCK_AGENTS } = useAgents();
  const { data: serverPerms = [] } = usePermissions(repo.id);
  const { data: serverBp = [] } = useBranchProtection(repo.id);

  const [perms, setPerms] = useState<AgentPermission[]>(serverPerms);
  const [bp, setBp] = useState<BranchProtection[]>(serverBp);

  // Resync local state when the upstream query settles or refetches.
  useEffect(() => { setPerms(serverPerms); }, [serverPerms]);
  useEffect(() => { setBp(serverBp); }, [serverBp]);

  const togglePerm = (id: string, key: Capability["key"]) => {
    setPerms((cur) =>
      cur.map((p) => (p.id === id ? { ...p, [key]: !p[key] } : p)),
    );
  };

  // Group permissions by agent so we can render an agent + its
  // branch-specific rules together.
  const grouped = useMemo(() => {
    const byAgent = new Map<string, AgentPermission[]>();
    for (const p of perms) {
      const arr = byAgent.get(p.agentId) ?? [];
      arr.push(p);
      byAgent.set(p.agentId, arr);
    }
    // Sort the inner arrays so most-specific patterns come first
    // (everything but '*' before '*').
    for (const arr of byAgent.values()) {
      arr.sort((a, b) =>
        (a.branchPattern === "*" ? 1 : 0) - (b.branchPattern === "*" ? 1 : 0),
      );
    }
    return byAgent;
  }, [perms]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[980px] mx-auto px-6 py-6 space-y-10">
        {/* ── Agent permissions matrix ─────────────────────────── */}
        <section>
          <SectionHeader
            icon={Bot}
            eyebrow="§ 01"
            title="Agent autonomy"
            description="What each AI agent is allowed to do in this repo, scoped by branch pattern. Most-specific pattern wins (e.g. a rule on `main` overrides the catch-all `*`)."
          />

          <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    Agent · branch
                  </th>
                  {CAPS.map((c) => (
                    <th
                      key={c.key}
                      title={c.description}
                      className={`px-2 py-2.5 text-center font-mono text-[9.5px] uppercase tracking-[0.18em] ${
                        c.dangerous ? "text-red-400" : "text-muted-foreground/80"
                      }`}
                    >
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const rows = grouped.get(agent.id) ?? [];
                  if (rows.length === 0) {
                    return (
                      <tr key={agent.id} className="border-t border-border/60">
                        <td className="px-4 py-3">
                          <AgentChip agent={agent} branchPattern="—" />
                        </td>
                        <td colSpan={CAPS.length} className="px-4 py-3 text-center text-[11px] text-muted-foreground italic">
                          No rules configured. Defaults to deny-all.
                        </td>
                      </tr>
                    );
                  }
                  return rows.map((rule, i) => (
                    <tr key={rule.id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        {i === 0 ? (
                          <AgentChip agent={agent} branchPattern={rule.branchPattern} />
                        ) : (
                          <div className="pl-9 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/85">
                              {rule.branchPattern}
                            </code>
                          </div>
                        )}
                      </td>
                      {CAPS.map((c) => (
                        <td key={c.key} className="px-2 py-2.5 text-center">
                          <PermToggle
                            on={rule[c.key]}
                            dangerous={c.dangerous}
                            onClick={() => togglePerm(rule.id, c.key)}
                            label={c.label}
                          />
                        </td>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-start gap-2 text-[10.5px] text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <p>
              Dangerous capabilities (Direct, Self-merge, Force) are tinted red. Toggle changes
              save immediately when wired to Supabase; this preview is local-only.
            </p>
          </div>
        </section>

        {/* ── Branch protection ────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Shield}
            eyebrow="§ 02"
            title="Branch protection"
            description="Branch-scoped rules that apply regardless of which agent acts. Use this for production branches that need human sign-off, resolved comment threads, etc."
          />

          <div className="mt-4 space-y-3">
            {bp.map((rule) => (
              <BranchProtectionCard
                key={rule.id}
                rule={rule}
                onDelete={() => setBp((cur) => cur.filter((b) => b.id !== rule.id))}
              />
            ))}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background hover:bg-muted/30 px-4 py-3 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add branch rule
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────

function SectionHeader({
  icon: Icon, eyebrow, title, description,
}: {
  icon: typeof Bot;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
        <Icon className="h-3 w-3 text-primary" />
        {eyebrow} · {title}
      </p>
      <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed max-w-[640px]">
        {description}
      </p>
    </div>
  );
}

function AgentChip({
  agent, branchPattern,
}: {
  agent: AiAgent;
  branchPattern: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
        style={{
          background: `hsl(${agent.accentHsl} / 0.18)`,
          color: `hsl(${agent.accentHsl})`,
        }}
      >
        {agent.displayName[0]}
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-foreground tracking-tight leading-none">
          {agent.displayName}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-foreground/85">
            {branchPattern}
          </code>
        </p>
      </div>
    </div>
  );
}

function PermToggle({
  on, dangerous, onClick, label,
}: {
  on: boolean;
  dangerous?: boolean;
  onClick: () => void;
  label: string;
}) {
  const dangerOn  = dangerous && on;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={[
        "inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
        on
          ? dangerOn
            ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
            : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          : "bg-muted/60 text-muted-foreground/50 hover:bg-muted hover:text-foreground/60",
      ].join(" ")}
    >
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </button>
  );
}

function BranchProtectionCard({
  rule, onDelete,
}: {
  rule: BranchProtection;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-[12px] text-foreground/90">
              {rule.branchPattern}
            </code>
            {rule.requireHumanApproval && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-amber-300">
                <Users className="h-2.5 w-2.5" />
                Human required
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px] text-foreground/85">
            <ProtectionRow
              on={rule.requiredApprovals > 0}
              label={`Requires ${rule.requiredApprovals} approving review${rule.requiredApprovals === 1 ? "" : "s"}`}
            />
            {rule.requiredApproverRoles.length > 0 && (
              <ProtectionRow
                on
                label={`Approver must be one of: ${rule.requiredApproverRoles.join(", ")}`}
              />
            )}
            <ProtectionRow
              on={rule.requireResolvedThreads}
              label="All review threads must be resolved before merge"
            />
            <ProtectionRow
              on={rule.blockForcePush}
              label="Block force-push to matching branches"
            />
            <ProtectionRow
              on={rule.deleteAfterMerge}
              label="Auto-delete source branch after merge"
            />
          </ul>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete branch rule"
          className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/40 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ProtectionRow({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-start gap-1.5">
      <span className={`mt-0.5 inline-flex h-3 w-3 items-center justify-center rounded shrink-0 ${
        on ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/60 text-muted-foreground/50"
      }`}>
        {on ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      </span>
      <span className={on ? "text-foreground/90" : "text-muted-foreground/70 line-through"}>
        {label}
      </span>
    </li>
  );
}
