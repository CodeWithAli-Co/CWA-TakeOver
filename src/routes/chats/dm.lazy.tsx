import React, { useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Gift, Smile, Plus, FileImage } from "lucide-react";
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

  useEffect(() => {
    if (dialog === "shadcn-close") {
      const closeButton = document.getElementById("dialog-close-shadcn");
      if (closeButton) closeButton.click();
    }
  }, [dialog]);

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

  if (!user?.[0]?.username) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1f22]">
        <div className="text-gray-300">No active user found</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#313338]">
      {/* Left Sidebar */}
      <div className="w-60 flex flex-col bg-[#2b2d31] border-r border-[#1e1f22]">
        <div className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Find or start a conversation"
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
                Select at least one person you'd like to message
              </DialogDescription>
              <AddDMGroup Users={AllEmployees || []} />
              <DialogClose>
                <div id="dialog-close-shadcn"></div>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1 py-2">
          <div className="space-y-[2px] px-2">
            {DmGroups?.map((group) => (
              <button
                key={group.id}
                onClick={() => setDMGroupName(group.name)}
                className={`w-full flex items-center space-x-3 p-2 rounded hover:bg-[#35373c] transition-colors ${
                  DMGroupName === group.name ? 'bg-[#35373c]' : ''
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.name}`} />
                  <AvatarFallback>{group.name?.slice(0, 2)?.toUpperCase() || 'DM'}</AvatarFallback>
                </Avatar>
                <span className="text-gray-300 text-sm font-medium truncate">{group.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {DMGroupName && (
          <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] bg-[#313338] shadow-sm">
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${DMGroupName}`} />
              <AvatarFallback>{DMGroupName?.slice(0, 2)?.toUpperCase() || 'DM'}</AvatarFallback>
            </Avatar>
            <h3 className="text-gray-100 font-medium text-base">{DMGroupName}</h3>
          </div>
        )}

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {DM?.map((dm) => (
              <div key={dm.msg_id} className="group flex items-start space-x-4 hover:bg-[#2e3035] px-2 py-1 rounded-lg">
                <Avatar className="h-10 w-10 mt-0.5">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.sent_by}`} />
                  <AvatarFallback>{dm.sent_by?.slice(0, 2)?.toUpperCase() || 'U'}</AvatarFallback>
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

        {DMGroupName && (
          <div className="px-4 pb-6 pt-2">
            <div className="relative flex items-center bg-[#383a40] rounded-lg p-0.5">
              <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300 hover:bg-transparent">
                <Plus className="h-5 w-5" />
              </Button>
              <ChatInputBox
                activeUser={user[0].username}
                table="cwa_dm_chat"
                DmGroup={DMGroupName}
                className="flex-1 bg-transparent border-none text-gray-200 placeholder:text-gray-400 focus:ring-0 px-2"
                placeholder={`Message ${DMGroupName}`}
              />
              <div className="flex items-center space-x-1 px-2">
                <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300 hover:bg-transparent">
                  <Gift className="h-5 w-5" />
                </Button>
                <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300 hover:bg-transparent">
                  <FileImage className="h-5 w-5" />
                </Button>
                <Button variant="ghost" className="h-10 w-10 p-2 text-gray-400 hover:text-gray-300 hover:bg-transparent">
                  <Smile className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/chats/dm")({
  component: DMChannels,
});

export default DMChannels;