import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion } from "framer-motion";
import { Users, Video, MapPin, ExternalLink } from "lucide-react";

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
  // Sample data with the new fields
  const meetingsData: MeetingType[] = [
    {
      title: "Stream Processing Event",
      time: "5:30 - 8:00 PM",
      date: "April, 16 2025",
      attendees: 2,
      type: "online",
      location: "https://zoom.us/j/123456789",
    },
    {
      title: "Quantum Computing Event",
      time: "9:00 - 10:00 AM",
      date: "April, 19 2025",
      attendees: 2,
      type: "in-person",
      location: "123 Innovation Center, Tech District",
    },
    {
      title: "Social Hangout",
      time: "7:00 - 9:00 PM",
      date: "April, 23 2025",
      attendees: 1,
      type: "hybrid",
      location: {
        address: "456 Community Center, Downtown",
        url: "https://meet.google.com/abc-defg-hij",
      },
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
      <Card className="bg-black/40 border-red-900/30 overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-amber-50">Upcoming Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
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
                      className="bg-red-900/20 text-red-400"
                    >
                      {meeting.time}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-amber-50/70">{meeting.date}</p>
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