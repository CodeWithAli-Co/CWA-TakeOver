/**
 * capitalPlan.lazy.tsx — Admin → Capital Plan route.
 * Visible to CEO, COO, CFO only.
 * Server-side enforcement: is_finance_role() in capital_plan_schema.sql.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import CapitalPlanPage from "@/MyComponents/CapitalPlan/CapitalPlanPage";
import UserView, { Role } from "@/MyComponents/Reusables/userView";

function CapitalPlanRoute() {
  return (
    <>
      <UserView userRole={[Role.CEO, Role.COO, Role.CFO]}>
        <CapitalPlanPage />
      </UserView>
      <UserView excludeRoles={[Role.CEO, Role.COO, Role.CFO]}>
        <div className="min-h-screen w-full bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-sm bg-muted/40 border border-border w-fit">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
              Restricted view
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground max-w-xs">
              Capital Plan is private to CEO, COO, and CFO.
            </p>
          </div>
        </div>
      </UserView>
    </>
  );
}

export const Route = createLazyFileRoute("/capitalPlan")({
  component: CapitalPlanRoute,
});
