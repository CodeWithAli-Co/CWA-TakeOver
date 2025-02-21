import React from 'react';
import { ScrollArea } from "../../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';
import { ChatInputBox } from "@/MyComponents/chatInput";
import { ActiveUser, Messages } from "@/stores/query";
import { createLazyFileRoute } from "@tanstack/react-router";

interface Msg {
  msg_id: number;
  sent_by: string;
  created_at: any;
  message: string;
}

function General() {
  const { data, error } = Messages();
  if (error) return "Error Loading Messages...";

  const { data: user, error: userError } = ActiveUser();
  if (userError)
    return console.log("Error getting active user in DM's", userError.message);

  // Group messages by sender and date
  const groupedMessages = data?.reduce((groups: any, message: Msg) => {
    const lastGroup = groups[groups.length - 1];
    const messageDate = new Date(message.created_at);
    
    if (
      lastGroup &&
      lastGroup.sent_by === message.sent_by &&
      Math.abs(new Date(lastGroup.messages[0].created_at).getTime() - messageDate.getTime()) < 300000 // 5 minutes
    ) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        sent_by: message.sent_by,
        messages: [message],
      });
    }
    return groups;
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center">
          <span className="text-xl font-semibold text-white">#</span>
          <h3 className="ml-2 text-xl font-semibold text-white">general</h3>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-6">
          {groupedMessages?.map((group: any, index: number) => (
            <div key={index} className="flex items-start space-x-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${group.sent_by}`} />
                <AvatarFallback>{group.sent_by.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-white">{group.sent_by}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(group.messages[0].created_at), { addSuffix: true })}
                  </span>
                </div>
                {group.messages.map((msg: Msg) => (
                  <p key={msg.msg_id} className="text-gray-300">
                    {msg.message}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800">
        <ChatInputBox 
          activeUser={user![0].username} 
          table="cwa_chat"
          className='bg-transparent text-white'
        />
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/chats/general")({
  component: General,
});

export default General;