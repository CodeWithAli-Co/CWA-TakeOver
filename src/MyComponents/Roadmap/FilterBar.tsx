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
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background/30 px-5 py-3 backdrop-blur-sm">
      {/* Group A — lanes. Wraps as a single visual unit on narrow
          viewports so chips don't get split mid-row. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 lg:inline">
          Lanes
        </span>
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
                  ? "border-transparent text-foreground shadow-sm"
                  : visuallyOn
                    ? "border-border/80 text-muted-foreground hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground"
                    : "border-border/40 text-muted-foreground/45 hover:text-muted-foreground",
              )}
              style={
                active
                  ? {
                      background: `color-mix(in srgb, hsl(${lane.accentHsl}) 22%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, hsl(${lane.accentHsl}) 50%, transparent), 0 0 14px -6px hsl(${lane.accentHsl} / 0.6)`,
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
            className="ml-0.5 rounded-full border border-border/40 px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            title="Clear lane filter"
          >
            clear
          </button>
        )}
      </div>

      <div className="hidden h-5 w-px bg-border lg:block" aria-hidden />

      {/* Group B — status + flags */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={filter.status}
          onValueChange={(v) =>
            setFilter({ ...filter, status: v as StatusFilter })
          }
        >
          <TabsList className="h-7 bg-muted/40 p-0.5">
            <TabsTrigger value="all" className="h-6 px-2.5 text-[11px]">All</TabsTrigger>
            <TabsTrigger value="active" className="h-6 px-2.5 text-[11px]">Active</TabsTrigger>
            <TabsTrigger value="upcoming" className="h-6 px-2.5 text-[11px]">Upcoming</TabsTrigger>
            <TabsTrigger value="shipped" className="h-6 px-2.5 text-[11px]">Shipped</TabsTrigger>
          </TabsList>
        </Tabs>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
          <Switch
            checked={filter.hideShipped}
            onCheckedChange={(v) =>
              setFilter({ ...filter, hideShipped: v })
            }
          />
          Hide shipped
        </label>
      </div>

      {/* Group C — right-aligned: search + count */}
      <div className="ml-auto flex items-center gap-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            type="search"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Search checkpoints…"
            className="h-8 w-56 rounded-full border-border/70 bg-muted/30 pl-8 text-[12px] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground tabular-nums">
          {totalVisible}/{totalAll}
        </span>
      </div>
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
