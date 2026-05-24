/**
 * ReportsHub.tsx — Tab container for /reports.
 *
 * Houses two tab views:
 *   · "Reports"     — the existing team-submitted reports inbox
 *                     (status updates, project updates, incidents,
 *                     feedback) — see ReportsInbox.
 *   · "Bug Reports" — the new bug-report triage inbox sourced from
 *                     the bug_reports table populated by the
 *                     in-app BugReportDialog.
 *
 * Tabs persist across reloads via localStorage so a triager
 * doesn't lose their place.
 */

import { useEffect, useState } from "react";
import { Inbox, Bug } from "lucide-react";
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, tab); } catch { /* noop */ }
  }, [tab]);

  return (
    <div className="flex h-svh min-h-0 flex-col bg-background relative overflow-hidden">
      {/* Tab strip — sits above whichever inbox is active. Both
          inboxes render their own internal header underneath, so we
          keep this strip compact and visually quiet. */}
      <div className="shrink-0 border-b border-border/60 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-6 md:px-8 py-2">
          <TabButton
            label="Reports"
            icon={Inbox}
            active={tab === "reports"}
            onClick={() => setTab("reports")}
          />
          <TabButton
            label="Bug Reports"
            icon={Bug}
            active={tab === "bugs"}
            onClick={() => setTab("bugs")}
          />
        </div>
      </div>

      {/* Active inbox — flex-1 so it fills the remaining height. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === "reports" ? <ReportsInbox /> : <BugReportsInbox />}
      </div>
    </div>
  );
}

function TabButton({
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
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all",
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
