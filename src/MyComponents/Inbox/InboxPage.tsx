/**
 * InboxPage — landing for the email feature, mounted at /inbox.
 *
 * v1 scope:
 *   · Editorial header with connection state at-a-glance.
 *   · Big Compose CTA that opens ComposeEmailModal.
 *   · "Inbox sync coming soon" empty state — actual incoming-mail
 *     surfacing lands with Email 7 (sync per contact). Once that
 *     ships, this page becomes the home for the synced list, but
 *     the Compose path stays identical.
 *
 * Why a dedicated page (vs. just composing from deal drawers):
 *   · Discoverable — sidebar entry beats "click a deal first".
 *   · Sends not tied to a deal (a recruiter pinging a candidate, a
 *     founder emailing a prospective hire) need somewhere to live.
 *   · Centralizes connection state — when something's wrong with
 *     the Gmail link, this is the obvious place to look.
 */

import { useState } from "react";
import { Mail, Send, Plug, ExternalLink, Inbox as InboxIcon } from "lucide-react";
import { useGmailConnection } from "@/stores/gmail";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { useNavigate } from "@tanstack/react-router";

const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";

export const InboxPage: React.FC = () => {
  const { data: connection, isLoading } = useGmailConnection();
  const [composeOpen, setComposeOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-[1100px] mx-auto px-8 py-10 space-y-8">
        {/* ── Editorial header ── */}
        <header className="flex items-end justify-between gap-6 border-b border-white/[0.06] pb-6">
          <div>
            <p className={eyebrow}>Mail</p>
            <h1
              className="text-[36px] leading-[1.05] text-zinc-50 mt-2"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              Inbox
            </h1>
            <p className="text-[13px] text-zinc-400 mt-2 max-w-[520px] leading-relaxed">
              Send email from inside Takeover with your connected Gmail.
              Replies sync into deal timelines automatically (coming soon).
            </p>
          </div>
          {connection && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[11px] font-mono uppercase tracking-wider text-emerald-200 rounded-md transition-colors shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Compose
            </button>
          )}
        </header>

        {/* ── Connection state ── */}
        {isLoading ? (
          <div className={`${tile} p-6 animate-pulse`}>
            <div className="h-3 w-24 bg-zinc-700/40 rounded mb-2" />
            <div className="h-5 w-48 bg-zinc-700/30 rounded" />
          </div>
        ) : !connection ? (
          <NotConnectedCard
            onGoToConnectors={() =>
              navigate({ to: "/settings", search: { tab: "connectors" } as any })
            }
          />
        ) : (
          <ConnectedCard
            email={connection.email}
            onCompose={() => setComposeOpen(true)}
          />
        )}

        {/* ── Inbox sync placeholder ── */}
        <section className={`${tile} p-8`}>
          <div className="flex items-center gap-3 mb-4">
            <InboxIcon className="h-4 w-4 text-zinc-500" />
            <p className={eyebrow}>Inbox sync</p>
          </div>
          <h2
            className="text-[20px] text-zinc-200"
            style={{ fontFamily: "Newsreader, Georgia, serif" }}
          >
            Replies will appear here
          </h2>
          <p className="text-[13px] text-zinc-400 mt-2 max-w-[560px] leading-relaxed">
            Once a contact replies to a message you sent from a deal, the
            response will surface here and on the deal's activity timeline.
            This view is wired up — incoming-mail sync ships next.
          </p>
        </section>
      </div>

      {composeOpen && (
        <ComposeEmailModal onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────
// NotConnectedCard — friendly nudge to go connect.
// ────────────────────────────────────────────────
const NotConnectedCard: React.FC<{ onGoToConnectors: () => void }> = ({
  onGoToConnectors,
}) => (
  <div className={`${tile} p-6 space-y-4`}>
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] shrink-0">
        <Plug className="h-4 w-4 text-amber-300" />
      </div>
      <div className="flex-1">
        <p className={eyebrow}>Not connected</p>
        <h3
          className="text-[18px] text-zinc-100 mt-1"
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        >
          Connect Gmail to send email
        </h3>
        <p className="text-[12.5px] text-zinc-400 mt-1.5 leading-relaxed max-w-[520px]">
          Takeover sends through your own Gmail account using Google
          OAuth. Your password never leaves Google, and you can disconnect
          any time.
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={onGoToConnectors}
      className="flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[11px] font-mono uppercase tracking-wider text-emerald-200 rounded-md transition-colors"
    >
      <Mail className="h-3 w-3" />
      Connect Gmail
      <ExternalLink className="h-3 w-3 opacity-60" />
    </button>
  </div>
);

// ────────────────────────────────────────────────
// ConnectedCard — shows the connected account + Compose CTA. The
// page header also carries a Compose button; this one is the
// "do something" affordance below the header for users who scan
// down the page.
// ────────────────────────────────────────────────
const ConnectedCard: React.FC<{
  email: string;
  onCompose: () => void;
}> = ({ email, onCompose }) => (
  <div className={`${tile} p-6 flex items-center justify-between gap-4`}>
    <div className="flex items-center gap-3 min-w-0">
      <div className="p-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] shrink-0">
        <Mail className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="min-w-0">
        <p className={eyebrow}>Connected</p>
        <p className="text-[14px] text-zinc-100 truncate mt-0.5">{email}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={onCompose}
      className="flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[11px] font-mono uppercase tracking-wider text-emerald-200 rounded-md transition-colors shrink-0"
    >
      <Send className="h-3 w-3" />
      Compose
    </button>
  </div>
);

export default InboxPage;
