/**
 * axonMemory.lazy.tsx -- /axonMemory route.
 *
 * Promotes the Axon MemoryInspector from a buried Settings section
 * to a first-class admin destination. Mirror of infrastructure.lazy.tsx:
 *   - Role gate (UserView): CEO + COO only
 *   - Tenant gate (Stronghold): CodeWithAli install only
 *   - Restricted view falls back with a Lock icon + reason
 *
 * Why both gates: the role check stops a non-C-level person on any
 * install. The tenant check stops a customer's CEO/COO from seeing
 * what's effectively OUR knowledge-of-Ali surface. Combined, only
 * Ali + Hanif (or future CWA C-level) see it.
 *
 * The MemoryInspector itself reads from window.localStorage, which is
 * per-install. Even without the gates a customer tenant would only
 * ever see their own data -- the gates exist for UX and product
 * positioning, not for security on the memory itself.
 */

import { useEffect, useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { AxonMemoryPage } from "@/MyComponents/Admin/AxonMemory/AxonMemoryPage";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { getStronghold } from "@/stores/stronghold";

/** CodeWithAli-specific tenant gate. Reads the bound company from
 *  Stronghold and confirms it's "codewithali" (case-insensitive).
 *  Returns null while the read is in flight so we render an empty
 *  shell instead of flashing the restricted view. */
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

function AxonMemoryRoute() {
  const isCwaTenant = useIsCodeWithAliInstall();

  return (
    <>
      <UserView userRole={[Role.CEO, Role.COO]}>
        {isCwaTenant === null ? (
          // In-flight tenant check -- avoid flashing the restricted
          // view by rendering an empty shell. Stronghold reads
          // resolve in single-digit ms in practice.
          <div className="min-h-screen w-full bg-background" />
        ) : isCwaTenant ? (
          <AxonMemoryPage />
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
            ? "Axon memory controls are private to CodeWithAli CEO and COO."
            : "This memory inspector is only available on CodeWithAli installs."}
        </p>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/axonMemory")({
  component: AxonMemoryRoute,
});

export default AxonMemoryRoute;
