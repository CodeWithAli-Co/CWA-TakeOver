import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion } from "framer-motion";
import { Users, Video, MapPin, ExternalLink, ArrowRight } from "lucide-react";
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
      title: "Online Learning Spanish and Spanish speakers.",
      time: "1:30 - 3:30pm",
      date: "April, 26 2025",
      attendees: 2,
      type: "online",
      location: "https://www.meetup.com/HOLA-Spanish-Conversation-Meetup/events/306509745"
    },
    {
      title: "Sunday Night Networking",
      time: "7:00 - 9:00pm",
      date: "April, 27 2025",
      attendees: 1,
      type: "in-person",
      location: "Panera Bread 2002 El Camino Real · Santa Clara, CA"
    },
    {
      title: "NeuroNerds General",
      time: "6:00 - 7:30pm",
      date: "April, 28 2025",
      attendees: 2,
      type: "online",
      location: "https://www.meetup.com/neuronerds/events/306369041"
    },
    {
      title: "Defense Against LLM and AGI Scheming with Guardrails and Architecture",
      time: "6:45 - 8:45pm",
      date: "April, 28 2025",
      attendees: 2,
      type: "hybrid",
      location: "https://www.meetup.com/sf-bay-acm/events/306888467"
    },
    {
      title: "Social Hangout",
      time: "7:00 - 9:00 PM",
      date: "May, 28 2025",
      attendees: 1,
      type: "in-person",
      location: "170 South Sunnyvale Avenue · Sunnyvale, CA"
    },
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
            <Button size={"default"} className="bg-red-600 hover:bg-gradient-to-tl hover:from-red-600 hover:via-red-950 hover:to-red-800 w-max h-auto transition-all duration-200 rounded-full" onClick={() => setIsShowing(!isShowing)}>
              View Schedule
            </Button>
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