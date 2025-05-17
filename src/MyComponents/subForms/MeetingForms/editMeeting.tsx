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

// I don't knoww if you had this elsewhere but im making aa prop for noww, you can delete later
interface EditMeetingProps {
  meetingID: number;
  open: boolean;
  setOpen : (open : boolean) => void;
  onComplete : () => void;
}


export const EditMeeting = ({ meetingID, open, setOpen, onComplete }: EditMeetingProps) => {
  // const [open, setOpen] = useState(false);
  // const { refetch } = MeetingsQuery();

  const { data, error, isLoading } = FetchMeetingQuery(meetingID);
  console.log({ meetingID });
  
  // creaating a state for the form default values to handle async loading
  const [defaultValues, setDefaultValues] = useState({
    meetingTitle: "",
    time: "",
    date: "",
    attendees: "",
    meetingType: "",
    location: "",
    url_location: ""
  })
  
  if (error) {
    console.log("Error fetching Selected Meeting to edit", error.message);
  }


  // a little useEffect actionn to update the default vaalues once data is loaded
  useEffect(() => {
    if ( data && !isLoading) {
      // extraact values from the meeting dataa
      setDefaultValues({
        meetingTitle: data.meeting_title || "",
        time: data.time || "",
        date: data.date || "",
        attendees: data.attendees?.toString() || "",
        meetingType : data.meeting_type || "",

      // we have to handle different locaation types
        location: data.meeting_type ===  "in-person"
        ? data.location
        : data.meeting_type === "hybrid"
          ? data.hybrid_location?.address
          : ""
        ,
        url_location : data.meeting_type === "online"
        ? data.location 
        : data.meeting_type === "hybrid"
        ? data.hybrid_location?.url
          : "",

      })
    }
  }, [data, isLoading])
  
  const form = useForm({
    defaultValues,
    // Dont need this no more
    // : {
    //   meetingTitle: data.meeting_title,
    //   time: data.time,
    //   date: data.date,
    //   attendees: data.attendees,
    //   meetingType: data.meeting_type,
    //   location: data.location || data.hybrid_location?.address,
    //   url_location: data.location || data.hybrid_location?.url,
    // },
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

                // clear hybrid location when switching to in-person
                hybrid_location: null
              })
              .eq("id", meetingID);

            if (error) {
              await message(error.message, {
                title: "Error Adding Meeting",
                kind: "error",
              });
            } else {
              // refetch();
              onComplete(); // we can just call on the onComplete rather than refetching
              setOpen(false);
              // form.reset();  // I  think this has been causing a few issues you can test this if youd like im just gonnaa not deal with it
              // actually im just gonna put it in a useEffect
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
                // clear hybrid 
                hybrid_locatiion: null
              })
              .eq("id", meetingID);

            if (onlineError) {
              await message(onlineError.message, {
                title: "Error Adding Meeting",
                kind: "error",
              });
            } else {
              // refetch();
              onComplete();
              setOpen(false);
              // form.reset();
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
                // clear regular locaation when switching to a hybridd
                location: null,
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
              // refetch();
              onComplete();
              setOpen(false);
              // form.reset();
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

  // updatae the form values when defaultValues Change
  useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues);
    }
  }, [defaultValues])

  // If still loading data, show a loading message in the dialog ( for funzies can't tweaak how it looks later)
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] bg-black/95 border-red-950/30 shadow-2xl shadow-red-950/40 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-red-200">Loading meeting data...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

 return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[600px] bg-black/95 border-red-950/30 
        shadow-2xl shadow-red-950/40 rounded-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-red-200 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-red-500" />
            Edit Meeting
          </DialogTitle>
          <DialogDescription className="text-red-200/60 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400" />
            Update the meeting details below.
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
                    placeholder="Meeting title"
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
                          required
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
                          required
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
                  Update Meeting
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};