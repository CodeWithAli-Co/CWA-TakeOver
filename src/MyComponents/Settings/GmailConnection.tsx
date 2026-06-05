/**
 * GmailConnection.tsx — Settings card for connecting / disconnecting
 * the operator's Gmail account.
 *
 * Three visible states:
 *   · Not connected      — "Connect Gmail" button.
 *   · Connecting (polled) — "Waiting for Google… open in browser" +
 *                            a "Cancel" affordance.
 *   · Connected          — shows the connected email, scopes granted,
 *                            connected_at timestamp, and a delete /
 *                            reconnect pair.
 *
 * The "connecting" state is local — once the operator clicks Connect
 * we flip a flag and start polling useGmailConnection every 3s as
 * a fallback for realtime. If the user closes the browser without
 * authorizing, they just click Cancel and we drop back to "Not
 * connected". The polling stops automatically once the row appears.
 *
 * Mount this anywhere — it manages its own state and queries.
 */

import { useEffect, useState } from "react";
import {
  Mail,
  Check,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  useGmailConnection,
  useStartGmailConnect,
  useDisconnectGmail,
  useGmailRealtime,
  type GmailConnection as GmailConnectionRow,
} from "@/stores/gmail";

// ────────────────────────────────────────────────
// Shared chrome — same editorial pattern as the CRM cards.
// ────────────────────────────────────────────────
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

// Friendly scope labels — Google's full URLs are noisy, so we map
// the two scopes we know about to short human-readable names. Any
// unknown scope falls back to its raw URL trimmed.
function scopeLabel(s: string): string {
  if (s.endsWith("/gmail.send")) return "Send email";
  if (s.endsWith("/gmail.readonly")) return "Read inbox";
  if (s === "openid") return "Identity";
  if (s === "email" || s.endsWith("/userinfo.email")) return "Email address";
  // Trim the long URL prefix so the chip stays compact.
  return s.replace("https://www.googleapis.com/auth/", "");
}

