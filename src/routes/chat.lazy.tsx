import React from "react";

import { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";
import { Card, CardContent } from "@/components/ui/shadcnComponents/card";
import { Sheet, SheetContent } from "@/components/ui/shadcnComponents/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/shadcnComponents/command";
import {
  Search,
  MessageSquare,
  Settings,
  Menu,
  Plus,
  FileImage,
  Smile,
  Send,
  MoreVertical,
  ChevronLeft,
  Pin,
  Archive,
  Inbox,
} from "lucide-react";
import { ChatInputBox } from "@/MyComponents/Reusables/chatInput";
import {
  ActiveUser,
  DMGroups,
  Employees,
  MessageInterface,
  Messages,
} from "@/stores/query";
import { useAppStore } from "@/stores/store";
import { createLazyFileRoute, useLocation } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import { formatDistanceToNow, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import supabase from "@/MyComponents/supabase";
import { sendNotification } from "@tauri-apps/plugin-notification";

const formatMessageDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "Invalid date";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return "Date unavailable";
  }
};

function GroupChats() {
  const { GroupName, setGroupName } = useAppStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentView, setCurrentView] = useState<
    "inbox" | "pinned" | "archived"
  >("inbox");
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const { data: AllEmployees, error: AllEmpError } = Employees();
  const { data: user, error: userError } = ActiveUser();
  const { data: DmGroups, error: groupsError } = DMGroups(user![0].username);
  const { data: Message } = Messages(GroupName);

  // With SuspenseQuery i dont think this has effect either, but leaving this here for now
  if (userError || AllEmpError || groupsError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1f22]">
        <div className="text-red-400">
          Error:{" "}
          {userError?.message || AllEmpError?.message || groupsError?.message}
        </div>
      </div>
    );
  }

  // Need to work on scrolling to bottom when new chat is sent

  // if (GroupName === "General") {
  //       supabase
  //         .channel("dm")
  //         .on(
  //           "postgres_changes",
  //           { event: "INSERT", schema: "public", table: "cwa_dm_chat" },
  //           (payload) =>
  //             scrollTo({ top: 1 })
  //         )
  //         .subscribe();
  //       console.log("Not on DMS 2");

  //       // While not on GeneralChat, they will get notifications
  //       const channels = supabase.getChannels();
  //       channels.map((channel) =>
  //         channel.topic === "realtime:general"
  //           ? supabase.removeChannel(channel)
  //           : console.log("No Such Realtime General channel")
  //       );
  //       console.log("on General chat! 2");
  //     } else {
  //       // Listens to the general chat updates no matter where user is in the App
  //       supabase
  //         .channel("general")
  //         .on(
  //           "postgres_changes",
  //           { event: "INSERT", schema: "public", table: "cwa_chat" },
  //           (payload) =>
  //             scrollTo({ top: 1 })
  //         )
  //         .subscribe();
  //       console.log("Not on General chat");

  //       const channels = supabase.getChannels();
  //       channels.map((channel) =>
  //         channel.topic === "realtime:dm"
  //           ? supabase.removeChannel(channel)
  //           : console.log("No Such Realtime DM channel")
  //       );
  //       console.log("on DMS! 2");
  //     }

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-950 high-dpi:bg-zinc-950/20">
      {/* Mobile Menu Button - Adjusted positioning */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2 left-2 z-50 lg:hidden text-white"
        onClick={() => setShowMobileMenu(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Left Sidebar - Adjusted for mobile */}
      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent
          side="left"
          className="w-full sm:w-80 p-0 bg-zinc-950/10 backdrop-blur-xl border-r border-white/10"
        >
          <ChatSidebar
            user={user![0]}
            groups={[
              {
                id: "general",
                name: "General",
                type: "general",
              },
              ...(DmGroups || []),
            ]}
            currentDM={GroupName}
            setCurrentView={setCurrentView}
            employees={AllEmployees || []}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Adjusted width and visibility */}
      <div className="hidden lg:flex w-80 xl:w-96 border-r border-white/10 bg-zinc-950/10 backdrop-blur-xl">
        <ChatSidebar
          user={user![0]}
          groups={[
            {
              id: "general",
              name: "General",
              type: "general",
            },
            ...(DmGroups || []),
          ]}
          currentDM={GroupName}
          setCurrentView={setCurrentView}
          employees={AllEmployees || []}
        />
      </div>

      {/* Main Chat Area - Improved responsiveness */}
      <div className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {GroupName ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col h-full"
            >
              {/* Chat Header - Adjusted padding */}
              <div className="h-16 flex items-center justify-between px-3 sm:px-6 bg-black/50 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8 ring-2 ring-red-800/90">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${GroupName}`}
                    />
                    <AvatarFallback>
                      {GroupName?.slice(0, 2)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="text-white font-semibold truncate">
                      {GroupName}
                    </h2>
                    <p className="text-xs text-zinc-400">Active now</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    onClick={() => setIsSearchOpen(true)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                  >
                    <Pin className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages Area - Improved scrolling */}
              <ScrollArea className="flex-1 px-3 sm:px-6 overflow-y-auto">
                <motion.div
                  className="py-6 space-y-4"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.1,
                      },
                    },
                  }}
                >
                  {Message?.map((msg: MessageInterface) => (
                    <motion.div
                      key={msg.msg_id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="group"
                    >
                      <Card className="border-0 hover:bg-white/10 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start space-x-3 sm:space-x-4">
                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-red-700/90">
                              <AvatarImage
                                src={`https://tqaytmvihogvhhvwgbwm.supabase.co/storage/v1/object/public/avatars//${msg.userAvatar}`}
                                style={{ borderRadius: 50 }}
                              />
                              <AvatarFallback className="text-red-500">
                                {msg.sent_by?.slice(0, 2)?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-red-400 font-medium truncate">
                                  {msg.sent_by}
                                </span>
                                <span className="text-zinc-500 text-xs sm:text-sm">
                                  {formatMessageDate(msg.created_at)}
                                </span>
                              </div>
                              <p className="text-white mt-1 break-words">
                                {msg.message}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </ScrollArea>

              {/* Chat Input - Improved mobile layout */}
              <div className="p-2 sm:p-4 bg-black/50 backdrop-blur-xl border-t border-white/10">
                <div className="max-w-4xl mx-auto">
                  <div className="relative flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>

                    <div className="flex-1 relative">
                      <ChatInputBox
                        activeUser={user![0].username as string}
                        UserAvatar={user![0].avatarName as string}
                        table="cwa_dm_chat"
                        Group={GroupName}
                        className="w-full h-5 bg-white/5 border-0 focus:ring-1 focus:ring-red-500 text-white placeholder:text-zinc-500 pl-5 rounded-full py-4 sm:py-5"
                        placeholder={`Message ${GroupName}`}
                      />
                      <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 sm:space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-white hidden sm:flex"
                        >
                          <FileImage className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-white hidden sm:flex"
                        >
                          <Smile className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          className="bg-red-500 hover:bg-red-600 text-white rounded-full"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            // Empty state remains the same but with improved responsive classes
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center p-4"
            >
              <div className="text-center space-y-6 max-w-md mx-auto px-4">
                <motion.div
                  className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-messages shadow-lg rounded-3xl mx-auto flex items-center justify-center"
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                >
                  <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  Welcome to Messages
                </h3>
                <p className="text-zinc-400 text-sm sm:text-base">
                  Choose a conversation from the sidebar or start a new one to
                  begin messaging
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-red-800 to-red-900 text-amber-50 hover:opacity-90">
                      Start New Conversation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-950/10 backdrop-blur-xl border border-white/10">
                    <DialogTitle>New Conversation</DialogTitle>
                    <AddDMGroup Users={AllEmployees || []} />
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Dialog */}
        <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <CommandInput placeholder="Search messages..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              {DmGroups?.map((group) => (
                <CommandItem
                  key={group.id}
                  onSelect={() => {
                    setGroupName(group.name);
                    setIsSearchOpen(false);
                  }}
                >
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`}
                    />
                    <AvatarFallback>
                      {group.name?.slice(0, 2)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {group.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </div>
  );
}

function ChatSidebar({
  user,
  groups,
  currentDM,
  employees,
}: {
  user: any;
  groups: any[];
  currentDM: string;
  setCurrentView: (view: "inbox" | "pinned" | "archived") => void;
  employees: any[];
}) {
  const { GroupName, setGroupName } = useAppStore();
  const { refetch: refetchMgs } = Messages(GroupName);
  // Fetch after updating the state
  useEffect(() => {
    if (GroupName) {
      refetchMgs();
    }
  }, [GroupName]);

  const routeLocation = useLocation({
    select: (location) => location.pathname,
  });

  useEffect(() => {
    setGroupName("General");
  }, [routeLocation]);

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-900 bg-clip-text text-transparent">
            Messages
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="rounded-full bg-gradient-to-r from-red-500 to-red-900 text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950/10 backdrop-blur-xl border border-white/10">
              <DialogTitle>New Conversation</DialogTitle>
              <AddDMGroup Users={employees || []} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search conversations"
            className="w-full bg-white/5 border-0 pl-9 text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      <Tabs defaultValue="inbox" className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 px-2">
          <motion.div
            className="py-4 space-y-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
          >
            {groups?.map((group) => (
              <motion.div
                key={group.id}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => setGroupName(group.name)}
                  className={cn(
                    "w-full justify-start px-5 py-6 space-x-1 group relative",
                    group.type === "general"
                      ? "bg-gradient-to-r from-red-700/50 to-transparent hover:from-red-900/40"
                      : "",
                    currentDM === group.name
                      ? "bg-white/10 text-red-900"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 ring-2 ring-red-700/90">
                      <AvatarImage
                        src={
                          group.type === "general"
                            ? //styling for general chat here
                              "/codewithali_logo.png"
                            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`
                        }
                      />
                      <AvatarFallback className="text-red-500">
                        {group.type === "general"
                          ? "GC"
                          : group.name?.slice(0, 2)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-black" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-medium truncate",
                          group.type === "general" ? "text-red-400" : ""
                        )}
                      >
                        {group.name}
                      </span>
                      {group.type === "general" ? (
                        <Badge
                          variant="outline"
                          className="bg-red-900/20 text-red-400 border-red-500/20"
                        >
                          Global
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-500">12m</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {group.type === "general"
                        ? "Company-wide discussions"
                        : "Latest message preview..."}
                    </p>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ scale: currentDM === group.name ? 1 : 0 }}
                    className="absolute left-0 w-1 h-full bg-red-500 rounded-r ml-2"
                  />
                </Button>
              </motion.div>
            ))}

            {/* specific style for the general group chat is above ^ */}
          </motion.div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export const Route = createLazyFileRoute("/chat")({
  component: GroupChats,
});

export default GroupChats;
