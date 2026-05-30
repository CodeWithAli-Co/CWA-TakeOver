import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useScheduleFocus } from "@/MyComponents/Timesheet/scheduleFocusStore";
import {
  Video,
  MapPin,
  ExternalLink,
  Calendar,
  Trash,
  EllipsisVertical,
  Pencil,
} from "lucide-react";
import { SchedImgStore } from "@/stores/store";
import { Button } from "@/components/ui/button";
import { Employees, MeetingsQuery } from "@/stores/query";
import { AddMeeting, type MeetingAttendeeOption } from "../subForms/MeetingForms/addMeeting";
import supabase from "../supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import {
  AvatarStack,
  type AvatarUser,
} from "@/MyComponents/Reusables/AvatarStack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import UserView from "../Reusables/userView";
import { EditMeeting } from "../subForms/MeetingForms/editMeeting";

// ── Company tinting — small dot used in header counts and as a
//    top-right marker on each card. The card-level dot is the only
//    surviving piece of the old row-style company indicator.
const COMPANY_STYLE = {
  CodeWithAli: { label: "CWA", dot: "bg-primary" },
  simplicity: { label: "SIMPL", dot: "bg-teal-400" },
} as const;

function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// ── Meeting type → category label.
// The reference design uses bold colored category labels at the top
// of each card ("Talent Acquisition", "Employee Development", etc.).
// We don't have a separate `category` column on cwa_meetings yet, so
// for now we map the existing `meeting_type` enum to a label + color
// triplet. The mapping is keyed by the label visually so each kind of
// meeting reads as its own swimlane.
//
// When we eventually add a `category` column (Hiring / Growth / Ops /
// etc.) we can swap this map for a categoryStyle(category) lookup and
// keep the rest of the card identical.
type CategoryStyle = {
  label: string;
  // text-* class for the label color. Uses semantic tokens where
  // possible so the same value reads correctly in light + dark.
  text: string;
  // dot color for the inline category dot we render next to the label
  // (very subtle, matches the label hue).
  dot: string;
};

const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  "in-person": {
    label: "In Person",
    text: "text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  online: {
    label: "Online",
    text: "text-sky-500 dark:text-sky-400",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  hybrid: {
    label: "Hybrid",
    text: "text-violet-500 dark:text-violet-400",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
};
const DEFAULT_CATEGORY: CategoryStyle = {
  label: "Meeting",
  text: "text-text-tertiary",
  dot: "bg-foreground/40",
};

function categoryFor(meeting: any): CategoryStyle {
  if (meeting.meeting_type && CATEGORY_STYLE[meeting.meeting_type]) {
    return CATEGORY_STYLE[meeting.meeting_type];
  }
  return DEFAULT_CATEGORY;
}

// ── Group meetings by ISO date (YYYY-MM-DD). Same logic as before,
//    just kept in this file so the card grid can still render date
//    bands above each chunk of cards. Today/Tomorrow get an accent
//    tint so the eye lands on the imminent ones first.
interface MeetingGroup {
  key: string;
  label: string;
  sublabel: string;
  isImminent: boolean;
  meetings: any[];
}
function groupMeetingsByDate(meetings: any[]): MeetingGroup[] {
  const buckets = new Map<string, any[]>();
  const undated: any[] = [];

  for (const m of meetings) {
    if (!m.date) {
      undated.push(m);
      continue;
    }
    const d = new Date(m.date);
    if (isNaN(d.getTime())) {
      undated.push(m);
      continue;
    }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups: MeetingGroup[] = Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, ms]) => {
      const d = new Date(key + "T00:00:00");
      const target = new Date(d);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round(
        (target.getTime() - today.getTime()) / 86_400_000,
      );

      let label: string;
      let sublabel: string;
      let isImminent = false;
      if (diff === 0) {
        label = "Today";
        sublabel = d.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        isImminent = true;
      } else if (diff === 1) {
        label = "Tomorrow";
        sublabel = d.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        isImminent = true;
      } else if (diff > 1 && diff < 7) {
        label = d.toLocaleDateString(undefined, { weekday: "long" });
        sublabel = d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      } else {
        label = d.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        sublabel = "";
      }
      return { key, label, sublabel, isImminent, meetings: ms };
    });

  if (undated.length > 0) {
    groups.push({
      key: "no-date",
      label: "No date",
      sublabel: "",
      isImminent: false,
      meetings: undated,
    });
  }
  return groups;
}

