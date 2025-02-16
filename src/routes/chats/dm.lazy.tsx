import React, { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Search, Gift, Smile, Plus, FileImage, 
  Settings, MessageSquare, Headphones, Mic,
  ChevronDown, Hash, Bot, Book, Users,
  VideoIcon, PhoneCall, UserPlus
} from "lucide-react";
import { ChatInputBox } from "@/MyComponents/chatInput";
import { ActiveUser, DMGroups, DMs, Employees } from "@/stores/query";
import { useAppStore } from "@/stores/store";
import { createLazyFileRoute } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import { formatDistanceToNow, isValid } from 'date-fns';
import { cn } from "@/lib/utils";

// Navigation sections configuration
const sections = [
  {
    id: 'platform',
    icon: Bot,
    label: 'Platform'
  },
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat'
  },
  {
    id: 'documentation',
    icon: Book,
    label: 'Documentation'
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings'
  }
];

// Helper function for date formatting
const formatMessageDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return 'Invalid date';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Date unavailable';
  }
};

function DMChannels() {
  const { DMGroupName, setDMGroupName, dialog } = useAppStore();
  const [activeSection, setActiveSection] = useState('chat');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const { data: AllEmployees, error: AllEmpError, isLoading: loadingEmployees } = Employees();
  const { data: user, error: userError, isLoading: loadingUser } = ActiveUser();
  const { data: DmGroups, error: groupsError, isLoading: loadingGroups } = DMGroups(user?.[0]?.username);
  const { data: DM, error: DMError, isPending: loadingMsg } = DMs(DMGroupName);

  if (loadingEmployees || loadingUser || loadingGroups || loadingMsg) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1f22]">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  if (userError || AllEmpError || groupsError || DMError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1f22]">
        <div className="text-red-400">
          Error: {userError?.message || AllEmpError?.message || groupsError?.message || DMError?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Slim Navigation Bar */}
      <div className="w-16 bg-[#1e1f22] flex flex-col items-center py-3 space-y-2">
        {/* Company Logo */}
        <div className="mb-2 w-12 h-12 rounded-2xl bg-[#313338] flex items-center justify-center text-white hover:bg-[#5865f2] transition-colors cursor-pointer">
          CWA
        </div>
        
        <div className="w-8 h-px bg-[#35373c] my-2" />
        
        {/* Main Navigation */}
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center group relative",
              activeSection === section.id ? "bg-[#5865f2] text-white" : "bg-[#313338] text-gray-400 hover:bg-[#5865f2] hover:text-white"
            )}
          >
            <section.icon className="h-5 w-5" />
            {activeSection !== section.id && (
              <div className="absolute left-0 w-1 h-8 bg-white rounded-r transform scale-0 group-hover:scale-100 transition-transform origin-left" />
            )}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === 'chat' && (
        <>
          {/* DM List Sidebar */}
          <div className="w-60 bg-[#2b2d31] flex flex-col">
            <div className="p-3 border-b border-[#1e1f22]">
              <h1 className="text-white font-semibold px-2 mb-4">CodeWithAli Co.</h1>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Find conversation"
                    className="pl-8 bg-[#1e1f22] border-none text-gray-300 h-9 text-sm placeholder:text-gray-400"
                  />
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm h-9">
                      Create New DM
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#313338] text-gray-100 border-none">
                    <DialogTitle>Create New DM Group</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Select at least one person to message
                    </DialogDescription>
                    <AddDMGroup Users={AllEmployees || []} />
                    <DialogClose>
                      <div id="dialog-close-shadcn"></div>
                    </DialogClose>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {/* Direct Messages Section */}
                <div className="px-2 py-3">
                  <button className="flex items-center justify-between w-full text-gray-400 hover:text-gray-200 mb-1">
                    <span className="text-xs font-semibold">DIRECT MESSAGES</span>
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="space-y-[2px]">
                    {DmGroups?.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setDMGroupName(group.name)}
                        className={cn(
                          "w-full flex items-center space-x-3 p-2 rounded hover:bg-[#35373c] transition-colors",
                          DMGroupName === group.name ? 'bg-[#35373c]' : ''
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`} />
                            <AvatarFallback>{group.name?.slice(0, 2)?.toUpperCase() || 'DM'}</AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31]" />
                        </div>
                        <span className="text-gray-300 text-sm font-medium truncate">{group.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* User Controls */}
            <div className="p-2 mt-auto bg-[#232428] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.[0]?.username}`} />
                    <AvatarFallback>{user?.[0]?.username?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#232428]" />
                </div>
                <div className="text-sm">
                  <div className="text-gray-200 font-medium">{user?.[0]?.username}</div>
                  <div className="text-gray-400 text-xs">Online</div>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mic className="h-4 w-4 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Headphones className="h-4 w-4 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[#313338]">
            {DMGroupName ? (
              <>
                {/* Chat Header */}
                <div className="h-12 flex items-center justify-between px-4 border-b border-[#1e1f22]">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${DMGroupName}`} />
                        <AvatarFallback>{DMGroupName?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <h3 className="text-gray-100 font-medium">{DMGroupName}</h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <VideoIcon className="h-4 w-4 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <PhoneCall className="h-4 w-4 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <UserPlus className="h-4 w-4 text-gray-400" />
                    </Button>
                    <div className="h-4 w-px bg-gray-700" />
                    <Search className="h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search"
                      className="w-40 h-8 bg-[#1e1f22] border-none text-gray-300 text-sm"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                    >
                      <Users className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 flex">
                  <div className="flex-1 flex flex-col">
                    <ScrollArea className="flex-1 px-4">
                      <div className="space-y-4 py-4">
                        {DM?.map((dm) => (
                          <div key={dm.msg_id} className="group flex items-start space-x-4 hover:bg-[#2e3035] px-2 py-1 rounded-lg">
                            <Avatar className="h-10 w-10 mt-0.5">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.sent_by}`} />
                              <AvatarFallback>{dm.sent_by?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-100 font-medium">{dm.sent_by}</span>
                                <span className="text-gray-400 text-xs">
                                  {formatMessageDate(dm.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-300 mt-0.5 break-words">{dm.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
{/* Chat Input */}
<div className="px-4 pb-6 pt-2">
                      <div className="relative flex items-center bg-[#383a40] rounded-lg p-0.5">
                        <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300">
                          <Plus className="h-5 w-5" />
                        </Button>
                        <ChatInputBox
                          activeUser={user![0].username}
                          table="cwa_dm_chat"
                          DmGroup={DMGroupName}
                          className="flex-1 bg-transparent border-none text-gray-200 placeholder:text-gray-400 focus:ring-0 px-2"
                          placeholder={`Message ${DMGroupName}`}
                        />
                        <div className="flex items-center space-x-1 px-2">
                          <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300">
                            <Gift className="h-5 w-5" />
                          </Button>
                          <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300">
                            <FileImage className="h-5 w-5" />
                          </Button>
                          <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300">
                            <Smile className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Sidebar - Member List */}
                  {isRightSidebarOpen && (
                    <div className="w-60 border-l border-[#1e1f22] bg-[#2b2d31] flex flex-col">
                      <div className="p-4 border-b border-[#1e1f22]">
                        <h3 className="text-gray-300 font-semibold text-xs uppercase tracking-wider">Members</h3>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-4 space-y-4">
                          {/* Online Members Section */}
                          <div>
                            <h4 className="text-gray-400 text-xs font-semibold mb-2">ONLINE — 3</h4>
                            <div className="space-y-2">
                              {[DMGroupName, user?.[0]?.username].map((member) => (
                                <div key={member} className="flex items-center space-x-3 p-2 rounded hover:bg-[#35373c] group">
                                  <div className="relative">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member}`} />
                                      <AvatarFallback>{member?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31]" />
                                  </div>
                                  <div>
                                    <span className="text-gray-200 text-sm font-medium">{member}</span>
                                    <p className="text-gray-400 text-xs">Working on something cool</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Offline Members Section */}
                          <div>
                            <h4 className="text-gray-400 text-xs font-semibold mb-2">OFFLINE — 2</h4>
                            <div className="space-y-2">
                              {['Member 3', 'Member 4'].map((member) => (
                                <div key={member} className="flex items-center space-x-3 p-2 rounded hover:bg-[#35373c] group">
                                  <div className="relative">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member}`} />
                                      <AvatarFallback>{member?.slice(0, 2)?.toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-[#2b2d31]" />
                                  </div>
                                  <div>
                                    <span className="text-gray-400 text-sm font-medium">{member}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Welcome Screen when no chat is selected
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto bg-[#5865f2] rounded-full flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-200">Welcome to Messages!</h3>
                  <p className="text-gray-400 max-w-md">Select a conversation from the sidebar or start a new one.</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const Route = createLazyFileRoute("/chats/dm")({
  component: DMChannels,
});

export default DMChannels;