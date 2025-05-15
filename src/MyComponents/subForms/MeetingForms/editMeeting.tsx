import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { useForm } from "@tanstack/react-form";
import {
  Calendar,
  Clock,
  Link,
  Map,
  PersonStanding,
  Plus,
  Tags,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { MeetingsQuery } from "@/stores/query";
import { FetchMeetingQuery } from "@/stores/MeetingStore";

export const EditMeeting = ({ meetingID }: { meetingID: number }) => {
  const [open, setOpen] = useState(false);
  const { refetch } = MeetingsQuery();
  const { data, error } = FetchMeetingQuery(meetingID);
  if (error) {
    console.log("Error fetching Selected Meeting to edit", error.message);
  }
  console.log({ meetingID });

  const form = useForm({
    defaultValues: {
      meetingTitle: data.meeting_title,
      time: data.time,
      date: data.date,
      attendees: data.attendees,
      meetingType: data.meeting_type,
      location: data.location || data.hybrid_location?.address,
      url_location: data.location || data.hybrid_location?.url,
    },
    onSubmit: async ({ value }) => {
      try {
        switch (value.meetingType) {
          case "in-person":
            const { error } = await supabase
              .from("cwa_meetings")
              .update({
                meeting_title: value.meetingTitle,
                time: value.time,
                date: value.date,
                attendees: value.attendees,
                meeting_type: value.meetingType,
                location: value.location,
              })
              .eq("id", meetingID);

            if (error) {
              await message(error.message, {
                title: "Error Adding Meeting",
                kind: "error",
              });
            } else {
              refetch();
              setOpen(false);
              form.reset();
            }
            return;

          case "online":
            const { error: onlineError } = await supabase
              .from("cwa_meetings")
              .update({
                meeting_title: value.meetingTitle,
                time: value.time,
                date: value.date,
                attendees: value.attendees,
                meeting_type: value.meetingType,
                location: value.url_location,
              })
              .eq("id", meetingID);

            if (onlineError) {
              await message(onlineError.message, {
                title: "Error Adding Meeting",
                kind: "error",
              });
            } else {
              refetch();
              setOpen(false);
              form.reset();
            }
            return;

          case "hybrid":
            const { error: hybridError } = await supabase
              .from("cwa_meetings")
              .update({
                meeting_title: value.meetingTitle,
                time: value.time,
                date: value.date,
                attendees: value.attendees,
                meeting_type: value.meetingType,
                hybrid_location: {
                  address: value.location,
                  url: value.url_location,
                },
              })
              .eq("id", meetingID);

            if (hybridError) {
              await message(hybridError.message, {
                title: "Error Adding Meeting",
                kind: "error",
              });
            } else {
              refetch();
              setOpen(false);
              form.reset();
            }
        }
      } catch (err) {
        await message("An unexpected error occurred", {
          title: "Error",
          kind: "error",
        });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            size={"default"}
            className="relative bg-gradient-to-r from-orange-700 via-orange-800 to-orange-950 hover:from-orange-950 hover:via-orange-900 active:from-orange-800  active:to-orange-990 w-auto h-auto px-4 py-2 transform transition-all ease-out border border-orange-900 group rounded-full  duration-300"
          >
            <Plus className="h-4 w-4 mr-1" />
            Edit Meeting
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[600px] bg-black/95 border-red-950/30 
        shadow-2xl shadow-red-950/40 rounded-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-red-200 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-red-500" />
            Add New Meeting
          </DialogTitle>
          <DialogDescription className="text-red-200/60 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400" />
            Add a new meeting to the schedule. Fill in the meeting details
            below.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="grid gap-4">
            {/* Title */}
            <form.Field
              name="meetingTitle"
              children={(field) => (
                <div className="grid gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-red-200 flex items-center gap-2"
                  >
                    <Tags className="w-4 h-4 text-red-400" />
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Task title"
                    className="bg-black/40 border-red-950/30 text-red-200 
                    focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
                    transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Time */}
            <form.Field
              name="time"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-red-200">
                    Time
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Enter Time ( e.g. 11:00AM - 2:00PM )"
                    className="bg-black/40 inline border-red-950/30 text-red-200 
                  focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
                  transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              {/* Date */}
              <form.Field
                name="date"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name} className="text-red-200">
                      Date
                    </Label>
                    <Input
                      id={field.name}
                      type="text"
                      autoComplete="off"
                      required
                      placeholder="Enter Date ( e.g. May, 11 2025 )"
                      className="bg-black/40 inline border-red-950/30 text-red-200 
                  focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
                  transition-all duration-300"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              />

              {/* Attendees */}
              <form.Field
                name="attendees"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label
                      htmlFor={field.name}
                      className="text-red-200 flex items-center gap-2"
                    >
                      <PersonStanding className="w-4 h-4 text-red-400" />
                      Attendees
                    </Label>
                    <Select
                      value={field.state.value}
                      required
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-black/40 border-red-950/30 
                        text-red-200 focus:border-red-700 
                        focus:ring-2 focus:ring-red-900/50"
                      >
                        <SelectValue placeholder="Select Number of Attendees" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-black border-red-950/30 
                        text-red-200"
                      >
                        {["1", "2", "3", "4", "5"].map((attendees) => (
                          <SelectItem
                            key={attendees}
                            value={attendees}
                            className="text-red-200 
                            hover:bg-red-950/30 focus:bg-red-950/40"
                          >
                            {attendees.charAt(0).toUpperCase() +
                              attendees.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              {/* Meeting Type */}
              <form.Field
                name="meetingType"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name} className="text-red-200">
                      Type
                    </Label>
                    <Select
                      value={field.state.value}
                      required
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-black/40 border-red-950/30 
                        text-red-200 focus:border-red-700 
                        focus:ring-2 focus:ring-red-900/50"
                      >
                        <SelectValue placeholder="Select Meeting Type" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-black border-red-950/30 
                        text-red-200"
                      >
                        {["in-person", "online", "hybrid"].map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                            className="text-red-200 
                            hover:bg-red-950/30 focus:bg-red-950/40"
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            {/* Location */}
            <form.Subscribe
              selector={(state) => state.values.meetingType}
              children={(meetingType) =>
                meetingType === "in-person" || meetingType === "hybrid" ? (
                  <form.Field
                    name="location"
                    children={(field) => (
                      <div className="grid gap-2">
                        <Label
                          htmlFor={field.name}
                          className="text-red-200 flex items-center gap-2"
                        >
                          <Map className="w-4 h-4 text-red-400" />
                          Location
                        </Label>
                        <Input
                          id={field.name}
                          type="text"
                          autoComplete="off"
                          placeholder="Physical Location for Meeting"
                          className="bg-black/40 border-red-950/30 text-red-200 
                    focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
                    transition-all duration-300"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    )}
                  />
                ) : (
                  ""
                )
              }
            />

            {/* Meeting URL */}
            <form.Subscribe
              selector={(state) => state.values.meetingType}
              children={(meetingType) =>
                meetingType === "online" || meetingType === "hybrid" ? (
                  <form.Field
                    name="url_location"
                    children={(field) => (
                      <div className="grid gap-2">
                        <Label
                          htmlFor={field.name}
                          className="text-red-200 flex items-center gap-2"
                        >
                          <Link className="w-4 h-4 text-red-400" />
                          URL Location
                        </Label>
                        <Input
                          id={field.name}
                          type="url"
                          autoComplete="off"
                          placeholder="Online Meeting Link"
                          className="bg-black/40 border-red-950/30 text-red-200 
                    focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
                    transition-all duration-300"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    )}
                  />
                ) : (
                  ""
                )
              }
            />
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                form.reset();
              }}
              className="border-red-800/30 text-red-200 
              hover:bg-red-950/20 hover:text-red-100 
              transition-all duration-300"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-gradient-to-r from-red-950 to-red-900 
                  hover:from-red-900 hover:to-red-800 
                  text-white border border-red-800/30 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300 
                  hover:scale-[1.02] active:scale-[0.98]"
                >
                  Edit Meeting
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