export const GmailConnection: React.FC = () => {
  // Polling fallback — flipped on when the operator clicks Connect.
  // Stays on until the connection lands OR the operator cancels.
  const [pollingForConnect, setPollingForConnect] = useState(false);

  // Realtime channel (filtered to this user). Pairs with polling
  // so a flaky channel doesn't strand the UI.
  useGmailRealtime();

  const { data: connection, isLoading } = useGmailConnection({
    isPolling: pollingForConnect,
  });
  const startConnect = useStartGmailConnect();
  const disconnect = useDisconnectGmail();

  // Stop polling as soon as a connection appears.
  useEffect(() => {
    if (connection && pollingForConnect) setPollingForConnect(false);
  }, [connection, pollingForConnect]);

  const handleConnect = async () => {
    setPollingForConnect(true);
    try {
      await startConnect.mutateAsync();
    } catch (e) {
      console.error("[gmail-ui] connect failed:", e);
      setPollingForConnect(false);
    }
  };

  const handleCancel = () => setPollingForConnect(false);

  if (isLoading) {
    return (
      <div className={`${tile} p-5 animate-pulse`}>
        <div className="h-3 w-20 bg-zinc-700/40 rounded mb-2" />
        <div className="h-5 w-40 bg-zinc-700/30 rounded" />
      </div>
    );
  }

  return (
    <div className={`${tile} p-5 space-y-4`}>
      <header className="flex items-baseline justify-between">
        <div>
          <p className={eyebrow}>Integrations</p>
          <h3
            className="ed-serif text-[20px] mt-1.5 text-zinc-100"
            style={{ fontFamily: "Newsreader, Georgia, serif" }}
          >
            Gmail
          </h3>
        </div>
        {connection && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 text-[10px] font-mono uppercase tracking-[0.16em]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            </span>
            Connected
          </span>
        )}
      </header>

      {/* ─── Not connected ─────────────────────────────────────── */}
      {!connection && !pollingForConnect && (
        <div className="space-y-3">
          <p className="text-[12.5px] text-zinc-400 leading-relaxed">
            Connect a Gmail account so Takeover can send emails on your
            behalf and log replies as CRM activities. The connection
            uses Google's OAuth — your password never leaves Google.
          </p>
          <button
            onClick={handleConnect}
            disabled={startConnect.isPending}
            className="flex items-center gap-2 px-3 py-2 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[11px] font-mono uppercase tracking-wider text-emerald-200 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail className="h-3 w-3" />
            {startConnect.isPending ? "Opening…" : "Connect Gmail"}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </button>
          {startConnect.isError && (
            <ErrorRow message={(startConnect.error as Error).message} />
          )}
        </div>
      )}

      {/* ─── Connecting (polling) ──────────────────────────────── */}
      {!connection && pollingForConnect && (
        <div className="space-y-3">
          <div className="border border-emerald-500/20 bg-emerald-500/[0.03] rounded-lg p-3 space-y-2">
            <p className="text-[12.5px] text-zinc-200 leading-relaxed">
              Opened Google's consent page in your browser. Approve the
              Takeover request there — this page will flip to "Connected"
              automatically.
            </p>
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-emerald-400/70">
              Waiting for callback…
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Reopen in browser
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.08] hover:border-white/[0.16] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Connected ─────────────────────────────────────────── */}
      {connection && (
        <ConnectedView
          connection={connection}
          onDisconnect={async () => {
            await disconnect.mutateAsync(connection.id);
          }}
          onReconnect={handleConnect}
          isDisconnecting={disconnect.isPending}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// ConnectedView — sub-panel rendered when a connection exists.
// Pulled out so the parent's state machine stays compact.
// ────────────────────────────────────────────────
const ConnectedView: React.FC<{
  connection: GmailConnectionRow;
  onDisconnect: () => Promise<void>;
  onReconnect: () => Promise<void>;
  isDisconnecting: boolean;
}> = ({ connection, onDisconnect, onReconnect, isDisconnecting }) => {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connectedAt = new Date(connection.connected_at);
  const lastSync = connection.last_sync_at
    ? new Date(connection.last_sync_at)
    : null;

  return (
    <div className="space-y-3">
      {/* Email + connected timestamp */}
      <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
        <div className="min-w-0">
          <p className={eyebrow}>Connected as</p>
          <p className="text-[14px] text-zinc-100 mt-0.5 truncate">
            {connection.email}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={eyebrow}>Connected</p>
          <p className={`text-[11px] text-zinc-400 mt-0.5 ${monoNum}`}>
            {connectedAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Scopes */}
      <div>
        <p className={eyebrow}>Permissions granted</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {connection.scopes.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/[0.07] bg-white/[0.02] text-[10.5px] font-mono uppercase tracking-wider text-zinc-300"
            >
              <Check className="h-2.5 w-2.5 text-emerald-400" />
              {scopeLabel(s)}
            </span>
          ))}
        </div>
      </div>

      {/* Last sync */}
      {lastSync && (
        <div className="flex items-baseline justify-between gap-3">
          <p className={eyebrow}>Last inbox sync</p>
          <p className={`text-[11px] text-zinc-400 ${monoNum}`}>
            {lastSync.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        {!confirmDisconnect ? (
          <>
            <button
              onClick={() => setConfirmDisconnect(true)}
              disabled={isDisconnecting}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.08] hover:border-rose-500/40 hover:bg-rose-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-rose-300 rounded-md transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Disconnect
            </button>
            <button
              onClick={onReconnect}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.08] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-emerald-300 rounded-md transition-colors"
              title="Re-run the OAuth flow to refresh granted scopes"
            >
              <RefreshCw className="h-3 w-3" />
              Reconnect
            </button>
          </>
        ) : (
          <>
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-rose-300/90">
              Disconnect Gmail?
            </span>
            <button
              onClick={async () => {
                await onDisconnect();
                setConfirmDisconnect(false);
              }}
              disabled={isDisconnecting}
              className="flex items-center gap-1 px-2 py-1 border border-rose-500/40 bg-rose-500/[0.1] hover:bg-rose-500/[0.16] text-[10px] font-mono uppercase tracking-wider text-rose-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {isDisconnecting ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDisconnect(false)}
              disabled={isDisconnecting}
              className="flex items-center gap-1 px-2 py-1 border border-white/[0.08] hover:border-white/[0.16] text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"
            >
              No
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ErrorRow: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-lg p-3 flex items-start gap-2 text-[12px] text-amber-200">
    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
    <span>{message}</span>
  </div>
);

export default GmailConnection;
