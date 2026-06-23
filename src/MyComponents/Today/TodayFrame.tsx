// ───────────────────────────────────────────────────────────────────
// TodayFrame — the redesigned primary interface. A full-bleed,
// three-column app frame: collapsed nav (left), the decision feed
// (center), and a persistent Axon rail (right). Renders over the legacy
// shell so it replaces the old sidebar + dashboard without disturbing
// the rest of the app. Dark near-black base, restrained and premium.
// ───────────────────────────────────────────────────────────────────
import { useOptionalAxon } from "@/Axon/AxonProvider";
import { ActiveUser } from "@/stores/query";
import { PrimaryNav } from "./PrimaryNav";
import { DecisionFeed } from "./DecisionFeed";
import { AxonRail, AXON_RAIL_INPUT_ID } from "./AxonRail";

export function TodayFrame() {
  const axon = useOptionalAxon();
  const { data: user } = ActiveUser();
  const username = (user?.[0] as any)?.username || "there";

  const runAxon = (prompt: string) => {
    void axon?.submitCommand(prompt, "text");
    // Bring focus to the rail so the operator sees Axon pick it up.
    document.getElementById(AXON_RAIL_INPUT_ID)?.focus();
  };

  const focusAxon = () => document.getElementById(AXON_RAIL_INPUT_ID)?.focus();

  return (
    <div
      className="fixed inset-0 z-40 flex"
      style={{ background: "#0E0E11", color: "#E4E4E7" }}
    >
      <PrimaryNav onAxon={focusAxon} />
      <main className="flex-1 min-w-0">
        <DecisionFeed username={username} runAxon={runAxon} />
      </main>
      <AxonRail />
    </div>
  );
}

export default TodayFrame;
