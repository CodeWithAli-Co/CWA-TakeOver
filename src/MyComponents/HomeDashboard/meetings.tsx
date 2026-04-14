import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
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

const Meetings = () => {
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { setIsShowing, isShowing } = SchedImgStore();
  const { data: meetings, error, refetch } = MeetingsQuery();
  if (error) console.log("Error Fetching Meetings", error.message);

  const getBadgeClass = (type?: string) => {
    switch (type) {
      case "online": return "bg-blue-500/[0.06] text-blue-400/80 border-blue-500/10";
      case "hybrid": return "bg-purple-500/[0.06] text-purple-400/80 border-purple-500/10";
      case "in-person": return "bg-emerald-500/[0.06] text-emerald-400/80 border-emerald-500/10";
      default: return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  const isHybridLocation = (location: any): location is { address: string; url: string } => {
    return typeof location === "object" && location !== null && "address" in location && "url" in location;
  };

  const delMeeting = async (id: number) => {
    const { error } = await supabase.from("cwa_meetings").delete().eq("id", id);
    if (error) await message(error.message, { title: "Error Deleting Meeting", kind: "error" });
    refetch();
  };

  const editMeeting = (id: number) => {
    setEditingMeetingId(id);
    setShowEditDialog(true);
  };

  // Empty state — compact
  if (!meetings || meetings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-sm overflow-hidden h-full flex flex-col">
        <div className="px-5 pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-muted/40 border border-border">
              <Calendar className="h-4 w-4 text-primary/70" />
            </div>
            <span className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">Meetings</span>
          </div>
          <UserView userRole={["CEO", "COO", "ProjectManager", "Marketing"]}>
            <AddMeeting />
          </UserView>
        </div>
        <div className="flex-1 flex items-center justify-center px-5 pb-5">
          <div className="text-center">
            <Calendar className="h-6 w-6 text-white/[0.05] mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground/40">No upcoming meetings</p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">Schedule one to get started</p>
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
          onComplete={() => { setEditingMeetingId(null); refetch(); }}
        />
      )}

      <div className="bg-card border border-border rounded-sm h-full overflow-hidden flex flex-col">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-muted/40 border border-border">
              <Calendar className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">Meetings</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="h-1 w-1 rounded-full bg-white/15" />
                <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Both companies</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <UserView userRole={["CEO", "COO", "ProjectManager", "Marketing"]}>
              <AddMeeting />
            </UserView>
            <UserView userRole={["CEO", "COO", "SoftwareDev"]}>
              <Button
                size="default"
                className="bg-muted/40 hover:bg-primary/[0.06] border border-border hover:border-primary/15 text-muted-foreground/50 hover:text-muted-foreground/80 transition-all duration-300 rounded-sm text-[11px] h-7"
                onClick={() => setIsShowing(!isShowing)}
              >
                <Calendar className="h-3 w-3 mr-1.5" />
                Schedule
              </Button>
            </UserView>
          </div>
        </div>

        <div className="px-5 pb-5 flex-1">
          <ScrollArea className="h-full min-h-[200px]">
            <div className="space-y-2">
              {meetings.map((meeting, i) => (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  key={i}
                  className="group grid grid-cols-[1fr_auto] p-4 rounded-sm bg-card border border-white/[0.03] hover:border-primary/10 transition-all duration-300"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-medium text-foreground/75">{meeting.meeting_title}</h3>
                      <Badge variant="outline" className="bg-red-500/[0.06] text-primary/60 border-red-500/10 text-[10px]">
                        {meeting.time}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground/60">{meeting.date}</p>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground/30" />
                        <span className="text-[11px] text-muted-foreground/40">{meeting.attendees}</span>
                      </div>
                    </div>
                    {meeting.meeting_type && (
                      <Badge className={`${getBadgeClass(meeting.meeting_type)} text-[10px]`}>
                        {meeting.meeting_type === "online" && <Video className="h-2.5 w-2.5 mr-1" />}
                        {meeting.meeting_type === "in-person" && <MapPin className="h-2.5 w-2.5 mr-1" />}
                        {meeting.meeting_type === "hybrid" && (<><Video className="h-2.5 w-2.5 mr-0.5" /><MapPin className="h-2.5 w-2.5 mr-1" /></>)}
                        {meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)}
                      </Badge>
                    )}
                    {meeting.location && meeting.meeting_type && (
                      <div className="text-[11px] text-muted-foreground/40">
                        {meeting.meeting_type === "online" && typeof meeting.location === "string" && (
                          <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary transition-colors">
                            <ExternalLink className="h-3 w-3 mr-1" />Join Meeting
                          </a>
                        )}
                        {meeting.meeting_type === "in-person" && typeof meeting.location === "string" && (
                          <div className="flex items-center"><MapPin className="h-3 w-3 mr-1" />{meeting.location}</div>
                        )}
                        {meeting.meeting_type === "hybrid" && isHybridLocation(meeting.hybrid_location) && (
                          <div className="space-y-1">
                            <div className="flex items-center"><MapPin className="h-3 w-3 mr-1" />{meeting.hybrid_location.address}</div>
                            <a href={meeting.hybrid_location.url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3 mr-1" />Join Online
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <UserView userRole={["CEO", "COO"]}>
                    <div className="flex items-center justify-center pl-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="text-muted-foreground/30 hover:text-muted-foreground/70 cursor-pointer p-1 rounded-sm hover:bg-muted/40 transition-all">
                            <EllipsisVertical className="h-4 w-4" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0f0f0f] border border-border text-muted-foreground/80 rounded-sm">
                          <DropdownMenuItem onClick={() => editMeeting(meeting.id)} className="hover:bg-muted/50 hover:text-foreground cursor-pointer rounded-sm text-[12px]">
                            <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => delMeeting(meeting.id)} className="hover:bg-primary/[0.06] hover:text-primary cursor-pointer text-primary/50 rounded-sm text-[12px]">
                            <Trash className="h-3.5 w-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </UserView>
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
