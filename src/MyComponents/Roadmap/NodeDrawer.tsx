import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type {
  Checkpoint,
  Dependency,
  RoadmapProfile,
} from "./lib/types";
import { STATUS_LABEL } from "./lib/constants";
import { LANE_ACCENT } from "./lib/colors";
import { daysRemaining } from "./lib/status";

interface Props {
  cp: Checkpoint | null;
  checkpoints: Checkpoint[];
  dependencies: Dependency[];
  profiles: RoadmapProfile[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

/**
 * Right-side detail drawer. Floats above the canvas, doesn't push layout.
 * Opens when the user clicks a node in RoadmapCanvas. ESC / × / clicking
 * another node updates or closes it.
 */
export function NodeDrawer({
  cp,
  checkpoints,
  dependencies,
  profiles,
  onClose,
  onSelect,
}: Props) {
  useEffect(() => {
    if (!cp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cp, onClose]);

  return (
    <AnimatePresence>
      {cp && (
        <motion.aside
          key={cp.id}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-full w-full flex-col bg-card text-card-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerBody
            cp={cp}
            checkpoints={checkpoints}
            dependencies={dependencies}
            profiles={profiles}
            onClose={onClose}
            onSelect={onSelect}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({
  cp,
  checkpoints,
  dependencies,
  profiles,
  onClose,
  onSelect,
}: {
  cp: Checkpoint;
  checkpoints: Checkpoint[];
  dependencies: Dependency[];
  profiles: RoadmapProfile[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const author = profileById.get(cp.authorId);
  const owner = cp.ownerId ? profileById.get(cp.ownerId) : undefined;

  const cpById = new Map(checkpoints.map((c) => [c.id, c]));
  const upstream = dependencies
    .filter((d) => d.toId === cp.id)
    .map((d) => cpById.get(d.fromId))
    .filter((x): x is Checkpoint => !!x);
  const downstream = dependencies
    .filter((d) => d.fromId === cp.id)
    .map((d) => cpById.get(d.toId))
    .filter((x): x is Checkpoint => !!x);

  const accent = `hsl(${LANE_ACCENT[cp.laneId]})`;
  const remaining = daysRemaining(cp);

  return (
    <>
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            <span
              aria-hidden
              className="inline-block size-[6px] rounded-sm"
              style={{ background: accent }}
            />
            <span>{laneName(cp.laneId)}</span>
            <span className="opacity-50">·</span>
            <StatusPill status={cp.status} />
          </div>
          <h2 className="text-[15px] font-semibold leading-snug text-foreground">
            {cp.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cp.description && (
          <section>
            <SectionLabel>Context</SectionLabel>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85">
              {cp.description}
            </p>
          </section>
        )}

        <section className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Start" value={cp.startDate} />
          <Stat label="Due" value={cp.targetDate} />
          <Stat
            label={cp.status === "completed" ? "Shipped" : "Left"}
            value={
              cp.status === "completed"
                ? "\u2713"
                : remaining < 0
                  ? `${Math.abs(remaining)}d over`
                  : `${remaining}d`
            }
            tone={
              cp.status === "completed"
                ? "muted"
                : remaining < 0
                  ? "danger"
                  : "default"
            }
          />
        </section>

        {cp.metricLabel && cp.metricTarget != null && (
          <section className="mt-5">
            <SectionLabel>Metric · {cp.metricLabel}</SectionLabel>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-[18px] font-semibold text-foreground tabular-nums">
                {cp.metricCurrent ?? 0}
                <span className="text-muted-foreground"> / {cp.metricTarget}</span>
              </div>
              <div className="h-1.5 flex-1 rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, ((cp.metricCurrent ?? 0) / cp.metricTarget) * 100)}%`,
                    background: accent,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3">
          {author && <PersonRow label="Author" person={author} />}
          {owner && owner.id !== author?.id && (
            <PersonRow label="Owner" person={owner} />
          )}
        </section>

        {upstream.length > 0 && (
          <section className="mt-5">
            <SectionLabel>Blocked by · {upstream.length}</SectionLabel>
            <ul className="mt-1.5 flex flex-col gap-1">
              {upstream.map((u) => (
                <DepRow
                  key={u.id}
                  cp={u}
                  onClick={() => onSelect(u.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {downstream.length > 0 && (
          <section className="mt-5">
            <SectionLabel>Unlocks · {downstream.length}</SectionLabel>
            <ul className="mt-1.5 flex flex-col gap-1">
              {downstream.map((d) => (
                <DepRow
                  key={d.id}
                  cp={d}
                  onClick={() => onSelect(d.id)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Action bar */}
      <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          disabled
          className="rounded-md border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground opacity-70"
          title="Wiring lands in Phase 3"
        >
          Mark complete
        </button>
        <button
          type="button"
          disabled
          className="rounded-md border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground opacity-70"
          title="Wiring lands in Phase 3"
        >
          Edit
        </button>
        <button
          type="button"
          disabled
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground opacity-70"
          title="Wiring lands in Phase 4"
        >
          Add comment
        </button>
      </footer>
    </>
  );
}

// ---------- small primitives ---------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "danger";
}) {
  const color =
    tone === "danger"
      ? "hsl(14 85% 60%)"
      : tone === "muted"
        ? "hsl(var(--muted-foreground))"
        : "hsl(var(--foreground))";
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div
        className="mt-0.5 text-[12.5px] tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function PersonRow({
  label,
  person,
}: {
  label: string;
  person: RoadmapProfile;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="inline-block size-[8px] rounded-full"
          style={{
            background: person.authorColor,
            boxShadow: `0 0 10px color-mix(in srgb, ${person.authorColor} 50%, transparent)`,
          }}
        />
        <span className="truncate text-[12px] text-foreground">
          {person.displayName}
        </span>
      </div>
    </div>
  );
}

function DepRow({
  cp,
  onClick,
}: {
  cp: Checkpoint;
  onClick: () => void;
}) {
  const accent = `hsl(${LANE_ACCENT[cp.laneId]})`;
  const done = cp.status === "completed";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11.5px] text-foreground transition-colors hover:border-foreground/30"
      >
        <span
          className="inline-block size-[6px] shrink-0 rounded-sm"
          style={{ background: accent, opacity: done ? 0.4 : 1 }}
        />
        <span
          className="truncate"
          style={{
            color: done ? "hsl(var(--muted-foreground))" : undefined,
          }}
        >
          {cp.title}
        </span>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
          {done ? "\u2713" : STATUS_LABEL[cp.status]}
        </span>
      </button>
    </li>
  );
}

function StatusPill({ status }: { status: Checkpoint["status"] }) {
  return (
    <span
      className="uppercase tracking-[0.14em]"
      style={{
        color:
          status === "completed"
            ? "hsl(var(--muted-foreground))"
            : status === "at_risk"
              ? "hsl(14 85% 60%)"
              : status === "in_progress"
                ? "hsl(var(--foreground))"
                : "hsl(var(--muted-foreground))",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function laneName(id: Checkpoint["laneId"]): string {
  switch (id) {
    case "fundraising":
      return "Fundraising";
    case "codewithali":
      return "CodeWithAli";
    case "simplicity":
      return "Simplicity";
    case "takeover":
      return "Takeover";
    case "brand":
      return "Brand";
    case "ops":
      return "Ops";
    default:
      return "";
  }
}
