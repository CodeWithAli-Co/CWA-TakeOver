/**
 * ChatSidebar.tsx — Left pane: list of all chat groups.
 *
 * Shows General + DM groups with unread badges. Active group highlighted.
 * "+ New conversation" button at top opens AddDMGroup dialog.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Hash, MessageSquare, HashIcon,
  Folder, FolderPlus, ChevronDown, ChevronRight, Star, MoreVertical, Webhook, Trash2,
  Phone,
} from "lucide-react";
import { useLiveHuddlesStore } from "@/stores/liveHuddlesStore";
import { useHuddleStore } from "@/stores/huddleStore";
import { PresenceDot } from "./PresenceDot";

// Module-scope stable empty array so the live-huddle selector returns
// the same reference on every render when a channel has no
// participants. Returning a fresh `[]` from a Zustand selector causes
// an infinite render loop because Object.is([], []) is false → store
// thinks the value changed → re-render → selector runs again → loop.
const NO_PARTICIPANTS: string[] = [];
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
import { takeOversupabase } from "@/MyComponents/supabase";
import { UnreadBadge } from "./UnreadBadge";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import { CategoryDialog } from "./CategoryDialog";
import { DMPickerDialog } from "./DMPickerDialog";
import {
  displayLabelForDM,
  isOneOnOneDM,
  dmOtherParty,
} from "./displayName";

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

  // username → public avatar URL. Built once per employees-change and
  // passed down to GroupButton so the live-call face-pile renders the
  // real image instead of initials. Memoized to keep the identity
  // stable across renders (otherwise GroupButton would re-render
  // every parent tick).
  //
  // IMPORTANT: app_users uses the `avatar` column (NOT `userAvatar` —
  // that's a denormalized snapshot on chat message rows). And the URL
  // must be generated via Supabase's getPublicUrl, not string concat:
  // hand-rolled URLs miss bucket prefixes and break silently.
  const avatarByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of employees ?? []) {
      const name = u?.username;
      const file = u?.avatar ?? u?.userAvatar; // tolerate either field
      if (!name || !file) continue;
      const { data } = takeOversupabase.storage.from("avatars").getPublicUrl(file);
      if (data?.publicUrl) map.set(name, data.publicUrl);
    }
    return map;
  }, [employees]);

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

  // ── Discord-style split: Channels vs Direct Messages ──────────────
  // Channels  = General + any name starting with "#" (created via the
  //             admin-only CreateChannelDialog — they're company-wide
  //             topic rooms).
  // DMs       = everything else: 1-on-1 dm::a::b conversations AND
  //             multi-person group rooms named without a # prefix
  //             ("Marketing", "Takeover Codewithali", etc).
  // Keeps the user's per-channel "categories" feature intact — those
  // render below both top-level sections so anything in a category is
  // surfaced there instead of duplicating into the channel/DM split.
  const isChannelGroup = (g: Group) =>
    g.type === "general" || g.name.startsWith("#");
  const channelsTop = uncategorized.filter(isChannelGroup);
  const dmsTop = uncategorized.filter((g) => !isChannelGroup(g));

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
            <span className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.15em] font-medium">
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/70" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-border"
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground/70 py-8">No conversations</p>
        ) : (
          <>
            {/* Threads virtual row — Slack-style global threads inbox */}
            <button
              type="button"
              onClick={() => handleSelect("__threads__")}
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-1.5 mb-0.5 text-[12px] transition-all ${
                GroupName === "__threads__"
                  ? "bg-primary/[0.08] border border-primary/15 text-primary-foreground"
                  : "border border-transparent text-foreground/75 hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-medium">Threads</span>
            </button>

            {/* Starred virtual row — jumps to global starred view */}
            {starredMessages.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelect("__starred__")}
                className={`flex w-full items-center gap-2 rounded-sm px-3 py-1.5 mb-0.5 text-[12px] transition-all ${
                  GroupName === "__starred__"
                    ? "bg-primary/[0.08] border border-primary/15 text-primary-foreground"
                    : "border border-transparent text-foreground/75 hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <Star className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium">Starred</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {starredMessages.length}
                </span>
              </button>
            )}

            {/* Section: CHANNELS — General + #-prefixed rooms */}
            {channelsTop.length > 0 && (
              <SectionHeader icon={Hash} label="Channels" count={channelsTop.length} />
            )}
            {channelsTop.map((group) => (
              <GroupButton
                key={group.id}
                group={group}
                isActive={GroupName === group.name}
                unread={unreadCounts[group.name] || 0}
                onSelect={handleSelect}
                categories={channelCategories}
                onMoveTo={(catId) => moveChannelToCategory(group.name, catId)}
                currentUsername={currentUsername}
                avatarByUser={avatarByUser}
                canDelete={canDelete && group.type !== "general"}
                onDelete={
                  onDeleteChannel
                    ? () => onDeleteChannel(group)
                    : undefined
                }
              />
            ))}

            {/* Section: DIRECT MESSAGES — 1-on-1s + group DMs */}
            {dmsTop.length > 0 && (
              <SectionHeader
                icon={MessageSquare}
                label="Direct Messages"
                count={dmsTop.length}
                className={channelsTop.length > 0 ? "mt-4" : ""}
              />
            )}
            {dmsTop.map((group) => (
              <GroupButton
                key={group.id}
                group={group}
                isActive={GroupName === group.name}
                unread={unreadCounts[group.name] || 0}
                onSelect={handleSelect}
                categories={channelCategories}
                onMoveTo={(catId) => moveChannelToCategory(group.name, catId)}
                currentUsername={currentUsername}
                avatarByUser={avatarByUser}
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
                avatarByUser={avatarByUser}
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
        <p className="text-[10px] text-muted-foreground/70">
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

// ── Section header — small Discord-style label above a group of rows ──
// Lives at module scope (not a closure) so the component identity is
// stable across re-renders and React doesn't remount the header tree.

function SectionHeader({
  icon: Icon,
  label,
  count,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 pb-1 pt-1 ${className}`}
    >
      <Icon className="h-3 w-3 text-muted-foreground/70" />
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[9.5px] text-muted-foreground/60">
        · {count}
      </span>
    </div>
  );
}

