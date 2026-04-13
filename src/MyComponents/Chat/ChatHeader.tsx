/**
 * ChatHeader.tsx — Title bar for the active chat.
 *
 * Shows: avatar + group name + member count + search icon + more menu.
 */

import { Search, Pin, MoreVertical, Hash, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/shadcnComponents/avatar";

interface Props {
  groupName: string;
  isGeneral: boolean;
  memberCount?: number;
  onSearch?: () => void;
}

export const ChatHeader: React.FC<Props> = ({ groupName, isGeneral, memberCount, onSearch }) => {
  return (
    <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between bg-[#0a0a0a]">
      <div className="flex items-center gap-3 min-w-0">
        {isGeneral ? (
          <div className="h-9 w-9 rounded-sm bg-red-500/[0.08] border border-red-500/15 flex items-center justify-center">
            <Hash className="h-4 w-4 text-red-400" />
          </div>
        ) : (
          <Avatar className="h-9 w-9 rounded-sm border border-white/[0.08]">
            <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${groupName}`} />
            <AvatarFallback className="bg-white/[0.04] text-white/40 text-[11px] rounded-sm">
              {groupName?.slice(0, 2)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-white/90 truncate">{groupName}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isGeneral ? (
              <span className="text-[11px] text-white/30">Company-wide channel</span>
            ) : (
              <>
                <Users className="h-2.5 w-2.5 text-white/20" />
                <span className="text-[11px] text-white/30">{memberCount || 0} members</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onSearch}
          className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          title="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          title="Pinned messages"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          title="More"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
