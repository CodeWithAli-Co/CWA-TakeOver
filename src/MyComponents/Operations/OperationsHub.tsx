/**
 * OperationsHub.tsx — Unified /operations command center.
 *
 * Thin shell around OperationsDashboard. The header is a live
 * command-bar style:
 *   · Eyebrow — primary accent dot (with a soft ping) + today's
 *     weekday and date in caps. Acts as a quiet "live now"
 *     indicator and grounds the page in the current moment.
 *   · Display title — large, tight tracking, primary-tinted
 *     period for a single dot of brand color.
 *   · Subtitle — one quiet line of context.
 *   · Background — radial primary accent that bleeds in from the
 *     top-left corner at ~4% opacity. Adds depth without yelling.
 *
 * The dashboard underneath does all the real work; the hub just
 * owns the page chrome.
 *
 * The legacy `?tab=` URL search param is accepted and ignored —
 * existing deep links still land on the dashboard.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { OperationsDashboard } from "./OperationsDashboard";

export function OperationsHub() {
  // Live clock — refresh every minute so the date eyebrow flips
  // at midnight without a page reload. Cheap (one setState/min).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="relative border-b border-xs border-border/15 bg-background/95 backdrop-blur-sm flex-shrink-0">
        {/* Subtle accent stripe — primary-tinted radial gradient
         *  bleeds in from the top-left and fades out. Adds a hint
         *  of color and depth without dominating the chrome. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            background:
              "radial-gradient(60% 90% at 0% 0%, hsl(var(--primary)) 0%, transparent 60%)",
          }}
        />

        <div className="relative px-6 pt-6 pb-5">
          {/* Eyebrow — primary pinging dot + caps date. Reads as
           *  a quiet "live now" indicator. */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-text-tertiary tabular-nums">
              {format(now, "EEEE")}{" "}
              <span className="text-foreground/40">·</span>{" "}
              {format(now, "MMM d")}
            </span>
          </div>

          <h1
            className="font-bold text-foreground leading-[0.95]"
            style={{
              fontFamily:
                "var(--ed-font-display, Inter), system-ui, sans-serif",
              fontSize: "clamp(30px, 2.4vw, 38px)",
              letterSpacing: "-0.03em",
            }}
          >
            Operations<span className="text-primary">.</span>
          </h1>

          <p className="text-[12.5px] text-text-tertiary mt-2 max-w-xl leading-relaxed">
            Tasks, quotas, and projects — at a glance.
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <OperationsDashboard />
      </main>
    </div>
  );
}

export default OperationsHub;
