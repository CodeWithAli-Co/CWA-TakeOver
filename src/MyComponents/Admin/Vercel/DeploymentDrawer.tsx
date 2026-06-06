/**
 * DeploymentDrawer.tsx — Right-side slide-in detail view for a
 * single Vercel deployment.
 *
 * Renders when the operator clicks any deploy row in the dashboard.
 * Replaces the old "open Vercel inspector in a new tab" UX with a
 * keep-them-in-TakeOver detail view. Closing snaps back to the
 * dashboard with no navigation loss.
 *
 * Surfaces:
 *   · Hero strip — project, state, target, full commit message
 *   · Quick stats — duration, created, ready, branch, author, sha
 *   · Aliases (when target=production)
 *   · Action buttons — Open in Vercel + Redeploy (POST /v13/deployments)
 *   · Esc closes
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  GitBranch,
  Clock,
  User,
  Hash,
  Globe,
  RotateCw,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { VercelDeployment } from "@/lib/vercel";

interface Props {
  deployment: VercelDeployment | null;
  onClose: () => void;
  /** Vercel API token from the connector — used for actions like
   *  Redeploy that need to call back to Vercel. */
  token?: string;
  /** Called after a successful redeploy so the parent can invalidate
   *  the deployments query and surface the new build. */
  onRedeployed?: () => void;
}

