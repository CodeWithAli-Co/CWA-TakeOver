import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";
import { Switch } from "@/components/ui/shadcnComponents/switch";
import { Input } from "@/components/ui/shadcnComponents/input";
import type { Lane, LaneId } from "./lib/types";

export type StatusFilter = "all" | "active" | "upcoming" | "shipped";

export interface FilterState {
  lanes: Set<LaneId>;
  status: StatusFilter;
  hideShipped: boolean;
  search: string;
}

interface Props {
  lanes: Lane[];
  filter: FilterState;
  setFilter: (next: FilterState) => void;
  totalVisible: number;
  totalAll: number;
}

/**
 * Clean filter row — uses your existing shadcn Tabs, Switch, Input so the
 * aesthetic matches the rest of the app instead of inventing new controls.
 */
export function FilterBar({
  lanes,
  filter,
  setFilter,
  totalVisible,
  totalAll,
}: Props) {
  const toggleLane = (id: LaneId) => {
    const next = new Set(filter.lanes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFilter({ ...filter, lanes: next });
  };

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/50 px-5 backdrop-blur">
      {/* Lane chips */}
      <div className="flex items-center gap-1.5">
        {lanes.map((lane) => {
          const active = filter.lanes.has(lane.id);
          const allSelected = filter.lanes.size === 0;
          const visuallyOn = allSelected || active;
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => toggleLane(lane.id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                active
                  ? "border-transparent text-foreground"
                  : visuallyOn
                    ? "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    : "border-border/50 text-muted-foreground/40 hover:text-muted-foreground",
              )}
              style={
                active
                  ? {
                      background: `color-mix(in srgb, hsl(${lane.accentHsl}) 18%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, hsl(${lane.accentHsl}) 40%, transparent)`,
                    }
                  : undefined
              }
              title={
                active
                  ? `Remove ${lane.title} from filter`
                  : allSelected
                    ? `Filter to ${lane.title} only`
                    : `Add ${lane.title} to filter`
              }
            >
              <span
                aria-hidden
                className="inline-block size-[7px] shrink-0 rounded-full"
                style={{ background: `hsl(${lane.accentHsl})` }}
              />
              <span className="hidden xl:inline">{lane.title}</span>
              <span className="xl:hidden">{shortLane(lane.id)}</span>
            </button>
          );
        })}
        {filter.lanes.size > 0 && (
          <button
            type="button"
            onClick={() => setFilter({ ...filter, lanes: new Set() })}
            className="ml-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        )}
      </div>

      <div className="h-5 w-px bg-border" aria-hidden />

      {/* Status tabs */}
      <Tabs
        value={filter.status}
        onValueChange={(v) =>
          setFilter({ ...filter, status: v as StatusFilter })
        }
      >
        <TabsList className="h-8 bg-muted/60">
          <TabsTrigger value="all" className="h-6 text-[11px]">All</TabsTrigger>
          <TabsTrigger value="active" className="h-6 text-[11px]">Active</TabsTrigger>
          <TabsTrigger value="upcoming" className="h-6 text-[11px]">Upcoming</TabsTrigger>
          <TabsTrigger value="shipped" className="h-6 text-[11px]">Shipped</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Hide shipped switch */}
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Switch
          checked={filter.hideShipped}
          onCheckedChange={(v) =>
            setFilter({ ...filter, hideShipped: v })
          }
        />
        Hide shipped
      </label>

      {/* Search */}
      <div className="relative ml-auto flex items-center">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <Input
          type="search"
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder="Search checkpoints…"
          className="h-8 w-56 pl-8 text-[12px]"
        />
      </div>

      {/* Visible count */}
      <span className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground tabular-nums">
        {totalVisible}/{totalAll}
      </span>
    </div>
  );
}

function shortLane(id: LaneId): string {
  switch (id) {
    case "fundraising":
      return "Fund";
    case "codewithali":
      return "CWA";
    case "simplicity":
      return "Simp";
    case "takeover":
      return "TK";
    case "brand":
      return "Brand";
    case "ops":
      return "Ops";
    default:
      return "";
  }
}
