import type { Checkpoint, RoadmapProfile } from "./lib/types";
import { STATUS_LABEL } from "./lib/constants";
import { daysRemaining } from "./lib/status";
import { LANE_ACCENT } from "./lib/colors";

interface Props {
  cp: Checkpoint;
  author: RoadmapProfile;
  owner?: RoadmapProfile;
}

function formatRelative(iso: string, now = new Date()): string {
  const secs = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/**
 * Hover-preview card. Minimal chrome — one soft drop shadow, no ring, no
 * border highlight. Matches a Linear / Notion inspector look.
 */
export function HoverCard({ cp, author, owner }: Props) {
  const remaining = daysRemaining(cp);
  const accent = `hsl(${LANE_ACCENT[cp.laneId]})`;

  return (
    <div
      role="tooltip"
      className="pointer-events-none w-[320px] rounded-xl bg-card px-4 py-3 text-card-foreground"
      style={{
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.35), 0 12px 32px rgba(0,0,0,0.45)",
      }}
    >
      <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        <span
          aria-hidden
          className="inline-block size-[6px] rounded-sm"
          style={{ background: accent }}
        />
        <span>{labelFor(cp.laneId)}</span>
        <span className="opacity-50">·</span>
        <span>{STATUS_LABEL[cp.status]}</span>
      </div>

      <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
        {cp.title}
      </h3>

      {cp.description && (
        <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
          {cp.description}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10.5px] text-muted-foreground">
        <div>
          <div className="font-mono uppercase tracking-widest opacity-60">
            Start
          </div>
          <div className="mt-0.5 text-foreground">{cp.startDate}</div>
        </div>
        <div>
          <div className="font-mono uppercase tracking-widest opacity-60">
            Due
          </div>
          <div className="mt-0.5 text-foreground">{cp.targetDate}</div>
        </div>
        <div className="text-right">
          <div className="font-mono uppercase tracking-widest opacity-60">
            {cp.status === "completed" ? "Shipped" : "Left"}
          </div>
          <div
            className="mt-0.5"
            style={{
              color:
                cp.status === "completed"
                  ? "hsl(var(--muted-foreground))"
                  : remaining < 0
                    ? "hsl(14 85% 60%)"
                    : "hsl(var(--foreground))",
            }}
          >
            {cp.status === "completed"
              ? "\u2713"
              : remaining < 0
                ? `${Math.abs(remaining)}d over`
                : `${remaining}d`}
          </div>
        </div>
      </div>

      {(owner || author) && (
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-2.5 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-[6px] rounded-full"
              style={{ background: author.authorColor }}
            />
            <span>by {author.displayName}</span>
            <span className="opacity-60">· {formatRelative(cp.createdAt)}</span>
          </span>
          {owner && owner.id !== author.id && (
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className="inline-block size-[6px] rounded-full"
                style={{ background: owner.authorColor }}
              />
              <span>→ {owner.displayName}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(laneId: Checkpoint["laneId"]): string {
  switch (laneId) {
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
