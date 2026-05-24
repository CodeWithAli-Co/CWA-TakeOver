/**
 * funding.lazy.tsx — Executive funding-strategy dashboard.
 * Visible to CEO and COO only.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import FundingPage from "@/MyComponents/FundingPage";
import UserView, { Role } from "@/MyComponents/Reusables/userView";

function FundingRoute() {
  return (
    <>
      <UserView userRole={[Role.CEO, Role.COO]}>
        <FundingPage />
      </UserView>
      <UserView excludeRoles={[Role.CEO, Role.COO]}>
        <div className="min-h-screen w-full bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-sm bg-muted/40 border border-border w-fit">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
              Restricted view
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground max-w-xs">
              The funding strategy dashboard is private to executive leadership.
            </p>
          </div>
        </div>
      </UserView>
    </>
  );
}

export const Route = createLazyFileRoute("/funding")({
  component: FundingRoute,
});
