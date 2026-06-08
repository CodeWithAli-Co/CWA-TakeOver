/**
 * WebhookManager.tsx — Admin dialog for generating and revoking chat
 * webhook tokens. Each token is bound to a specific channel. External
 * services POST to `/webhooks/chat/:token` with `{sender?, message}`
 * and the webhook-server.ts handler (see migrations/chat_webhooks.sql
 * bottom) inserts a message into the mapped channel.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Hash, Loader2, MessageSquare, Plus, Trash2, Webhook, X } from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";

interface Group {
  id: string | number;
  name: string;
  type?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: Group[];
  currentUsername: string;
}

interface WebhookRow {
  id: string;
  token: string;
  group_name: string;
  table_name: "cwa_chat" | "cwa_dm_chat";
  label: string | null;
  bot_name: string | null;
  created_at: string;
  last_used_at: string | null;
  active: boolean;
}

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function WebhookManager({ open, onOpenChange, groups, currentUsername }: Props) {
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<string>("");
  const [label, setLabel] = useState("");
  const [botName, setBotName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await companySupabase
.from("chat_webhooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[webhooks] list failed:", error.message);
      setHooks([]);
    } else {
      setHooks((data ?? []) as WebhookRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const createHook = async () => {
    if (!group) return;
    setCreating(true);
    try {
      const isGeneral = group === "General";
      const token = randomToken();
      const { error } = await companySupabase.from("chat_webhooks").insert({
        token,
        group_name: group,
        table_name: isGeneral ? "cwa_chat" : "cwa_dm_chat",
        label: label.trim() || null,
        bot_name: botName.trim() || "Bot",
        created_by: currentUsername,
      });
      if (error) {
        alert(`Failed: ${error.message}`);
        return;
      }
      setLabel("");
      setBotName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this webhook? External services using this token will stop posting.")) return;
    const { error } = await companySupabase.from("chat_webhooks").delete().eq("id", id);
    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }
    await refresh();
  };

  const copy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch { /* noop */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/60 p-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Webhook manager"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Chat webhooks</h3>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            {/* Create */}
            <div className="border-b border-border bg-muted/20 p-4">
              <p className="mb-2 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                New webhook
              </p>
              <div className="flex flex-col gap-2">
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="h-9 text-[12px]">
                    <SelectValue placeholder="Select a channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups
                      // Radix Select refuses empty-string values — filter any
                      // pathological rows that would crash the menu.
                      .filter((g) => g && typeof g.name === "string" && g.name.trim() !== "")
                      .map((g) => (
                        <SelectItem
                          key={String(g.id)}
                          value={g.name}
                          className="text-[12px]"
                        >
                          <span className="flex items-center gap-1.5">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            {g.name === "General" ? "General" : g.name.replace(/^#/, "")}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (e.g. GitHub CI)"
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="Sender name (default: Bot)"
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={createHook}
                  disabled={!group || creating}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Generate token
                </button>
              </div>
            </div>

            {/* Existing tokens */}
            <div className="max-h-[40vh] overflow-y-auto p-4">
              <p className="mb-2 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Active webhooks
              </p>
              {loading ? (
                <p className="text-[11.5px] text-muted-foreground">Loading…</p>
              ) : hooks.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">None yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {hooks.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2"
                    >
                      {h.table_name === "cwa_chat" ? (
                        <Hash className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-foreground">
                          {h.label || h.group_name}
                        </div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {h.group_name} · {h.bot_name || "Bot"} ·
                          {h.last_used_at ? ` used ${new Date(h.last_used_at).toLocaleDateString()}` : " unused"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(h.id, h.token)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Copy token"
                      >
                        {copiedId === h.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => revoke(h.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Revoke"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-border bg-muted/20 px-4 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              Services POST{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                /webhooks/chat/{"{"}token{"}"}
              </code>{" "}
              with <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{ message }"}</code>. See
              migrations/chat_webhooks.sql for the handler snippet.
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
