import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
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
  const [moreToggle, setMoreToggle] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null); // This state to track which meeting is being edited | blaze: is there a reason why default value is null?
  const [showEditDialog, setShowEditDialog] = useState(false); //this state will control the visibility of the edit dialog
  const { setIsShowing, isShowing } = SchedImgStore();
  const { data: meetings, error, refetch } = MeetingsQuery();
  if (error) {
    console.log("Error Fetching Meetings", error.message);
  }

  // Helper function to get badge color based on meeting type
  const getBadgeClass = (type?: string) => {
    switch (type) {
      case "online":
        return "bg-blue-900/20 text-blue-400";
      case "hybrid":
        return "bg-purple-900/20 text-purple-400";
      case "in-person":
        return "bg-green-900/20 text-green-400";
      default:
        return "bg-gray-900/20 text-gray-400";
    }
  };

  // Helper function to check if location is an object with address and url
  const isHybridLocation = (
    location: any
  ): location is { address: string; url: string } => {
    return (
      typeof location === "object" &&
      location !== null &&
      "address" in location &&
      "url" in location
    );
  };

  const delMeeting = async (id: number) => {
    const { error } = await supabase.from("cwa_meetings").delete().eq("id", id);
    if (error) {
      await message(error.message, {
        title: "Error Deleting Meeting",
        kind: "error",
      });
    }
    refetch();
  };

  // Im simply going to put a placeholder function for the editing form
  const editMeeting = (id: number) => {
    setEditingMeetingId(id); // setting the id of the appropiate meeting to edit ()
    setShowEditDialog(true);
    console.log("Edit meeting with ID:", id);
  };

  return (
    <>
      {/* EditMeeting Dialog - its gonna render only when the showDialog is true */}
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

      {/* Upcoming Meetings */}
      <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 overflow-y-auto  sm:col-span-2 lg:col-span-2 rounded-xs">
        <CardHeader>
          <CardTitle className="text-amber-50 flex justify-between items-center">
            <span>Upcoming Meetings</span>

            <div className="flex space-x-2">
              {/* Add Meeting Dialog */}
              <UserView
                userRole={["CEO", "COO", "ProjectManager", "Marketing"]}
              >
                <AddMeeting />
              </UserView>

              <UserView userRole={["CEO", "COO", "SoftwareDev"]}>
                {/* Schedule Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    size={"default"}
                    className="relative bg-red-950/20 hover:bg-red-950/10 w-auto h-auto px-6 py-2  border border-red-500/20 group overflow-hidden rounded-xs"
                    onClick={() => setIsShowing(!isShowing)}
                  >
                    <Calendar className="h-4 ww-4"></Calendar>
                    View Schedule
                  </Button>
                </motion.div>
              </UserView>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {meetings.map((meeting, i) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  key={i}
                  // Put grid-cols to 1fr and 0.25fr when having 2 items
                  className={`grid ${moreToggle ? "grid-cols-[1fr_0.12fr]" : "grid-cols-[1fr] pr-0"} grid-rows-[auto] p-3 rounded-lg bg-black/60 border border-red-900/30`}
                >
                  <div className="col-start-1 grid grid-cols-[1fr_0.02fr] grid-rows-[auto] gap-5">
                    <section className="">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-amber-50">
                          {meeting.meeting_title}
                        </h3>
                        <Badge
                          variant="outline"
                          className="bg-red-900/20 text-red-400 "
                        >
                          {meeting.time}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-amber-50/70 ">
                          {meeting.date}
                        </p>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-amber-50/70" />
                          <span className="text-xs text-amber-50/70">
                            {meeting.attendees}
                          </span>
                        </div>
                      </div>

                      {/* Meeting Type Badge - Only show if type exists */}
                      {meeting.meeting_type && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            className={getBadgeClass(meeting.meeting_type)}
                          >
                            {meeting.meeting_type === "online" && (
                              <Video className="h-3 w-3 mr-1" />
                            )}
                            {meeting.meeting_type === "in-person" && (
                              <MapPin className="h-3 w-3 mr-1" />
                            )}
                            {meeting.meeting_type === "hybrid" && (
                              <div className="flex items-center">
                                <Video className="h-3 w-3 mr-1" />
                                <MapPin className="h-3 w-3 mr-1" />
                              </div>
                            )}
                            {meeting.meeting_type.charAt(0).toUpperCase() +
                              meeting.meeting_type.slice(1)}
                          </Badge>
                        </div>
                      )}

                      {/* Location Information - Only show if location exists */}
                      {meeting.location && meeting.meeting_type && (
                        <div className="mt-2 text-xs text-amber-50/70">
                          {meeting.meeting_type === "online" &&
                            typeof meeting.location === "string" && (
                              <>
                                <a
                                  href={meeting.location}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center hover:text-amber-50 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Join Meeting
                                </a>
                              </>
                            )}
                          {meeting.meeting_type === "in-person" &&
                            typeof meeting.location === "string" && (
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {meeting.location}
                              </div>
                            )}

                          {/* Hybrid locations is not showing for some reason */}
                          {meeting.meeting_type === "hybrid" &&
                            isHybridLocation(meeting.hybrid_location) && (
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {meeting.hybrid_location.address}
                                </div>
                                <a
                                  href={meeting.hybrid_location.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center hover:text-amber-50 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Join Online
                                </a>
                              </div>
                            )}
                        </div>
                      )}
                    </section>

                    <UserView userRole={["CEO", "COO"]}>
                      <section className="flex flex-col items-center justify-center border-l-[1px] border-red-950">
                        {/* Replace the ellipsis toggle with dropdown menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="text-red-700 hover:text-red-300 hover:cursor-pointer p-1">
                              <EllipsisVertical />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-black/90 border border-red-900/30 text-amber-50/70">
                            <DropdownMenuItem
                              onClick={() => editMeeting(meeting.id)}
                              className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => delMeeting(meeting.id)}
                              className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer text-red-400 "
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </section>
                    </UserView>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
};

export default Meetings;
