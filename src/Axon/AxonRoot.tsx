// ───────────────────────────────────────────────────────────────────
// AxonRoot — admin-gated mount point.
//
// Accepts children so it can wrap them in <AxonProvider> alongside the
// Axon UI bits (Orb, CommandPanel, etc.). That way any widget rendered
// inside the same authenticated layout — e.g. AxonCoachCard in the
// home dashboard — can `useAxon()` and dispatch into the brain
// without needing its own provider.
//
// For non-permitted users we render `children` straight through,
// without the provider. Widgets call `useOptionalAxon()` and fall
// back gracefully.
// ───────────────────────────────────────────────────────────────────

import { useMemo, type ReactNode } from "react";
import { ActiveUser } from "@/stores/query";
import { AXON_ALLOWED_ROLES } from "./config";
import { AxonProvider } from "./AxonProvider";
import { Orb } from "./ui/Orb";
import { CommandPanel } from "./ui/CommandPanel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { SubtitleOverlay } from "./ui/SubtitleOverlay";
import { DiffOverlay } from "./ui/DiffOverlay";
import { AxonActivityHud } from "./ui/AxonActivityHud";
import "./axon.css";

export function AxonRoot({ children }: { children?: ReactNode }) {
  const { data: userRows } = ActiveUser();
  const role = userRows?.[0]?.role;

  const permitted = useMemo(
    () => !!role && (AXON_ALLOWED_ROLES as readonly string[]).includes(role),
    [role]
  );

  // Non-admin: pass children through, no provider, no UI bits.
  // useOptionalAxon() in downstream widgets sees null and falls back.
  if (!permitted) return <>{children}</>;

  return (
    <AxonProvider>
      {children}
      <div data-axon>
        <Orb />
        <SubtitleOverlay />
        <CommandPanel />
        <ConfirmDialog />
        {/* Live diff — auto-pops in the corner when Axon writes/modifies
            a file. Mounted at root level (not inside CommandPanel) so
            it is visible even when the panel is closed. */}
        <DiffOverlay />
        {/* Live activity HUD — its own surface (not the Mind Map, not the
            command drawer). Auto-appears when Axon runs so you can watch
            each action land + verify it. Just talk to the orb. */}
        <AxonActivityHud />
      </div>
    </AxonProvider>
  );
}

export default AxonRoot;
