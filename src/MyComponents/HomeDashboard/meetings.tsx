import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion } from "framer-motion";
import { Users, Video, MapPin, ExternalLink, ArrowRight, Calendar } from "lucide-react";
import { SchedImgStore } from "@/stores/store";
import { Button } from "@/components/ui/button";
// Define types for our meeting data
type LocationType = string | { address: string; url: string };

interface MeetingType {
  title: string;
  time: string;
  date: string;
  attendees: number;
  type?: "online" | "in-person" | "hybrid";
  location?: LocationType;
}

const Meetings = () => {
  const { setIsShowing, isShowing } = SchedImgStore();

  // Sample data with the new fields
  const meetingsData: MeetingType[] = [
    {
      title: "E-Commerce Website Meeting",
      time: "1:00pm - 2:00pm",
      date: "May, 6 2025",
      attendees: 2,
      type: "online",
      location: "https://sfpl-org.zoom.us/w/87319780450?tk=qZI35JsmfogzcSFVN87MI0lWb6BjyfQnagBuQ9tU9bE.DQcAAAAUVKocYhZmSmJsYVhObFIwLWgxdHoyZTlEdktRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    },
    {
      title: "Pre-Departure Meeting",
      time: "11:00am - 12:30pm",
      date: "May, 7 2025",
      attendees: 2,
      type: "online",
      location: "https://www.google.com/url?q=https://teams.microsoft.com/l/meetup-join/19%253ameeting_MDBjYTkxMGItOWZjMy00MjMzLThkNDUtNzVkMDBjZDk1MDJi%2540thread.v2/0?context%3D%257b%2522Tid%2522%253a%2522ca6fbace-7cba-4d53-8681-a06284f7ff46%2522%252c%2522Oid%2522%253a%252288eed1c4-b14d-480c-a796-9ac379e3c0e5%2522%257d&sa=D&source=calendar&usd=2&usg=AOvVaw1sVb54sA-lS7jcujII63LA"
    },
    {
      title: "Bay Area Real Estate Investing Mixer & Fireside Chat",
      time: "2:30pm - 5:30pm",
      date: "May, 9 2025",
      attendees: 1,
      type: "in-person",
      location: "Quadrus Conference Center & Catering - 2400 Sand Hill Road - Menlo Park, CA, US"
    },
    {
      title: "Meet your VCs, Meet your startup teams: entrepreneurs' networking coffee time",
      time: "11:00am - 1:00pm",
      date: "May, 13 2025",
      attendees: 1,
      type: "in-person",
      location: "Starbucks - 325 Sharon Park Dr - Menlo Park, CA, US"
    },
    {
      title: "Startup Oasis",
      time: "5:00pm - 7:00pm",
      date: "May, 22 2025",
      attendees: 2,
      type: "online",
      location: "https://us06web.zoom.us/j/84877132456?pwd=H8ZfGHbr5aEeEy0C1RXTepx3DEMhsm.1"
    },
    {
      title: "Social Hangout",
      time: "7:00 - 9:00 PM",
      date: "May, 28 2025",
      attendees: 1,
      type: "in-person",
      location: "170 South Sunnyvale Avenue · Sunnyvale, CA"
    },
    {
      title: "SJSU Mandatory Orientation Session",
      time: "8:00am - 5:00pm (?)",
      date: "July, 8 2025",
      attendees: 1,
      type: "in-person",
      location: "unknown -> SJSU?"
    }
    // Add more meetings as needed
  ];

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
  const isHybridLocation = (location: any): location is { address: string; url: string } => {
    return typeof location === 'object' && location !== null && 'address' in location && 'url' in location;
  };

  return (
    <>
      {/* Upcoming Meetings */}
      <Card className="bg-black/40 border-red-900/30 overflow-y-auto  sm:col-span-2 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-amber-50 flex justify-between items-center">
            <span>Upcoming Meetings</span>
           
           {/* addding motion to smoothe things out */}
           <motion.div
           whileHover={{scale: 1.02}}
           whileTap={{scale: 0.98}}
           transition={{ type: "spring", stiffness: 400, damping: 17}}
           >
            <Button size={"default"} className="relative bg-gradient-to-r from-red-700 via-red-800 to-red-950  hover:from-red-800 hover:to-red-950 hover:via-red-900 active:from-red-800 active:to-red-990 w-auto h-auto px-6 py-2.5 transform transition-all duration-300 ease-out shadow-sm hover:shadow-red-500/25 hover:shadow-sm border border-red-500/20 group overflow-hidden rounded-full" onClick={() => setIsShowing(!isShowing)}>
              <Calendar className="h-4 ww-4"></Calendar>
              View Schedule
            </Button>

           </motion.div>

          </CardTitle>
          
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {meetingsData.map((meeting, i) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  key={i}
                  className="p-3 rounded-lg bg-black/60 border border-red-900/30"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-amber-50">
                      {meeting.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className="bg-red-900/20 text-red-400 "
                    >
                      {meeting.time}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-amber-50/70 ">{meeting.date}</p>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-amber-50/70" />
                      <span className="text-xs text-amber-50/70">
                        {meeting.attendees}
                      </span>
                    </div>
                  </div>
                  
                  {/* Meeting Type Badge - Only show if type exists */}
                  {meeting.type && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={getBadgeClass(meeting.type)}>
                        {meeting.type === "online" && (
                          <Video className="h-3 w-3 mr-1" />
                        )}
                        {meeting.type === "in-person" && (
                          <MapPin className="h-3 w-3 mr-1" />
                        )}
                        {meeting.type === "hybrid" && (
                          <div className="flex items-center">
                            <Video className="h-3 w-3 mr-1" />
                            <MapPin className="h-3 w-3 mr-1" />
                          </div>
                        )}
                        {meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Location Information - Only show if location exists */}
                  {meeting.location && meeting.type && (
                    <div className="mt-2 text-xs text-amber-50/70">
                      {meeting.type === "online" && typeof meeting.location === 'string' && (
                        <a 
                          href={meeting.location} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center hover:text-amber-50 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Join Meeting
                        </a>
                      )}
                      {meeting.type === "in-person" && typeof meeting.location === 'string' && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {meeting.location}
                        </div>
                      )}
                      {meeting.type === "hybrid" && isHybridLocation(meeting.location) && (
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {meeting.location.address}
                          </div>
                          <a 
                            href={meeting.location.url} 
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