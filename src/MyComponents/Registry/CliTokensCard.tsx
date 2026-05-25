/**
 * CliTokensCard — UI for managing personal-access tokens used by
 * the CWA-CLI. Shown inside the Components route (and/or Settings
 * page, wherever it's dropped in).
 *
 * Flow:
 *   1. Click "Generate new token" → prompts for a label
 *   2. Modal shows the raw token once with a Copy button
 *   3. Token disappears after close — only the hash is stored
 *   4. Revoke any token from the list at any time
 */

import { useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import {
  Key, Plus, Copy, CheckCircle2, Trash2, Terminal, X, GripHorizontal,
  Clock, ShieldCheck,
} from "lucide-react";
import { ActiveUser } from "@/stores/query";
import {
  useRegistryTokens,
  useCreateRegistryToken,
  useDeleteRegistryToken,
} from "./queries";
import type { RegistryToken } from "./types";

export function CliTokensCard() {
  const { data: me } = ActiveUser();
  const username = me?.[0]?.username || "";
  const { data: tokens = [] } = useRegistryTokens(username);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300 ring-1 ring-inset ring-white/10">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">CLI Tokens</h3>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
              Personal-access tokens for the{" "}
              <code className="font-mono text-foreground/80">cwa</code> command.
              Paste these into{" "}
              <code className="font-mono text-foreground/80">cwa login</code>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-amber-500 to-orange-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground shadow-sm ring-1 ring-inset ring-white/15 hover:from-amber-400 hover:to-orange-400 transition-all"
        >
          <Plus className="h-3 w-3" />
          New token
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-center">
            <p className="text-[12px] text-muted-foreground">
              No tokens yet. Generate one to authenticate the CWA-CLI.
            </p>
          </div>
        ) : (
          tokens.map((t) => <TokenRow key={t.id} token={t} />)
        )}
      </div>

      <CreateTokenModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        owner={username}
      />
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────
function TokenRow({ token }: { token: RegistryToken }) {
  const del = useDeleteRegistryToken();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <Key className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-semibold text-foreground">{token.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {token.scope}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          Created {relative(token.createdAt)}
          {token.lastUsedAt && (
            <>
              <span>·</span>
              <span>Last used {relative(token.lastUsedAt)}</span>
            </>
          )}
          {!token.lastUsedAt && <span>· Never used</span>}
        </div>
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => del.mutate(token.id)}
            disabled={del.isPending}
            className="rounded bg-red-500 px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground hover:bg-red-600 disabled:opacity-50"
          >
            Revoke
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-red-400 group-hover:opacity-100"
          title="Revoke"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Create modal ─────────────────────────────────────────────
function CreateTokenModal({
  open, onClose, owner,
}: {
  open: boolean;
  onClose: () => void;
  owner: string;
}) {
  const create = useCreateRegistryToken();
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dragControls = useDragControls();

  const handleClose = () => {
    if (create.isPending) return;
    setLabel("");
    setRevealed(null);
    setCopied(false);
    create.reset();
    onClose();
  };

  const handleGenerate = () => {
    if (!label.trim() || !owner) return;
    create.mutate(
      { label: label.trim(), owner },
      {
        onSuccess: (data) => setRevealed(data.rawToken),
      },
    );
  };

  const copy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={handleClose}
          />
          <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0.08}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            whileDrag={{ scale: 1.005 }}
            className="relative z-10 w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <div
              className="h-1 w-full"
              style={{ background: "linear-gradient(90deg, hsl(35 95% 55%), hsl(20 90% 55%))" }}
            />

            {/* Drag handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300 ring-1 ring-inset ring-white/10">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[14px] font-semibold text-foreground">Generate CLI token</h3>
                      <GripHorizontal className="h-3 w-3 text-foreground/30" />
                    </div>
                    <p className="mt-0.5 text-[11px] text-foreground/55">
                      One-time reveal. Save it immediately.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={create.isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:bg-white/5 hover:text-foreground/80 disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-5 pb-4 pt-1">
              {!revealed ? (
                <>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                    Token label
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder='e.g. "laptop" or "ci-runner"'
                    className="mt-1 h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-[12.5px] text-foreground outline-none focus:border-amber-400/60"
                  />
                  <p className="mt-2 text-[10.5px] text-foreground/40 leading-snug">
                    A human-readable name so you can identify and revoke this
                    token later if the machine is compromised.
                  </p>

                  {create.error && (
                    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-200">
                      {(create.error as Error).message}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={handleClose}
                      disabled={create.isPending}
                      className="rounded-md px-3 py-1.5 text-[12px] text-foreground/70 hover:bg-white/5 hover:text-foreground disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={!label.trim() || create.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-amber-500 to-orange-500 px-4 py-1.5 text-[12px] font-semibold text-foreground shadow-sm ring-1 ring-inset ring-white/15 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                    >
                      <Key className="h-3.5 w-3.5" />
                      {create.isPending ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <p className="text-[11.5px] leading-snug text-amber-100">
                      This is the only time you'll see this token. Copy it
                      now and paste into{" "}
                      <code className="font-mono text-amber-200">cwa login</code>.
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-muted/60 px-3 py-2">
                    <code className="flex-1 truncate font-mono text-[11.5px] text-foreground">
                      {revealed}
                    </code>
                    <button
                      onClick={copy}
                      className={[
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                        copied
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                          : "border-white/15 bg-white/5 text-foreground/75 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {copied ? <><CheckCircle2 className="h-2.5 w-2.5" /> Copied</> : <><Copy className="h-2.5 w-2.5" /> Copy</>}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      onClick={handleClose}
                      className="rounded-md bg-white/10 px-4 py-1.5 text-[12px] font-semibold text-foreground hover:bg-white/15"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function relative(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60)     return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)     return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)     return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)     return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)    return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