// ── Visual helpers: deterministic tile avatar from the channel name ────
// Clean, brand-aligned initials tile. Muted zinc gradient with a tiny
// warm/cool accent derived from a djb2 hash of the name — just enough
// variation to tell channels apart at a glance without looking like a
// rave flyer.

function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0);
}

export function groupAvatarStyle(name: string): React.CSSProperties {
  const seed = hashSeed(name || "channel");
  // Pick one of 6 muted hue families — neutrals and deep accents only.
  const HUES = [215, 230, 250, 200, 180, 30];
  const hue = HUES[seed % HUES.length];
  const bias = ((seed >> 4) % 6) - 3; // -3..+2 tiny lightness jitter
  const topL = 16 + bias;
  const bottomL = 9 + bias;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 14% ${topL}%) 0%, hsl(${hue} 18% ${bottomL}%) 100%)`,
    color: `hsl(${hue} 20% 88%)`,
    boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.04)",
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
  canDelete, onDelete, currentUsername, avatarByUser,
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
  avatarByUser: Map<string, string>;
}) {
  const isGeneral = group.type === "general";
  // Route every render through the central displayName helper. Storage
  // keys ("dm::Ali::Mason", "dm::Ali::Mason::Sem") never leak to UI:
  //   1:1            → other person's name
  //   self-DM        → "Me"
  //   DM with Axon   → "Axon"
  //   group ≤4       → comma-separated other names
  //   group >4       → "Mason, Sem, blazehp +2"  (text fallback;
  //                    avatar-stack render is a future visual upgrade)
  //   channels       → unchanged
  const displayName = displayLabelForDM(group.name, currentUsername);
  const isOneOnOne = isOneOnOneDM(group.name, currentUsername);
  // PresenceDot needs the OTHER person's actual username (not "Me",
  // not the comma-joined group label). Falls back to displayName for
  // legacy non-DM rows where the helper returns null.
  const presenceTarget = dmOtherParty(group.name, currentUsername) ?? displayName;

  // Who's in a live huddle on THIS channel right now (excluding me —
  // I already know I'm in if I am). Pulls from the global lobby
  // presence subscribed to by HuddleHost. NO_PARTICIPANTS is a stable
  // module-scope ref — see comment near the import.
  const inCall = useLiveHuddlesStore((s) => s.byChannel.get(group.name) ?? NO_PARTICIPANTS);
  const inCallOthers = inCall.filter((u) => u !== currentUsername);
  const meInThisCall = inCall.includes(currentUsername);
  const myCurrentHuddle = useHuddleStore((s) => s.group);
  const startHuddle = useHuddleStore((s) => s.startHuddle);

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
            <div className="relative shrink-0">
              <div
                className="h-8 w-8 rounded-md border border-border flex items-center justify-center font-semibold text-[11px] shadow-sm"
                style={groupAvatarStyle(displayName)}
              >
                {groupAvatarInitials(displayName)}
              </div>
              {/* Online/offline dot — only meaningful for 1-on-1 DMs
                  where "displayName" is a real person. For group chats
                  and channels there's no single person to surface
                  presence for, so we skip it. */}
              {isOneOnOne && (
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot username={presenceTarget} size={10} />
                </span>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[12px] font-medium truncate ${
                isActive ? "text-foreground" : unread > 0 ? "text-foreground" : "text-foreground/80"
              }`}>
                {displayName}
              </span>
              <UnreadBadge count={unread} />
            </div>
            <p className="text-[10px] text-muted-foreground/75 truncate mt-0.5">
              {isGeneral
                ? "Company-wide"
                : isOneOnOne
                  ? "Direct message"
                  : `${group.subscribers?.length || 0} members`}
            </p>
            {/* Live in-call indicator. Shows when at least one person is
                huddled on this channel right now. Click "Join" to drop
                into the call without having to open it first. */}
            {inCall.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  <Phone className="h-2.5 w-2.5" />
                  {inCall.length} in call
                </span>
                {/* Face-pile of up to 3 avatars. Real images when
                    available; falls back to initials chip if the
                    avatar URL is missing or fails to load. */}
                <div className="flex -space-x-1">
                  {inCall.slice(0, 3).map((u) => {
                    const isMe = u === currentUsername;
                    const src = avatarByUser.get(u) ?? null;
                    return (
                      <FaceChip
                        key={u}
                        username={u}
                        src={src}
                        isMe={isMe}
                      />
                    );
                  })}
                  {inCall.length > 3 && (
                    <span className="inline-flex h-4 items-center px-1 text-[9px] text-muted-foreground">
                      +{inCall.length - 3}
                    </span>
                  )}
                </div>
                {/* Quick join — only if I'm not already in this call AND
                    I'm not in a different call. */}
                {!meInThisCall && !myCurrentHuddle && inCallOthers.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(group.name);
                      startHuddle(group.name);
                    }}
                    className="ml-auto rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-400 hover:bg-emerald-500/30"
                  >
                    JOIN
                  </button>
                )}
                {meInThisCall && (
                  <span className="ml-auto text-[9px] tracking-wider text-emerald-400/70">
                    YOU&apos;RE IN
                  </span>
                )}
              </div>
            )}
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

/** Single chip in the live-call face-pile. Renders the user's avatar
 *  image when available, falls back to initials when the URL is
 *  missing or the image fails to load (404, network error, etc.).
 *  The "me" variant gets a red ring so the operator can spot
 *  themselves at a glance. */
function FaceChip({
  username,
  src,
  isMe,
}: {
  username: string;
  src: string | null;
  isMe: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const initials = username.slice(0, 2).toUpperCase();
  const ringStyle = isMe ? { borderColor: "rgb(239,68,68)" } : undefined;
  const titleText = username + (isMe ? " (you)" : "");

  return showImage ? (
    <img
      src={src!}
      alt={username}
      title={titleText}
      onError={() => setFailed(true)}
      className="h-4 w-4 rounded-full border border-border object-cover bg-muted"
      style={ringStyle}
    />
  ) : (
    <span
      title={titleText}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-[8px] font-bold text-foreground/80"
      style={ringStyle}
    >
      {initials}
    </span>
  );
}