// ── Location helpers.
// The `location` field shape depends on `meeting_type`:
//   - online    → URL string
//   - in-person → plain address string
//   - hybrid    → { address, url } object on `hybrid_location`
//
// For the card pill we always want a SHORT human-readable label
// (room name, building, or "Online"). The URL still gets a hover/
// click affordance via the Join link inside the pill when relevant.
type HybridLoc = { address: string; url: string };
function isHybridLoc(loc: any): loc is HybridLoc {
  return typeof loc === "object" && loc !== null && "address" in loc && "url" in loc;
}

function locationLabel(meeting: any): string {
  if (meeting.meeting_type === "online") return "Online";
  if (meeting.meeting_type === "hybrid" && isHybridLoc(meeting.hybrid_location)) {
    return meeting.hybrid_location.address || "Hybrid";
  }
  if (meeting.meeting_type === "in-person" && typeof meeting.location === "string") {
    return meeting.location;
  }
  return "TBD";
}

function joinUrl(meeting: any): string | null {
  if (meeting.meeting_type === "online" && typeof meeting.location === "string") {
    return meeting.location;
  }
  if (meeting.meeting_type === "hybrid" && isHybridLoc(meeting.hybrid_location)) {
    return meeting.hybrid_location.url || null;
  }
  return null;
}

// AvatarStack + gradientForSeed have been extracted to
// `src/MyComponents/Reusables/AvatarStack.tsx` so the Tasks widget
// (and any future card-style widget) can render the same avatar
// treatment without duplicating the implementation. See imports
// above.

// ── Meeting Card ──────────────────────────────────────────────
function MeetingCard({
  meeting,
  onEdit,
  onDelete,
  usersById,
}: {
  meeting: any;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  /** supa_id → AvatarUser. Built once in the parent so all cards
   *  share the same lookup map instead of each rebuilding it. */
  usersById: Map<string, AvatarUser>;
}) {
  const co = companyStyle(meeting.company);
  const cat = categoryFor(meeting);
  const join = joinUrl(meeting);
  const locLabel = locationLabel(meeting);

  // Resolve attendee_ids → user objects. IDs that don't resolve
  // (deleted users) are dropped silently rather than rendered as
  // ghost avatars. Memoised per meeting so we don't re-scan on
  // every parent re-render.
  const resolvedAttendees = useMemo<AvatarUser[]>(() => {
    const ids: string[] = Array.isArray(meeting?.attendee_ids)
      ? meeting.attendee_ids
      : [];
    return ids
      .map((id) => usersById.get(id))
      .filter((u): u is AvatarUser => Boolean(u));
  }, [meeting?.attendee_ids, usersById]);

  const navigate = useNavigate();
  const setFocusDate = useScheduleFocus((s) => s.setFocusDate);

  /**
   * Click anywhere on the card → /schedule, focused on the meeting's
   * day. Interactive children (Join link, action menu) stopPropagate
   * so the card-level click doesn't intercept them.
   */
  function openOnSchedule(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [role='menuitem']")) return;

    if (meeting.date) {
      const d = new Date(meeting.date);
      if (!isNaN(d.getTime())) {
        setFocusDate(d);
      }
    }
    navigate({ to: "/schedule" as any });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={openOnSchedule}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openOnSchedule(e as unknown as React.MouseEvent);
        }
      }}
      // Card surface — a hair lighter than the parent widget's
      // bg-card so the cards visually float. Using foreground at
      // very low alpha works in both themes: on dark bg it's a
      // subtle light tint, on light bg it's a subtle gray. Hover
      // deepens the border for clickable affordance.
      className="
        group relative cursor-pointer
        bg-foreground/[0.03] hover:bg-foreground/[0.05]
        border border-xs border-border-soft hover:border-border
        rounded-lg p-3.5
        transition-colors
        focus-visible:outline-none focus-visible:border-primary/40
      "
    >
      {/* Company dot — tiny corner indicator. Hidden by default in
       *  single-company installs (still rendered so the layout
       *  doesn't shift; just very subtle). */}
      <span
        className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${co.dot} opacity-60`}
        title={meeting.company === "simplicity" ? "Simplicity" : "CodeWithAli"}
      />

      {/* Category label — small caps, colored by meeting type. The
       *  inline dot reinforces the color so it reads as a category
       *  marker even at a glance. */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[10.5px] font-semibold tracking-wide ${cat.text}`}
        >
          {cat.label}
        </span>
      </div>

      {/* Title — the main thing your eye should land on. Slightly
       *  larger than the row version, weight bumped to bold. Two
       *  lines max so a long title doesn't blow out the card. */}
      <h3 className="text-[13.5px] font-bold text-foreground leading-snug line-clamp-2 pr-5">
        {meeting.meeting_title}
      </h3>

      {/* Bottom row — location pill + time on the left, avatar
       *  stack on the right. mt-3 gives the title room to breathe.
       *  Avatar stack lives at the far right with ml-auto so a
       *  long location label can't push it off the card. */}
      <div className="flex items-center gap-2 mt-3">
        {/* Location pill. For online meetings the pill itself is
         *  a Join link; for in-person + hybrid it shows the room
         *  name with an optional Join link beside it. */}
        {meeting.meeting_type === "online" && join ? (
          <a
            href={join}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="
              inline-flex items-center gap-1 max-w-[180px]
              bg-foreground/[0.06] hover:bg-foreground/[0.10]
              border border-xs border-border-soft
              rounded-md px-2 py-0.5
              text-[10.5px] font-medium text-foreground/80 hover:text-primary
              transition-colors
            "
          >
            <Video className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{locLabel}</span>
          </a>
        ) : (
          <span
            className="
              inline-flex items-center gap-1 max-w-[200px]
              bg-foreground/[0.06]
              border border-xs border-border-soft
              rounded-md px-2 py-0.5
              text-[10.5px] font-medium text-foreground/80
            "
          >
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{locLabel}</span>
          </span>
        )}

        {/* Time — tabular numbers so 9:00 AM and 12:30 PM align
         *  visually across stacked cards. Truncates if a range is
         *  unusually long. */}
        <span className="text-[10.5px] tabular-nums font-semibold text-foreground/85 whitespace-nowrap">
          {meeting.time || "—"}
        </span>

        {/* Inline Join link for hybrid (when there's both a physical
         *  room and a URL). Online meetings already use the pill as
         *  the join target, so they don't need a second link here. */}
        {meeting.meeting_type === "hybrid" && join && (
          <a
            href={join}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10.5px] text-text-tertiary hover:text-primary transition-colors whitespace-nowrap"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Join
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          <AvatarStack
            count={meeting.attendees}
            seed={String(meeting.id ?? meeting.meeting_title ?? "x")}
            users={resolvedAttendees}
          />

          {/* Action menu — visible on hover only so the card stays
           *  visually clean at rest. Stops propagation so the card's
           *  navigate-to-schedule click doesn't fire. */}
          <UserView userRole={["CEO", "COO"]}>
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/50 hover:text-muted-foreground p-1 rounded-sm hover:bg-foreground/[0.06] transition-all"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Meeting actions"
                  >
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover border-xs border-border-soft text-text-secondary rounded-md">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(meeting.id);
                    }}
                    className="hover:bg-foreground/[0.05] hover:text-foreground cursor-pointer rounded-sm text-[12px]"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(meeting.id);
                    }}
                    className="hover:bg-destructive/10 hover:text-destructive cursor-pointer text-destructive/70 rounded-sm text-[12px]"
                  >
                    <Trash className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </UserView>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main widget ─────────────────────────────────────────────────
