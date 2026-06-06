/**
 * linear.lazy.tsx — Admin → Linear route.
 *
 * Visible to CEO + COO only. Mirrors the gating pattern used by
 * Capital Plan and Vercel.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import LinearDashboard from "@/MyComponents/Admin/Linear/LinearDashboard";
import UserView, { Role } from "@/MyComponents/Reusables/userView";

function LinearRoute() {
  return (
    <>
      <UserView userRole={[Role.CEO, Role.COO]}>
        <LinearDashboard />
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
              Linear operations are private to CEO and COO.
            </p>
          </div>
        </div>
      </UserView>
    </>
  );
}

export const Route = createLazyFileRoute("/linear")({
  component: LinearRoute,
});
