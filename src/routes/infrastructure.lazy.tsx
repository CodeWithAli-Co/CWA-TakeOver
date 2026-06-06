/**
 * infrastructure.lazy.tsx — TakeOver's internal super-admin route.
 *
 * Restricted to CodeWithAli CEO + COO specifically. This is *our*
 * dashboard for managing TakeOver itself across every tenant we
 * sell to — distinct from per-tenant admin pages like Capital Plan,
 * Vercel, Linear, which are tenant-facing.
 *
 * The double gate (role + tenant) is intentional. A CEO/COO of a
 * customer company should never see this. Only Ali (CEO) and the
 * COO of CodeWithAli should be able to inspect or manage the
 * cross-tenant TakeOver infrastructure.
 */

import { useEffect, useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import InfrastructurePage from "@/MyComponents/Admin/Infrastructure/InfrastructurePage";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { getStronghold } from "@/stores/stronghold";

/** The CodeWithAli-specific tenant gate. UserView covers role; this
 *  hook adds the additional check that the bound tenant on this
 *  install is CodeWithAli. Combined they form a (role AND tenant)
 *  filter — pass both or you don't see the dashboard. */
function useIsCodeWithAliInstall(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stronghold = await getStronghold();
        const name = await stronghold.getRecord("company_name");
        if (cancelled) return;
        const ok =
          typeof name === "string" &&
          name.trim().toLowerCase() === "codewithali";
        setAllowed(ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return allowed;
}

function InfrastructureRoute() {
  const isCwaTenant = useIsCodeWithAliInstall();

  // The role gate. If you're not CEO or COO at all, you see the
  // restricted view immediately — no tenant check needed.
  return (
    <>
      <UserView userRole={[Role.CEO, Role.COO]}>
        {/* Inside the role gate: tenant must also be CodeWithAli. */}
        {isCwaTenant === null ? (
          // Still checking — render nothing so the layout doesn't
          // jump. Stronghold reads resolve quickly.
          <div className="min-h-screen w-full bg-background" />
        ) : isCwaTenant ? (
          <InfrastructurePage />
        ) : (
          <RestrictedView reason="company" />
        )}
      </UserView>
      <UserView excludeRoles={[Role.CEO, Role.COO]}>
        <RestrictedView reason="role" />
      </UserView>
    </>
  );
}

function RestrictedView({ reason }: { reason: "role" | "company" }) {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="mx-auto mb-4 p-3 rounded-sm bg-muted/40 border border-border w-fit">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          Restricted view
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {reason === "role"
            ? "Infrastructure controls are private to CodeWithAli CEO and COO."
            : "This admin surface is only available on CodeWithAli installs."}
        </p>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/infrastructure")({
  component: InfrastructureRoute,
});
