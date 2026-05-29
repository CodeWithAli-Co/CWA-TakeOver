import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion } from "framer-motion";
import {
  Users,
  Video,
  MapPin,
  ExternalLink,
  Calendar,
  Trash,
  EllipsisVertical,
  Pencil,
  Building2,
  Clock,
} from "lucide-react";
import { SchedImgStore } from "@/stores/store";
import { Button } from "@/components/ui/button";
import { MeetingsQuery } from "@/stores/query";
import { AddMeeting } from "../subForms/MeetingForms/addMeeting";
import supabase from "../supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import UserView from "../Reusables/userView";
import { EditMeeting } from "../subForms/MeetingForms/editMeeting";

// ── Company tinting — small dot at the right end of the row ──
const COMPANY_STYLE = {
  CodeWithAli: { label: "CWA",   dot: "bg-primary" },
  simplicity:  { label: "SIMPL", dot: "bg-teal-400" },
} as const;

function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// Meeting-type colors used as inline dot + label, no bordered pills.
const TYPE_STYLE: Record<
  string,
  { icon: typeof Video; text: string; dot: string; label: string }
> = {
  online:      { icon: Video,  text: "text-sky-300",     dot: "bg-sky-400",     label: "Online" },
  hybrid:      { icon: Video,  text: "text-violet-300",  dot: "bg-violet-400",  label: "Hybrid" },
  "in-person": { icon: MapPin, text: "text-success",     dot: "bg-success",     label: "In person" },
};

/**
 * Group meetings by ISO date (YYYY-MM-DD). Returns an ordered array
 * of { key, label, sublabel, isImminent, meetings } so the render
 * loop can drop a section header in front of each group.
 *
 * Sort order: by ISO date ascending, so today comes before
 * tomorrow comes before next week. Undated meetings sink to a
 * single "No date" group at the bottom.
 */