export function DeploymentDrawer({
  deployment,
  onClose,
  token,
  onRedeployed,
}: Props) {
  // Esc → close. Mount listener only when a deployment is selected
  // so the drawer doesn't intercept Esc on other pages.
  useEffect(() => {
    if (!deployment) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deployment, onClose]);

  // Redeploy mutation — calls Vercel's /v13/deployments with the
  // original deploy's name + git source. Vercel re-fetches the
  // referenced commit and runs the build.
  const redeploy = useMutation({
    mutationFn: async () => {
      if (!deployment || !token) {
        throw new Error("No token or deployment.");
      }
      const res = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: deployment.name,
          deploymentId: deployment.uid,
          target: deployment.target ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as any)?.error?.message ?? `Vercel ${res.status}`,
        );
      }
      return res.json();
    },
    onSuccess: () => {
      onRedeployed?.();
      onClose();
    },
  });

  return (
    <AnimatePresence>
      {deployment && (
        <>
          {/* Backdrop — dims the dashboard, click anywhere to close */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40"
          />

          {/* Drawer panel — slides in from the right */}
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl overflow-y-auto"
          >
            <DrawerHeader
              deployment={deployment}
              onClose={onClose}
            />

            <DrawerBody
              deployment={deployment}
              redeploy={redeploy}
              hasToken={!!token}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function DrawerHeader({
  deployment,
  onClose,
}: {
  deployment: VercelDeployment;
  onClose: () => void;
}) {
  const commit = deployment.meta?.githubCommitMessage as string | undefined;
  return (
    <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border-soft px-5 py-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            Deployment
          </p>
          <StatusBadge state={deployment.state} />
          {deployment.target === "production" && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-primary">
              <Globe className="h-2.5 w-2.5" /> Production
            </span>
          )}
        </div>
        <h2 className="text-[16px] font-bold text-foreground leading-tight">
          {deployment.name}
        </h2>
        {commit && (
          <p className="text-[12.5px] text-foreground/80 mt-1 leading-snug">
            {commit}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-foreground/[0.06] text-text-tertiary hover:text-foreground transition-colors"
        aria-label="Close drawer"
      >
        <X size={14} />
      </button>
    </header>
  );
}

function DrawerBody({
  deployment,
  redeploy,
  hasToken,
}: {
  deployment: VercelDeployment;
  redeploy: ReturnType<typeof useMutation<unknown, Error, void, unknown>>;
  hasToken: boolean;
}) {
  const branch = deployment.meta?.githubCommitRef as string | undefined;
  const sha = deployment.meta?.githubCommitSha as string | undefined;
  const author = deployment.meta?.githubCommitAuthorName as string | undefined;
  const duration =
    deployment.ready && deployment.buildingAt
      ? (deployment.ready - deployment.buildingAt) / 1000
      : null;
  const inspector =
    deployment.inspectorUrl ??
    `https://vercel.com/dashboard?proj=${deployment.name}`;

  return (
    <div className="p-5 space-y-5">
      {/* Live URL */}
      <Section title="Live URL">
        <a
          href={`https://${deployment.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline break-all"
        >
          {deployment.url}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </Section>

      {/* Quick stats grid */}
      <Section title="Build">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
          <Stat
            icon={Clock}
            label="Duration"
            value={duration === null ? "—" : formatDuration(duration)}
          />
          <Stat
            icon={Calendar}
            label="Created"
            value={new Date(deployment.created).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
          {deployment.buildingAt && (
            <Stat
              icon={RotateCw}
              label="Started"
              value={new Date(deployment.buildingAt).toLocaleTimeString(
                undefined,
                { hour: "numeric", minute: "2-digit" },
              )}
            />
          )}
          {deployment.ready && (
            <Stat
              icon={CheckCircle2}
              label="Ready"
              value={new Date(deployment.ready).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            />
          )}
        </dl>
      </Section>

      {/* Git context — only renders when there's something to show */}
      {(branch || sha || author) && (
        <Section title="Source">
          <dl className="space-y-2 text-[12px]">
            {branch && (
              <Stat icon={GitBranch} label="Branch" value={branch} />
            )}
            {sha && (
              <Stat
                icon={Hash}
                label="Commit"
                value={sha.slice(0, 7)}
                mono
              />
            )}
            {author && <Stat icon={User} label="Author" value={author} />}
          </dl>
        </Section>
      )}

      {/* Aliases — only for prod deploys */}
      {deployment.target === "production" &&
        deployment.aliasAssigned != null && (
          <Section title="Aliases">
            <p className="text-[12px] text-text-secondary">
              {deployment.aliasAssigned} alias
              {deployment.aliasAssigned === 1 ? "" : "es"} pointing here
            </p>
          </Section>
        )}

      {/* Action row */}
      <div className="border-t border-border-soft pt-4 flex flex-col gap-2">
        <a
          href={inspector}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-border bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[12.5px] font-semibold text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Vercel
        </a>
        {hasToken && (
          <button
            type="button"
            onClick={() => redeploy.mutate()}
            disabled={redeploy.isPending}
            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-primary/40 bg-primary/[0.1] hover:bg-primary/[0.18] text-[12.5px] font-semibold text-primary transition-colors disabled:opacity-50"
          >
            {redeploy.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCw className="h-3 w-3" />
            )}
            {redeploy.isPending ? "Redeploying…" : "Redeploy"}
          </button>
        )}
        {redeploy.isError && (
          <p className="text-[11px] text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {(redeploy.error as Error)?.message ?? "Redeploy failed."}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2">
        {title}
      </p>
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] text-text-tertiary mb-0.5">
        <Icon size={10} />
        <span className="uppercase tracking-[0.12em] font-semibold">
          {label}
        </span>
      </dt>
      <dd
        className={`text-[12.5px] text-foreground/95 truncate ${
          mono ? "font-mono tabular-nums" : "font-semibold"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ state }: { state: VercelDeployment["state"] }) {
  const meta =
    state === "READY"
      ? { label: "Ready", cls: "text-success bg-success/12 border-success/30", Icon: CheckCircle2 }
      : state === "ERROR"
      ? { label: "Error", cls: "text-destructive bg-destructive/12 border-destructive/30", Icon: XCircle }
      : state === "BUILDING" || state === "QUEUED" || state === "INITIALIZING"
      ? { label: state.toLowerCase(), cls: "text-warning bg-warning/12 border-warning/30", Icon: Loader2 }
      : { label: state.toLowerCase(), cls: "text-text-tertiary bg-foreground/[0.05] border-border-soft", Icon: AlertTriangle };
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-bold uppercase tracking-[0.12em] ${meta.cls}`}
    >
      <Icon
        className={`h-2.5 w-2.5 ${
          state === "BUILDING" || state === "QUEUED" || state === "INITIALIZING"
            ? "animate-spin"
            : ""
        }`}
      />
      {meta.label}
    </span>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default DeploymentDrawer;
