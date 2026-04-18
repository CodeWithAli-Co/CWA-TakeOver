// ───────────────────────────────────────────────────────────────────
// AxonRoot — admin-gated mount point.
// Only renders when the operator has an AXON_ALLOWED_ROLES role.
// ───────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { ActiveUser } from "@/stores/query";
import { AXON_ALLOWED_ROLES } from "./config";
import { AxonProvider } from "./AxonProvider";
import { Orb } from "./ui/Orb";
import { CommandPanel } from "./ui/CommandPanel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import "./axon.css";

export function AxonRoot() {
  const { data: userRows } = ActiveUser();
  const role = userRows?.[0]?.role;

  const permitted = useMemo(
    () => !!role && (AXON_ALLOWED_ROLES as readonly string[]).includes(role),
    [role]
  );

  if (!permitted) return null;

  return (
    <div data-axon>
      <AxonProvider>
        <Orb />
        <CommandPanel />
        <ConfirmDialog />
      </AxonProvider>
    </div>
  );
}

export default AxonRoot;
