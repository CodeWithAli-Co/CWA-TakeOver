/**
 * ScenariosTab.tsx — Worth-it calculator (Phase 4 stub).
 */

import { GitBranch, Calculator, Save, Sparkles } from "lucide-react";
import type { CapitalPlanData } from "../CapitalPlan.queries";
import { ComingSoon } from "./ChecksTab";

export function ScenariosTab({ plan: _plan }: { plan: CapitalPlanData }) {
  return (
    <ComingSoon
      icon={<GitBranch className="h-5 w-5" />}
      title="Scenarios"
      subtitle="Phase 4"
      bullets={[
        { icon: Calculator, text: "Worth-it calculator: cost, duration, expected impact, confidence → payback + runway impact" },
        { icon: Save,       text: "Save scenarios, compare 2-3 side-by-side, promote winner into Allocation" },
        { icon: Sparkles,   text: "AXON verdict per scenario with reasoning and opportunity-cost analysis" },
        { icon: GitBranch,  text: "Branch from current Allocation to see how reallocation propagates over 12 months" },
      ]}
    />
  );
}
