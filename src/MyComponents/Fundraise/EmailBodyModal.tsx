/**
 * EmailBodyModal.tsx -- pops over the Outreach tab when the operator
 * clicks a row in the live queue or the recent-sends tile. Shows the
 * full subject + body that went out (or is queued to go out), the
 * recipient, and the employee badge so it's clear who/what the
 * mail was sent AS.
 *
 * Source: the QuickSendEntry from quickSendStore. resolvedSubject /
 * resolvedBody / sentAsAlias / sentAsDisplayName are stamped by
 * QuickSendRunner when it pulls the draft (precomputed or freshly
 * generated). For queued rows that haven't been drafted yet, we
 * show "Body will draft right before send -- check back when this
 * row leaves the queue."
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  User,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { QuickSendEntry } from "./quickSendStore";

export interface EmailBodyModalProps {
  entry: QuickSendEntry | null;
  onClose: () => void;
}

export function EmailBodyModal({ entry, onClose }: EmailBodyModalProps) {
  // Esc to close. Modal trap is minimal but the panel is one focus
  // target so it's fine.
  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          key="email-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            key="email-modal-panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] max-h-[88vh] flex flex-col rounded-sm bg-card border border-border shadow-2xl overflow-hidden"
          >
            <Header entry={entry} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <MetaGrid entry={entry} />
              <BodySection entry={entry} />
            </div>
            <Footer entry={entry} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({
  entry,
  onClose,
}: {
  entry: QuickSendEntry;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60 bg-secondary/30">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45 mb-1.5">
          <Mail size={10} />
          Outbound email
          <span className="text-foreground/30">·</span>
          <StatusPill status={entry.status} />
        </div>
        <h2 className="text-[16px] font-semibold text-foreground m-0 truncate">
          {entry.resolvedSubject ?? "(Subject pending draft)"}
        </h2>
        <p className="text-[11px] text-foreground/55 mt-1 truncate">
          to {entry.partner_name} ·{" "}
          <span className="font-mono">{entry.partner_email}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="p-1 text-foreground/45 hover:text-foreground transition-colors flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function MetaGrid({ entry }: { entry: QuickSendEntry }) {
  // Operator-facing meta strip: firm, partner, pattern, employee.
  // Mono labels in the editorial tracker style.
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px]">
      <MetaCell label="Firm" value={entry.firm_name} />
      <MetaCell
        label="Recipient"
        value={
          <span>
            {entry.partner_name}
            <span className="text-foreground/40">{" · "}</span>
            <span className="font-mono text-foreground/55">
              {entry.partner_email}
            </span>
          </span>
        }
      />
      <MetaCell
        label="Pattern"
        value={
          entry.pattern ? (
            <span className="font-mono uppercase tracking-[0.1em] text-foreground/75">
              {entry.pattern}
            </span>
          ) : (
            <span className="text-foreground/40">—</span>
          )
        }
      />
      <MetaCell
        label="Sent at"
        value={
          entry.finishedAt ? (
            <span className="font-mono">
              {new Date(entry.finishedAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-foreground/40">
              <Clock size={10} className="inline mr-1" />
              not yet
            </span>
          )
        }
      />
      <MetaCell label="Sent as" value={<EmployeeBadge entry={entry} />} />
      <MetaCell
        label="Status"
        value={<StatusPill status={entry.status} error={entry.error} />}
      />
    </div>
  );
}

function MetaCell({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-foreground/40 mb-0.5">
        {label}
      </div>
      <div className="text-foreground/80 truncate">{value}</div>
    </div>
  );
}

/** Employee badge -- initials avatar + alias label. Falls back to
 *  display name if no alias is set, and to "—" if neither. */
export function EmployeeBadge({ entry }: { entry: QuickSendEntry }) {
  const name = entry.sentAsDisplayName ?? null;
  const alias = entry.sentAsAlias ?? null;
  if (!name && !alias) {
    return <span className="text-foreground/40">—</span>;
  }
  const initials = (name ?? alias ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold tracking-[0.04em] flex-shrink-0">
        {initials || "?"}
      </span>
      <span className="min-w-0 truncate">
        {name && <span className="text-foreground/85">{name}</span>}
        {alias && (
          <span className="font-mono text-foreground/55 ml-1.5">
            &lt;{alias}&gt;
          </span>
        )}
      </span>
    </span>
  );
}

function BodySection({ entry }: { entry: QuickSendEntry }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[9.5px] font-mono uppercase tracking-[0.18em] text-foreground/40 mb-2">
        <Send size={10} />
        Body
      </div>
      {entry.resolvedBody ? (
        <pre className="ed-mono text-[12px] leading-[1.55] text-foreground/85 whitespace-pre-wrap break-words rounded-sm border border-border/60 bg-secondary/30 p-3.5 m-0">
          {entry.resolvedBody}
        </pre>
      ) : (
        <div className="text-[11.5px] text-foreground/55 italic border border-dashed border-border/60 rounded-sm p-3.5">
          Body will draft right before send. Check back when this row
          leaves the queue.
        </div>
      )}
    </div>
  );
}

function Footer({ entry }: { entry: QuickSendEntry }) {
  // Bottom strip: contextual hint depending on status.
  let hint: React.ReactNode = null;
  if (entry.status === "queued") {
    const secs = Math.max(
      0,
      Math.ceil((entry.notBefore - Date.now()) / 1000),
    );
    hint = (
      <span className="inline-flex items-center gap-1.5 text-foreground/55">
        <Clock size={11} />
        Slot opens in {fmt(secs)}
      </span>
    );
  } else if (entry.status === "drafting") {
    hint = (
      <span className="inline-flex items-center gap-1.5 text-foreground/55">
        Axon is drafting this row.
      </span>
    );
  } else if (entry.status === "sending") {
    hint = (
      <span className="inline-flex items-center gap-1.5 text-foreground/55">
        <Send size={11} /> Handing off to Gmail.
      </span>
    );
  } else if (entry.status === "sent") {
    hint = (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <CheckCircle2 size={11} /> Sent. Activity row logged on the
        contact.
      </span>
    );
  } else if (entry.status === "failed") {
    hint = (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <AlertTriangle size={11} />
        {entry.error ?? "Send failed."}
      </span>
    );
  }
  return (
    <div className="px-5 py-3 border-t border-border/60 bg-secondary/30 text-[11px]">
      {hint}
    </div>
  );
}

function StatusPill({
  status,
  error,
}: {
  status: QuickSendEntry["status"];
  error?: string;
}) {
  const map: Record<
    QuickSendEntry["status"],
    { label: string; cls: string }
  > = {
    queued: {
      label: "queued",
      cls: "bg-foreground/8 text-foreground/65 border-border",
    },
    drafting: {
      label: "drafting",
      cls: "bg-primary/12 text-primary border-primary/30",
    },
    sending: {
      label: "sending",
      cls: "bg-primary/12 text-primary border-primary/30",
    },
    sent: {
      label: "sent",
      cls: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30",
    },
    failed: {
      label: error ? "failed" : "failed",
      cls: "bg-destructive/15 text-destructive border-destructive/40",
    },
  };
  const v = map[status];
  return (
    <span
      className={
        "inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-mono uppercase tracking-[0.14em] " +
        v.cls
      }
    >
      {v.label}
    </span>
  );
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
