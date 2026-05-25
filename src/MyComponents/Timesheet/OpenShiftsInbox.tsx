/**
 * OpenShiftsInbox.tsx — Lightweight shift-swap v1.
 *
 * Lists every shift currently flagged "needs cover" via the
 * `coverage_requested_at` timestamp. Anyone in the org can claim one,
 * which reassigns the shift to the claimer and clears the flag.
 *
 * Renders as a collapsible card. The trigger button shows the open
 * count and a small dot pulse when there's anything to handle.
 */

import { useState } from "react";
import {
  HandHelping,
  ChevronRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  SHIFT_TYPE_META,
  formatClock,
  shiftHours,
  type Shift,
} from "@/stores/shiftTypes";
import {
  useOpenShifts,
  useClaimShift,
  useCancelCoverageRequest,
} from "@/stores/shifts";

interface Props {
  currentUserId: string | null;
  currentUserName: string;
}

export function OpenShiftsInbox({ currentUserId, currentUserName }: Props) {
  const { data: openShifts = [], isLoading } = useOpenShifts();
  const claim = useClaimShift();
  const cancel = useCancelCoverageRequest();
  const [expanded, setExpanded] = useState(true);

  if (isLoading) return null;
  if (openShifts.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sky-500/5 transition-colors"
      >
        <div className="relative">
          <HandHelping className="w-4 h-4 text-sky-300" />
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200">
          Open shifts
        </span>
        <span className="font-mono tabular-nums text-[11px] text-sky-300">
          {openShifts.length}
        </span>
        <span className="ml-auto text-[10.5px] text-sky-200/70">
          {expanded ? "Hide" : "Show"}
        </span>
        <ChevronRight
          className={[
            "w-3.5 h-3.5 text-sky-300/70 transition-transform",
            expanded ? "rotate-90" : "",
          ].join(" ")}
        />
      </button>

      {expanded && (
        <ul className="divide-y divide-sky-500/15 border-t border-sky-500/20">
          {openShifts.map((s) => {
            const isMine = s.user_supa_id === currentUserId;
            const claiming = claim.isPending && claim.variables?.shiftId === s.id;
            const cancelling = cancel.isPending && cancel.variables === s.id;
            return (
              <li
                key={s.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-sky-500/5 transition-colors"
              >
                <ShiftMeta shift={s} />

                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {isMine ? (
                    <button
                      type="button"
                      onClick={() => cancel.mutate(s.id)}
                      disabled={cancelling}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 h-7 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                    >
                      {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      Cancel request
                    </button>
                  ) : currentUserId ? (
                    <button
                      type="button"
                      onClick={() =>
                        claim.mutate({
                          shiftId: s.id,
                          claimerSupaId: currentUserId,
                          claimerUsername: currentUserName,
                        })
                      }
                      disabled={claiming}
                      className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 text-white px-2.5 h-7 text-[10.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                      style={{ boxShadow: "0 4px 12px -2px rgba(14,165,233,0.45)" }}
                    >
                      {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Claim
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShiftMeta({ shift }: { shift: Shift }) {
  const typeMeta = SHIFT_TYPE_META[shift.type];
  const accent = shift.color || typeMeta.accent;
  const date = new Date(shift.starts_at);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <span
        className="w-1.5 h-7 rounded-full shrink-0"
        style={{ background: accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">
          {shift.title || typeMeta.label}
          <span className="ml-2 text-[10.5px] font-normal text-muted-foreground">
            for {shift.username}
          </span>
        </p>
        <p className="text-[10.5px] text-muted-foreground font-mono tabular-nums truncate">
          {dateLabel} · {formatClock(shift.starts_at)}–{formatClock(shift.ends_at)} · {shiftHours(shift).toFixed(1)}h
        </p>
      </div>
    </div>
  );
}