const Meetings = () => {
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { setIsShowing, isShowing } = SchedImgStore();
  const { data: meetings, error, refetch } = MeetingsQuery();
  const { data: employees } = Employees();
  if (error) console.log("Error Fetching Meetings", error.message);

  // Resolve every employee's avatar URL once and stash by supa_id.
  // The map drives both the attendee picker (passed into AddMeeting
  // and EditMeeting) and the AvatarStack on each card. Values match
  // the shared AvatarUser shape ({ id, name, avatarUrl }) so the
  // extracted AvatarStack component consumes them directly.
  const { usersById, attendeeOptions } = useMemo(() => {
    const map = new Map<string, AvatarUser>();
    const opts: MeetingAttendeeOption[] = [];

    for (const e of (employees as any[] | undefined) ?? []) {
      if (!e?.supa_id) continue;
      // Resolve avatar — supports both filename-in-bucket (legacy)
      // and full URL (Direct Hire flow uses DiceBear URLs directly).
      let avatarUrl: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        avatarUrl = e.avatar;
      } else if (e.avatar) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        avatarUrl = data?.publicUrl;
      }
      const username = e.username ?? "Unknown";
      map.set(e.supa_id, { id: e.supa_id, name: username, avatarUrl });
      opts.push({
        supa_id: e.supa_id,
        username,
        role: e.role ?? null,
        avatarUrl,
      });
    }
    return { usersById: map, attendeeOptions: opts };
  }, [employees]);

  const list = meetings ?? [];
  const cwaCount = list.filter(
    (m: any) => !m.company || m.company === "CodeWithAli",
  ).length;
  const simpCount = list.filter((m: any) => m.company === "simplicity").length;

  const delMeeting = async (id: number) => {
    const { error } = await supabase.from("cwa_meetings").delete().eq("id", id);
    if (error)
      await message(error.message, {
        title: "Error Deleting Meeting",
        kind: "error",
      });
    refetch();
  };

  const editMeeting = (id: number) => {
    setEditingMeetingId(id);
    setShowEditDialog(true);
  };

  const Header = (
    <div className="px-5 py-3.5 flex items-center gap-3 border-b border-xs border-border/15">
      {/* Title + total only — the company breakdown dots+counts
       *  were visual noise. Each meeting card already shows its
       *  org via the small corner dot, which is where that info
       *  actually helps the operator. */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <span className="text-[11px] text-foreground uppercase tracking-[0.14em] font-bold">
          Meetings
        </span>
        <span className="text-[11px] text-text-tertiary tabular-nums font-medium">
          {list.length}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 shrink-0">
        <UserView
          userRole={[
            "CEO",
            "COO",
            "CFO",
            "Admin",
            "ProjectManager",
            "Marketing",
            "SoftwareDev",
            "HeadOfGrowth",
            "HeadOfGrowth",
            "HeadOfInternalAffairs",
          ]}
        >
          <AddMeeting users={attendeeOptions} />
        </UserView>

        <UserView userRole={["COO"]}>
          <Button
            size="sm"
            className="
              group inline-flex items-center gap-1.5 h-7 px-3 rounded-md
              bg-transparent hover:bg-foreground/[0.04]
              border border-border-soft hover:border-foreground/15
              text-text-tertiary hover:text-foreground
              text-[11px] font-bold uppercase tracking-wider
              transition-colors
            "
            onClick={() => setIsShowing(!isShowing)}
          >
            <Calendar className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-px" />
            Schedule
          </Button>
        </UserView>
      </div>
    </div>
  );

  if (list.length === 0) {
    return (
      <div className="bg-card border-xs border-border-soft rounded-xl overflow-hidden h-full flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center px-5 pb-5">
          <div className="text-center">
            <Calendar className="h-7 w-7 text-foreground/10 mx-auto mb-2" />
            <p className="text-[12.5px] text-text-tertiary">
              No upcoming meetings
            </p>
            <p className="text-[10.5px] text-text-tertiary/60 mt-1">
              Say "AXON, schedule a meeting tomorrow at 3pm."
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showEditDialog && editingMeetingId && (
        <EditMeeting
          meetingID={editingMeetingId}
          open={showEditDialog}
          setOpen={setShowEditDialog}
          users={attendeeOptions}
          onComplete={() => {
            setEditingMeetingId(null);
            refetch();
          }}
        />
      )}

      <div className="bg-card border-xs border-border-soft rounded-xl h-full overflow-hidden flex flex-col">
        {Header}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[540px]">
            {/* Outer padding gives the card grid breathing room
             *  against the parent widget chrome. */}
            <div className="px-3 py-3 space-y-4">
              {groupMeetingsByDate(list).map((group, gi) => (
                <motion.section
                  key={group.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: gi * 0.04 }}
                  className="space-y-2"
                >
                  {/* Softer date label — sits above the card group,
                   *  no heavy bg or sticky behavior. Today/Tomorrow
                   *  pick up the primary color so they read as the
                   *  active day at a glance. */}
                  <div className="flex items-center gap-1.5 px-1">
                    <span
                      className={
                        "text-[10px] font-bold uppercase tracking-[0.14em] " +
                        (group.isImminent
                          ? "text-primary"
                          : "text-foreground/70")
                      }
                    >
                      {group.label}
                    </span>
                    {group.sublabel && (
                      <span className="text-[10px] text-text-tertiary">
                        · {group.sublabel}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-text-tertiary tabular-nums">
                      {group.meetings.length}
                    </span>
                  </div>

                  {/* Stack of cards for the day. gap-2 is the
                   *  reference spacing — tight enough to feel
                   *  like a group, loose enough to read as cards. */}
                  <div className="space-y-2">
                    {group.meetings.map((meeting: any, i: number) => (
                      <MeetingCard
                        key={meeting.id ?? `${group.key}-${i}`}
                        meeting={meeting}
                        onEdit={editMeeting}
                        onDelete={delMeeting}
                        usersById={usersById}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default Meetings;
