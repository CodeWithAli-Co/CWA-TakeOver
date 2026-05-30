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
  // Aliased to avoid shadowing the built-in Map constructor. Other
  // meeting-form files do the same; keep them in sync.
  Map as MapIcon,
  PersonStanding,
  Plus,
  Tags,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { MeetingsQuery, getActiveCompanyLabel } from "@/stores/query";
import {
  MultiSelectField,
  type Option,
} from "@/MyComponents/Reusables/multiselectField";

/**
 * Shape of the user objects passed in from the parent. Loosely
 * typed because different upstream queries return slightly
 * different row shapes — we accept anything with the fields we
 * actually use.
 */
export interface MeetingAttendeeOption {
  supa_id?: string | null;
  username?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
}

interface AddMeetingProps {
  /** Roster passed in from the parent — used to populate the
   *  attendee multi-select. Optional so legacy callers that don't
   *  yet pass users still render the form (the multi-select just
   *  shows "no employees available" in that case). */
  users?: MeetingAttendeeOption[];
}

export const AddMeeting = ({ users = [] }: AddMeetingProps = {}) => {
  const [open, setOpen] = useState(false);
  const { refetch } = MeetingsQuery();

  // Build the option list once per render of the user roster.
  // Skips any row missing a supa_id (the value we ultimately store
  // on cwa_meetings.attendee_ids).
  const attendeeOptions: Option[] = useMemo(
    () =>
      users
        .filter((u): u is MeetingAttendeeOption & { supa_id: string } =>
          Boolean(u.supa_id),
        )
        .map((u) => ({
          value: u.supa_id,
          // "username · Role" — role is optional, drop the dot when missing.
          label: u.role ? `${u.username ?? u.supa_id} · ${u.role}` : (u.username ?? u.supa_id),
          ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
        })),
    [users],
  );

  // Local controlled state for the multi-select — kept in this
  // component instead of the shared multi-select zustand store so
  // the AddTodo modal (which uses the same store) doesn't interfere.
  const [selectedAttendees, setSelectedAttendees] = useState<Option[]>([]);

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
      // Derive both columns from the multi-select. attendee_ids is
      // the source of truth going forward; attendees (count string)
      // is written too so legacy reads / callers that haven't been
      // updated still see a sensible number.
      const attendeeIds = selectedAttendees.map((a) => a.value);
      const attendeeCount =
        attendeeIds.length > 0 ? String(attendeeIds.length) : value.attendees;

      // Helper — base insert payload shared across meeting types.
      // Type-specific location handling layered on top below.
      const baseInsert = {
        meeting_title: value.meetingTitle,
        time: value.time,
        date: value.date,
        attendees: attendeeCount,
        attendee_ids: attendeeIds,
        meeting_type: value.meetingType,
        company: getActiveCompanyLabel(),
      };

      // Try the full insert. If the DB doesn't have the new
      // attendee_ids column yet (migration not run), Supabase
      // returns a schema-cache error — retry once without it so
      // the meeting still gets created. The operator sees a tiny
      // hint in console; meetings UI degrades to placeholder
      // avatars for this row.
      const insertWithFallback = async (payload: Record<string, any>) => {
        let res = await supabase.from("cwa_meetings").insert(payload);
        if (
          res.error &&
          /attendee_ids/i.test(res.error.message ?? "") &&
          /column|schema|cache/i.test(res.error.message ?? "")
        ) {
          console.warn(
            "cwa_meetings.attendee_ids not found — retrying without it. Run migrations/meeting_attendees.sql in Supabase.",
          );
          const { attendee_ids: _drop, ...rest } = payload;
          res = await supabase.from("cwa_meetings").insert(rest);
        }
        return res;
      };

      try {
        let res;
        switch (value.meetingType) {
          case "in-person":
            res = await insertWithFallback({
              ...baseInsert,
              location: value.location,
            });
            break;
          case "online":
            res = await insertWithFallback({
              ...baseInsert,
              location: value.url_location,
            });
            break;
          case "hybrid":
            res = await insertWithFallback({
              ...baseInsert,
              hybrid_location: {
                address: value.location,
                url: value.url_location,
              },
            });
            break;
          default:
            return;
        }

        if (res.error) {
          await message(res.error.message, {
            title: "Error Adding Meeting",
            kind: "error",
          });
          return;
        }

        refetch();
        setOpen(false);
        form.reset();
        setSelectedAttendees([]);
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
        {/* Dark inset, red outline, red text — the look the operator
            specced. zinc-950 keeps the chip almost flush with the
            canvas, with the primary border + label doing all the
            colour work. Hover lifts the border slightly so the chip
            still feels alive without growing in weight. */}
        <Button
          size="sm"
          className="
            group inline-flex items-center gap-1.5 h-7 px-3 rounded-md
            bg-primary/10 hover:bg-primary/20
            border border-primary/30 hover:border-primary/60
            text-primary
            text-[11px] font-bold uppercase tracking-wider
            transition-colors
          "
        >
          <Plus className="h-3 w-3 transition-transform duration-200 group-hover:rotate-90" />
          Add Meeting
        </Button>
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

            {/* Attendees — full-width multi-select. Picked people
             *  get stamped into cwa_meetings.attendee_ids on submit.
             *  The MeetingCard later resolves those IDs back to
             *  avatars so the meeting tile shows real faces. */}
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
                  className="bg-blue-500 
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
