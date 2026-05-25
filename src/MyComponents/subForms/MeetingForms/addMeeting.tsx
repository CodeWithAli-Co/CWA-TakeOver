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
import { useState } from "react";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { MeetingsQuery, getActiveCompanyLabel } from "@/stores/query";

export const AddMeeting = () => {
  const [open, setOpen] = useState(false);
  const { refetch } = MeetingsQuery();

  const form = useForm({
    defaultValues: {
      meetingTitle: "",
      time: "",
      date: "",
      attendees: "",
      meetingType: "",
      location: "",
      url_location: "",
    },
    onSubmit: async ({ value }) => {
      try {
        switch (value.meetingType) {
          case "in-person":
            const { error } = await supabase.from("cwa_meetings").insert({
              meeting_title: value.meetingTitle,
              time: value.time,
              date: value.date,
              attendees: value.attendees,
              meeting_type: value.meetingType,
              location: value.location,
              company: getActiveCompanyLabel(),
            });

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
              .insert({
                meeting_title: value.meetingTitle,
                time: value.time,
                date: value.date,
                attendees: value.attendees,
                meeting_type: value.meetingType,
                location: value.url_location,
                company: getActiveCompanyLabel(),
              });

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
              .insert({
                meeting_title: value.meetingTitle,
                time: value.time,
                date: value.date,
                attendees: value.attendees,
                meeting_type: value.meetingType,
                hybrid_location: {
                  address: value.location,
                  url: value.url_location,
                },
                company: getActiveCompanyLabel(),
              });

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
            className="relative bg-green-950/20 hover:bg-green-950/10  active:to-green-950/20 w-auto h-auto px-4 py-2 transform transition-all ease-out border border-green-900 group rounded-xs  duration-300"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Meeting
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Add New Meeting
          </DialogTitle>
          <DialogDescription className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
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
                    className="text-foreground/70 flex items-center gap-2"
                  >
                    <Tags className="w-4 h-4 text-primary" />
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Task title"
                    className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
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
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Time
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Enter Time ( e.g. 11:00AM - 2:00PM )"
                    className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
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
                    <Label htmlFor={field.name} className="text-foreground/70">
                      Date
                    </Label>
                    <Input
                      id={field.name}
                      type="text"
                      autoComplete="off"
                      required
                      placeholder="Enter Date ( e.g. May, 11 2025 )"
                      className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
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
                      className="text-foreground/70 flex items-center gap-2"
                    >
                      <PersonStanding className="w-4 h-4 text-primary" />
                      Attendees
                    </Label>
                    <Select
                      value={field.state.value}
                      required
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-background/40 border-border 
                        text-foreground/70 focus:border-primary/30 
                        focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Select Number of Attendees" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-background border-border 
                        text-foreground/70"
                      >
                        {["1", "2", "3", "4", "5"].map((attendees) => (
                          <SelectItem
                            key={attendees}
                            value={attendees}
                            className="text-primary-foreground/70 
                            hover:bg-primary/[0.12] focus:bg-primary/[0.15]"
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
                    <Label htmlFor={field.name} className="text-foreground/70">
                      Type
                    </Label>
                    <Select
                      value={field.state.value}
                      required
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-background/40 border-border 
                        text-foreground/70 focus:border-primary/30 
                        focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Select Meeting Type" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-background border-border 
                        text-foreground/70"
                      >
                        {["in-person", "online", "hybrid"].map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                            className="text-primary-foreground/70 
                            hover:bg-primary/[0.12] focus:bg-primary/[0.15]"
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
                          className="text-foreground/70 flex items-center gap-2"
                        >
                          <Map className="w-4 h-4 text-primary" />
                          Location
                        </Label>
                        <Input
                          id={field.name}
                          type="text"
                          autoComplete="off"
                          required
                          placeholder="Physical Location for Meeting"
                          className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
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
                          className="text-foreground/70 flex items-center gap-2"
                        >
                          <Link className="w-4 h-4 text-primary" />
                          URL Location
                        </Label>
                        <Input
                          id={field.name}
                          type="url"
                          autoComplete="off"
                          required
                          placeholder="Online Meeting Link"
                          className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
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
              className="border-primary/15 text-primary-foreground/70 
              hover:bg-primary/10 hover:text-foreground/80 
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
                  className="bg-primary 
                  hover:bg-primary/80 
                  text-primary-foreground border border-primary/15 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300 
                  hover:scale-[1.02] active:scale-[0.98]"
                >
                  Add Meeting
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
