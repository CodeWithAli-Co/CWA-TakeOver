import supabase from "@/MyComponents/supabase"
import { useSuspenseQuery } from "@tanstack/react-query"
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
  meeting_type?: string;
  location?: string;
  hybrid_location?: { address: string, url: string };
}
const fetchMeeting = async (id: number) => {
  const { data, error } = await supabase.from('cwa_meetings').select('*').eq('id', id).single()
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