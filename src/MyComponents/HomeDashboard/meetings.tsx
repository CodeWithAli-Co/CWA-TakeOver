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

// ── Company tinting tokens ─────────────────────────────────────
const COMPANY_STYLE = {
  CodeWithAli: { label: "CWA",   rail: "bg-primary" },
  simplicity:  { label: "SIMPL", rail: "bg-teal-400" },
} as const;

function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// Meeting-type colors used as inline dot + label, no bordered pills.
const TYPE_STYLE: Record<
  string,
  { icon: typeof Video; text: string; dot: string }
> = {
  online:      { icon: Video,  text: "text-blue-300",     dot: "bg-blue-400" },
  hybrid:      { icon: Video,  text: "text-purple-300",   dot: "bg-purple-400" },
  "in-person": { icon: MapPin, text: "text-success",      dot: "bg-success" },
};

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
      className="group relative flex items-stretch rounded-lg bg-card border-xs border-border-soft overflow-hidden"
    >
      {/* Company accent rail — solid, slim, no gradient */}
      <div className={`w-[2px] ${co.rail} opacity-80`} />

      <div className="flex-1 min-w-0 py-3 pl-3.5 pr-3.5">
        {/* Top line — title + time on right */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground truncate leading-snug">
            {meeting.meeting_title}
          </h3>
          {meeting.time && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] tabular-nums font-semibold text-foreground/80">
              <Clock className="h-2.5 w-2.5 text-text-tertiary" />
              {meeting.time}
            </span>
          )}
        </div>

        {/* Dot-separated metadata: date · attendees · type · company */}
        <div className="mt-1 flex items-center gap-2 text-[10.5px] text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {formatDate(meeting.date)}
          </span>
          <span className="text-text-tertiary/40">·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            {meeting.attendees ?? 1}
          </span>
          {typeInfo && meeting.meeting_type && (
            <>
              <span className="text-text-tertiary/40">·</span>
              <span className={`inline-flex items-center gap-1 ${typeInfo.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${typeInfo.dot}`} />
                <span className="uppercase tracking-wider font-medium">
                  {meeting.meeting_type}
                </span>
              </span>
            </>
          )}
          <span className="text-text-tertiary/40">·</span>
          <span className="uppercase tracking-wider">{co.label}</span>
        </div>

        {/* Location / link — subtler, single line, truncating */}
        {meeting.location && meeting.meeting_type && (
          <div className="mt-1 text-[10.5px] text-text-tertiary truncate">
            {meeting.meeting_type === "online" && typeof meeting.location === "string" && (
              <a
                href={meeting.location}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Join meeting
              </a>
            )}
            {meeting.meeting_type === "in-person" && typeof meeting.location === "string" && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {meeting.location}
              </span>
            )}
            {meeting.meeting_type === "hybrid" && isHybridLoc(meeting.hybrid_location) && (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  {meeting.hybrid_location.address}
                </span>
                <a
                  href={meeting.hybrid_location.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Join
                </a>
              </span>
            )}
          </div>
        )}
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
    <div className="px-5 py-3 flex items-center justify-between gap-3 bg-popover/70 border-b border-xs border-border-soft">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-md bg-gradient-to-br from-primary/15 to-primary/[0.03] border border-primary/20">
          <Calendar className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.18em] font-semibold">
              Meetings
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{list.length}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/60 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              CWA {cwaCount}
            </span>
            <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/60 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              Simpl {simpCount}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
            <Calendar className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground/50">No upcoming meetings</p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">
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
        <div className="px-5 pb-5 flex-1 min-h-0">
          {/* *This is 60px bigger than Tasks ScrollArea fixed height */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {list.map((meeting: any, i: number) => (
                <motion.div
                  key={meeting.id ?? i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <MeetingRow meeting={meeting} onEdit={editMeeting} onDelete={delMeeting} />
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
