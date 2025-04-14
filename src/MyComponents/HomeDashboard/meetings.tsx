import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

const Meetings = () => {
  return (
    <>
      {/* Upcoming Meetings */}
      <Card className="bg-black/40 border-red-900/30 ">
        <CardHeader>
          <CardTitle className="text-amber-50">Upcoming Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {[
                {
                  title: "Stream Processing Event",
                  time: "5:30 - 8:00 PM",
                  date: "April, 16 2025",
                  attendees: 2,
                },
                {
                  title: "Quantum Computing Event",
                  time: "9:00 - 10:00 AM",
                  date: "April, 19 2025",
                  attendees: 2,
                },
                {
                  title: "Social Hangout",
                  time: "7:00 - 9:00 PM",
                  date: "April, 23 2025",
                  attendees: 1,
                },
                // Add more meetings...
              ].map((meeting, i) => (
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
