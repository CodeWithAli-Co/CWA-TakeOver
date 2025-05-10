import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion } from "framer-motion";
import { Users, Video, MapPin, ExternalLink, Calendar, Plus } from "lucide-react";
import { SchedImgStore } from "@/stores/store";
import { Button } from "@/components/ui/button";
import { MeetingsQuery } from "@/stores/query";

const Meetings = () => {
  const { setIsShowing, isShowing } = SchedImgStore();
  const { data: meetings, error } = MeetingsQuery();
  if (error) {
    console.log('Error Fetching Meetings', error.message)
  };

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
           
           <div className="flex space-x-2">
           {/* addding motion to smoothe things out */}
          
          {/* Meeting Button */}
          <motion.div
            whileHover={{ scale: 1.02}}
            whileTap={{ scale: 0.98 }}
            transition={{ type : "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              size={"default"}
              className="relative bg-gradient-to-r from-green-700 via-green-800 to-green-950 hover:from-green-950 hover:via-green-900 active:from-green-800  active:to-green-990 w-auto h-auto px-4 py-2 transform transition-all ease-out border border-green-900 group rounded-full  duration-300"
              // onClick={handleOpenAddForm}
            >
              <Plus className="h-4 w-4 mr-1"/>
              Add Meeting
            </Button>


          </motion.div>
          
          
          
          
          {/* Schedule Button */}
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
        </div>
          </CardTitle>
          
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {meetings.map((meeting, i) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  key={i}
                  className="p-3 rounded-lg bg-black/60 border border-red-900/30"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-amber-50">
                      {meeting.meeting_title}
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
                  {meeting.meeting_type && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={getBadgeClass(meeting.meeting_type)}>
                        {meeting.meeting_type === "online" && (
                          <Video className="h-3 w-3 mr-1" />
                        )}
                        {meeting.meeting_type === "in-person" && (
                          <MapPin className="h-3 w-3 mr-1" />
                        )}
                        {meeting.meeting_type === "hybrid" && (
                          <div className="flex items-center">
                            <Video className="h-3 w-3 mr-1" />
                            <MapPin className="h-3 w-3 mr-1" />
                          </div>
                        )}
                        {meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Location Information - Only show if location exists */}
                  {meeting.location && meeting.meeting_type && (
                    <div className="mt-2 text-xs text-amber-50/70">
                      {meeting.meeting_type === "online" && typeof meeting.location === 'string' && (
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
                      {meeting.meeting_type === "in-person" && typeof meeting.location === 'string' && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {meeting.location}
                        </div>
                      )}
                      {meeting.meeting_type === "hybrid" && isHybridLocation(meeting.hybrid_location) && (
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {meeting.hybrid_location.address}
                          </div>
                          <a 
                            href={meeting.hybrid_location.url} 
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