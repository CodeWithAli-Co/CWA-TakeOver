/**
 * ChatSidebar.tsx — Left pane: list of all chat groups.
 *
 * Shows General + DM groups with unread badges. Active group highlighted.
 * "+ New conversation" button at top opens AddDMGroup dialog.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Hash, MessageSquare, HashIcon,
  Folder, FolderPlus, ChevronDown, ChevronRight, Star, MoreVertical, Webhook, Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { useAppStore } from "@/stores/store";
import { useChatStore } from "@/stores/chatStore";
import { ActiveUser } from "@/stores/query";
import { UnreadBadge } from "./UnreadBadge";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import { CategoryDialog } from "./CategoryDialog";
import { DMPickerDialog, prettyDMLabel } from "./DMPickerDialog";

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
  onManageWebhooks?: () => void;
  /** Admin-gated callback to delete a DM channel. Handles the DB side. */
  onDeleteChannel?: (group: Group) => Promise<void> | void;
  /** True if the current user is allowed to delete channels. */
  canDelete?: boolean;
}

export const ChatSidebar: React.FC<Props> = ({ groups, employees, onCreateChannel, onManageWebhooks, onDeleteChannel, canDelete }) => {
  const { GroupName, setGroupName } = useAppStore();
  const {
    unreadCounts, markRead,
    channelCategories, addChannelCategory, moveChannelToCategory,
    toggleCategoryCollapsed, removeChannelCategory,
    starredMessages,
  } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [dmPickerOpen, setDmPickerOpen] = useState(false);

  // Current user's own username — needed to render 1-on-1 DM labels as
  // the OTHER person's name (not the canonical dm::alice::bob form) and
  // to exclude yourself from the DM picker list.
  const { data: me } = ActiveUser();
  const currentUsername = me?.[0]?.username || "";

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Split into categorized vs uncategorized.
  const inAnyCategory = new Set<string>(
    channelCategories.flatMap((c) => c.items),
  );
  const uncategorized = filtered.filter((g) => !inAnyCategory.has(g.name));

  const handleSelect = (name: string) => {
    setGroupName(name);
    markRead(name);
  };

  const promptCategory = () => {
    setCategoryDialogOpen(true);
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
            {onManageWebhooks && (
              <button
                type="button"
                onClick={onManageWebhooks}
                className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Manage webhooks"
              >
                <Webhook className="h-3.5 w-3.5" />
              </button>
            )}
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
            {/* New DM — 1-on-1, no group-naming step */}
            <button
              type="button"
              onClick={() => setDmPickerOpen(true)}
              className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="New direct message"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            {/* New group conversation — keeps AddDMGroup for multi-person rooms */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/80/[0.06] transition-colors"
                  title="New group conversation"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogTitle className="text-foreground/85">New Group</DialogTitle>
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
          <>
            {/* Starred virtual row — jumps to global starred view */}
            {starredMessages.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelect("__starred__")}
                className={`flex w-full items-center gap-2 rounded-sm px-3 py-1.5 mb-0.5 text-[12px] transition-all ${
                  GroupName === "__starred__"
                    ? "bg-primary/[0.08] border border-primary/15 text-foreground"
                    : "border border-transparent text-white/55 hover:bg-muted/30 hover:text-foreground/80"
                }`}
              >
                <Star className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium">Starred</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {starredMessages.length}
                </span>
              </button>
            )}

            {/* Uncategorized first */}
            {uncategorized.map((group) => (
              <GroupButton
                key={group.id}
                group={group}
                isActive={GroupName === group.name}
                unread={unreadCounts[group.name] || 0}
                onSelect={handleSelect}
                categories={channelCategories}
                onMoveTo={(catId) => moveChannelToCategory(group.name, catId)}
                currentUsername={currentUsername}
                canDelete={canDelete && group.type !== "general"}
                onDelete={
                  onDeleteChannel
                    ? () => onDeleteChannel(group)
                    : undefined
                }
              />
            ))}

            {/* Categories */}
            {channelCategories.map((cat) => {
              const catGroups = filtered.filter((g) =>
                cat.items.includes(g.name),
              );
              return (
                <div key={cat.id} className="mt-3">
                  <div className="flex items-center gap-1.5 px-2 pb-1">
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapsed(cat.id)}
                      className="flex flex-1 items-center gap-1.5 text-left font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                    >
                      {cat.collapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      <Folder className="h-3 w-3 opacity-70" />
                      <span className="truncate">{cat.name}</span>
                      <span className="opacity-60">
                        · {catGroups.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove category "${cat.name}"?`)) {
                          removeChannelCategory(cat.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove category"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </div>
                  {!cat.collapsed && catGroups.map((group) => (
                    <GroupButton
                      key={group.id}
                      group={group}
                      isActive={GroupName === group.name}
                      unread={unreadCounts[group.name] || 0}
                      onSelect={handleSelect}
                      categories={channelCategories}
                      onMoveTo={(catId) => moveChannelToCategory(group.name, catId)}
                currentUsername={currentUsername}
                      currentCategoryId={cat.id}
                      canDelete={canDelete && group.type !== "general"}
                      onDelete={
                        onDeleteChannel
                          ? () => onDeleteChannel(group)
                          : undefined
                      }
                    />
                  ))}
                </div>
              );
            })}

            {/* Add category */}
            <button
              type="button"
              onClick={promptCategory}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-border py-1.5 text-[10.5px] text-muted-foreground hover:border-primary/30 hover:text-foreground"
            >
              <FolderPlus className="h-3 w-3" />
              New category
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/40">
          {filtered.length} of {groups.length} conversations
        </p>
      </div>

      {/* Themed modal for creating a new channel category */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onCreate={(name) => addChannelCategory(name)}
      />

      {/* 1-on-1 DM picker — skips the group-naming step */}
      <DMPickerDialog
        open={dmPickerOpen}
        onOpenChange={setDmPickerOpen}
        employees={employees || []}
        currentUsername={currentUsername}
      />
    </div>
  );
};

// ── Visual helpers: deterministic tile avatar from the channel name ────
// Replaces the old dicebear shape noise with a clean, brand-aligned
// initials tile. Hue is derived from a quick djb2 of the name so each
// channel has its own consistent color without any external service.

function hashHue(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 360);
}

export function groupAvatarStyle(name: string): React.CSSProperties {
  const hue = hashHue(name || "channel");
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 32%) 0%, hsl(${(hue + 24) % 360} 60% 22%) 100%)`,
    color: `hsl(${hue} 80% 90%)`,
  };
}

export function groupAvatarInitials(name: string): string {
  const bare = (name || "").replace(/^#/, "").trim();
  if (!bare) return "?";
  // "3 Blind Mice" → "3B", "Ali&Blaze" → "AB", "Marketing" → "MA"
  const parts = bare.split(/[\s&_/.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return bare.slice(0, 2).toUpperCase();
}

// ── Single sidebar button (with category-move dropdown) ────────────────

function GroupButton({
  group, isActive, unread, onSelect, categories, onMoveTo, currentCategoryId,
  canDelete, onDelete, currentUsername,
}: {
  group: Group;
  isActive: boolean;
  unread: number;
  onSelect: (name: string) => void;
  categories: { id: string; name: string }[];
  onMoveTo: (categoryId: string | null) => void;
  currentCategoryId?: string;
  canDelete?: boolean;
  onDelete?: () => void;
  currentUsername: string;
}) {
  const isGeneral = group.type === "general";
  // For canonical 1-on-1 DMs (dm::alice::bob) show the OTHER person's name.
  const pretty = prettyDMLabel(group.name, currentUsername);
  const displayName = pretty ?? group.name;
  const isOneOnOne = pretty != null;
  return (
    <div className="group/row relative">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => onSelect(group.name)}
        className={`w-full text-left px-3 py-2 rounded-sm mb-0.5 transition-all duration-200 ${
          isActive
            ? "bg-primary/[0.08] border border-primary/15"
            : "border border-transparent hover:bg-muted/30 hover:border-border"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isGeneral ? (
            <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Hash className="h-3.5 w-3.5 text-primary" />
            </div>
          ) : (
            <div
              className="h-8 w-8 rounded-md border border-border flex items-center justify-center shrink-0 font-semibold text-[11px] shadow-sm"
              style={groupAvatarStyle(displayName)}
            >
              {groupAvatarInitials(displayName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[12px] font-medium truncate ${
                isActive ? "text-foreground" : unread > 0 ? "text-foreground/80" : "text-white/55"
              }`}>
                {displayName}
              </span>
              <UnreadBadge count={unread} />
            </div>
            <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
              {isGeneral
                ? "Company-wide"
                : isOneOnOne
                  ? "Direct message"
                  : `${group.subscribers?.length || 0} members`}
            </p>
          </div>
        </div>
      </motion.button>

      {/* Category move dropdown — visible on row hover */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-1 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/row:opacity-100"
            title="Move to category"
            onClick={(e) => e.stopPropagation()}
          >
            <Folder className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
            Move to
          </div>
          {categories.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              No categories yet.
            </div>
          )}
          {categories.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => onMoveTo(c.id)}
              disabled={c.id === currentCategoryId}
              className="gap-2 text-[12px]"
            >
              <Folder className="h-3.5 w-3.5" />
              {c.name}
            </DropdownMenuItem>
          ))}
          {currentCategoryId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onMoveTo(null)}
                className="gap-2 text-[12px]"
              >
                Remove from category
              </DropdownMenuItem>
            </>
          )}
          {canDelete && onDelete && !isGeneral && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="gap-2 text-[12px] text-destructive focus:bg-destructive/15 focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete conversation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
