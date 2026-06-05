import { takeOversupabase } from "@/MyComponents/supabase"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { create } from "zustand"

// Meeting Store
interface MeetingState {
  title: string
  setTitle: (title: string) => void
  time: string
  setTime: (time: string) => void
  date: string
  setDate: (date: string) => void
  attendees: number
  setAttendees: (attendees: number) => void
  type: string
  setType: (type: string) => void
  location: string
  setLocation: (location: string) => void
  urlLocation: string
  setUrlLocation: (urlLocation: string) => void
}
export const useMeetingStore = create<MeetingState>()((set) => ({
  title: '',
  setTitle: (title: string) => set({ title }),
  time: '',
  setTime: (time: string) => set({ time }),
  date: '',
  setDate: (date: string) => set({ date }),
  attendees: 0,
  setAttendees: (attendees: number) => set({ attendees }),
  type: '',
  setType: (type: string) => set({ type }),
  location: '',
  setLocation: (location: string) => set({ location }),
  urlLocation: '',
   setUrlLocation: (urlLocation: string) =>  set({ urlLocation })
}))

// Single Meeting Query
interface SingleMeeting {
  meeting_title: string;
  time?: string;
  date: string;
  attendees: string;
  meeting_type: string;
  location?: string;
  hybrid_location?: { address: string, url: string };
}
const fetchMeeting = async (id: number) => {
  const { data, error } = await takeOversupabase.from('cwa_meetings').select('*').eq('id', id).single()
  if (error) {
    console.log('Error fetching Single Meeting from DB', error.message)
  };

  return data as SingleMeeting
};
export const FetchMeetingQuery = (id: number) => {
  return useSuspenseQuery({
    queryKey: ["single-meeting"],
    queryFn: () => fetchMeeting(id)
  });
};

// ----------------------------------------------------------------
// useJoinMeeting -- append the current user's supa_id to a meeting's
// `joiners` jsonb array.
//
// Why a read-modify-write on the client instead of a stored proc:
//   The joiners lists are short (a handful per meeting), this
//   action only fires on an explicit click (not at scale), and we
//   want the optimistic UI of refreshing one row. If contention
//   ever becomes a problem we move to a SQL function with
//   array_append + WHERE NOT joiners ? user_id.
//
// Guard rails:
//   - No-op if user_supa_id is empty / falsy (avoids "" rows).
//   - No-op if the meeting doesn't actually allow_join (the button
//     could be stale if creator toggled it off between fetch and
//     click).
//   - No-op if user is already in joiners (idempotent).
//
// On success we invalidate the "meetings" query (all company
// variants) so every surface that reads MeetingsQuery refreshes.
// ----------------------------------------------------------------
export const useJoinMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      meetingId,
      userSupaId,
    }: {
      meetingId: number;
      userSupaId: string;
    }) => {
      if (!userSupaId) {
        throw new Error("Cannot join meeting without a user identity.");
      }

      // Re-fetch the row so we don't trample concurrent joiners.
      const { data: row, error: fetchErr } = await takeOversupabase
        .from("cwa_meetings")
        .select("id, allow_join, joiners")
        .eq("id", meetingId)
        .single();

      if (fetchErr || !row) {
        throw new Error(
          fetchErr?.message ?? "Meeting not found while joining."
        );
      }

      // Schema types are loose (Database type isn't regenerated
      // after every migration) so we widen the row locally to read
      // the two columns added in meeting_description_and_joins.sql.
      const r = row as { allow_join?: boolean; joiners?: unknown };
      if (r.allow_join !== true) {
        throw new Error("This meeting isn't open for self-join.");
      }

      const current: string[] = Array.isArray(r.joiners)
        ? (r.joiners as string[])
        : [];
      if (current.includes(userSupaId)) {
        return current;
      }

      const next = [...current, userSupaId];
      // Cast through unknown to bypass the strict Update<T> overload.
      const patch = { joiners: next } as unknown as never;
      const { error: updateErr } = await takeOversupabase
        .from("cwa_meetings")
        .update(patch)
        .eq("id", meetingId);

      if (updateErr) {
        throw new Error(updateErr.message);
      }
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
};
