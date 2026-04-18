/**
 * ChatSidebar.tsx — Left pane: list of all chat groups.
 *
 * Shows General + DM groups with unread badges. Active group highlighted.
 * "+ New conversation" button at top opens AddDMGroup dialog.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Hash, MessageSquare, HashIcon } from "lucide-react";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { useAppStore } from "@/stores/store";
import { useChatStore } from "@/stores/chatStore";
import { UnreadBadge } from "./UnreadBadge";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";

interface Group {
  id: string | number;
  name: string;
  type?: string;
  subscribers?: string[];
}

interface Props {
  groups: Group[];
  employees: any[];
  onCreateChannel?: () => void;
}

export const ChatSidebar: React.FC<Props> = ({ groups, employees, onCreateChannel }) => {
  const { GroupName, setGroupName } = useAppStore();
  const { unreadCounts, markRead } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (name: string) => {
    setGroupName(name);
    markRead(name);
  };

  return (
    <div className="bg-card border-r border-border h-full flex flex-col w-72 shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-sm bg-primary/[0.08]">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.15em] font-medium">
              Messages
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onCreateChannel && (
              <button
                type="button"
                onClick={onCreateChannel}
                className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="New channel"
              >
                <HashIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/80/[0.06] transition-colors"
                  title="New conversation"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogTitle className="text-foreground/85">New Conversation</DialogTitle>
                <AddDMGroup Users={employees || []} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/60 placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground/40 py-8">No conversations</p>
        ) : (
          filtered.map((group, i) => {
            const isActive = GroupName === group.name;
            const isGeneral = group.type === "general";
            const unread = unreadCounts[group.name] || 0;

            return (
              <motion.button
                key={group.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleSelect(group.name)}
                className={`w-full text-left px-3 py-2 rounded-sm mb-0.5 transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/[0.08] border border-primary/15"
                    : "border border-transparent hover:bg-muted/30 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isGeneral ? (
                    <div className="h-8 w-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                    </div>
                  ) : (
                    <Avatar className="h-8 w-8 rounded-sm border border-border shrink-0">
                      <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${group.name}`} />
                      <AvatarFallback className="bg-muted/50 text-muted-foreground/70 text-[10px] rounded-sm">
                        {group.name?.slice(0, 2)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[12px] font-medium truncate ${
                        isActive ? "text-foreground" : unread > 0 ? "text-foreground/80" : "text-white/55"
                      }`}>
                        {group.name}
                      </span>
                      <UnreadBadge count={unread} />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                      {isGeneral ? "Company-wide" : `${group.subscribers?.length || 0} members`}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/40">
          {filtered.length} of {groups.length} conversations
        </p>
      </div>
    </div>
  );
};
