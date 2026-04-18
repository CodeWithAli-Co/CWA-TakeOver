/**
 * ChatHeader.tsx — Title bar for the active chat.
 *
 * Shows: avatar + group name + member count + working action buttons.
 *
 * Buttons:
 *   · Search   — toggles an inline search input that filters messages
 *   · Pin      — expands/scrolls to the pinned messages bar for this group
 *   · More     — dropdown with channel actions (mark all read, copy link, etc.)
 */

import { useEffect, useRef, useState } from "react";
import {
  Search, Pin, MoreVertical, Hash, Users, X,
  Check, Copy, BellOff, Bell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/shadcnComponents/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { Input } from "@/components/ui/shadcnComponents/input";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  groupName: string;
  isGeneral: boolean;
  memberCount?: number;
  pinnedCount: number;

  /** Search is lifted so MessageList can filter against it. */
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** Marks this channel's unread counter to zero. */
  onMarkAllRead: () => void;
}

export const ChatHeader: React.FC<Props> = ({
  groupName, isGeneral, memberCount, pinnedCount,
  searchQuery, setSearchQuery, onMarkAllRead,
}) => {
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pinCollapsed, togglePinCollapsed } = useChatStore();
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  // Mute state is just per-session localStorage for the channel, tracked by
  // the existing notification prefs pattern (muted groups skip notify).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cwa-chat-muted-groups");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setMuted(arr.includes(groupName));
      }
    } catch { /* noop */ }
  }, [groupName]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      const raw = localStorage.getItem("cwa-chat-muted-groups");
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const dedup = arr.filter((g) => g !== groupName);
      if (next) dedup.push(groupName);
      localStorage.setItem("cwa-chat-muted-groups", JSON.stringify(dedup));
    } catch { /* noop */ }
  };

  const copyChannelLink = async () => {
    try {
      await navigator.clipboard.writeText(`cwa-takeover://chat/${encodeURIComponent(groupName)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };

  const openPinned = () => {
    // If the pinned bar is collapsed, expand it; otherwise just scroll to it.
    if (pinCollapsed[groupName]) {
      togglePinCollapsed(groupName);
    }
    const first = document.querySelector<HTMLElement>(`[data-pinned-bar="${groupName}"]`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card">
      {/* Left: identity or search input */}
      {searching ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search in #${groupName}…`}
            className="h-8 flex-1 border-0 bg-transparent text-[12.5px] focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearching(false);
                setSearchQuery("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              setSearching(false);
              setSearchQuery("");
            }}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 min-w-0">
          {isGeneral ? (
            <div className="h-9 w-9 rounded-sm bg-primary/[0.08] border border-primary/15 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <Avatar className="h-9 w-9 rounded-sm border border-border">
              <AvatarImage src={`https://api.dicebear.com/7.x/shapes/svg?seed=${groupName}`} />
              <AvatarFallback className="bg-muted/50 text-muted-foreground/70 text-[11px] rounded-sm">
                {groupName?.slice(0, 2)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-foreground truncate flex items-center gap-1.5">
              {groupName}
              {muted && <BellOff className="h-3 w-3 text-muted-foreground" />}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isGeneral ? (
                <span className="text-[11px] text-muted-foreground">Company-wide channel</span>
              ) : (
                <>
                  <Users className="h-2.5 w-2.5 text-muted-foreground/60" />
                  <span className="text-[11px] text-muted-foreground">{memberCount || 0} members</span>
                </>
              )}
              {pinnedCount > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    onClick={openPinned}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Pin className="h-2.5 w-2.5" />
                    {pinnedCount} pinned
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          className={`p-1.5 rounded-sm transition-colors ${
            searching
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground/70 hover:bg-muted/50"
          }`}
          title="Search messages"
        >
          <Search className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={openPinned}
          disabled={pinnedCount === 0}
          className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground/70 hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={pinnedCount === 0 ? "No pinned messages" : `Jump to ${pinnedCount} pinned`}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground/70 hover:bg-muted/50 transition-colors"
              title="More"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onMarkAllRead} className="gap-2 text-[12px]">
              <Check className="h-3.5 w-3.5" />
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleMute} className="gap-2 text-[12px]">
              {muted ? (
                <>
                  <Bell className="h-3.5 w-3.5" />
                  Unmute channel
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5" />
                  Mute channel
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyChannelLink} className="gap-2 text-[12px]">
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy channel link"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
