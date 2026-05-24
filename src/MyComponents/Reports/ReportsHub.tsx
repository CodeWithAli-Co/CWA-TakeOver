/**
 * ReportsHub.tsx — Editorial shell for /reports.
 *
 * Owns the page title bar, tab strip, and a refresh signal that
 * gets forwarded to whichever inbox is active. Both inboxes
 * render in the same shell so flipping between Reports and Bug
 * Reports feels like one product, not two.
 *
 * Design language matches /onboarding:
 *   · slim header bar with section title (mono uppercase),
 *     active tab indicator on the bottom edge,
 *     icon-only refresh on the far right
 *   · tabs feel like proper section dividers, not afterthoughts —
 *     bottom-border indicator + heavier weight on active
 */

import { useEffect, useState } from "react";
import { Inbox, Bug, RefreshCw } from "lucide-react";
import { ReportsInbox } from "./ReportsInbox";
import { BugReportsInbox } from "./BugReportsInbox";

type Tab = "reports" | "bugs";

const STORAGE_KEY = "cwa-reports-tab";

function loadTab(): Tab {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "reports" || v === "bugs") return v;
  } catch { /* noop */ }
  return "reports";
}

export function ReportsHub() {
  const [tab, setTab] = useState<Tab>(loadTab);
  // Bump this counter to ask the active inbox to re-fetch. Each
  // inbox subscribes via prop and runs its reload when the value
  // changes. Keeps the refresh button at the hub level instead
  // of duplicated into each inbox's own header.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, tab); } catch { /* noop */ }
  }, [tab]);

  return (
    <div className="flex h-svh min-h-0 flex-col bg-background relative overflow-hidden">
      {/* ── Editorial header ──────────────────────────────────────
          Single row: section eyebrow ("§ INBOX"), tab strip,
          refresh button. The active tab is marked by a 2px
          bottom border that's flush with the header border —
          reads as a true tab attaching to its panel below. */}
      <header className="shrink-0 border-b border-border bg-background relative">
        <div className="flex items-end gap-6 px-6 md:px-8 pt-3.5">
          {/* Section eyebrow + word "Inbox". Stays anchored on the
              left as a constant page identifier. */}
          <div className="pb-3 shrink-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
              § 03
            </p>
            <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight text-foreground leading-none">
              Inbox
            </h1>
          </div>

          {/* Tab strip — pushed to the bottom so the active
              indicator hugs the page border. */}
          <nav className="flex items-end gap-1">
            <Tab
              label="Reports"
              icon={Inbox}
              active={tab === "reports"}
              onClick={() => setTab("reports")}
            />
            <Tab
              label="Bug Reports"
              icon={Bug}
              active={tab === "bugs"}
              onClick={() => setTab("bugs")}
            />
          </nav>

          {/* Right edge: refresh. Wraps to the bottom of the row
              by virtue of items-end. */}
          <div className="ml-auto pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshToken((n) => n + 1)}
              title="Refresh"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Active inbox panel. flex-1 + min-h-0 so the inner list/
          detail layout can claim all remaining height. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "reports"
          ? <ReportsInbox refreshToken={refreshToken} />
          : <BugReportsInbox refreshToken={refreshToken} />}
      </div>
    </div>
  );
}

/** Editorial tab. Active state is a 2px bottom border that bleeds
 *  into the header's underline + a foreground text colour shift.
 *  No background fills, no chip outlines — keeps the chrome quiet. */
function Tab({
  label, icon: Icon, active, onClick,
}: {
  label: string;
  icon: typeof Inbox;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground/80 hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="tracking-tight">{label}</span>
      {/* Active indicator — 2px primary bar, anchored to the bottom
          edge so it overlaps the header's underline by 1px. */}
      <span
        aria-hidden="true"
        className={[
          "absolute left-3 right-3 -bottom-px h-[2px] rounded-full transition-all",
          active ? "bg-primary opacity-100" : "bg-transparent opacity-0",
        ].join(" ")}
      />
    </button>
  );
}
