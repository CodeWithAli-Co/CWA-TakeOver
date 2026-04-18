import { useMemo, useState } from "react";
import { RoadmapCanvas } from "./RoadmapCanvas";
import { RoadmapTopBar } from "./TopBar";
import { FilterBar, type FilterState } from "./FilterBar";
import { NodeDrawer } from "./NodeDrawer";
import {
  useRoadmapCheckpoints,
  useRoadmapDependencies,
  useRoadmapLanes,
  useRoadmapProfiles,
} from "@/stores/roadmapQuery";
import type { Checkpoint } from "./lib/types";

/**
 * Owns filter + selection state. Composes:
 *   · TopBar        — title + YC countdown
 *   · FilterBar     — lane chips, status control, hide-shipped, search
 *   · RoadmapCanvas — pure DAG renderer
 *   · NodeDrawer    — slides in when a node is selected
 */
export function RoadmapPage() {
  const { data: lanes } = useRoadmapLanes();
  const { data: checkpoints } = useRoadmapCheckpoints();
  const { data: dependencies } = useRoadmapDependencies();
  const { data: profiles } = useRoadmapProfiles();

  const [filter, setFilter] = useState<FilterState>({
    lanes: new Set(),
    status: "all",
    hideShipped: true,
    search: "",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredCheckpoints = useMemo(
    () => applyFilter(checkpoints, filter),
    [checkpoints, filter],
  );

  const selectedCp =
    selectedId != null
      ? filteredCheckpoints.find((c) => c.id === selectedId) ?? null
      : null;

  const handleSelect = (cp: Checkpoint | null) => {
    setSelectedId(cp?.id ?? null);
  };

  const activeCount = filteredCheckpoints.filter(
    (c) => c.status === "in_progress",
  ).length;

  return (
    <section className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <RoadmapTopBar
        activeCount={activeCount}
        totalCount={checkpoints.length}
      />
      <FilterBar
        lanes={lanes}
        filter={filter}
        setFilter={setFilter}
        totalVisible={filteredCheckpoints.length}
        totalAll={checkpoints.length}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <RoadmapCanvas
            lanes={lanes}
            checkpoints={filteredCheckpoints}
            dependencies={dependencies}
            profiles={profiles}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
        {selectedCp && (
          <div className="flex h-full w-[360px] shrink-0 border-l border-border bg-background">
            <NodeDrawer
              cp={selectedCp}
              checkpoints={filteredCheckpoints}
              dependencies={dependencies}
              profiles={profiles}
              onClose={() => setSelectedId(null)}
              onSelect={(id) => setSelectedId(id)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default RoadmapPage;

// ---------- filter logic --------------------------------------------------

function applyFilter(cps: Checkpoint[], f: FilterState): Checkpoint[] {
  const needle = f.search.trim().toLowerCase();
  return cps.filter((c) => {
    if (c.approvalStatus === "rejected") return false;

    if (f.lanes.size > 0 && !f.lanes.has(c.laneId)) return false;

    if (f.hideShipped && c.status === "completed") return false;

    if (f.status === "active" && c.status !== "in_progress") return false;
    if (f.status === "upcoming" && c.status !== "upcoming") return false;
    if (f.status === "shipped" && c.status !== "completed") return false;

    if (needle) {
      const hay =
        c.title.toLowerCase() +
        " " +
        (c.description ?? "").toLowerCase() +
        " " +
        (c.shortCode ?? "").toLowerCase();
      if (!hay.includes(needle)) return false;
    }

    return true;
  });
}
