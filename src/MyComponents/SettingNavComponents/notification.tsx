import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/shadcnComponents/button";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion } from "framer-motion";
import {
  Bell,
  MessageSquare,
  Mail,
  AlertCircle,
  Shield,
  Settings2,
  Folder,
  Coffee,
  Briefcase,
} from "lucide-react";
import ToggleSwitch from "../Reusables/switchUI";

export const NotificationSetting = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-amber-50">
            Notification Settings
          </h2>
          <p className="text-sm text-amber-50/70">
            Manage your notification preferences and alerts
          </p>
        </div>
        <Button
          variant="outline"
          className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Configure All
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Notifications */}
        <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs ">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-50">
                Email Notifications
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-400"
              >
                Active
              </Badge>
            </div>
            <CardDescription className="text-amber-50/70">
              Configure email notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  title: "Broadcast Updates",
                  description: "Get notified about broadcast status",
                },
                {
                  title: "Contact Changes",
                  description: "Notifications for contact list updates",
                },
                {
                  title: "System Alerts",
                  description: "Important system notifications",
                },
                {
                  title: "Weekly Reports",
                  description: "Weekly summary and analytics",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/10 border border-red-900/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-900/20">
                      <Mail className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-amber-50">
                        {item.title}
                      </h3>
                      <p className="text-xs text-amber-50/70">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <ToggleSwitch
                    checked={true}
                    onChange={(checked) =>
                      console.log("Switch toggled:", checked)
                    }
                  />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* In-App Notifications */}
        <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs ">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-50">
                In-App Notifications
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-400"
              >
                Enabled
              </Badge>
            </div>
            <CardDescription className="text-amber-50/70">
              Manage desktop and mobile notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  title: "Push Notifications",
                  description: "Enable desktop notifications",
                  icon: Bell,
                },
                {
                  title: "Chat Alerts",
                  description: "New message notifications",
                  icon: MessageSquare,
                },
                {
                  title: "Critical Alerts",
                  description: "High-priority notifications",
                  icon: AlertCircle,
                },
                {
                  title: "Security Alerts",
                  description: "Security-related notifications",
                  icon: Shield,
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/10 border border-red-900/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-900/20">
                      <item.icon className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-amber-50">
                        {item.title}
                      </h3>
                      <p className="text-xs text-amber-50/70">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={true}
                    onChange={(checked) =>
                      console.log("Switch toggled:", checked)
                    }
                  />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notification Log */}
        {/* Recent Notifications */}
        <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 col-span-2 rounded-xs ">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-50">
                Recent Notifications
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-50/70 hover:text-amber-50"
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4 flex justify-center">
              <div className="space-y-2 w-full max-w-[1500px] mx-auto">
                {[
                  {
                    icon: Briefcase,
                    title: "Project deadline reminder",
                    time: "10 mins ago",
                    category: "Work",
                    type: "warning",
                  },
                  {
                    icon: Coffee,
                    title: "Team lunch scheduled",
                    time: "30 mins ago",
                    category: "Personal",
                    type: "success",
                  },
                  {
                    icon: Mail,
                    title: "New client proposal received",
                    time: "1 hour ago",
                    category: "Work",
                    type: "info",
                  },
                  {
                    icon: Folder,
                    title: "Quarterly report ready for review",
                    time: "2 hours ago",
                    category: "Work",
                    type: "info",
                  },
                  {
                    icon: Bell,
                    title: "Meeting with design team",
                    time: "3 hours ago",
                    category: "Work",
                    type: "success",
                  },
                  {
                    icon: Briefcase,
                    title: "Project deadline reminder",
                    time: "10 mins ago",
                    category: "Work",
                    type: "warning",
                  },
                  {
                    icon: Mail,
                    title: "New client proposal received",
                    time: "1 hour ago",
                    category: "Work",
                    type: "info",
                  },
                ].map((notification, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-lg bg-zinc-950/10 border border-red-900/30"
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        notification.type === "success"
                          ? "bg-emerald-500/20"
                          : notification.type === "warning"
                            ? "bg-amber-500/20"
                            : "bg-red-900/20"
                      }`}
                    >
                      <notification.icon
                        className={`h-4 w-4 ${
                          notification.type === "success"
                            ? "text-emerald-500"
                            : notification.type === "warning"
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 ">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-50">
                          {notification.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-900/20 text-amber-50/70"
                        >
                          {notification.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-50/70 mt-1">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
