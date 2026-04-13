import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/shadcnComponents/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/shadcnComponents/sidebar";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { useRolePreview } from "@/stores/store";

interface NavUserProps {
  userData: {
    name: string;
    email: string;
    avatar: string;
  };
}

export function NavUser({ }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { data: activeuser } = ActiveUser();
  const { previewRole } = useRolePreview();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Error Signing Out:", error.message);
    } else {
      localStorage.removeItem("isLoggedIn");
      window.location.reload();
    }
  };

  const user = activeuser[0] || {
    username: "Unknown",
    email: "unknown@example.com",
    avatar: "/public/codewithali_logo.png",
    role: "Member",
    avatarURL: "",
  };

  const displayRole = previewRole || user.role;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-white/[0.04] data-[state=open]:text-white hover:bg-white/[0.03] rounded-sm transition-colors"
            >
              <Avatar className="h-7 w-7 rounded-sm border border-white/[0.06]">
                <AvatarImage
                  src={user.avatarURL}
                  alt={user.username}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-sm bg-white/[0.04] text-white/40 text-[10px]">
                  {user.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-white/80 text-[13px]">{user.username}</span>
                <span className="truncate text-[11px] text-white/25">
                  {displayRole}
                  {previewRole && (
                    <span className="ml-1 text-red-400/60">(preview)</span>
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-white/15" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 bg-[#0a0a0a] border border-white/[0.06] rounded-sm"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-sm border border-white/[0.06]">
                  <AvatarImage src={user.avatarURL} alt={user.username} className="object-cover" />
                  <AvatarFallback className="rounded-sm bg-white/[0.04] text-white/40 text-[10px]">
                    {user.username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-white/80 text-[13px]">{user.username}</span>
                  <span className="truncate text-[11px] text-white/25">{displayRole}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/[0.04]" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-white/50 hover:text-white hover:bg-white/[0.04] cursor-pointer rounded-sm text-[12px]">
                <Sparkles className="h-3.5 w-3.5 mr-2 text-white/20" />
                Profile Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-white/[0.04]" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-white/50 hover:text-white hover:bg-white/[0.04] cursor-pointer rounded-sm text-[12px]">
                <BadgeCheck className="h-3.5 w-3.5 mr-2 text-white/20" />
                My Tasks
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/50 hover:text-white hover:bg-white/[0.04] cursor-pointer rounded-sm text-[12px]">
                <CreditCard className="h-3.5 w-3.5 mr-2 text-white/20" />
                Manage Teams
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/50 hover:text-white hover:bg-white/[0.04] cursor-pointer rounded-sm text-[12px]">
                <Bell className="h-3.5 w-3.5 mr-2 text-white/20" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-white/[0.04]" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] cursor-pointer rounded-sm text-[12px]">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
