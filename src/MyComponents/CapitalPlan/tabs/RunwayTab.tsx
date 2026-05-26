/**
 * RunwayTab.tsx — Burn + runway visualization (Phase 3 stub).
 */

import { Activity, TrendingDown, Clock, Calendar } from "lucide-react";
import type { CapitalPlanData } from "../CapitalPlan.queries";
import { ComingSoon } from "./ChecksTab";

export function RunwayTab({ plan: _plan }: { plan: CapitalPlanData }) {
  return (
    <ComingSoon
      icon={<Activity className="h-5 w-5" />}
      title="Runway"
      subtitle="Phase 3"
      bullets={[
        { icon: TrendingDown, text: "Manual burn entry (per-vendor or monthly aggregate)" },
        { icon: Clock,        text: "Live runway timeline: today / pre-seed close / runway exhausted / seed target" },
        { icon: Activity,     text: "Planned vs actual variance chart, color-coded by bucket" },
        { icon: Calendar,     text: "Mercury / Brex / Ramp / QBO MCP wiring slot (deferred — manual works fine for v1)" },
      ]}
    />
  );
}
