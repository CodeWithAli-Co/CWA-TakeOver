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
  // Aliased to avoid shadowing the built-in Map constructor — we
  // use `new Map()` below to build the attendee-lookup index.
  Map as MapIcon,
  PersonStanding,
  Plus,
  Tags,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { takeOversupabase } from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { MeetingsQuery } from "@/stores/query";
import { FetchMeetingQuery } from "@/stores/MeetingStore";
import {
  MultiSelectField,
  type Option,
} from "@/MyComponents/Reusables/multiselectField";
import type { MeetingAttendeeOption } from "./addMeeting";

interface EditMeetingProps {
  meetingID: number;
  open: boolean;
  setOpen : (open : boolean) => void;
  onComplete : () => void;
  /** Roster passed in from the parent — drives the attendee
   *  multi-select. Optional so legacy callers don't break. */
  users?: MeetingAttendeeOption[];
}


export const EditMeeting = ({ meetingID, open, setOpen, onComplete, users = [] }: EditMeetingProps) => {
  // const [open, setOpen] = useState(false);
  // const { refetch } = MeetingsQuery();

  const { data, error, isLoading } = FetchMeetingQuery(meetingID);
  console.log({ meetingID });

  // Build the option list from the parent-provided roster.
  // Skip rows missing supa_id (the value we store on attendee_ids).
  const attendeeOptions: Option[] = useMemo(
    () =>
      users
        .filter((u): u is MeetingAttendeeOption & { supa_id: string } =>
          Boolean(u.supa_id),
        )
        .map((u) => ({
          value: u.supa_id,
          label: u.role ? `${u.username ?? u.supa_id} · ${u.role}` : (u.username ?? u.supa_id),
          ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
        })),
    [users],
  );

  // Local controlled state for the multi-select — kept here so the
  // EditTodo modal (which uses the shared zustand multi-select
  // store) doesn't stomp our selections.
  const [selectedAttendees, setSelectedAttendees] = useState<Option[]>([]);

  // When the meeting data arrives, hydrate the multi-select from
  // attendee_ids. Look each ID up in the option list so the chip
  // gets the correct label + avatar; IDs that don't resolve are
  // skipped (defensive — handles deleted users gracefully).
  useEffect(() => {
    if (!data) return;
    const ids: string[] = Array.isArray((data as any).attendee_ids)
      ? (data as any).attendee_ids
      : [];
    const optionsById = new Map(attendeeOptions.map((o) => [o.value, o]));
    const preselected = ids
      .map((id) => optionsById.get(id))
      .filter((o): o is Option => Boolean(o));
    setSelectedAttendees(preselected);
  }, [data, attendeeOptions]);

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
        // @ts-expect-error (location is possibly undefined)
        location: data.meeting_type ===  "in-person"
        ? data.location
        : data.meeting_type === "hybrid"
          ? data.hybrid_location?.address
          : ""
        ,
        // @ts-expect-error (location is possibly undefined)
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
      // attendee_ids = source of truth; legacy attendees count is
      // derived from the picked array length on every save so the
      // two columns can't drift apart.
      const attendeeIds = selectedAttendees.map((a) => a.value);
      const attendeeCount =
        attendeeIds.length > 0 ? String(attendeeIds.length) : value.attendees;

      // Per-type location handling. Switching type clears the
      // other branch's fields so a hybrid->online switch doesn't
      // leave a stale `hybrid_location` object behind.
      type Patch = Record<string, any>;
      let typeSpecific: Patch;
      switch (value.meetingType) {
        case "in-person":
          typeSpecific = {
            location: value.location,
            hybrid_location: null,
          };
          break;
        case "online":
          typeSpecific = {
            location: value.url_location,
            hybrid_location: null,
          };
          break;
        case "hybrid":
          typeSpecific = {
            location: null,
            hybrid_location: {
              address: value.location,
              url: value.url_location,
            },
          };
          break;
        default:
          return;
      }

      const basePatch: Patch = {
        meeting_title: value.meetingTitle,
        time: value.time,
        date: value.date,
        attendees: attendeeCount,
        attendee_ids: attendeeIds,
        meeting_type: value.meetingType,
        ...typeSpecific,
      };

      // Same fallback dance as AddMeeting — if the schema doesn't
      // have attendee_ids yet, retry without it so the update
      // still succeeds. Logs a hint to run the migration.
      const updateWithFallback = async (patch: Patch) => {
        let res = await takeOversupabase
    .from("cwa_meetings")
          .update(patch)
          .eq("id", meetingID);
        if (
          res.error &&
          /attendee_ids/i.test(res.error.message ?? "") &&
          /column|schema|cache/i.test(res.error.message ?? "")
        ) {
          console.warn(
            "cwa_meetings.attendee_ids not found — retrying without it. Run migrations/meeting_attendees.sql in Supabase.",
          );
          const { attendee_ids: _drop, ...rest } = patch;
          res = await takeOversupabase
      .from("cwa_meetings")
            .update(rest)
            .eq("id", meetingID);
        }
        return res;
      };

      try {
        const res = await updateWithFallback(basePatch);
        if (res.error) {
          await message(res.error.message, {
            title: "Error Updating Meeting",
            kind: "error",
          });
          return;
        }
        onComplete();
        setOpen(false);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground/70">Loading meeting data...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

 return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Edit Meeting
          </DialogTitle>
          <DialogDescription className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
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
                    placeholder="Meeting title"
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

            {/* Attendees — full-width multi-select hydrated from
             *  attendee_ids in the useEffect above. */}
            <div className="grid gap-2">
              <Label className="text-foreground/70 flex items-center gap-2">
                <PersonStanding className="w-4 h-4 text-primary" />
                Attendees
              </Label>
              <MultiSelectField
                name="Attendees"
                hideLabel
                options={attendeeOptions}
                value={selectedAttendees}
                onChange={setSelectedAttendees}
                placeholder={
                  attendeeOptions.length === 0
                    ? "No employees available"
                    : "Pick who's attending…"
                }
              />
            </div>

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
                          <MapIcon className="w-4 h-4 text-primary" />
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