interface MeetingGroup {
  key: string;
  label: string;       // "Today" / "Tomorrow" / "Thu" etc.
  sublabel: string;    // "May 29" or "" when label is the full noun
  isImminent: boolean; // today / tomorrow → accent tint
  meetings: any[];
}
function groupMeetingsByDate(meetings: any[]): MeetingGroup[] {
  const buckets = new Map<string, any[]>();
  const undated: any[] = [];

  for (const m of meetings) {
    if (!m.date) { undated.push(m); continue; }
    const d = new Date(m.date);
    if (isNaN(d.getTime())) { undated.push(m); continue; }
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
      const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

      let label: string;
      let sublabel: string;
      let isImminent = false;
      if (diff === 0) {
        label = "Today";
        sublabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        isImminent = true;
      } else if (diff === 1) {
        label = "Tomorrow";
        sublabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        isImminent = true;
      } else if (diff > 1 && diff < 7) {
        label = d.toLocaleDateString(undefined, { weekday: "long" });
        sublabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } else {
        label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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

/**
 * Mini date stripe — left column on every meeting row. "TUE" over
 * "AUG 5" (or "TODAY"/"TOMORROW" when applicable, big and small).
 * Kept around for layout balance (date column still exists), but
 * meetings now also pick up a group header above them when sorted
 * by date.
 */
function MeetingDateStripe({ dateStr }: { dateStr: string }) {
  if (!dateStr) {
    return (
      <div className="w-12 flex flex-col items-center justify-center text-text-tertiary">
        <span className="text-[9px] font-bold uppercase tracking-wider">—</span>
      </div>
    );
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return (
      <div className="w-12 flex flex-col items-center justify-center text-text-tertiary">
        <span className="text-[9px] font-bold uppercase tracking-wider">—</span>
      </div>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  // Today + Tomorrow get an accent tint so the eye spots them fast.
  const isImminent = diff === 0 || diff === 1;
  const tintWeekday = isImminent ? "text-primary" : "text-text-tertiary";
  const tintDay = isImminent ? "text-foreground" : "text-foreground/80";

  if (diff === 0) {
    return (
      <div className="w-12 flex flex-col items-center justify-center leading-none">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${tintWeekday}`}>Today</span>
        <span className={`text-[14px] font-bold tabular-nums mt-0.5 ${tintDay}`}>
          {d.toLocaleDateString(undefined, { day: "numeric" })}
        </span>
      </div>
    );
  }
  if (diff === 1) {
    return (
      <div className="w-12 flex flex-col items-center justify-center leading-none">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${tintWeekday}`}>Tom.</span>
        <span className={`text-[14px] font-bold tabular-nums mt-0.5 ${tintDay}`}>
          {d.toLocaleDateString(undefined, { day: "numeric" })}
        </span>
      </div>
    );
  }
  return (
    <div className="w-12 flex flex-col items-center justify-center leading-none">
      <span className={`text-[9px] font-bold uppercase tracking-wider ${tintWeekday}`}>
        {d.toLocaleDateString(undefined, { weekday: "short" })}
      </span>
      <span className={`text-[14px] font-bold tabular-nums mt-0.5 ${tintDay}`}>
        {d.toLocaleDateString(undefined, { day: "numeric" })}
      </span>
      <span className="text-[8.5px] font-semibold uppercase tracking-wider text-text-tertiary mt-0.5">
        {d.toLocaleDateString(undefined, { month: "short" })}
      </span>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7 && diff >= 0) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Meeting Row ────────────────────────────────────────────────
function MeetingRow({ meeting, onEdit, onDelete }: { meeting: any; onEdit: (id: number) => void; onDelete: (id: number) => void }) {
  const co = companyStyle(meeting.company);
  const typeInfo = meeting.meeting_type ? TYPE_STYLE[meeting.meeting_type] : null;
  const isHybridLoc = (loc: any): loc is { address: string; url: string } =>
    typeof loc === "object" && loc !== null && "address" in loc && "url" in loc;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      // Flush row, no per-row card. Date stripe sits as the left
      // column; title + meta in the middle; time + actions on the
      // right. Hairline separates siblings.
      className="
        group relative flex items-stretch
        border-b border-xs border-border/20 last:border-b-0
        hover:bg-foreground/[0.025] transition-colors
      "
    >
      {/* Time column — wider so a range like "5:00PM - 7:00PM"
       *  fits on a single line. The group header above carries
       *  the date so we only need the time here. */}
      <div className="shrink-0 w-[96px] py-3 px-2 flex items-center justify-center border-r border-xs border-border/15">
        <span className="text-[10.5px] tabular-nums font-semibold text-foreground/85 whitespace-nowrap text-center">
          {meeting.time || "—"}
        </span>
      </div>

      {/* Single-line body. Title leads, meta cluster pinned to the
       *  right edge using ml-auto so the row uses the full width
       *  instead of collapsing all weight onto the left. */}
      <div className="flex-1 min-w-0 py-3 pl-4 pr-4 flex items-center gap-3">
        <h3 className="flex-1 min-w-0 text-[13px] font-semibold text-foreground truncate leading-snug">
          {meeting.meeting_title}
        </h3>

        <div className="flex items-center gap-2.5 text-[10.5px] text-text-tertiary shrink-0">
          {typeInfo && meeting.meeting_type && (
            <span className={`inline-flex items-center gap-1 ${typeInfo.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${typeInfo.dot}`} />
              <span className="font-medium whitespace-nowrap">{typeInfo.label}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="h-2.5 w-2.5" />
            {meeting.attendees ?? 1}
          </span>

          {/* Location / link. Each branch keeps its own truncating
           *  text so a long address won't push the cluster off the
           *  right edge. max-w cap keeps the meta tidy on a wide
           *  meetings panel. */}
          {meeting.location && meeting.meeting_type === "online" &&
            typeof meeting.location === "string" && (
              <a
                href={meeting.location}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors whitespace-nowrap"
              >
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                Join
              </a>
            )}
          {meeting.location && meeting.meeting_type === "in-person" &&
            typeof meeting.location === "string" && (
              <span className="inline-flex items-center gap-1 max-w-[220px]">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{meeting.location}</span>
              </span>
            )}
          {meeting.meeting_type === "hybrid" && isHybridLoc(meeting.hybrid_location) && (
            <span className="inline-flex items-center gap-2 max-w-[260px]">
              <span className="inline-flex items-center gap-1 max-w-[180px]">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{meeting.hybrid_location.address}</span>
              </span>
              <a
                href={meeting.hybrid_location.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Join
              </a>
            </span>
          )}

          {/* Company dot — anchored to the far right. */}
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${co.dot} ml-1`} />
        </div>
      </div>

      {/* Action menu */}
      <UserView userRole={["CEO", "COO"]}>
        <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="text-muted-foreground/40 hover:text-muted-foreground/90 cursor-pointer p-1 rounded-sm hover:bg-muted/40 transition-all">
                <EllipsisVertical className="h-4 w-4" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#0f0f0f] border border-border text-muted-foreground/80 rounded-md">
              <DropdownMenuItem
                onClick={() => onEdit(meeting.id)}
                className="hover:bg-muted/50 hover:text-foreground cursor-pointer rounded-sm text-[12px]"
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(meeting.id)}
                className="hover:bg-red-500/[0.08] hover:text-red-300 cursor-pointer text-red-400/60 rounded-sm text-[12px]"
              >
                <Trash className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </UserView>
    </motion.div>
  );
}

// ── Main widget ─────────────────────────────────────────────────
const Meetings = () => {
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { setIsShowing, isShowing } = SchedImgStore();
  const { data: meetings, error, refetch } = MeetingsQuery();
  if (error) console.log("Error Fetching Meetings", error.message);

  const list = meetings ?? [];
  const cwaCount = list.filter((m: any) => !m.company || m.company === "CodeWithAli").length;
  const simpCount = list.filter((m: any) => m.company === "simplicity").length;

  const delMeeting = async (id: number) => {
    const { error } = await supabase.from("cwa_meetings").delete().eq("id", id);
    if (error) await message(error.message, { title: "Error Deleting Meeting", kind: "error" });
    refetch();
  };

  const editMeeting = (id: number) => {
    setEditingMeetingId(id);
    setShowEditDialog(true);
  };

  const Header = (
    <div className="px-4 py-2.5 flex items-center gap-3 bg-popover/40 border-b border-xs border-border-soft">
      {/* Left: title + total + company dots inline (mirrors Tasks header) */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <span className="text-[11px] text-foreground uppercase tracking-[0.14em] font-bold">
          Meetings
        </span>
        <span className="text-[11px] text-text-tertiary tabular-nums font-medium">
          {list.length}
        </span>
        <span className="inline-flex items-center gap-1 ml-1">
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            title={`CodeWithAli · ${cwaCount}`}
          />
          <span className="text-[10px] text-text-tertiary tabular-nums">{cwaCount}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full bg-teal-400"
            title={`Simplicity · ${simpCount}`}
          />
          <span className="text-[10px] text-text-tertiary tabular-nums">{simpCount}</span>
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 shrink-0">
        <UserView
          userRole={[
            "CEO", "COO", "ProjectManager", "Marketing",
            // Head of Growth + Head of Internal Affairs can also create
            // meetings. Both string forms (display value used by the
            // Role enum + the key form some surfaces store) are listed
            // so this gates work regardless of which form app_users.role
            // happens to carry.
            "Head of Growth", "Head of Internal Affairs",
            "HeadOfGrowth", "HeadOfInternalAffairs",
          ]}
        >
          <AddMeeting />
        </UserView>
        <UserView
          userRole={[
            "CEO", "COO", "SoftwareDev",
            "Head of Growth", "Head of Internal Affairs",
            "HeadOfGrowth", "HeadOfInternalAffairs",
          ]}
        >
          <Button
            size="sm"
            // Cleaned ghost button — matches Tasks search bar styling
            // (bg-zinc-950 + border-zinc-800) so the Tasks and Meetings
            // panels share one visual language.
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-background/60 hover:bg-popover border-xs border-border-soft hover:border-foreground/15 text-text-tertiary hover:text-foreground text-[11px] font-bold uppercase tracking-wider transition-colors"
            onClick={() => setIsShowing(!isShowing)}
          >
            <Calendar className="h-3 w-3" />
            Schedule
          </Button>
        </UserView>
      </div>
    </div>
  );

  if (list.length === 0) {
    return (
      <div className="relative bg-card border-xs border-border-soft rounded-xl overflow-hidden h-full flex flex-col">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />
        {Header}
        <div className="flex-1 flex items-center justify-center px-5 pb-5">
          <div className="text-center">
            <Calendar className="h-7 w-7 text-foreground/10 mx-auto mb-2" />
            <p className="text-[12.5px] text-text-tertiary">No upcoming meetings</p>
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
          onComplete={() => {
            setEditingMeetingId(null);
            refetch();
          }}
        />
      )}

      <div className="relative bg-card border-xs border-border-soft rounded-xl h-full overflow-hidden flex flex-col">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />
        {Header}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[400px]">
            <div>
              {groupMeetingsByDate(list).map((group, gi) => (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: gi * 0.04 }}
                >
                  {/* Section header for this date group. Today /
                   *  Tomorrow get a primary-tinted label so they
                   *  read as the active surface. */}
                  <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-popover/70 backdrop-blur-sm border-y border-xs border-border/15">
                    <span
                      className={
                        "text-[10px] font-bold uppercase tracking-[0.14em] " +
                        (group.isImminent ? "text-primary" : "text-foreground/80")
                      }
                    >
                      {group.label}
                    </span>
                    {group.sublabel && (
                      <span className="text-[10px] text-text-tertiary">
                        · {group.sublabel}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-text-tertiary tabular-nums uppercase tracking-wider">
                      {group.meetings.length}
                    </span>
                  </div>

                  {group.meetings.map((meeting: any, i: number) => (
                    <MeetingRow
                      key={meeting.id ?? `${group.key}-${i}`}
                      meeting={meeting}
                      onEdit={editMeeting}
                      onDelete={delMeeting}
                    />
                  ))}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default Meetings;
